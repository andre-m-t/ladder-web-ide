(* Programa minimo valido em Structured Text (IEC 61131-3).
   Existe apenas para provar que o iec2c esta operacional no container.
   Sem acentos: mantem o arquivo em ASCII puro para o compilador. *)

PROGRAM prog0
  VAR
    entrada : BOOL;
    saida   : BOOL;
  END_VAR

  saida := NOT entrada;
END_PROGRAM

CONFIGURATION Config0
  RESOURCE Res0 ON PLC
    TASK task0(INTERVAL := T#20ms, PRIORITY := 0);
    PROGRAM instance0 WITH task0 : prog0;
  END_RESOURCE
END_CONFIGURATION
