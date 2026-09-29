<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useEventListener, useLocalStorage } from '@vueuse/core'
import { AlertCircle, X } from 'lucide-vue-next'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'
import AppSidebar from './components/shell/AppSidebar.vue'
import AppTitlebar from './components/shell/AppTitlebar.vue'
import AppToolbar from './components/shell/AppToolbar.vue'
import DocumentNotice from './components/shell/DocumentNotice.vue'
import UpdateNotice from './components/shell/UpdateNotice.vue'
import MarkdownEditor from './components/editor/MarkdownEditor.vue'
import DocumentOutline from './components/outline/DocumentOutline.vue'
import SettingsPanel from './components/settings/SettingsPanel.vue'
import { formatShortcut, useShortcuts } from './composables/useShortcuts'
import type { ShortcutId } from './composables/useShortcuts'
import { useUpdater } from './composables/useUpdater'
import { isTauri } from './utils/env'
import { useDocumentStore } from './stores/document'
import { isThemeId, themes } from './themes'
import type { ThemeId } from './themes'

const DrawingWorkspace = defineAsyncComponent(() => import('./components/drawing/DrawingWorkspace.vue'))
const DiagramWorkspace = defineAsyncComponent(() => import('./components/drawing/DiagramWorkspace.vue'))

const documentStore = useDocumentStore()
const {
  content,
  editorRevision,
  errorMessage,
  fileName,
  isBusy,
  isDirty,
  recentFiles,
  recoveryDraft,
  conflictMessage,
  windowTitle,
} = storeToRefs(documentStore)

const sidebarOpen = shallowRef(true)
const drawingOpen = shallowRef(false)
const diagramOpen = shallowRef(false)
const settingsOpen = shallowRef(false)
const settingsPanel = useTemplateRef<InstanceType<typeof SettingsPanel>>('settingsPanel')
const markdownEditor = useTemplateRef<InstanceType<typeof MarkdownEditor>>('markdownEditor')
const { bindings, matches, resetAll, resetBinding, setBinding } = useShortcuts()
const updater = useUpdater()
const autostartEnabled = shallowRef(false)
const autostartBusy = shallowRef(false)
const closeToTrayEnabled = useLocalStorage('markfx:close-to-tray', true)
const outlineVisible = useLocalStorage('markfx:outline-visible', true)
const legacyMode = localStorage.getItem('markfx:color-mode')
const initialTheme: ThemeId = legacyMode === 'dark' ? 'ink' : 'paper'
const themeId = useLocalStorage<ThemeId>('markfx:theme', initialTheme)
if (!isThemeId(themeId.value))
  themeId.value = initialTheme
localStorage.removeItem('markfx:color-mode')

const activeTheme = computed(() => themes.find(theme => theme.id === themeId.value) ?? themes[0]!)
const isDark = computed(() => activeTheme.value.dark)
const drawingTheme = computed<'light' | 'dark'>(() => isDark.value ? 'dark' : 'light')

const shortcutActions: Record<ShortcutId, () => void> = {
  new: () => documentStore.createNew(),
  open: () => void documentStore.openDocument(),
  save: () => void documentStore.saveDocument(),
  saveAs: () => void documentStore.saveDocument(true),
  draw: () => { drawingOpen.value = true },
  diagram: () => { diagramOpen.value = true },
  toggleSidebar: () => { sidebarOpen.value = !sidebarOpen.value },
  settings: () => { settingsOpen.value = !settingsOpen.value },
  heading1: () => markdownEditor.value?.setHeading(1),
  heading2: () => markdownEditor.value?.setHeading(2),
  heading3: () => markdownEditor.value?.setHeading(3),
  heading4: () => markdownEditor.value?.setHeading(4),
  heading5: () => markdownEditor.value?.setHeading(5),
  heading6: () => markdownEditor.value?.setHeading(6),
  bold: () => markdownEditor.value?.toggleFormat('bold'),
  italic: () => markdownEditor.value?.toggleFormat('italic'),
  strikethrough: () => markdownEditor.value?.toggleFormat('strikethrough'),
  inlineCode: () => markdownEditor.value?.toggleFormat('inlineCode'),
  link: () => markdownEditor.value?.toggleFormat('link'),
}

useEventListener(window, 'keydown', event => {
  if (settingsOpen.value)
    return

  const shortcut = (Object.keys(shortcutActions) as ShortcutId[]).find(id => matches(event, id))
  if (shortcut) {
    event.preventDefault()
    shortcutActions[shortcut]()
    return
  }

  if (event.key === 'Escape') {
    drawingOpen.value = false
    diagramOpen.value = false
  }
})
watch(windowTitle, title => {
  document.title = title
  if (!isTauri())
    return
  void getCurrentWindow().setTitle(title).catch(() => undefined)
}, { immediate: true })

