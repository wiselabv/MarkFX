import { describe, expect, it, vi } from 'vitest'
import { createMermaidRenderer } from './mermaidRender'
import type { MermaidApi } from './mermaidRender'

type FakeMermaid = MermaidApi & {
  initialize: ReturnType<typeof vi.fn>
  render: ReturnType<typeof vi.fn>
}

function fakeMermaid(overrides: Partial<MermaidApi> = {}): FakeMermaid {
  let counter = 0
  return {
    initialize: vi.fn(),
    render: vi.fn(async (id: string, content: string) => {
      counter += 1
      return { svg: `<svg id="${id}"><text>${content}-${counter}</text></svg>` }
    }),
    ...overrides,
  } as unknown as FakeMermaid
}

describe('createMermaidRenderer', () => {
  it('initializes mermaid only once across renders', async () => {
    const mermaid = fakeMermaid()
    const renderer = createMermaidRenderer(async () => mermaid)

    await renderer.render('graph TD; A-->B', false)
    await renderer.render('graph TD; C-->D', false)
    await renderer.render('graph TD; E-->F', false)

    expect(mermaid.initialize).toHaveBeenCalledTimes(1)
  })

  it('reuses the cached diagram for identical content', async () => {
    const mermaid = fakeMermaid()
    const renderer = createMermaidRenderer(async () => mermaid)

    const first = await renderer.render('graph TD; A-->B', false)
    const second = await renderer.render('graph TD; A-->B', false)

    expect(mermaid.render).toHaveBeenCalledTimes(1)
    expect(second.svg).toBe(first.svg)
  })

  it('renders different content separately', async () => {
    const mermaid = fakeMermaid()
    const renderer = createMermaidRenderer(async () => mermaid)

    await renderer.render('graph TD; A-->B', false)
    await renderer.render('graph TD; C-->D', false)

    expect(mermaid.render).toHaveBeenCalledTimes(2)
    expect(renderer.cachedCount()).toBe(2)
  })

  it('deduplicates concurrent renders of the same diagram', async () => {
    let resolveRender: (value: { svg: string }) => void = () => {}
    const mermaid = fakeMermaid({
      render: vi.fn(() => new Promise<{ svg: string }>((resolve) => {
        resolveRender = resolve
      })),
    })
    const renderer = createMermaidRenderer(async () => mermaid)

    const pending = [renderer.render('graph TD; A-->B', false), renderer.render('graph TD; A-->B', false)]
    await new Promise(resolve => setTimeout(resolve, 0))
    resolveRender({ svg: '<svg id="markfx-mermaid-1"></svg>' })
    const [first, second] = await Promise.all(pending)

    expect(mermaid.render).toHaveBeenCalledTimes(1)
    expect(second.svg).toBe(first.svg)
  })

  it('evicts the oldest diagram once the cache is full', async () => {
    const mermaid = fakeMermaid()
    const renderer = createMermaidRenderer(async () => mermaid, 2)

    await renderer.render('a', false)
    await renderer.render('b', false)
    await renderer.render('c', false)

    expect(renderer.cachedCount()).toBe(2)
    await renderer.render('a', false)
    expect(mermaid.render).toHaveBeenCalledTimes(4)
  })

  it('does not cache failures so the next attempt retries', async () => {
    const render = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ svg: '<svg id="markfx-mermaid-1"></svg>' })
    const mermaid = fakeMermaid({ render })
    const renderer = createMermaidRenderer(async () => mermaid)

    await expect(renderer.render('broken', false)).rejects.toThrow('boom')
    const recovered = await renderer.render('broken', false)

    expect(recovered.svg).toContain('markfx-mermaid-1')
    expect(renderer.cachedCount()).toBe(1)
  })

  it('re-initializes when the theme changes', async () => {
    const mermaid = fakeMermaid()
    const renderer = createMermaidRenderer(async () => mermaid)

    await renderer.render('graph TD; A-->B', false)
    await renderer.render('graph TD; A-->B', true)

    expect(mermaid.initialize).toHaveBeenCalledTimes(2)
    expect(mermaid.render).toHaveBeenCalledTimes(2)
  })

  it('gives every cached diagram its own svg id', async () => {
    const mermaid = fakeMermaid()
    const renderer = createMermaidRenderer(async () => mermaid)

    const first = await renderer.render('a', false)
    const second = await renderer.render('b', false)

    expect(first.id).not.toBe(second.id)
    expect(first.svg).toContain(first.id)
  })

  it('keeps re-renders proportional to distinct diagrams, not to requests', async () => {
    const mermaid = fakeMermaid()
    const renderer = createMermaidRenderer(async () => mermaid)
    const diagrams = Array.from({ length: 8 }, (_, index) => `graph TD; A${index}-->B${index}`)

    // 模拟编辑器重挂载与文档编辑引发的重复 renderPreview 调用
    for (let round = 0; round < 5; round++) {
      for (const diagram of diagrams)
        await renderer.render(diagram, false)
    }

    expect(mermaid.render).toHaveBeenCalledTimes(8)
    expect(renderer.cachedCount()).toBe(8)
  })
})
