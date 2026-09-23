/**
 * Cena SVG do portão (spec 005, RNF-2). Paleta fixa — conteúdo didático, não cromo da IDE.
 */
import type { KeyboardEvent, PointerEvent } from 'react'

import type { EstadoPortao } from '../../ambientes/portao'
import {
  ENDERECO_ABRIR,
  ENDERECO_FC_INFERIOR,
  ENDERECO_FC_SUPERIOR,
  ENDERECO_FECHAR,
  ENDERECO_LAMP_ABERTO,
  ENDERECO_LAMP_ENTREABERTO,
  ENDERECO_LAMP_FECHADO,
  ENDERECO_MOTOR_DESCE,
  ENDERECO_MOTOR_SOBE,
  ENDERECO_PARAR,
  montarEntradasPortao,
} from '../../ambientes/portao'

export interface CenaPortaoProps {
  estado: EstadoPortao
  saidas: Record<string, boolean>
  simulacaoAtiva: boolean
  aoComando: (comando: 'abrir' | 'parar' | 'fechar', pressionado: boolean) => void
}

/** Vão do portão de enrolar (coordenadas na viewBox). */
const VAO = { x: 218, y: 78, w: 300, h: 220 }
const TAMBOR_Y = VAO.y - 14
/** Pulia direita do tambor — ponto de onde sai o eixo até a barra lateral. */
const TAMBOR_PULIA_DIR_X = VAO.x + VAO.w / 2 + (VAO.w - 24) / 2 - 8

/** Caixa do motor, montada ao lado do vão (nunca sobre o portão), abaixo da
 * janela da fachada para não se sobrepor a ela. */
const MOTOR_BOX = { x: VAO.x + VAO.w + 26, y: VAO.y + 44, w: 148, h: 104 }

/** Barra (trilho) vertical no lado direito do vão: recebe o eixo que sai do
 * tambor (na altura dele) e desce até a altura do motor, de onde parte o fio
 * até a caixa — evita o traço diagonal solto que atravessava a moldura. */
const BARRA_LATERAL_X = VAO.x + VAO.w + 16
const BARRA_LATERAL_Y_TOPO = TAMBOR_Y
const BARRA_LATERAL_Y_BASE = MOTOR_BOX.y + MOTOR_BOX.h / 2

