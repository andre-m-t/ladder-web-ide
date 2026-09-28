(* Gerado pelo LadderFlow a partir de um diagrama Ladder. Nao editar. *)
PROGRAM prog0
  VAR
    abrir AT %IX0.0 : BOOL;
    fechar AT %IX0.1 : BOOL;
    parar AT %IX0.2 : BOOL;
    fc_superior AT %IX0.3 : BOOL;
    fc_inferior AT %IX0.4 : BOOL;
    motor_sobe AT %QX0.0 : BOOL;
    motor_desce AT %QX0.1 : BOOL;
    lamp_entreaberto AT %QX0.2 : BOOL;
    lamp_aberto AT %QX0.3 : BOOL;
    lamp_fechado AT %QX0.4 : BOOL;
  END_VAR

  (* degrau 1 *)
  motor_sobe := abrir AND parar AND fc_superior;
  (* degrau 2 *)
  motor_desce := fechar AND parar AND NOT fc_inferior;
  (* degrau 3 *)
  lamp_aberto := NOT fc_superior;
  (* degrau 4 *)
  lamp_fechado := fc_inferior;
  (* degrau 5 *)
  lamp_entreaberto := fc_superior AND NOT fc_inferior;
END_PROGRAM

CONFIGURATION Config0
  RESOURCE Res0 ON PLC
    TASK task0(INTERVAL := T#20ms, PRIORITY := 0);
    PROGRAM instance0 WITH task0 : prog0;
  END_RESOURCE
END_CONFIGURATION
