/**
 * ST de exemplo pré-carregado na tela (Q-1 da spec 001).
 *
 * Cópia de `backend/tests/fixtures/blink.st` — o mesmo ST canônico usado nos
 * testes do serviço de compilação, para que o exemplo do editor e o exemplo
 * validado no back-end nunca divirjam silenciosamente. Código autoral do
 * projeto.
 */
export const BLINK_ST = `(* Programa canonico de teste da fatia vertical (decisao Q-1 da spec 001).
   Pisca a saida %QX0.0 -- o LED embarcado da DevKit v1, GPIO2 -- contando
   ciclos de varredura: 25 ciclos de 20 ms = 500 ms ligado, 500 ms desligado.
   Enquanto a entrada %IX0.0 (botao BOOT, GPIO0) estiver acionada, o LED fica
   aceso, o que prova o caminho de leitura de entrada no mesmo programa.

   As variaveis localizadas ficam em um bloco VAR proprio: o iec2c nao aceita
   declaracao localizada e nao-localizada no mesmo bloco.
   Sem acentos: mantem o arquivo em ASCII puro para o compilador. *)

PROGRAM prog0
  VAR
    botao AT %IX0.0 : BOOL;
    led   AT %QX0.0 : BOOL;
  END_VAR
  VAR
    contador : UINT;
  END_VAR

  contador := contador + 1;
  IF contador >= 25 THEN
    contador := 0;
    led := NOT led;
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
`
