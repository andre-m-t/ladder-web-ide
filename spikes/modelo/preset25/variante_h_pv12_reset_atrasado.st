(* Variante D -- PV=13, reset com 1 ciclo de atraso EXTRA (2 scans no total,
   em vez do minimo de 1 -- ver variante A) frente ao momento em que
   `atingiu` fica verdadeiro. Testa a celula da matriz "reset imediato
   (minimo possivel, variante A) vs atrasado" pedida no enunciado.

   Para conseguir um segundo scan de atraso sem tocar no elemento `ctu` (que
   so aceita R vindo de um caminho de contatos), uso DOIS estagios de
   bobina -- mas a ORDEM dos rungs importa (isto foi corrigido depois de
   medir: a primeira versao desta variante, com os dois rungs na ordem
   "contrario", nao acrescentava atraso nenhum -- ver NOTA DE MEDICAO no
   fim deste comentario):

     Rung 3 (ANTES do estagio 1): reset_ctu := reset_estagio1
       -- le reset_estagio1 como estava NO INICIO deste scan (o rung
       seguinte ainda nao o atualizou), ou seja o valor que o rung 4
       escreveu no scan ANTERIOR.
     Rung 4 (DEPOIS): reset_estagio1 := atingiu
       -- atualiza com o `atingiu` fresco deste mesmo scan.

   Com essa ordem: reset_estagio1(n) = atingiu(n); reset_ctu(n) =
   reset_estagio1(n-1) [valor pre-atualizacao] = atingiu(n-1). O `R` usado
   pela chamada do CTU no scan n+1 e reset_ctu(n) = atingiu(n-1) -- 2 scans
   de atraso frente a atingiu(n), 1 scan a mais que a variante A (que da
   R(n+1) = atingiu(n)).

   Ladder (ASCII):

   Rung 1 (pulso):
   ====|/pulso|==================( pulso )====

   Rung 2 (contador, mesmo desenho da variante A):
   ====|pulso|===+==[ CTU PV=13 ]===saida=atingiu====
                 %
                 +--|reset_ctu|--+

   Rung 3 (le o estagio 1 ANTES dele ser atualizado neste mesmo scan --
           e o que da o segundo scan de atraso):
   ====|reset_estagio1|===========( reset_ctu )====

   Rung 4 (so agora atualiza o estagio 1 com o `atingiu` fresco):
   ====|atingiu|=================( reset_estagio1 )====

   Rung 5 (instantaneo de led, igual a variante A):
   ====|led|======================( led_estava_aceso )====

   Rung 6 (liga led):
   ====|atingiu|==|/led_estava_aceso|========(S led )====

   Rung 7 (desliga led):
   ====|atingiu|==|led_estava_aceso|=========(R led )====

   Rung 8 (botao):
   ====|botao|====================(S led )====

   ST derivado:
     pulso := NOT pulso;
     ctu0(CU := pulso, R := reset_ctu, PV := 12);
     atingiu := ctu0.Q;
     reset_ctu := reset_estagio1;
     reset_estagio1 := atingiu;
     led_estava_aceso := led;
     IF atingiu AND NOT led_estava_aceso THEN led := TRUE; END_IF;
     IF atingiu AND led_estava_aceso THEN led := FALSE; END_IF;
     IF botao THEN led := TRUE; END_IF;

   NOTA DE MEDICAO (achado no proprio processo de montar esta variante, nao
   so no experimento original): a primeira tentativa de escrever este atraso
   extra colocou "reset_estagio1 := atingiu" ANTES de "reset_ctu :=
   reset_estagio1", isto e, deixou o valor fresco de `atingiu` atravessar os
   dois estagios NO MESMO SCAN (rung3 grava reset_estagio1(n)=atingiu(n);
   rung4, logo em seguida, ja le esse valor fresco e grava
   reset_ctu(n)=atingiu(n) -- zero atraso ADICIONAL, resultado identico ao
   da variante A). So a ordem escrita acima (ler o estagio seguinte ANTES de
   atualizar o anterior) de fato empurra 1 scan a mais -- e a mesma logica,
   inversa, de por que a variante A ja e o atraso MINIMO possivel (rung do
   reset depois do rung do CTU): o numero de scans de atraso de uma cadeia
   de bobinas depende de QUAL lado da cadeia e lido antes do outro ser
   escrito, nao so de quantos estagios existem. Medido com medir.py: a
   PRIMEIRA versao (sem atraso extra de fato) deu os MESMOS 22/22/21
   divergencias da variante A; esta versao corrigida e a que aparece na
   tabela de RESULTADO.md como "variante D". *)

PROGRAM prog0
  VAR
    botao AT %IX0.0 : BOOL;
    led   AT %QX0.0 : BOOL;
  END_VAR
  VAR
    pulso            : BOOL;
    reset_estagio1   : BOOL;
    reset_ctu        : BOOL;
    atingiu          : BOOL;
    led_estava_aceso : BOOL;
    ctu0             : CTU;
  END_VAR

  (* Rung 1 *)
  pulso := NOT pulso;

  (* Rung 2 *)
  ctu0(CU := pulso, R := reset_ctu, PV := 12);
  atingiu := ctu0.Q;

  (* Rung 3 -- le reset_estagio1 ANTES do rung 4 atualiza-lo (2o scan de atraso) *)
  reset_ctu := reset_estagio1;

  (* Rung 4 -- so agora atualiza com o atingiu fresco deste scan *)
  reset_estagio1 := atingiu;

  (* Rung 5 *)
  led_estava_aceso := led;

  (* Rung 6 *)
  IF atingiu AND NOT led_estava_aceso THEN
    led := TRUE;
  END_IF;

  (* Rung 7 *)
  IF atingiu AND led_estava_aceso THEN
    led := FALSE;
  END_IF;

  (* Rung 8 *)
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
