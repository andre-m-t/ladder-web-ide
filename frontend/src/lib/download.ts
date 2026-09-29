/**
 * Download de projeto no cliente (rodada de UX, frente D).
 *
 * A aba "ST gerado" saiu da tela; no lugar, o cabeçalho ganha um botão de
 * download (`MenuDownload`, ao lado do Compilar) com opções: envelope do
 * projeto em JSON, texto Structured Text, PLCopen XML e pacote de firmware
 * ESP32 em ZIP. Este módulo não decide *quando* cada opção está disponível
 * (isso é do `App`) — só monta nome de arquivo, conteúdo e o download em si.
 *
 * Puro, sem estado: `baixarBlob` / `baixarTexto` usam `<a download>`
 * temporário — `Blob` + `URL.createObjectURL`, anexa, `click()`, remove,
 * revoga a URL (adiada com `setTimeout`).
 */
import type { Pacote } from './api'

/** Remove acentos e outros diacríticos de `texto` via decomposição Unicode
 * (NFD) seguida da remoção dos marcadores de combinação (categoria Mn). */
function semAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Deriva um nome de arquivo a partir do título do projeto: ASCII minúsculo,
 * sem acentos, com qualquer caractere fora de `[a-z0-9]` virando `-`
 * (colapsando repetições e aparando das pontas). Título vazio ou só feito de
 * símbolos vira `projeto`. `extensao` não leva o ponto inicial (ex.: `'st'`,
 * ou `'ladderflow.json'` para múltiplas partes).
 *
 * Ex.: `nomeDeArquivo('Semáforo 2', 'st')` → `'semaforo-2.st'`.
 */
