(* Gerado pelo LadderFlow a partir de um diagrama Ladder. Nao editar. *)
PROGRAM prog0
  VAR
    entrada0 AT %IX0.0 : BOOL;
    entrada1 AT %IX0.1 : BOOL;
    entrada2 AT %IX0.2 : BOOL;
    entrada3 AT %IX0.3 : BOOL;
    entrada4 AT %IX0.4 : BOOL;
    entrada5 AT %IX0.5 : BOOL;
    entrada6 AT %IX0.6 : BOOL;
    entrada7 AT %IX0.7 : BOOL;
    saida0 AT %QX0.0 : BOOL;
    saida1 AT %QX0.1 : BOOL;
    saida2 AT %QX0.2 : BOOL;
    saida3 AT %QX0.3 : BOOL;
    saida4 AT %QX0.4 : BOOL;
    saida5 AT %QX0.5 : BOOL;
    saida6 AT %QX0.6 : BOOL;
    saida7 AT %QX0.7 : BOOL;
  END_VAR

  (* degrau 1 *)
  saida0 := entrada0;
  (* degrau 2 *)
  saida1 := entrada1;
  (* degrau 3 *)
  saida2 := entrada2;
  (* degrau 4 *)
  saida3 := entrada3;
  (* degrau 5 *)
  saida4 := entrada4;
  (* degrau 6 *)
  saida5 := entrada5;
  (* degrau 7 *)
  saida6 := entrada6;
  (* degrau 8 *)
  saida7 := entrada7;
END_PROGRAM

CONFIGURATION Config0
  RESOURCE Res0 ON PLC
    TASK task0(INTERVAL := T#20ms, PRIORITY := 0);
    PROGRAM instance0 WITH task0 : prog0;
  END_RESOURCE
END_CONFIGURATION
