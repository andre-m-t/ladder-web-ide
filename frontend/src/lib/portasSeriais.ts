/// <reference types="w3c-web-serial" />
/**
 * Listagem e seleção de portas seriais via Web Serial API (spec 001, revisão
 * 2026-09-23 — modal de porta antes da gravação).
 *
 * A API só expõe portas já autorizadas em `getPorts()`; nomes do sistema
 * (COMn, /dev/ttyUSBn) aparecem apenas no seletor nativo de `requestPort()`.
 */
import type { PortaLike } from './gravador'

/** Subconjunto de `navigator.serial` usado pelo modal e pelos testes. */
export interface SerialGerenciadorLike {
  getPorts(): Promise<PortaLike[]>
  requestPort(): Promise<PortaLike>
  addEventListener?(type: 'connect' | 'disconnect', listener: (ev: Event) => void): void
  removeEventListener?(type: 'connect' | 'disconnect', listener: (ev: Event) => void): void
}

export interface InfoPortaUsb {
  usbVendorId?: number
  usbProductId?: number
}

const VENDOR_CONHECIDO: Record<number, string> = {
  0x10c4: 'Silicon Labs CP210x',
  0x1a86: 'WCH CH340',
  0x0403: 'FTDI',
  0x303a: 'Espressif',
}

function infoUsb(porta: PortaLike): InfoPortaUsb {
  const info = (porta as SerialPort).getInfo?.()
  if (!info) return {}
  return {
    usbVendorId: info.usbVendorId,
    usbProductId: info.usbProductId,
  }
}

/** Rótulo legível para uma porta (chip USB ou VID:PID). */
export function rotuloPorta(porta: PortaLike): string {
  const { usbVendorId, usbProductId } = infoUsb(porta)
  if (usbVendorId != null) {
    const nome = VENDOR_CONHECIDO[usbVendorId]
    const pid = usbProductId != null ? ` (${formatarHex(usbVendorId)}:${formatarHex(usbProductId)})` : ''
    return nome ? `${nome}${pid}` : `Dispositivo USB ${formatarHex(usbVendorId)}:${formatarHex(usbProductId ?? 0)}`
  }
  return 'Porta serial'
}

function formatarHex(valor: number): string {
  return `0x${valor.toString(16).padStart(4, '0')}`
}

/** Portas já autorizadas para este site. */
export async function listarPortas(serial: SerialGerenciadorLike): Promise<PortaLike[]> {
  return serial.getPorts()
}

/**
 * Abre o seletor nativo. Retorna `null` se o usuário cancelar (`NotFoundError`).
 */
export async function solicitarPorta(serial: SerialGerenciadorLike): Promise<PortaLike | null> {
  try {
    return await serial.requestPort()
  } catch (erro) {
    if (erro instanceof DOMException && erro.name === 'NotFoundError') {
      return null
    }
    throw erro
  }
}

/** Assina `connect`/`disconnect` no gerenciador serial; retorna função de limpeza. */
export function observarPortas(serial: SerialGerenciadorLike, aoMudar: () => void): () => void {
  const tipos: Array<'connect' | 'disconnect'> = ['connect', 'disconnect']
  for (const tipo of tipos) {
    serial.addEventListener?.(tipo, aoMudar)
  }
  return () => {
    for (const tipo of tipos) {
      serial.removeEventListener?.(tipo, aoMudar)
    }
  }
}

/** Identificador estável para comparar portas na lista (mesmo objeto ou mesmo VID:PID). */
export function idPorta(porta: PortaLike): string {
  const { usbVendorId, usbProductId } = infoUsb(porta)
  if (usbVendorId != null && usbProductId != null) {
    return `${usbVendorId}:${usbProductId}`
  }
  return `obj-${String(porta)}`
}

export function mesmaPorta(a: PortaLike, b: PortaLike): boolean {
  return a === b || idPorta(a) === idPorta(b)
}
