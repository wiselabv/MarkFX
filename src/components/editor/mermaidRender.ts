export interface MermaidApi {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, content: string) => Promise<{ svg: string }>
}

export interface RenderedDiagram {
  id: string
  svg: string
}

export interface MermaidRenderer {
  render: (content: string, dark: boolean) => Promise<RenderedDiagram>
  cachedCount: () => number
}

const MAX_CACHED_DIAGRAMS = 30

export function createMermaidRenderer(
  loadMermaid: () => Promise<MermaidApi>,
  limit = MAX_CACHED_DIAGRAMS,
): MermaidRenderer {
  const cache = new Map<string, RenderedDiagram>()
  const inFlight = new Map<string, Promise<RenderedDiagram>>()
  let renderId = 0
  let initializedTheme: string | null = null

  function cacheKey(content: string, dark: boolean) {
    return `${dark ? 'dark' : 'light'}::${content}`
  }

  function remember(key: string, diagram: RenderedDiagram) {
    cache.set(key, diagram)
    if (cache.size > limit) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined)
        cache.delete(oldest)
    }
  }

  async function renderDiagram(content: string, dark: boolean) {
    const mermaid = await loadMermaid()
    const theme = dark ? 'dark' : 'default'
    if (initializedTheme !== theme) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme,
      })
      initializedTheme = theme
    }

    const id = `markfx-mermaid-${++renderId}`
    const { svg } = await mermaid.render(id, content)
    return { id, svg }
  }

  return {
    async render(content: string, dark: boolean) {
      const key = cacheKey(content, dark)
      const cached = cache.get(key)
      if (cached)
        return cached

      const pending = inFlight.get(key)
      if (pending)
        return pending

      const request = renderDiagram(content, dark)
        .then((diagram) => {
          remember(key, diagram)
          return diagram
        })
        .finally(() => {
          inFlight.delete(key)
        })

      inFlight.set(key, request)
      return request
    },
    cachedCount: () => cache.size,
  }
}
