import { beforeEach, describe, expect, it } from 'vitest'
import { mermaidSvgFromClick, storeMermaidSvg } from './mermaidPreview'

const SVG = '<svg id="markfx-mermaid-x"><g>diagram</g></svg>'

function buildHost(svgId: string) {
  const host = document.createElement('div')
  host.className = 'mermaid-preview-host'

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.id = svgId
  host.appendChild(svg)

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'mermaid-zoom-button'
  host.appendChild(button)

  return { host, svg, button }
}

describe('mermaidSvgFromClick', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('returns null when the click target is not inside a mermaid host', () => {
    const outside = document.createElement('p')
    document.body.appendChild(outside)

    expect(mermaidSvgFromClick(outside)).toBeNull()
    expect(mermaidSvgFromClick(null)).toBeNull()
  })

  it('returns null when the host svg was never stored', () => {
    const { host, button } = buildHost('markfx-mermaid-unknown')
    document.body.appendChild(host)

    expect(mermaidSvgFromClick(button)).toBeNull()
  })

  it('returns the stored svg when clicking the zoom button inside the host', () => {
    storeMermaidSvg('markfx-mermaid-1', SVG)
    const { host, button } = buildHost('markfx-mermaid-1')
    document.body.appendChild(host)

    expect(mermaidSvgFromClick(button)).toBe(SVG)

    host.remove()
  })

  it('returns the stored svg when clicking the diagram itself', () => {
    storeMermaidSvg('markfx-mermaid-2', SVG)
    const { host, svg } = buildHost('markfx-mermaid-2')
    document.body.appendChild(host)

    expect(mermaidSvgFromClick(svg)).toBe(SVG)

    host.remove()
  })

  it('still resolves after the host is cloned and re-inserted', () => {
    storeMermaidSvg('markfx-mermaid-3', SVG)
    const { host } = buildHost('markfx-mermaid-3')
    document.body.appendChild(host)

    const clone = host.cloneNode(true) as HTMLElement
    host.replaceWith(clone)

    const clonedButton = clone.querySelector('.mermaid-zoom-button')
    expect(clonedButton).not.toBeNull()
    expect(mermaidSvgFromClick(clonedButton)).toBe(SVG)

    clone.remove()
  })
})
