# Contrato do executável de runtime no host (`plc_host_runner`)

**Status:** contrato publicado antes da implementação · **Data:** 2026-09-15 ·
**Contexto:** spec 001 (caminho curto, `docs/workflow.md`)

Este documento fixa a interface de processo do executável que roda a lógica IEC
compilada **no host**, sem ESP32. Ele existe porque duas frentes de trabalho
programam contra ele em paralelo: quem o implementa (runtime em C) e quem o
consome (arcabouço de teste diferencial). Sem o contrato escrito antes, cada
lado inventaria um formato diferente.

É também o **ponto de extensão** que torna aditiva a comparação futura com o
simulador de F9: qualquer processo que respeite esta interface é um *executor*
válido, e o runner de comparação não precisa saber se do outro lado há C ou
TypeScript.

## Por que o contrato fala em endereço IEC, não em GPIO

A comparação que interessa ao TCC é **simulação ↔ runtime**. O simulador (F9)
roda no navegador e conhece `%QX0.0`; ele não sabe — nem deve saber — que
`%QX0.0` é o GPIO2 de uma DevKit v1. O mapeamento para pino é específico do
alvo ESP32 e vive em `plc_io_map.h`.

Por isso a interface padrão é em **endereço IEC**. O modo elétrico, em nível de
pino, existe à parte e serve a outra pergunta (a inversão de `active_low`), que
é do runtime e não do simulador.

## Modo padrão — endereço IEC

```
plc_host_runner <arquivo.st>
```

**Entrada (stdin):** uma linha por ciclo de varredura. Cada linha traz os
endereços de entrada e seus valores lógicos, separados por espaço. Linha vazia
significa "nenhuma mudança em relação ao ciclo anterior". O número de linhas
determina quantos ciclos são executados.

```
%IX0.0=0 %IX0.1=0
%IX0.0=1
```

**Saída (stdout):** uma linha por ciclo, com o valor lógico de **todas** as
saídas depois daquele ciclo, em ordem crescente de endereço.

```
ciclo=1 %QX0.0=0 %QX0.1=0
ciclo=2 %QX0.0=1 %QX0.1=0
```

**Código de saída:** `0` se executou os ciclos pedidos. Diferente de `0` se o
`iec2c` ou o `gcc` falharam, ou se a entrada é malformada — nesse caso a saída
bruta da ferramenta vai para stderr, íntegra, no mesmo espírito do campo `raw`
da Q-3.

## Modo elétrico — nível de pino

```
plc_host_runner --eletrico <arquivo.st>
```

Mesma estrutura, mas entradas e saídas são **níveis elétricos de GPIO** (`0`/`1`),
na forma `gpio18=0`. É o modo que permite verificar a inversão de `active_low`
e a ligação endereço ↔ pino, comportamento do runtime do ESP32 que o simulador
não tem e com o qual não se compara.

```
$ printf 'gpio0=1\ngpio0=0\n' | plc_host_runner --eletrico blink.st
ciclo=1 gpio2=0 gpio4=0
ciclo=2 gpio2=1 gpio4=0
```

(`%IX0.0` é `active_low`: `gpio0=1` é o botão **solto**.)

## O que o contrato deliberadamente não cobre

- **Tempo de ciclo real.** O host executa os ciclos em sequência, o mais rápido
  possível; o relógio é controlado, não medido. Tempo de varredura no
  dispositivo é medição de bancada — ver `ca-4-gravacao-esp32.md`.
- **Estado elétrico dos pinos.** Um nível em memória não é uma tensão em um
  pino. Ver `limites-da-validacao-sem-hardware.md`.