useEventListener(window, 'beforeunload', event => {
  if (!isDirty.value)
    return

  event.preventDefault()
  event.returnValue = ''
})

watch(activeTheme, theme => {
  document.documentElement.dataset.theme = theme.id
  document.documentElement.classList.toggle('dark', theme.dark)
}, { immediate: true })

async function toggleAutostart() {
  if (autostartBusy.value)
    return

  autostartBusy.value = true
  try {
    if (autostartEnabled.value)
      await disable()
    else
      await enable()
    autostartEnabled.value = await isEnabled()
  }
  catch (error) {
    documentStore.setError(error instanceof Error ? error.message : String(error))
  }
  finally {
    autostartBusy.value = false
  }
}

function selectTheme(id: ThemeId) {
  themeId.value = id
}

function updateShortcut(id: ShortcutId, binding: string) {
  const result = setBinding(id, binding)
  settingsPanel.value?.finishRecording(result.ok ? undefined : result.message)
}

let unlistenClose: (() => void) | undefined
let unlistenOpenFile: (() => void) | undefined
let unlistenDragDrop: (() => void) | undefined

async function openFromSystem(path: string | null | undefined) {
  if (!path)
    return

  if (isDirty.value && !await confirmDiscardChanges())
    return

  await documentStore.openDocument(path)
}

function confirmDiscardChanges() {
  return Promise.resolve(window.confirm('当前文档有未保存的更改，继续打开其他文件会丢弃这些更改。是否继续？'))
}

onMounted(async () => {
  void documentStore.checkForRecoveryDraft()
  autostartEnabled.value = await isEnabled().catch(() => false)
  if (!isTauri())
    return

  void invoke<string | null>('initial_open_path')
    .then(path => openFromSystem(path))
    .catch(() => undefined)

  unlistenOpenFile = await listen<string>('markfx://open-file', event => {
    void openFromSystem(event.payload)
  })

  unlistenDragDrop = await getCurrentWebview().onDragDropEvent(event => {
    if (event.payload.type === 'drop')
      void openFromSystem(event.payload.paths[0])
  })

  unlistenClose = await getCurrentWindow().onCloseRequested(async event => {
    if (!closeToTrayEnabled.value)
      return

    event.preventDefault()
    await getCurrentWindow().hide()
  })

  window.setTimeout(() => {
    void updater.checkForUpdate()
  }, 8000)
})

onUnmounted(() => {
  unlistenClose?.()
  unlistenOpenFile?.()
  unlistenDragDrop?.()
})

function insertDrawing(markdown: string) {
  documentStore.setContent(`${content.value.trimEnd()}\n${markdown}`)
  editorRevision.value += 1
  drawingOpen.value = false
}
</script>

