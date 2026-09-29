const MAX_STORED_SVGS = 20

const svgByRenderId = new Map<string, string>()

export function storeMermaidSvg(renderId: string, svg: string) {
  svgByRenderId.set(renderId, svg)
  if (svgByRenderId.size > MAX_STORED_SVGS) {
    const oldest = svgByRenderId.keys().next().value
    if (oldest)
      svgByRenderId.delete(oldest)
  }
}

export function mermaidSvgFromClick(target: EventTarget | null): string | null {
  if (!(target instanceof Element))
    return null

  const host = target.closest('.mermaid-preview-host')
  const svgId = host?.querySelector('svg')?.id
  if (!svgId)
    return null

  return svgByRenderId.get(svgId) ?? null
}
