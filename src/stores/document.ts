import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { describeFileError } from '../utils/fileErrors'

const RECENT_FILES_KEY = 'markfx:recent-files'
const MAX_RECENT_FILES = 8
const DRAFT_DELAY_MS = 1200

export interface RecoveryDraft {
  key: string
  path: string | null
  content: string
  savedAtMs: number
}

const welcomeDocument = `# 欢迎使用 MarkFX

一款安静、现代的 Markdown 写作工具。

从这里开始写作，或使用左上角的打开按钮载入已有文档。输入 **/** 可以快速插入标题、列表、代码块、表格与公式。

## 画图

点击工具栏中的“画图”打开自由画布；代码块中使用 \`mermaid\` 语言可以编写流程图、时序图和甘特图。

> 你的文档始终保存为标准 Markdown 文件。
`

function fileNameFromPath(path: string | null) {
  if (!path)
    return '未命名文档'

  return path.split(/[\\/]/).pop() || path
}

function loadRecentFiles() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_FILES_KEY) ?? '[]') as string[]
  }
  catch {
    return []
  }
}

export const useDocumentStore = defineStore('document', () => {
  const content = shallowRef(welcomeDocument)
  const currentPath = shallowRef<string | null>(null)
  const isDirty = shallowRef(false)
  const isBusy = shallowRef(false)
  const errorMessage = shallowRef<string | null>(null)
  const recentFiles = shallowRef<string[]>(loadRecentFiles())
  const editorRevision = shallowRef(0)
  const recoveryDraft = shallowRef<RecoveryDraft | null>(null)
  const conflictMessage = shallowRef<string | null>(null)

  let savedMtimeMs: number | null = null
  let draftTimer: ReturnType<typeof setTimeout> | null = null

  const fileName = computed(() => fileNameFromPath(currentPath.value))
  const windowTitle = computed(() => `${fileName.value}${isDirty.value ? ' *' : ''} — MarkFX`)

  function rememberFile(path: string) {
    recentFiles.value = [path, ...recentFiles.value.filter(item => item !== path)].slice(0, MAX_RECENT_FILES)
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recentFiles.value))
  }

  function setContent(markdown: string) {
    if (markdown === content.value)
      return

    content.value = markdown
    isDirty.value = true
    scheduleDraft()
  }

  function scheduleDraft() {
    if (draftTimer)
      clearTimeout(draftTimer)

    draftTimer = setTimeout(() => {
      draftTimer = null
      void persistDraft()
    }, DRAFT_DELAY_MS)
  }

  async function persistDraft(path = currentPath.value, markdown = content.value, dirty = isDirty.value) {
    if (!dirty || markdown.trim().length === 0)
      return

    try {
      await invoke('save_draft', { path, content: markdown })
    }
    catch {
      // 草稿写入失败不应打断写作，下一次内容变化会重试
    }
  }

  function cancelPendingDraft() {
    if (draftTimer) {
      clearTimeout(draftTimer)
      draftTimer = null
    }
  }

  async function dropDraft(path: string | null) {
    cancelPendingDraft()
    try {
      await invoke('clear_draft', { path })
    }
    catch {
      // 清理失败不影响主流程，残留草稿会在下次启动时提示
    }
  }

  async function syncMtime(path: string) {
    try {
      savedMtimeMs = await invoke<number | null>('file_modified_ms', { path }) ?? null
    }
    catch {
      savedMtimeMs = null
    }
  }

  async function checkForRecoveryDraft() {
    try {
      const drafts = await invoke<RecoveryDraft[]>('list_drafts')
      const candidate = drafts.find(draft => draft.content.trim().length > 0)
      recoveryDraft.value = candidate ?? null
    }
    catch {
      recoveryDraft.value = null
    }
  }

  function recoverDraft() {
    const draft = recoveryDraft.value
    if (!draft)
      return

    cancelPendingDraft()
    content.value = draft.content
    currentPath.value = draft.path
    isDirty.value = true
    savedMtimeMs = null
    errorMessage.value = null
    conflictMessage.value = null
    editorRevision.value += 1
    recoveryDraft.value = null
  }

  async function discardDraft() {
    const draft = recoveryDraft.value
    recoveryDraft.value = null
    if (draft)
      await dropDraft(draft.path)
  }

  function createNew() {
    content.value = '# 未命名文档\n\n'
    currentPath.value = null
    isDirty.value = false
    errorMessage.value = null
    conflictMessage.value = null
    savedMtimeMs = null
    editorRevision.value += 1
  }

  async function openDocument(path?: string) {
    const selectedPath = path ?? await open({
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }],
      multiple: false,
      directory: false,
    })

    if (!selectedPath)
      return false

    isBusy.value = true
    errorMessage.value = null
    try {
      const markdown = await invoke<string>('read_text_file', { path: selectedPath })
      content.value = markdown
      currentPath.value = selectedPath
      isDirty.value = false
      conflictMessage.value = null
      editorRevision.value += 1
      await syncMtime(selectedPath)
      rememberFile(selectedPath)
      return true
    }
    catch (error) {
      errorMessage.value = describeFileError(String(error))
      return false
    }
    finally {
      isBusy.value = false
    }
  }

  async function saveDocument(saveAs = false, options: { force?: boolean } = {}) {
    let targetPath = saveAs ? null : currentPath.value
    if (!targetPath) {
      targetPath = await save({
        defaultPath: fileName.value.endsWith('.md') ? fileName.value : `${fileName.value}.md`,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      })
    }

    if (!targetPath)
      return false

    if (!saveAs && !options.force && currentPath.value) {
      const changed = await hasExternalChanges()
      if (changed) {
        conflictMessage.value = '文件已被其他程序修改。请选择覆盖保存、重新载入磁盘内容，或另存为新文件。'
        isBusy.value = false
        return false
      }
    }

    isBusy.value = true
    errorMessage.value = null
    try {
      await invoke('write_text_file', { path: targetPath, content: content.value })
      const previousPath = currentPath.value
      currentPath.value = targetPath
      isDirty.value = false
      conflictMessage.value = null
      await syncMtime(targetPath)
      if (previousPath && previousPath !== targetPath)
        await dropDraft(previousPath)
      else
        await dropDraft(targetPath)
      rememberFile(targetPath)
      return true
    }
    catch (error) {
      errorMessage.value = describeFileError(String(error))
      return false
    }
    finally {
      isBusy.value = false
    }
  }

  async function hasExternalChanges() {
    const path = currentPath.value
    if (!path || savedMtimeMs === null)
      return false

    try {
      const current = await invoke<number | null>('file_modified_ms', { path })
      return current !== null && current !== savedMtimeMs
    }
    catch {
      return false
    }
  }

  async function overwriteDocument() {
    conflictMessage.value = null
    return saveDocument(false, { force: true })
  }

  async function reloadFromDisk() {
    const path = currentPath.value
    if (!path)
      return false

    isBusy.value = true
    try {
      content.value = await invoke<string>('read_text_file', { path })
      isDirty.value = false
      conflictMessage.value = null
      errorMessage.value = null
      editorRevision.value += 1
      await syncMtime(path)
      await dropDraft(path)
      return true
    }
    catch (error) {
      errorMessage.value = describeFileError(String(error))
      return false
    }
    finally {
      isBusy.value = false
    }
  }

  function dismissConflict() {
    conflictMessage.value = null
  }

  function removeRecentFile(path: string) {
    recentFiles.value = recentFiles.value.filter(item => item !== path)
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recentFiles.value))
  }

  function setError(message: string) {
    errorMessage.value = message
  }

  function clearError() {
    errorMessage.value = null
  }

  return {
    content,
    currentPath,
    isDirty,
    isBusy,
    errorMessage,
    recentFiles,
    editorRevision,
    recoveryDraft,
    conflictMessage,
    fileName,
    windowTitle,
    setContent,
    createNew,
    openDocument,
    saveDocument,
    overwriteDocument,
    reloadFromDisk,
    dismissConflict,
    checkForRecoveryDraft,
    recoverDraft,
    discardDraft,
    removeRecentFile,
    setError,
    clearError,
  }
})
