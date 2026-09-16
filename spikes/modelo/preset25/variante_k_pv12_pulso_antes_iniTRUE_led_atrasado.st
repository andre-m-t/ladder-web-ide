(* Variante K (orquestrador, 2026-09-16): PV=12, pulso realinhado ao atingir o
   limite; ordem=pulso_antes, pulso inicial=TRUE, realinhamento=FALSE; LED alterna com o limite atrasado 1 ciclo (reset_ctu). *)
PROGRAM prog0
  VAR
    botao AT %IX0.0 : BOOL;
    led   AT %QX0.0 : BOOL;
  END_VAR
  VAR
    pulso            : BOOL := TRUE;
    reset_ctu        : BOOL;
    atingiu          : BOOL;
    led_estava_aceso : BOOL;
    ctu0             : CTU;
  END_VAR

  pulso := NOT pulso;
  ctu0(CU := pulso, R := reset_ctu, PV := 12);
  atingiu := ctu0.Q;
  IF atingiu THEN
    pulso := FALSE;
  END_IF;
  led_estava_aceso := led;
  IF reset_ctu AND NOT led_estava_aceso THEN
    led := TRUE;
  END_IF;
  IF reset_ctu AND led_estava_aceso THEN
    led := FALSE;
  END_IF;
  reset_ctu := atingiu;
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