export function nomeDeArquivo(titulo: string, extensao: string): string {
  const base = semAcentos(titulo)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${base || 'projeto'}.${extensao}`
}

/** Serializa `projeto` no mesmo formato gravado por `salvarProjeto`
 * (`projeto/projeto.ts`): JSON com indentação de 2 espaços, terminado em
 * `\n`. */
export function conteudoProjetoJson(projeto: import('../projeto/projeto').Projeto): string {
  return JSON.stringify(projeto, null, 2) + '\n'
}

/** Nome de arquivo dentro do ZIP para cada chave do manifesto de gravação. */
const NOME_ARQUIVO_IMAGEM: Record<string, string> = {
  bootloader: 'bootloader.bin',
  'partition-table': 'partition-table.bin',
  app: 'ladderflow_plc.bin',
}

function nomeArquivoImagem(chave: string): string {
  return NOME_ARQUIVO_IMAGEM[chave] ?? `${chave}.bin`
}

/** Versão do manifesto ESP Web Tools — alinhada a `frontend/package.json`. */
const VERSAO_FIRMWARE_MANIFEST = '0.1.0'

function chipFamilyEspWebTools(chip: string): string {
  if (chip === 'esp32') return 'ESP32'
  return chip.toUpperCase()
}

/** `manifest.json` no formato [ESP Web Tools](https://esphome.github.io/esp-web-tools/). */
export function conteudoManifestEspWebTools(pacote: Pacote): string {
  const manifest = {
    name: 'LadderFlow',
    version: VERSAO_FIRMWARE_MANIFEST,
    new_install_prompt_erase: true,
    builds: [
      {
        chipFamily: chipFamilyEspWebTools(pacote.chip),
        parts: pacote.images.map((imagem) => ({
          path: nomeArquivoImagem(imagem.name),
          offset: imagem.offset,
        })),
      },
    ],
  }
  return JSON.stringify(manifest, null, 2) + '\n'
}

function base64ParaBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** CRC-32 (polinômio IEEE) sobre `dados`, para cabeçalhos ZIP. */
function crc32(dados: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of dados) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function u16(n: number): Uint8Array {
  const buf = new Uint8Array(2)
  buf[0] = n & 0xff
  buf[1] = (n >>> 8) & 0xff
  return buf
}

function u32(n: number): Uint8Array {
  const buf = new Uint8Array(4)
  buf[0] = n & 0xff
  buf[1] = (n >>> 8) & 0xff
  buf[2] = (n >>> 16) & 0xff
  buf[3] = (n >>> 24) & 0xff
  return buf
}

function concatPartes(partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((soma, parte) => soma + parte.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const parte of partes) {
    out.set(parte, offset)
    offset += parte.length
  }
  return out
}

/** Texto de ajuda `gravacao.txt` a partir dos offsets reais do pacote. */
export function conteudoGravacaoTxt(pacote: Pacote): string {
  const linhas: string[] = [
    'Firmware LadderFlow — gravação na flash do ESP32',
    '',
    `Chip: ${pacote.chip}`,
    `Flash: mode=${pacote.flash.mode}, freq=${pacote.flash.freq}, size=${pacote.flash.size}`,
    '',
    'Arquivos neste zip (endereço na flash):',
  ]

  for (const imagem of pacote.images) {
    const offsetHex = `0x${imagem.offset.toString(16)}`
    const arquivo = nomeArquivoImagem(imagem.name)
    linhas.push(`  ${offsetHex}  ${arquivo}  (${imagem.size} bytes)`)
  }

  const argsFlash = pacote.images
    .map((imagem) => {
      const offsetHex = `0x${imagem.offset.toString(16)}`
      return `${offsetHex} ${nomeArquivoImagem(imagem.name)}`
    })
    .join(' ')

  linhas.push(
    '',
    'ESP Web Tools (instalador web do ESPHome e similares):',
    '  O arquivo manifest.json deste zip segue o formato do ESP Web Tools.',
    '  Os caminhos em "parts" são relativos ao manifest.json — publique a pasta',
    '  descompactada inteira em um servidor HTTP (ou use uma página que aponte',
    '  para esse manifest.json). O instalador não lê um zip local diretamente.',
    '',
    'Exemplo com esptool (ajuste a porta serial):',
    '',
    `esptool.py --chip ${pacote.chip} -p PORTA write_flash -z \\`,
    `  --flash_mode ${pacote.flash.mode} --flash_freq ${pacote.flash.freq} --flash_size ${pacote.flash.size} \\`,
    `  ${argsFlash}`,
    '',
  )

  return linhas.join('\n')
}

/** Monta um ZIP (método STORE, sem compressão) com as imagens, `manifest.json` e `gravacao.txt`. */
export function montarZipFirmware(pacote: Pacote): Blob {
  const entradas: { nome: string; dados: Uint8Array }[] = [
    ...pacote.images.map((imagem) => ({
      nome: nomeArquivoImagem(imagem.name),
      dados: base64ParaBytes(imagem.data_base64),
    })),
    { nome: 'manifest.json', dados: new TextEncoder().encode(conteudoManifestEspWebTools(pacote)) },
    { nome: 'gravacao.txt', dados: new TextEncoder().encode(conteudoGravacaoTxt(pacote)) },
  ]

  const partesLocais: Uint8Array[] = []
  const partesCentral: Uint8Array[] = []
  let offsetLocal = 0

  for (const entrada of entradas) {
    const nomeBytes = new TextEncoder().encode(entrada.nome)
    const crc = crc32(entrada.dados)
    const tamanho = entrada.dados.length

    const cabecalhoLocal = concatPartes([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(tamanho),
      u32(tamanho),
      u16(nomeBytes.length),
      u16(0),
      nomeBytes,
    ])

    partesLocais.push(cabecalhoLocal, entrada.dados)

    const cabecalhoCentral = concatPartes([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(tamanho),
      u32(tamanho),
      u16(nomeBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offsetLocal),
      nomeBytes,
    ])

    partesCentral.push(cabecalhoCentral)
    offsetLocal += cabecalhoLocal.length + entrada.dados.length
  }

  const inicioCentral = offsetLocal
  const blocoCentral = concatPartes(partesCentral)
  const fim = concatPartes([
    blocoCentral,
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entradas.length),
    u16(entradas.length),
    u32(blocoCentral.length),
    u32(inicioCentral),
    u16(0),
  ])

  const zipBytes = concatPartes([...partesLocais, fim])
  return new Blob([new Uint8Array(zipBytes)], { type: 'application/zip' })
}

/** Dispara o download de `blob` como o arquivo `nome`. */
export function baixarBlob(nome: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = nome
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 0)
}

/** Dispara o download de `conteudo` como o arquivo `nome`, com o tipo MIME
 * `mime`. */
export function baixarTexto(nome: string, conteudo: string, mime: string): void {
  baixarBlob(nome, new Blob([conteudo], { type: mime }))
}

/** Monta o ZIP do `pacote` e baixa com nome derivado do `titulo` do projeto. */
export function baixarPacoteFirmware(pacote: Pacote, titulo: string): void {
  const nome = nomeDeArquivo(titulo, 'firmware-esp32.zip')
  baixarBlob(nome, montarZipFirmware(pacote))
}
