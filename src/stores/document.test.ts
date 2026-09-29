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

function routeInvoke(handlers: Record<string, (args: Record<string, unknown>) => unknown>) {
  invokeMock.mockImplementation(((command: string, args: Record<string, unknown>) => {
    const handler = handlers[command]
    if (!handler)
      return Promise.reject(new Error(`unexpected command: ${command}`))

    return Promise.resolve(handler(args))
  }) as typeof invoke)
}

describe('document store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.resetAllMocks()
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

  it('writes a draft once edits settle', async () => {
    vi.useFakeTimers()
    routeInvoke({ save_draft: () => undefined })
    const store = useDocumentStore()

    store.setContent('# 草稿内容')
    await vi.advanceTimersByTimeAsync(1200)

    expect(invokeMock).toHaveBeenCalledWith('save_draft', { path: null, content: '# 草稿内容' })
    vi.useRealTimers()
  })

  it('drops the draft after a successful save', async () => {
    saveMock.mockResolvedValue('D:\\notes\\draft.md')
    routeInvoke({
      write_text_file: () => undefined,
      file_modified_ms: () => 500,
      clear_draft: () => undefined,
    })
    const store = useDocumentStore()
    store.setContent('# Draft')

    await store.saveDocument()

    expect(invokeMock).toHaveBeenCalledWith('clear_draft', { path: 'D:\\notes\\draft.md' })
  })

  it('keeps unsaved drafts of other documents when opening a file', async () => {
    openMock.mockResolvedValue('D:\\notes\\b.md')
    const cleared: unknown[] = []
    routeInvoke({
      read_text_file: () => '# B',
      file_modified_ms: () => 100,
      clear_draft: (args) => {
        cleared.push(args.path)
        return undefined
      },
    })
    const store = useDocumentStore()
    store.setContent('# A 的未保存修改')

    await store.openDocument()

    expect(cleared).not.toContain(null)
  })

  it('keeps unsaved drafts of other documents when creating a new one', async () => {
    const cleared: unknown[] = []
    routeInvoke({
      clear_draft: (args) => {
        cleared.push(args.path)
        return undefined
      },
    })
    const store = useDocumentStore()
    store.setContent('# A 的未保存修改')

    store.createNew()

    expect(cleared).toHaveLength(0)
  })

  it('offers the newest non-empty draft for recovery', async () => {
    routeInvoke({
      list_drafts: () => [
        { key: 'b', path: 'D:\\notes\\b.md', content: '   ', savedAtMs: 300 },
        { key: 'a', path: 'D:\\notes\\a.md', content: '# 未保存的改动', savedAtMs: 200 },
      ],
    })
    const store = useDocumentStore()

    await store.checkForRecoveryDraft()

    expect(store.recoveryDraft?.path).toBe('D:\\notes\\a.md')
  })

  it('applies a recovered draft as unsaved content', async () => {
    routeInvoke({
      list_drafts: () => [{ key: 'a', path: 'D:\\notes\\a.md', content: '# 恢复内容', savedAtMs: 200 }],
    })
    const store = useDocumentStore()
    await store.checkForRecoveryDraft()

    store.recoverDraft()

    expect(store.content).toBe('# 恢复内容')
    expect(store.currentPath).toBe('D:\\notes\\a.md')
    expect(store.isDirty).toBe(true)
    expect(store.recoveryDraft).toBeNull()
  })

  it('discards a draft and clears its file', async () => {
    routeInvoke({
      list_drafts: () => [{ key: 'a', path: null, content: '# 丢弃我', savedAtMs: 200 }],
      clear_draft: () => undefined,
    })
    const store = useDocumentStore()
    await store.checkForRecoveryDraft()

    await store.discardDraft()

    expect(invokeMock).toHaveBeenCalledWith('clear_draft', { path: null })
    expect(store.recoveryDraft).toBeNull()
  })

  it('asks before overwriting a file changed by another program', async () => {
    openMock.mockResolvedValue('D:\\notes\\shared.md')
    routeInvoke({
      read_text_file: () => '# 磁盘版本',
      file_modified_ms: () => 100,
    })
    const store = useDocumentStore()
    await store.openDocument()
    store.setContent('# 本地修改')

    let mtimeCall = 0
    routeInvoke({
      file_modified_ms: () => (++mtimeCall === 1 ? 999 : 999),
    })
    await expect(store.saveDocument()).resolves.toBe(false)

    expect(invokeMock).not.toHaveBeenCalledWith('write_text_file', expect.anything())
    expect(store.conflictMessage).toContain('其他程序')
    expect(store.isDirty).toBe(true)
  })

  it('overwrites on request after a conflict', async () => {
    openMock.mockResolvedValue('D:\\notes\\shared.md')
    routeInvoke({
      read_text_file: () => '# 磁盘版本',
      file_modified_ms: () => 100,
    })
    const store = useDocumentStore()
    await store.openDocument()
    store.setContent('# 本地修改')

    routeInvoke({
      file_modified_ms: () => 999,
      write_text_file: () => undefined,
      clear_draft: () => undefined,
    })
    await expect(store.overwriteDocument()).resolves.toBe(true)

    expect(invokeMock).toHaveBeenCalledWith('write_text_file', {
      path: 'D:\\notes\\shared.md',
      content: '# 本地修改',
    })
    expect(store.conflictMessage).toBeNull()
    expect(store.isDirty).toBe(false)
  })

  it('reloads disk content and discards local edits', async () => {
    openMock.mockResolvedValue('D:\\notes\\shared.md')
    routeInvoke({
      read_text_file: () => '# 磁盘版本',
      file_modified_ms: () => 100,
    })
    const store = useDocumentStore()
    await store.openDocument()
    store.setContent('# 本地修改')

    routeInvoke({
      read_text_file: () => '# 其他人改过的版本',
      file_modified_ms: () => 999,
      clear_draft: () => undefined,
    })
    await expect(store.reloadFromDisk()).resolves.toBe(true)

    expect(store.content).toBe('# 其他人改过的版本')
    expect(store.isDirty).toBe(false)
    expect(store.conflictMessage).toBeNull()
  })

  it('explains permission failures in plain language', async () => {
    saveMock.mockResolvedValue('D:\\readonly\\note.md')
    routeInvoke({
      write_text_file: () => {
        throw new Error('io error: Access is denied. (os error 5)')
      },
    })
    const store = useDocumentStore()
    store.setContent('# Draft')

    await store.saveDocument()

    expect(store.errorMessage).toContain('权限')
    expect(store.errorMessage).toContain('另存为')
  })
})
