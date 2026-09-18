(* Gerado pelo LadderFlow a partir de um diagrama Ladder. Nao editar. *)
PROGRAM prog0
  VAR
    partida AT %IX0.0 : BOOL;
    parada AT %IX0.1 : BOOL;
    motor AT %QX0.0 : BOOL;
  END_VAR

  (* degrau 1 *)
  motor := (partida OR motor) AND NOT parada;
END_PROGRAM

CONFIGURATION Config0
  RESOURCE Res0 ON PLC
    TASK task0(INTERVAL := T#20ms, PRIORITY := 0);
    PROGRAM instance0 WITH task0 : prog0;
  END_RESOURCE
END_CONFIGURATION
