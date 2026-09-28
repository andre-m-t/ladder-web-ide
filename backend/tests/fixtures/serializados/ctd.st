(* Gerado pelo LadderFlow a partir de um diagrama Ladder. Nao editar. *)
PROGRAM prog0
  VAR
    pulso AT %IX0.0 : BOOL;
    carregar AT %IX0.1 : BOOL;
    vazio AT %QX0.0 : BOOL;
  END_VAR
  VAR
    ctd0 : CTD;
  END_VAR

  (* degrau 1 *)
  ctd0(CD := pulso, LD := carregar, PV := 3);
  vazio := ctd0.Q;
END_PROGRAM

CONFIGURATION Config0
  RESOURCE Res0 ON PLC
    TASK task0(INTERVAL := T#20ms, PRIORITY := 0);
    PROGRAM instance0 WITH task0 : prog0;
  END_RESOURCE
END_CONFIGURATION
