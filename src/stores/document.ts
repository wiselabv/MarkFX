import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'

const RECENT_FILES_KEY = 'markfx:recent-files'
const MAX_RECENT_FILES = 8

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
  }

  function createNew() {
    content.value = '# 未命名文档\n\n'
    currentPath.value = null
    isDirty.value = false
    errorMessage.value = null
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
      editorRevision.value += 1
      rememberFile(selectedPath)
      return true
    }
    catch (error) {
      errorMessage.value = String(error)
      return false
    }
    finally {
      isBusy.value = false
    }
  }

  async function saveDocument(saveAs = false) {
    let targetPath = saveAs ? null : currentPath.value
    if (!targetPath) {
      targetPath = await save({
        defaultPath: fileName.value.endsWith('.md') ? fileName.value : `${fileName.value}.md`,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      })
    }

    if (!targetPath)
      return false

    isBusy.value = true
    errorMessage.value = null
    try {
      await invoke('write_text_file', { path: targetPath, content: content.value })
      currentPath.value = targetPath
      isDirty.value = false
      rememberFile(targetPath)
      return true
    }
    catch (error) {
      errorMessage.value = String(error)
      return false
    }
    finally {
      isBusy.value = false
    }
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
    fileName,
    windowTitle,
    setContent,
    createNew,
    openDocument,
    saveDocument,
    removeRecentFile,
    setError,
    clearError,
  }
})
