import { afterEach, describe, expect, it } from 'vitest'
import { isTauri } from './env'

describe('isTauri', () => {
  afterEach(() => {
    // @ts-expect-error cleanup test global
    delete window.__TAURI_INTERNALS__
  })

  it('returns false in a plain browser', () => {
    expect(isTauri()).toBe(false)
  })

  it('returns true when the Tauri internals global exists', () => {
    // @ts-expect-error simulate Tauri runtime
    window.__TAURI_INTERNALS__ = {}
    expect(isTauri()).toBe(true)
  })
})
