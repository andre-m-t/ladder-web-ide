(* ST derivado a mao do Ladder BLINK de spikes/modelo/fixtures.ts (ver
   NOTAS.md, "Experimento BLINK"). NAO e uma traducao de backend/tests/
   fixtures/blink.st -- e o ST equivalente ao DESENHO alternativo que usa
   contato NA/NF, ramo paralelo, bobina SET/RESET e um CTU (bloco de funcao
   padrao IEC, ja embutido na lib do MATIEC) para contar ciclos de varredura.

   Ordem dos rungs = ordem de leitura do Ladder, de cima para baixo:

   Rung 1 (pulso):        contato NF(pulso) -- bobina(pulso)
   Rung 2 (contador):     contato NA(pulso) -+- CTU(CU, R, PV:=13) -- saida=atingiu
                            ramo: contato NA(reset_ctu) -+  (retroalimenta o pino R)
   Rung 3 (agenda reset): contato NA(atingiu) -- bobina(reset_ctu)
   Rung 4 (instantaneo):  contato NA(led) -- bobina(led_estava_aceso)
   Rung 5 (liga led):     contato NA(atingiu) -- contato NF(led_estava_aceso) -- bobina SET(led)
   Rung 6 (desliga led):  contato NA(atingiu) -- contato NA(led_estava_aceso) -- bobina RESET(led)
   Rung 7 (botao):        contato NA(botao) -- bobina SET(led)      [igual ao blink.st]

   O rung 4 (instantaneo de `led`) NAO estava no primeiro desenho. Foi
   acrescentado depois de rodar o experimento e medir o resultado errado --
   ver NOTAS.md, "Risco descoberto no experimento", para o relato completo do
   porque os rungs 5/6, lendo `led` ao vivo, se auto-cancelavam no mesmo scan.

   Sem acentos: mantem o arquivo em ASCII puro para o compilador (mesma
   convencao dos .st de backend/tests/fixtures/). *)

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

  (* Rung 3 -- reset de 1 scan de atraso: e uma das duas fontes de
     divergencia medidas (ver NOTAS.md). *)
  reset_ctu := atingiu;

  (* Rung 4 -- instantaneo de led, lido pelos rungs 5/6 no lugar de `led` ao
     vivo (ver cabecalho). *)
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