export default function CenaPortao({ estado, saidas, simulacaoAtiva, aoComando }: CenaPortaoProps) {
  const abertura = estado.abertura
  const alturaFolha = VAO.h * (1 - abertura / 100)
  const yFolha = VAO.y

  const lampEntre = saidas[ENDERECO_LAMP_ENTREABERTO] === true
  const lampAberto = saidas[ENDERECO_LAMP_ABERTO] === true
  const lampFechado = saidas[ENDERECO_LAMP_FECHADO] === true
  const motorSobe = saidas[ENDERECO_MOTOR_SOBE] === true
  const motorDesce = saidas[ENDERECO_MOTOR_DESCE] === true
  // Ambos os fins de curso são NA (spec 005, revisão 2026-09-21) e o
  // `SensorFc` acende exatamente com o booleano bruto da entrada, sem
  // inversão (ver JSDoc de `SensorFc` abaixo) — mas "detectando" tem sentido
  // físico diferente em cada um (revisão 2026-09-23, ver `nivelFcSuperior`/
  // `nivelFcInferior` em `ambientes/portao.ts`): o FC inferior fecha quando a
  // folha CHEGA à extremidade de baixo; o FC superior, montado junto ao
  // tambor, fecha enquanto ainda HÁ lona passando por aquele ponto fixo —
  // ou seja, fica ligado fechado ou entreaberto, e só abre perto do
  // totalmente aberto, quando a lona se recolhe no tambor.
  const entradas = montarEntradasPortao(estado)
  const fcSup = entradas[ENDERECO_FC_SUPERIOR] === true
  const fcInf = entradas[ENDERECO_FC_INFERIOR] === true

  const bloqueado = !simulacaoAtiva || estado.motorDanificado
  const interiorVisivel = abertura > 8

  return (
    <div className="flex flex-col gap-2">
      {!simulacaoAtiva && (
        <p className="text-xs text-ide-aviso">Entre em Simulação para o processo reagir à lógica do diagrama.</p>
      )}
      {estado.motorDanificado && (
        <p className="text-xs font-medium text-ide-perigo" role="alert">
          Motor danificado — use Reiniciar na barra de simulação.
        </p>
      )}

      <svg
        viewBox="0 0 720 440"
        className="w-full rounded border border-ide-borda"
        role="img"
        aria-labelledby="cena-portao-titulo"
      >
        <title id="cena-portao-titulo">Simulação do portão de enrolar</title>
        <desc>Bar com portão de enrolar, painel de comando, fins de curso e acionamento do motor.</desc>

        <rect x="0" y="0" width="720" height="440" fill="#5c4a7a" />
        <rect x="10" y="10" width="700" height="420" fill="#e5d5bc" stroke="#4a4035" strokeWidth="2" />

        <FachadaBar />
        <rect x="10" y="318" width="700" height="112" fill="#b8b0a8" />
        <rect x="10" y="318" width="700" height="18" fill="#9a928a" />

        <rect x={VAO.x - 14} y={VAO.y - 10} width={VAO.w + 28} height={VAO.h + 20} fill="#1c1c1c" />
        <rect x={VAO.x - 8} y={VAO.y} width={8} height={VAO.h} fill="#b71c1c" />
        <rect x={VAO.x + VAO.w} y={VAO.y} width={8} height={VAO.h} fill="#b71c1c" />

        <clipPath id="clip-interior">
          <rect x={VAO.x + 6} y={VAO.y + 2} width={VAO.w - 12} height={VAO.h - 4} />
        </clipPath>
        <g clipPath="url(#clip-interior)">
          <rect x={VAO.x} y={VAO.y} width={VAO.w} height={VAO.h} fill="#2a2520" />
          {interiorVisivel && <InteriorBar abertura={abertura} />}
        </g>

        <Tambor x={VAO.x + VAO.w / 2} y={TAMBOR_Y} largura={VAO.w - 24} />

        {alturaFolha > 0.5 && (
          <g>
            <rect
              x={VAO.x + 10}
              y={yFolha}
              width={VAO.w - 20}
              height={alturaFolha}
              fill="#0a6e6e"
              stroke="#044"
              strokeWidth="1.2"
            />
            {Array.from({ length: Math.max(1, Math.floor(alturaFolha / 12)) }).map((_, i) => (
              <line
                key={i}
                x1={VAO.x + 12}
                y1={yFolha + 6 + i * 12}
                x2={VAO.x + VAO.w - 12}
                y2={yFolha + 6 + i * 12}
                stroke="#085858"
                strokeWidth="1.5"
              />
            ))}
          </g>
        )}

        <SensorFc
          sensorX={VAO.x - 22}
          sensorY={VAO.y + 6}
          labelX={148}
          labelY={VAO.y + 4}
          ativo={fcSup}
          rotulo="FC1"
          endereco={ENDERECO_FC_SUPERIOR}
        />
        <SensorFc
          sensorX={VAO.x - 22}
          sensorY={VAO.y + VAO.h - 28}
          labelX={148}
          labelY={VAO.y + VAO.h - 20}
          ativo={fcInf}
          rotulo="FC2"
          endereco={ENDERECO_FC_INFERIOR}
        />

        <ConectorMotor
          eixoX={TAMBOR_PULIA_DIR_X}
          eixoY={TAMBOR_Y}
          barraX={BARRA_LATERAL_X}
          barraYTopo={BARRA_LATERAL_Y_TOPO}
          barraYBase={BARRA_LATERAL_Y_BASE}
          motorX={MOTOR_BOX.x}
        />
        <MotorPortao
          x={MOTOR_BOX.x}
          y={MOTOR_BOX.y}
          w={MOTOR_BOX.w}
          h={MOTOR_BOX.h}
          motorSobe={motorSobe}
          motorDesce={motorDesce}
        />

        <PainelControle
          x={14}
          y={56}
          lampEntre={lampEntre}
          lampAberto={lampAberto}
          lampFechado={lampFechado}
          botoes={estado.botoes}
          bloqueado={bloqueado}
          aoComando={aoComando}
        />
      </svg>

      <p className="text-[10px] text-ide-suave">Abertura: {Math.round(abertura)}%</p>
    </div>
  )
}

function FachadaBar() {
  return (
    <g>
      <rect x="10" y="10" width="700" height="308" fill="#e5d5bc" />
      <rect x="40" y="28" width="120" height="90" fill="#c4a574" stroke="#6d5a45" strokeWidth="2" />
      <rect x="48" y="36" width="104" height="74" fill="#fff3c4" opacity="0.85" />
      <line x1="100" y1="36" x2="100" y2="110" stroke="#8b7355" strokeWidth="2" />
      <rect x="560" y="28" width="120" height="90" fill="#c4a574" stroke="#6d5a45" strokeWidth="2" />
      <rect x="568" y="36" width="104" height="74" fill="#fff3c4" opacity="0.85" />
      <line x1="620" y1="36" x2="620" y2="110" stroke="#8b7355" strokeWidth="2" />
      <path
        d={`M ${VAO.x - 40} 52 Q ${VAO.x + VAO.w / 2} 22 ${VAO.x + VAO.w + 40} 52 L ${VAO.x + VAO.w + 36} 68 L ${VAO.x - 36} 68 Z`}
        fill="#8b1a1a"
        stroke="#4a0a0a"
      />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect
          key={i}
          x={VAO.x - 32 + i * 42}
          y={54}
          width="20"
          height="12"
          fill={i % 2 === 0 ? '#f5f5f5' : '#8b1a1a'}
        />
      ))}
    </g>
  )
}

