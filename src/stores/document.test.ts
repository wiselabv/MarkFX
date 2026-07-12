import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { useDocumentStore } from './document'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}))

const invokeMock = vi.mocked(invoke)
const openMock = vi.mocked(open)
const saveMock = vi.mocked(save)

describe('document store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('creates a clean untitled document', () => {
    const store = useDocumentStore()

    store.createNew()

    expect(store.currentPath).toBeNull()
    expect(store.isDirty).toBe(false)
    expect(store.content).toContain('# 未命名文档')
  })

  it('marks changed content as dirty', () => {
    const store = useDocumentStore()

    store.setContent('# 新内容')

    expect(store.content).toBe('# 新内容')
    expect(store.isDirty).toBe(true)
  })

  it('opens markdown and remembers its path', async () => {
    openMock.mockResolvedValue('D:\\notes\\hello.md')
    invokeMock.mockResolvedValue('# Hello')
    const store = useDocumentStore()

    await expect(store.openDocument()).resolves.toBe(true)

    expect(invokeMock).toHaveBeenCalledWith('read_text_file', { path: 'D:\\notes\\hello.md' })
    expect(store.content).toBe('# Hello')
    expect(store.currentPath).toBe('D:\\notes\\hello.md')
    expect(store.isDirty).toBe(false)
    expect(store.recentFiles).toEqual(['D:\\notes\\hello.md'])
  })

  it('saves to a selected path and clears dirty state', async () => {
    saveMock.mockResolvedValue('D:\\notes\\draft.md')
    invokeMock.mockResolvedValue(undefined)
    const store = useDocumentStore()
    store.setContent('# Draft')

    await expect(store.saveDocument()).resolves.toBe(true)

    expect(invokeMock).toHaveBeenCalledWith('write_text_file', {
      path: 'D:\\notes\\draft.md',
      content: '# Draft',
    })
    expect(store.currentPath).toBe('D:\\notes\\draft.md')
    expect(store.isDirty).toBe(false)
  })
})
