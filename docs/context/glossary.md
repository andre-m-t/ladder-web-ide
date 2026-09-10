# Glossário — LadderFlow

Vocabulário comum para specs, planos e código. Use estes termos de forma
consistente.

---

## Linguagem Ladder e IEC 61131-3

| Termo | Definição |
|---|---|
| **IEC 61131-3** | Norma internacional que define as linguagens de programação para controladores programáveis. O LadderFlow implementa um subconjunto de LD e ST. |
| **Ladder / LD (Ladder Diagram)** | Linguagem gráfica que representa a lógica como "degraus" entre duas trilhas de energia, análoga a diagramas de relés. |
| **Structured Text / ST** | Linguagem textual da IEC 61131-3, sintaxe tipo Pascal. É o formato canônico para o qual o diagrama Ladder é serializado antes da compilação. |
| **Rung (degrau)** | Uma linha horizontal do diagrama Ladder: uma expressão lógica que energiza (ou não) suas saídas. |
| **Contato** | Elemento de entrada de um rung. Normalmente aberto (NA / `--| |--`) conduz quando a variável é verdadeira; normalmente fechado (NF / `--|/|--`) conduz quando falsa. |
| **Bobina (coil)** | Elemento de saída de um rung (`--( )--`). Recebe o resultado lógico do degrau e atribui a uma variável de saída. |
| **Ciclo de varredura (scan cycle)** | O laço de execução do controlador: lê entradas → avalia toda a lógica uma vez → escreve saídas → repete. O simulador do LadderFlow reproduz esse ciclo no navegador. |
| **Serialização Ladder → ST** | Conversão do diagrama de contatos/bobinas em código Structured Text equivalente. |
| **Subconjunto suportado** | O conjunto de elementos da IEC 61131-3 que o LadderFlow reconhece. Declarado explicitamente em cada spec relevante; elementos fora dele são recusados. |

## Compilação e hardware

| Termo | Definição |
|---|---|
| **MATIEC** | Compilador open-source (GPL-3.0) que traduz ST/IL da IEC 61131-3 para C ANSI. Invocado como processo externo. |
| **`iec2c`** | O executável do MATIEC usado pelo LadderFlow: recebe um arquivo ST e emite C. |
| **Toolchain ESP32** | Conjunto de compilador/linker que transforma o C gerado em firmware binário para o ESP32. |
| **Firmware / binário** | Artefato final gravável no microcontrolador, produzido pelo serviço de compilação. |
| **ESP32 (clássico)** | Microcontrolador alvo. Variantes (S2, S3, C3, …) não são validadas. |
| **Web Serial API** | API do navegador (Chromium 89+) que dá à página acesso a portas seriais. Só funciona em contexto seguro (HTTPS ou `localhost`). |
| **esptool-js** | Biblioteca da Espressif (Apache-2.0) que implementa o protocolo de gravação do ESP32 sobre a Web Serial API. |
| **Contexto seguro** | Origem HTTPS ou `localhost`. Pré-requisito da Web Serial API. |
| **Gravação (flash)** | Transferência do firmware para a memória do ESP32 a partir do navegador. |

## Projeto

| Termo | Definição |
|---|---|
| **Fatia vertical** | Um caminho fim-a-fim mínimo que atravessa todas as camadas (edição → compilação → gravação), por mais estreito que seja. |
| **SDD (Spec-Driven Development)** | Método deste projeto: `spec → plan → tasks → código`, com aprovação humana entre fases. |
| **INPI** | Instituto Nacional da Propriedade Industrial. O LadderFlow está em processo de registro de programa de computador (Lei 9.609/1998). |
| **NIT** | Núcleo de Inovação Tecnológica da instituição; define os termos de licenciamento junto com os autores. |