function InteriorBar({ abertura }: { abertura: number }) {
  const op = Math.min(1, abertura / 35)
  return (
    <g opacity={op}>
      <rect x={VAO.x + 16} y={VAO.y + VAO.h - 52} width={VAO.w - 32} height="48" fill="#5c4033" stroke="#3e2a22" />
      <rect x={VAO.x + 16} y={VAO.y + VAO.h - 58} width={VAO.w - 32} height="8" fill="#3e2a22" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <rect
          key={i}
          x={VAO.x + 28 + i * 30}
          y={VAO.y + VAO.h - 78}
          width="10"
          height="22"
          fill="#2e5a88"
          stroke="#1a3344"
        />
      ))}
      <rect x={VAO.x + 40} y={VAO.y + 50} width="70" height="10" fill="#4a3728" />
      <rect x={VAO.x + 50} y={VAO.y + 60} width="14" height="36" fill="#6d4c35" rx="2" />
      <rect x={VAO.x + 80} y={VAO.y + 60} width="14" height="36" fill="#6d4c35" rx="2" />
      <rect x={VAO.x + 200} y={VAO.y + 100} width="90" height="50" fill="#5c4a3a" stroke="#3a2e24" />
      <ellipse cx={VAO.x + 245} cy={VAO.y + 125} rx="28" ry="8" fill="#4a3a2a" />
      <line x1={VAO.x + 80} y1={VAO.y + 30} x2={VAO.x + 80} y2={VAO.y + 55} stroke="#888" strokeWidth="2" />
      <ellipse cx={VAO.x + 80} cy={VAO.y + 28} rx="18" ry="8" fill="#ffe9a8" opacity="0.9" />
      <line x1={VAO.x + 260} y1={VAO.y + 30} x2={VAO.x + 260} y2={VAO.y + 55} stroke="#888" strokeWidth="2" />
      <ellipse cx={VAO.x + 260} cy={VAO.y + 28} rx="18" ry="8" fill="#ffe9a8" opacity="0.9" />
    </g>
  )
}

function Tambor({ x, y, largura }: { x: number; y: number; largura: number }) {
  return (
    <g>
      <rect x={x - largura / 2} y={y - 6} width={largura} height="12" fill="#444" stroke="#222" rx="3" />
      <circle cx={x - largura / 2 + 8} cy={y} r="5" fill="#666" stroke="#333" />
      <circle cx={x + largura / 2 - 8} cy={y} r="5" fill="#666" stroke="#333" />
    </g>
  )
}

/**
 * Liga o eixo do tambor à caixa do motor por uma **barra** (trilho) vertical
 * no lado direito do vão, nunca por um traço diagonal solto: um trecho curto
 * sai do próprio tambor até a barra, na altura dele; a barra desce até a
 * altura do motor; um segundo trecho (o fio) sai do pé da barra até a caixa.
 */
function ConectorMotor({
  eixoX,
  eixoY,
  barraX,
  barraYTopo,
  barraYBase,
  motorX,
}: {
  eixoX: number
  eixoY: number
  barraX: number
  barraYTopo: number
  barraYBase: number
  motorX: number
}) {
  return (
    <g>
      <line x1={eixoX} y1={eixoY} x2={barraX} y2={barraYTopo} stroke="#333" strokeWidth="3" />
      <circle cx={eixoX} cy={eixoY} r="6" fill="#666" stroke="#222" strokeWidth="1.5" />

      <rect x={barraX - 3} y={barraYTopo} width="6" height={barraYBase - barraYTopo} fill="#555" stroke="#222" strokeWidth="1" />

      <line x1={barraX} y1={barraYBase} x2={motorX} y2={barraYBase} stroke="#333" strokeWidth="3" />
      <circle cx={barraX} cy={barraYBase} r="5" fill="#666" stroke="#222" strokeWidth="1.5" />
      <circle cx={motorX} cy={barraYBase} r="7" fill="#666" stroke="#222" strokeWidth="1.5" />
    </g>
  )
}

