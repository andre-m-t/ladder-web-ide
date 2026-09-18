(* Gerado pelo LadderFlow a partir de um diagrama Ladder. Nao editar. *)
PROGRAM prog0
  VAR
    a AT %IX0.0 : BOOL;
    b AT %IX0.1 : BOOL;
    q AT %QX0.0 : BOOL;
  END_VAR

  (* degrau 1 *)
  q := a OR b;
END_PROGRAM

CONFIGURATION Config0
  RESOURCE Res0 ON PLC
    TASK task0(INTERVAL := T#20ms, PRIORITY := 0);
    PROGRAM instance0 WITH task0 : prog0;
  END_RESOURCE
END_CONFIGURATION
