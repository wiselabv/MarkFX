import { describe, expect, it } from 'vitest'
import { MAX_ZOOM, MIN_ZOOM, clampZoom, computeFitScale, zoomAroundPoint } from './mermaidZoom'

describe('clampZoom', () => {
  it('clamps scale below the minimum', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM)
  })

  it('clamps scale above the maximum', () => {
    expect(clampZoom(100)).toBe(MAX_ZOOM)
  })

  it('keeps an in-range scale unchanged', () => {
    expect(clampZoom(1.5)).toBe(1.5)
  })
})

describe('computeFitScale', () => {
  it('fits content into the viewport with padding', () => {
    expect(computeFitScale(200, 100, 1000, 800, 40)).toBeCloseTo(4.6)
  })

  it('is limited by the height when it is the tighter axis', () => {
    expect(computeFitScale(100, 100, 1000, 400, 0)).toBeCloseTo(4)
  })

  it('falls back to 1 for empty content or viewport', () => {
    expect(computeFitScale(0, 0, 1000, 800, 40)).toBe(1)
    expect(computeFitScale(200, 100, 0, 0, 40)).toBe(1)
  })

  it('clamps the result to the maximum zoom', () => {
    expect(computeFitScale(1, 1, 10000, 10000, 0)).toBe(MAX_ZOOM)
  })
})

describe('zoomAroundPoint', () => {
  it('keeps the point under the cursor fixed while zooming', () => {
    const next = zoomAroundPoint({ scale: 1, panX: 0, panY: 0 }, 100, 100, 2)
    expect(next.scale).toBe(2)
    expect(next.panX).toBe(-100)
    expect(next.panY).toBe(-100)
  })

  it('clamps the scale and keeps pan stable when already at the limit', () => {
    const next = zoomAroundPoint({ scale: MAX_ZOOM, panX: 5, panY: 5 }, 0, 0, 2)
    expect(next.scale).toBe(MAX_ZOOM)
    expect(next.panX).toBe(5)
    expect(next.panY).toBe(5)
  })
})
