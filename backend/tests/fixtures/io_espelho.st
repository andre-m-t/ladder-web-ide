(* ST secundario para a validacao de bancada da Tarefa 4 (procedimento em
   docs/validacao/ca-4-gravacao-esp32.md), NAO usado no teste automatizado.
   Espelha a entrada %IX0.1 (GPIO18, revisao Q-5 de 2026-09-15) na saida
   %QX0.1 (GPIO4): aterrar GPIO18 deve acender a saida em GPIO4. Complementa
   blink.st (Q-1), que so exercita %IX0.0/%QX0.0 -- este cobre o segundo par
   de pinos do mapa em backend/firmware/esp32-template/main/plc_io_map.h.

   Este arquivo nao tem fixture correspondente em conftest.py: e insumo
   manual para gravar na placa durante a bancada, nao entrada de pytest.

   As variaveis localizadas ficam em um bloco VAR proprio: o iec2c nao aceita
   declaracao localizada e nao-localizada no mesmo bloco.
   Sem acentos: mantem o arquivo em ASCII puro para o compilador. *)

PROGRAM prog0
  VAR
    entrada AT %IX0.1 : BOOL;
    saida   AT %QX0.1 : BOOL;
  END_VAR

  saida := entrada;
END_PROGRAM

CONFIGURATION Config0
  RESOURCE Res0 ON PLC
    TASK task0(INTERVAL := T#20ms, PRIORITY := 0);
    PROGRAM instance0 WITH task0 : prog0;
  END_RESOURCE
END_CONFIGURATION