<template>
  <div class="app-frame">
    <AppTitlebar :file-name="fileName" :is-dirty="isDirty" />
    <div class="app-shell" :class="{ 'sidebar-is-open': sidebarOpen }">
      <AppSidebar
      v-if="sidebarOpen"
      :current-path="documentStore.currentPath"
      :file-name="fileName"
      :recent-files="recentFiles"
      @close="sidebarOpen = false"
      @create="documentStore.createNew()"
      @open="documentStore.openDocument($event)"
      @remove-recent="documentStore.removeRecentFile($event)"
    />

    <main class="workspace">
      <AppToolbar
        :file-name="fileName"
        :is-busy="isBusy"
        :is-dirty="isDirty"
        :sidebar-open="sidebarOpen"
        :save-shortcut="formatShortcut(bindings.save)"
        @diagram="diagramOpen = true"
        @draw="drawingOpen = true"
        @save="documentStore.saveDocument()"
        @open-settings="settingsOpen = true"
        @toggle-sidebar="sidebarOpen = !sidebarOpen"
      />

      <section class="editor-surface" :class="{ 'outline-is-visible': outlineVisible }" aria-label="Markdown 编辑器">
        <MarkdownEditor ref="markdownEditor" :key="editorRevision" v-model="content" />
        <DocumentOutline
          v-if="outlineVisible"
          :markdown="content"
          @navigate="markdownEditor?.scrollToHeading($event)"
        />
      </section>

      <footer class="statusbar">
        <span>{{ isDirty ? '已修改' : '文档已同步到本地' }}</span>
        <span class="status-separator" />
        <span>Markdown</span>
        <span class="status-spacer" />
        <span>UTF-8</span>
        <span>Ctrl + S 保存</span>
      </footer>
    </main>

    <SettingsPanel
      ref="settingsPanel"
      :open="settingsOpen"
      :autostart-enabled="autostartEnabled"
      :autostart-busy="autostartBusy"
      :close-to-tray-enabled="closeToTrayEnabled"
      :outline-visible="outlineVisible"
      :bindings="bindings"
      :theme-id="themeId"
      :themes="themes"
      @close="settingsOpen = false"
      @reset-all-shortcuts="resetAll"
      @reset-shortcut="resetBinding"
      @select-theme="selectTheme"
      @set-shortcut="updateShortcut"
      @toggle-autostart="toggleAutostart"
      @toggle-close-to-tray="closeToTrayEnabled = !closeToTrayEnabled"
      @toggle-outline="outlineVisible = !outlineVisible"
    />

    <DocumentNotice
      :recovery="recoveryDraft"
      :conflict="conflictMessage"
      @recover="documentStore.recoverDraft()"
      @discard="documentStore.discardDraft()"
      @overwrite="documentStore.overwriteDocument()"
      @reload="documentStore.reloadFromDisk()"
      @save-as="documentStore.saveDocument(true)"
      @dismiss-conflict="documentStore.dismissConflict()"
    />

    <UpdateNotice
      v-if="updater.available.value"
      :version="updater.available.value.version"
      :notes="updater.available.value.notes"
      :status="updater.status.value"
      :progress="updater.progress.value"
      :error-message="updater.errorMessage.value"
      @install="updater.installUpdate()"
      @dismiss="updater.dismiss()"
    />

    <Transition name="notice">
      <div v-if="errorMessage" class="error-notice" role="alert">
        <AlertCircle :size="18" aria-hidden="true" />
        <div>
          <strong>操作未完成</strong>
          <p>{{ errorMessage }}</p>
        </div>
        <button class="icon-button" type="button" aria-label="关闭提示" @click="documentStore.clearError()">
          <X :size="17" />
        </button>
      </div>
    </Transition>

    <Transition name="drawing">
      <DrawingWorkspace
        v-if="drawingOpen"
        :theme="drawingTheme"
        @close="drawingOpen = false"
        @insert="insertDrawing"
      />
    </Transition>

    <Transition name="drawing">
      <DiagramWorkspace
        v-if="diagramOpen"
        :theme="drawingTheme"
        @close="diagramOpen = false"
        @insert="insertDrawing"
      />
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.app-frame {
  display: grid;
  width: 100%;
  height: 100%;
  grid-template-rows: 38px minmax(0, 1fr);
  background: var(--surface-base);
}

.app-shell {
  display: grid;
  width: 100%;
  height: 100%;
  grid-template-columns: minmax(0, 1fr);
  background: var(--surface-base);
}

.app-shell.sidebar-is-open {
  grid-template-columns: 238px minmax(0, 1fr);
}

.workspace {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: 54px minmax(0, 1fr) 28px;
}

.editor-surface {
  display: grid;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  grid-template-columns: minmax(0, 1fr);
  background: var(--editor-paper);
}

.editor-surface.outline-is-visible {
  grid-template-columns: minmax(0, 1fr) 218px;
}

.statusbar {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  border-top: 1px solid var(--border-default);
  background: var(--surface-elevated);
  padding: 0 12px;
  color: var(--text-tertiary);
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}

.status-separator {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--accent);
}

.status-spacer {
  flex: 1;
}

.error-notice {
  position: fixed;
  z-index: 40;
  right: 18px;
  bottom: 42px;
  display: grid;
  width: min(390px, calc(100vw - 36px));
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  border: 1px solid var(--border-strong);
  border-radius: 7px;
  background: var(--surface-elevated);
  box-shadow: var(--shadow-panel);
  padding: 14px;
  color: var(--danger);
}

.error-notice strong {
  display: block;
  color: var(--text-primary);
  font-size: 13px;
}

.error-notice p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.notice-enter-active,
.notice-leave-active,
.drawing-enter-active,
.drawing-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.notice-enter-from,
.notice-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.drawing-enter-from,
.drawing-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@media (max-width: 900px) {
  .editor-surface.outline-is-visible {
    grid-template-columns: minmax(0, 1fr);
  }

  .editor-surface.outline-is-visible > :last-child {
    display: none;
  }
}

@media (max-width: 760px) {
  .app-shell.sidebar-is-open {
    grid-template-columns: min(78vw, 280px) minmax(0, 1fr);
  }

  .app-shell.sidebar-is-open .workspace {
    opacity: 0.45;
    pointer-events: none;
  }
}
</style>