/**
 * Motor do portão, montado **ao lado** do vão (nunca sobre a folha): caixa com
 * redutor, com as setas SOBE/DESCE e o respectivo endereço bem legíveis
 * dentro da própria caixa. O fio que a liga ao tambor é o `ConectorMotor`.
 */
function MotorPortao({
  x,
  y,
  w,
  h,
  motorSobe,
  motorDesce,
}: {
  x: number
  y: number
  w: number
  h: number
  motorSobe: boolean
  motorDesce: boolean
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#3a3a3a" stroke="#111" strokeWidth="2" rx="4" />
      <text x={x + w / 2} y={y + 17} textAnchor="middle" fill="#eee" fontSize="11" fontFamily="sans-serif" fontWeight="bold">
        MOTOR
      </text>
      <line x1={x + 8} y1={y + 25} x2={x + w - 8} y2={y + 25} stroke="#555" />

      <g transform={`translate(${x + 14}, ${y + 34})`}>
        <SetaMotor x={0} y={0} paraCima ativo={motorSobe} />
        <text x="30" y="10" fill={motorSobe ? '#58d68d' : '#ccc'} fontSize="10" fontFamily="sans-serif" fontWeight="bold">
          SOBE
        </text>
        <text x="30" y="21" fill="#aaa" fontSize="8" fontFamily="monospace">
          {ENDERECO_MOTOR_SOBE}
        </text>
      </g>

      <g transform={`translate(${x + 14}, ${y + 70})`}>
        <SetaMotor x={0} y={0} paraCima={false} ativo={motorDesce} />
        <text x="30" y="10" fill={motorDesce ? '#58d68d' : '#ccc'} fontSize="10" fontFamily="sans-serif" fontWeight="bold">
          DESCE
        </text>
        <text x="30" y="21" fill="#aaa" fontSize="8" fontFamily="monospace">
          {ENDERECO_MOTOR_DESCE}
        </text>
      </g>
    </g>
  )
}

/**
 * Indicador de um fim de curso NA: `ativo` é o valor bruto da entrada
 * (`%IX0.3`/`%IX0.4`, calculado por `nivelFcSuperior`/`nivelFcInferior` em
 * `portao.ts`), sem inversão nem derivação adicional aqui. O que faz o
 * contato "detectar" difere entre os dois (revisão 2026-09-23): o FC
 * inferior fecha quando a folha alcança a extremidade de baixo; o FC
 * superior fecha enquanto há lona passando pelo ponto fixo junto ao tambor
 * (fechado e entreaberto) e abre só perto do totalmente aberto. Aceso
 * (verde vivo + anel amarelo) só quando `ativo`; apagado (verde escuro, sem
 * anel) caso contrário.
 */
function SensorFc({
  sensorX,
  sensorY,
  labelX,
  labelY,
  ativo,
  rotulo,
  endereco,
}: {
  sensorX: number
  sensorY: number
  labelX: number
  labelY: number
  ativo: boolean
  rotulo: string
  endereco: string
}) {
  const fill = ativo ? '#2ecc71' : '#3d5c3d'
  return (
    <g>
      <line x1={labelX + 72} y1={labelY + 8} x2={sensorX + 11} y2={sensorY + 11} stroke="#5d5040" strokeWidth="1" />
      <text x={labelX + 4} y={labelY + 11} fill="#2a1810" fontSize="9" fontFamily="sans-serif" fontWeight="bold">
        {rotulo}
      </text>
      <text x={labelX + 4} y={labelY + 22} fill="#4a4035" fontSize="7" fontFamily="monospace">
        {endereco}
      </text>
      <rect x={sensorX} y={sensorY} width="22" height="22" fill={fill} stroke="#111" strokeWidth="2" />
      {ativo && (
        <rect x={sensorX - 3} y={sensorY - 3} width="28" height="28" fill="none" stroke="#f1c40f" strokeWidth="3" />
      )}
    </g>
  )
}

/**
 * Seta indicadora do sentido do motor. `paraCima` (SOBE) desenha o ápice no
 * topo (▲); `!paraCima` (DESCE) desenha o ápice na base (▼) — as duas formas
 * estavam trocadas antes desta correção.
 */
function SetaMotor({ x, y, paraCima, ativo }: { x: number; y: number; paraCima: boolean; ativo: boolean }) {
  const fill = ativo ? '#58d68d' : '#555'
  const pontos = paraCima
    ? `${x},${y + 16} ${x + 12},${y} ${x + 24},${y + 16}` // ápice no topo — sobe (▲)
    : `${x},${y} ${x + 12},${y + 16} ${x + 24},${y}` // ápice na base — desce (▼)
  return <polygon points={pontos} fill={fill} stroke="#222" strokeWidth="1" />
}

