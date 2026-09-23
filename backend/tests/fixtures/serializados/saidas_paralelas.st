(* Gerado pelo LadderFlow a partir de um diagrama Ladder. Nao editar. *)
PROGRAM prog0
  VAR
    entrada AT %IX0.0 : BOOL;
    saida_a AT %QX0.0 : BOOL;
    saida_b AT %QX0.1 : BOOL;
  END_VAR

  (* degrau 1 *)
  saida_a := entrada;
  saida_b := entrada;
END_PROGRAM

CONFIGURATION Config0
  RESOURCE Res0 ON PLC
    TASK task0(INTERVAL := T#20ms, PRIORITY := 0);
    PROGRAM instance0 WITH task0 : prog0;
  END_RESOURCE
END_CONFIGURATION
