/** Configuração global do vitest: matchers de DOM (`toBeInTheDocument`, `toBeDisabled` etc). */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