function PainelControle({
  x,
  y,
  lampEntre,
  lampAberto,
  lampFechado,
  botoes,
  bloqueado,
  aoComando,
}: {
  x: number
  y: number
  lampEntre: boolean
  lampAberto: boolean
  lampFechado: boolean
  botoes: EstadoPortao['botoes']
  bloqueado: boolean
  aoComando: CenaPortaoProps['aoComando']
}) {
  const w = 118
  const h = 218
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#2a2a2a" stroke="#111" strokeWidth="2" rx="2" />
      <LampadaSvg cx={x + 28} cy={y + 28} ligada={lampEntre} titulo="ENTREABERTO" endereco={ENDERECO_LAMP_ENTREABERTO} />
      <LampadaSvg cx={x + 28} cy={y + 58} ligada={lampAberto} titulo="ABERTO" endereco={ENDERECO_LAMP_ABERTO} />
      <LampadaSvg cx={x + 28} cy={y + 88} ligada={lampFechado} titulo="FECHADO" endereco={ENDERECO_LAMP_FECHADO} />
      <line x1={x + 8} y1={y + 108} x2={x + w - 8} y2={y + 108} stroke="#555" />
      <BotaoSvg
        cx={x + 28}
        cy={y + 135}
        label="ABRIR"
        endereco={ENDERECO_ABRIR}
        pressionado={botoes.abrir}
        vermelho={false}
        disabled={bloqueado}
        onPress={(p) => aoComando('abrir', p)}
      />
      <BotaoSvg
        cx={x + 28}
        cy={y + 165}
        label="FECHAR"
        endereco={ENDERECO_FECHAR}
        pressionado={botoes.fechar}
        vermelho={false}
        disabled={bloqueado}
        onPress={(p) => aoComando('fechar', p)}
      />
      <BotaoSvg
        cx={x + 28}
        cy={y + 195}
        label="PARAR"
        endereco={ENDERECO_PARAR}
        pressionado={botoes.parar}
        vermelho={true}
        disabled={bloqueado}
        onPress={(p) => aoComando('parar', p)}
      />
    </g>
  )
}

function LampadaSvg({
  cx,
  cy,
  ligada,
  titulo,
  endereco,
}: {
  cx: number
  cy: number
  ligada: boolean
  titulo: string
  endereco: string
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="11" fill={ligada ? '#f4d03f' : '#111'} stroke={ligada ? '#b8860b' : '#444'} strokeWidth="2" />
      {ligada && <circle cx={cx} cy={cy} r="5" fill="#fff8dc" opacity="0.8" />}
      <text x={cx + 18} y={cy - 2} fill="#ddd" fontSize="7" fontFamily="sans-serif">
        {titulo}
      </text>
      <text x={cx + 18} y={cy + 8} fill="#aaa" fontSize="6" fontFamily="monospace">
        {endereco}
      </text>
    </g>
  )
}

function BotaoSvg({
  cx,
  cy,
  label,
  endereco,
  pressionado,
  vermelho,
  disabled,
  onPress,
}: {
  cx: number
  cy: number
  label: string
  endereco: string
  pressionado: boolean
  vermelho: boolean
  disabled: boolean
  onPress: (pressionado: boolean) => void
}) {
  const r = 14
  const nome = label.charAt(0) + label.slice(1).toLowerCase()

  function aoPointerDown(e: PointerEvent) {
    e.preventDefault()
    if (!disabled) onPress(true)
  }

  function aoTecla(e: KeyboardEvent) {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onPress(true)
    }
  }

  return (
    <g
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={pressionado}
      aria-label={nome}
      aria-disabled={disabled}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
      onPointerDown={aoPointerDown}
      onPointerUp={() => onPress(false)}
      onPointerLeave={() => onPress(false)}
      onKeyDown={aoTecla}
      onKeyUp={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onPress(false)
      }}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={pressionado ? '#ccc' : vermelho ? '#c44' : '#eee'}
        stroke="#333"
        strokeWidth="2"
      />
      <circle cx={cx} cy={cy} r="4" fill="#222" />
      <text x={cx + 20} y={cy - 2} fill="#ddd" fontSize="7" fontFamily="sans-serif">
        {label}
      </text>
      <text x={cx + 20} y={cy + 8} fill="#aaa" fontSize="6" fontFamily="monospace">
        {endereco}
      </text>
    </g>
  )
}
