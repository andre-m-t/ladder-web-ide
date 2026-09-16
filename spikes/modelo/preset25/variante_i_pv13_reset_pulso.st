(* Variante A -- BASELINE do preset25 (spikes/modelo/NOTAS.md, "Experimento
   BLINK"). E o mesmo desenho/ST de spikes/modelo/blink_ladder.st (PV=13),
   reproduzido aqui como ponto de partida da matriz, para todas as variantes
   ficarem juntas e serem medidas pelo mesmo medir.py. Ver RESULTADO.md para
   a tabela comparativa.

   Ladder (ASCII; "%" = ramo paralelo na linha 1):

   Rung 1 (pulso, oscilador de 1 ciclo):
   ====|/pulso|==================( pulso )====

   Rung 2 (contador):
   ====|pulso|===+==[ CTU PV=13 ]===saida=atingiu====
                 %
                 +--|reset_ctu|--+   (ramo linha 1, alimenta R)

   Rung 3 (agenda reset, MINIMO de 1 ciclo de atraso -- e o proprio Q lido
           1 ciclo depois, por construcao: nao ha como um CTU usar seu
           proprio Q como R na MESMA chamada -- ver RESULTADO.md, prova):
   ====|atingiu|=================( reset_ctu )====

   Rung 4 (instantaneo de led, evita auto-cancelamento SET/RESET no mesmo
           scan -- ver NOTAS.md, "Risco descoberto no experimento"):
   ====|led|======================( led_estava_aceso )====

   Rung 5 (liga led):
   ====|atingiu|==|/led_estava_aceso|========(S led )====

   Rung 6 (desliga led):
   ====|atingiu|==|led_estava_aceso|=========(R led )====

   Rung 7 (botao, igual ao blink.st original):
   ====|botao|====================(S led )====

   ST derivado (ordem de leitura = ordem de execucao):
     pulso := NOT pulso;
     ctu0(CU := pulso, R := reset_ctu, PV := 13);
     atingiu := ctu0.Q;
     reset_ctu := atingiu;
     led_estava_aceso := led;
     IF atingiu AND NOT led_estava_aceso THEN led := TRUE; END_IF;
     IF atingiu AND led_estava_aceso THEN led := FALSE; END_IF;
     IF botao THEN led := TRUE; END_IF;

   Sem acentos: ASCII puro para o compilador. *)

PROGRAM prog0
  VAR
    botao AT %IX0.0 : BOOL;
    led   AT %QX0.0 : BOOL;
  END_VAR
  VAR
    pulso            : BOOL;
    reset_ctu        : BOOL;
    atingiu          : BOOL;
    led_estava_aceso : BOOL;
    ctu0             : CTU;
  END_VAR

  (* Rung 1 *)
  pulso := NOT pulso;

  (* Rung 2 *)
  ctu0(CU := pulso, R := reset_ctu, PV := 13);
  atingiu := ctu0.Q;

  (* Rung 2b -- reset de pulso ao atingir: realinha a grade de bordas *)
  IF atingiu THEN
    pulso := FALSE;
  END_IF;

  (* Rung 3 -- reset com o atraso MINIMO possivel (1 scan) *)
  reset_ctu := atingiu;

  (* Rung 4 -- instantaneo de led *)
  led_estava_aceso := led;

  (* Rung 5 *)
  IF atingiu AND NOT led_estava_aceso THEN
    led := TRUE;
  END_IF;

  (* Rung 6 *)
  IF atingiu AND led_estava_aceso THEN
    led := FALSE;
  END_IF;

  (* Rung 7 *)
  IF botao THEN
    led := TRUE;
  END_IF;
END_PROGRAM

CONFIGURATION Config0
  RESOURCE Res0 ON PLC
    TASK task0(INTERVAL := T#20ms, PRIORITY := 0);
    PROGRAM instance0 WITH task0 : prog0;
  END_RESOURCE
END_CONFIGURATION
