(* Gerado pelo LadderFlow a partir de um diagrama Ladder. Nao editar. *)
PROGRAM prog0
  VAR
    gate AT %IX0.0 : BOOL;
    saida AT %QX0.0 : BOOL;
  END_VAR
  VAR
    tof0 : TOF;
  END_VAR

  (* degrau 1 *)
  tof0(IN := gate, PT := T#100ms);
  saida := tof0.Q;
END_PROGRAM

CONFIGURATION Config0
  RESOURCE Res0 ON PLC
    TASK task0(INTERVAL := T#20ms, PRIORITY := 0);
    PROGRAM instance0 WITH task0 : prog0;
  END_RESOURCE
END_CONFIGURATION
