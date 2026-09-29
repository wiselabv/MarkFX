export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 8

export interface ZoomState {
  scale: number
  panX: number
  panY: number
}

export function clampZoom(scale: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale))
}

export function computeFitScale(
  contentWidth: number,
  contentHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  padding = 0,
) {
  const availableWidth = viewportWidth - padding * 2
  const availableHeight = viewportHeight - padding * 2
  if (contentWidth <= 0 || contentHeight <= 0 || availableWidth <= 0 || availableHeight <= 0)
    return 1

  return clampZoom(Math.min(availableWidth / contentWidth, availableHeight / contentHeight))
}

export function zoomAroundPoint(state: ZoomState, cursorX: number, cursorY: number, factor: number): ZoomState {
  const scale = clampZoom(state.scale * factor)
  const ratio = scale / state.scale
  return {
    scale,
    panX: cursorX - (cursorX - state.panX) * ratio,
    panY: cursorY - (cursorY - state.panY) * ratio,
  }
}
