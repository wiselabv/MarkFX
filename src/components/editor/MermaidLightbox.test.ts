import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MermaidLightbox from './MermaidLightbox.vue'

const svg = '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="100" /></svg>'

function mountLightbox() {
  return mount(MermaidLightbox, { attachTo: document.body, props: { svg } })
}

function stage() {
  return document.body.querySelector<HTMLElement>('.lightbox-stage')
}

function percentText() {
  return document.body.querySelector<HTMLElement>('.lightbox-percent')?.textContent ?? ''
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('MermaidLightbox', () => {
  it('renders the provided svg markup', () => {
    mountLightbox()
    expect(document.body.querySelector('.lightbox-content svg')).not.toBeNull()
  })

  it('zooms in and out via the control buttons', async () => {
    const wrapper = mountLightbox()
    const initial = percentText()
    document.body.querySelector<HTMLElement>('[data-action="zoom-in"]')?.click()
    await wrapper.vm.$nextTick()
    expect(percentText()).not.toBe(initial)
    document.body.querySelector<HTMLElement>('[data-action="zoom-out"]')?.click()
    await wrapper.vm.$nextTick()
    expect(percentText()).toBe(initial)
    wrapper.unmount()
  })

  it('zooms with the mouse wheel over the stage', async () => {
    const wrapper = mountLightbox()
    const initial = percentText()
    stage()?.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100 }))
    await wrapper.vm.$nextTick()
    expect(percentText()).not.toBe(initial)
    wrapper.unmount()
  })

  it('closes on Escape', async () => {
    const wrapper = mountLightbox()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('close')).toBeTruthy()
    wrapper.unmount()
  })

  it('wraps Tab from the last control back to the first', async () => {
    const wrapper = mountLightbox()
    const controls = document.body.querySelectorAll<HTMLElement>('.lightbox-overlay button')
    const first = controls[0]
    const last = controls[controls.length - 1]
    last.focus()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    await wrapper.vm.$nextTick()

    expect(document.activeElement).toBe(first)
    wrapper.unmount()
  })

  it('wraps Shift+Tab from the first control to the last', async () => {
    const wrapper = mountLightbox()
    const controls = document.body.querySelectorAll<HTMLElement>('.lightbox-overlay button')
    const first = controls[0]
    const last = controls[controls.length - 1]
    first.focus()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }))
    await wrapper.vm.$nextTick()

    expect(document.activeElement).toBe(last)
    wrapper.unmount()
  })

  it('returns focus to the element that opened it', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const wrapper = mountLightbox()
    expect(document.activeElement).not.toBe(trigger)

    wrapper.unmount()

    expect(document.activeElement).toBe(trigger)
  })
})
