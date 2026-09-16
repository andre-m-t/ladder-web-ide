/** Configuração global do vitest: matchers de DOM (`toBeInTheDocument`, `toBeDisabled` etc). */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// `test.globals` fica desligado (import explícito em cada teste), então o
// desmonte automático do @testing-library/react entre testes precisa ser
// registrado aqui à mão.
afterEach(() => {
  cleanup()
})
