import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import './index.css'
import { aplicarTema, temaInicial } from './lib/tema'

// Aplica o tema (escuro/claro, spec 002 D-13) antes do primeiro render: sem
// isso, a página pintaria com o tema padrão do CSS e só trocaria para a
// preferência salva depois que o React montasse — um "flash" visível.
aplicarTema(temaInicial())

const container = document.getElementById('root')
if (!container) {
  throw new Error('Elemento #root não encontrado em index.html')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
