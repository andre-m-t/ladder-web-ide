(* Variante J (orquestrador, 2026-09-16): PV=12, pulso realinhado ao atingir o
   limite; ordem=ctu_antes, pulso inicial=FALSE, valor de realinhamento=FALSE. *)
PROGRAM prog0
  VAR
    botao AT %IX0.0 : BOOL;
    led   AT %QX0.0 : BOOL;
  END_VAR
  VAR
    pulso            : BOOL := FALSE;
    reset_ctu        : BOOL;
    atingiu          : BOOL;
    led_estava_aceso : BOOL;
    ctu0             : CTU;
  END_VAR

  ctu0(CU := pulso, R := reset_ctu, PV := 12);
  atingiu := ctu0.Q;
  IF atingiu THEN
    pulso := FALSE;
  END_IF;
  pulso := NOT pulso;
  reset_ctu := atingiu;
  led_estava_aceso := led;
  IF atingiu AND NOT led_estava_aceso THEN
    led := TRUE;
  END_IF;
  IF atingiu AND led_estava_aceso THEN
    led := FALSE;
  END_IF;
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
