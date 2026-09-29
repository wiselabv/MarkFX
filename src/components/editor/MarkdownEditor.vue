<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, shallowRef, useTemplateRef } from 'vue'
import { useEventListener } from '@vueuse/core'
import { Crepe } from '@milkdown/crepe'
import { toggleLinkCommand } from '@milkdown/kit/component/link-tooltip'
import { toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm'
import { callCommand } from '@milkdown/kit/utils'
import {
  createCodeBlockCommand,
  insertHrCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  turnIntoTextCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from '@milkdown/kit/preset/commonmark'
import { redoCommand, undoCommand } from '@milkdown/kit/plugin/history'
import {
  Bold,
  Code,
  CodeXml,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Undo2,
} from 'lucide-vue-next'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import MermaidLightbox from './MermaidLightbox.vue'
import { mermaidSvgFromClick, storeMermaidSvg } from './mermaidPreview'
import { createMermaidRenderer } from './mermaidRender'
import type { MermaidApi } from './mermaidRender'

const model = defineModel<string>({ required: true })

const editorRoot = useTemplateRef<HTMLDivElement>('editorRoot')
const contextMenu = useTemplateRef<HTMLDivElement>('contextMenu')
const crepe = shallowRef<Crepe | null>(null)
const isReady = shallowRef(false)
const lightboxSvg = shallowRef<string | null>(null)
const menu = reactive({ open: false, x: 0, y: 0 })

let labelsObserver: MutationObserver | null = null
let labelsFrame = 0

const mermaidRenderer = createMermaidRenderer(async () => {
  const { default: mermaid } = await import('mermaid')
  return mermaid as unknown as MermaidApi
})

const toolbarHints = [
  '粗体（Ctrl+B）',
  '斜体（Ctrl+I）',
  '删除线',
  '行内代码',
  '行内公式',
  '插入链接（Ctrl+K）',
]

function applyAccessibleLabels() {
  const root = editorRoot.value
  if (!root)
    return

  const buttons = root.querySelectorAll<HTMLButtonElement>('.milkdown-toolbar .toolbar-item')
  buttons.forEach((button, index) => {
    const hint = toolbarHints[index]
    if (!hint)
      return

    button.title = hint
    button.setAttribute('aria-label', hint)
  })

  const latexConfirm = root.querySelector<HTMLButtonElement>('.milkdown-latex-inline-edit .container button')
  if (latexConfirm) {
    latexConfirm.title = '确认公式'
    latexConfirm.setAttribute('aria-label', '确认公式')
  }
}

const LABEL_HOST_SELECTORS = ['.milkdown-toolbar', '.milkdown-latex-inline-edit']

function touchesLabelHost(node: Node) {
  const element = node instanceof Element ? node : node.parentElement
  if (!element)
    return false

  return LABEL_HOST_SELECTORS.some(selector => element.closest(selector) !== null || element.querySelector(selector) !== null)
}

function scheduleAccessibleLabels(records?: MutationRecord[]) {
  if (records && !records.some(record => touchesLabelHost(record.target) || Array.from(record.addedNodes).some(touchesLabelHost)))
    return

  if (labelsFrame)
    return

  labelsFrame = requestAnimationFrame(() => {
    labelsFrame = 0
    applyAccessibleLabels()
  })
}

function runCommand(command: { key: unknown }, payload?: unknown) {
  if (!crepe.value)
    return

  crepe.value.editor.action(callCommand(command.key as never, payload as never))
  menu.open = false
  editorRoot.value?.querySelector<HTMLElement>('.ProseMirror')?.focus()
}

function openContextMenu(event: MouseEvent) {
  if (!editorRoot.value?.contains(event.target as Node))
    return

  event.preventDefault()
  menu.x = event.clientX
  menu.y = event.clientY
  menu.open = true

  void nextTick(() => {
    const element = contextMenu.value
    if (!element)
      return

    const rect = element.getBoundingClientRect()
    menu.x = Math.max(8, Math.min(menu.x, window.innerWidth - rect.width - 8))
    menu.y = Math.max(8, Math.min(menu.y, window.innerHeight - rect.height - 8))
  })
}

function closeContextMenu() {
  menu.open = false
}

function onEditorClick(event: MouseEvent) {
  const svg = mermaidSvgFromClick(event.target)
  if (svg)
    lightboxSvg.value = svg
}

function setHeading(level: 1 | 2 | 3 | 4 | 5 | 6) {
  runCommand(wrapInHeadingCommand, level)
}

function toggleFormat(format: 'bold' | 'italic' | 'strikethrough' | 'inlineCode' | 'link') {
  const commands = {
    bold: toggleStrongCommand,
    italic: toggleEmphasisCommand,
    strikethrough: toggleStrikethroughCommand,
    inlineCode: toggleInlineCodeCommand,
    link: toggleLinkCommand,
  }
  runCommand(commands[format])
}

function scrollToHeading(index: number) {
  const heading = editorRoot.value?.querySelectorAll<HTMLElement>('.ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6')[index]
  if (!heading)
    return

  heading.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  })
  heading.setAttribute('tabindex', '-1')
  heading.focus({ preventScroll: true })
}

defineExpose({ scrollToHeading, setHeading, toggleFormat })

useEventListener(window, 'pointerdown', event => {
  if (menu.open && !contextMenu.value?.contains(event.target as Node))
    closeContextMenu()
})
useEventListener(window, 'keydown', event => {
  if (event.key === 'Escape')
    closeContextMenu()
})
useEventListener(window, 'blur', closeContextMenu)
useEventListener(window, 'resize', closeContextMenu)
useEventListener(window, 'scroll', closeContextMenu, { capture: true })

function buildPreviewHost(svg: string) {
  const host = document.createElement('div')
  host.className = 'mermaid-preview-host'
  host.innerHTML = svg

  const zoomButton = document.createElement('button')
  zoomButton.type = 'button'
  zoomButton.className = 'mermaid-zoom-button'
  zoomButton.textContent = '放大查看'
  zoomButton.setAttribute('aria-label', '放大查看 Mermaid 图表')
  host.appendChild(zoomButton)

  return host
}

function buildErrorView(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const errorView = document.createElement('div')
  errorView.className = 'mermaid-preview-error'
  errorView.textContent = `Mermaid 图表无法渲染：${message}`

  return errorView
}

function renderCodePreview(
  language: string,
  content: string,
  applyPreview: (value: null | string | HTMLElement) => void,
) {
  if (language.toLowerCase() !== 'mermaid')
    return null

  const isDark = document.documentElement.classList.contains('dark')

  void mermaidRenderer.render(content, isDark).then(({ id, svg }) => {
    storeMermaidSvg(id, svg)
    applyPreview(buildPreviewHost(svg))
  }).catch((error) => {
    applyPreview(buildErrorView(error))
  })
}

onMounted(async () => {
  if (!editorRoot.value)
    return

  const instance = new Crepe({
    root: editorRoot.value,
    defaultValue: model.value,
    features: {
      [Crepe.Feature.Toolbar]: true,
      [Crepe.Feature.Latex]: true,
      [Crepe.Feature.CodeMirror]: true,
      [Crepe.Feature.ImageBlock]: true,
      [Crepe.Feature.BlockEdit]: true,
      [Crepe.Feature.Placeholder]: true,
    },
    featureConfigs: {
      [Crepe.Feature.Placeholder]: {
        text: '输入 / 以插入内容',
        mode: 'block',
      },
      [Crepe.Feature.CodeMirror]: {
        renderPreview: renderCodePreview,
        previewLabel: '预览',
        previewLoading: '正在渲染 Mermaid 图表…',
      },
    },
  })

  instance.on(listener => {
    listener.markdownUpdated((_ctx, markdown) => {
      model.value = markdown
    })
    listener.mounted(() => {
      isReady.value = true
      applyAccessibleLabels()
      labelsObserver = new MutationObserver(scheduleAccessibleLabels)
      labelsObserver.observe(editorRoot.value!, { childList: true, subtree: true })
    })
  })

  crepe.value = instance
  await instance.create()
})

onBeforeUnmount(async () => {
  labelsObserver?.disconnect()
  labelsObserver = null
  if (labelsFrame)
    cancelAnimationFrame(labelsFrame)
  labelsFrame = 0
  await crepe.value?.destroy()
  crepe.value = null
})
</script>

<template>
  <div class="editor-viewport">
    <div v-if="!isReady" class="editor-loading" role="status">
      <span class="loading-line loading-line-wide" />
      <span class="loading-line" />
      <span class="loading-line loading-line-short" />
    </div>
    <div
      ref="editorRoot"
      class="editor-root"
      :class="{ 'is-ready': isReady }"
      @click="onEditorClick"
      @contextmenu="openContextMenu"
    />

    <MermaidLightbox
      v-if="lightboxSvg"
      :svg="lightboxSvg"
      @close="lightboxSvg = null"
    />

    <Teleport to="body">
      <div
        v-if="menu.open"
        ref="contextMenu"
        class="markdown-context-menu"
        role="menu"
        aria-label="Markdown 编辑菜单"
        :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
        @contextmenu.prevent
      >
        <button role="menuitem" type="button" @click="runCommand(undoCommand)">
          <Undo2 :size="15" />撤销 <kbd>Ctrl Z</kbd>
        </button>
        <button role="menuitem" type="button" @click="runCommand(redoCommand)">
          <Redo2 :size="15" />重做 <kbd>Ctrl Y</kbd>
        </button>
        <div class="context-menu-separator" role="separator" />
        <button role="menuitem" type="button" @click="runCommand(toggleStrongCommand)">
          <Bold :size="15" />粗体 <kbd>Ctrl B</kbd>
        </button>
        <button role="menuitem" type="button" @click="runCommand(toggleEmphasisCommand)">
          <Italic :size="15" />斜体 <kbd>Ctrl I</kbd>
        </button>
        <button role="menuitem" type="button" @click="runCommand(toggleInlineCodeCommand)">
          <Code :size="15" />行内代码
        </button>
        <div class="context-menu-separator" role="separator" />
        <button role="menuitem" type="button" @click="runCommand(turnIntoTextCommand)">
          <Pilcrow :size="15" />正文
        </button>
        <button role="menuitem" type="button" @click="runCommand(wrapInHeadingCommand, 1)">
          <Heading1 :size="15" />一级标题
        </button>
        <button role="menuitem" type="button" @click="runCommand(wrapInHeadingCommand, 2)">
          <Heading2 :size="15" />二级标题
        </button>
        <button role="menuitem" type="button" @click="runCommand(wrapInBlockquoteCommand)">
          <Quote :size="15" />引用
        </button>
        <button role="menuitem" type="button" @click="runCommand(wrapInBulletListCommand)">
          <List :size="15" />无序列表
        </button>
        <button role="menuitem" type="button" @click="runCommand(wrapInOrderedListCommand)">
          <ListOrdered :size="15" />有序列表
        </button>
        <div class="context-menu-separator" role="separator" />
        <button role="menuitem" type="button" @click="runCommand(createCodeBlockCommand)">
          <CodeXml :size="15" />代码块
        </button>
        <button role="menuitem" type="button" @click="runCommand(insertHrCommand)">
          <Minus :size="15" />分隔线
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.editor-viewport {
  position: relative;
  height: 100%;
  overflow-y: auto;
  background: var(--editor-paper);
  scrollbar-gutter: stable;
}

.editor-root {
  min-height: 100%;
  opacity: 0;
  transition: opacity 180ms ease;
}

.editor-root.is-ready {
  opacity: 1;
}

.editor-loading {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: min(760px, calc(100% - 48px));
  margin: 0 auto;
  padding-top: 112px;
}

.loading-line {
  width: 68%;
  height: 13px;
  border-radius: 3px;
  background: var(--surface-subtle);
  animation: pulse 1.4s ease-in-out infinite;
}

.loading-line-wide {
  width: 42%;
  height: 28px;
}

.loading-line-short {
  width: 54%;
}

.editor-root :deep(.milkdown) {
  min-height: 100%;
  background: transparent;
  color: var(--text-primary);
  --crepe-color-background: var(--surface-base);
  --crepe-color-on-background: var(--text-primary);
  --crepe-color-surface: var(--surface-subtle);
  --crepe-color-surface-low: var(--surface-elevated);
  --crepe-color-on-surface: var(--text-primary);
  --crepe-color-on-surface-variant: var(--text-secondary);
  --crepe-color-outline: var(--border-strong);
  --crepe-color-primary: var(--accent);
  --crepe-color-secondary: var(--surface-hover);
  --crepe-color-hover: var(--surface-hover);
  --crepe-color-selected: var(--surface-active);
  --crepe-shadow-1: var(--shadow-panel);
}

.editor-root :deep(.crepe-placeholder::before) {
  color: var(--text-tertiary);
  opacity: 1;
}

.editor-root :deep(.ProseMirror) {
  min-height: calc(100vh - 116px);
  width: min(780px, calc(100% - 64px));
  margin: 0 auto;
  padding: 80px 0 160px;
  outline: none;
  color: var(--text-primary);
  font-family: ui-serif, Georgia, "Noto Serif SC", "Songti SC", serif;
  font-size: 17px;
  line-height: 1.82;
  letter-spacing: 0;
  caret-color: var(--accent);
}

.editor-root :deep(.ProseMirror h1),
.editor-root :deep(.ProseMirror h2),
.editor-root :deep(.ProseMirror h3),
.editor-root :deep(.ProseMirror h4) {
  color: var(--text-primary);
  font-family: Inter, ui-sans-serif, system-ui, "Microsoft YaHei UI", sans-serif;
  letter-spacing: 0;
}

.editor-root :deep(.ProseMirror h1) {
  margin: 1.5em 0 0.75em;
  font-size: 2.15rem;
  font-weight: 720;
  line-height: 1.18;
}

.editor-root :deep(.ProseMirror h2) {
  margin: 1.75em 0 0.7em;
  padding-bottom: 0.35em;
  border-bottom: 1px solid var(--border-default);
  font-size: 1.5rem;
  font-weight: 680;
  line-height: 1.3;
}

.editor-root :deep(.ProseMirror h3) {
  margin: 1.6em 0 0.6em;
  font-size: 1.18rem;
  font-weight: 650;
}

.editor-root :deep(.ProseMirror p) {
  margin: 0.75em 0;
}

.editor-root :deep(.ProseMirror a) {
  color: var(--accent);
  text-decoration-color: color-mix(in srgb, var(--accent) 40%, transparent);
  text-underline-offset: 3px;
}

.editor-root :deep(.ProseMirror blockquote) {
  margin: 1.5em 0;
  padding: 0.25em 0 0.25em 1.15em;
  border-left: 3px solid var(--accent);
  color: var(--text-secondary);
}

.editor-root :deep(.ProseMirror code) {
  border-radius: 4px;
  background: var(--surface-subtle);
  padding: 0.15em 0.35em;
  color: var(--accent-strong);
  font-family: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
  font-size: 0.88em;
}

.editor-root :deep(.ProseMirror pre) {
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background: var(--surface-subtle);
  box-shadow: none;
}

.editor-root :deep(.milkdown-code-block) {
  overflow: visible;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background: var(--surface-subtle);
}

.editor-root :deep(.milkdown-code-block .cm-editor),
.editor-root :deep(.milkdown-code-block .cm-gutters),
.editor-root :deep(.milkdown-code-block .cm-scroller) {
  background: transparent;
}

.editor-root :deep(.milkdown-code-block .cm-content),
.editor-root :deep(.milkdown-code-block .cm-line),
.editor-root :deep(.milkdown-code-block .milkdown-code-block-placeholder) {
  color: var(--text-primary);
  caret-color: var(--accent);
}

.editor-root :deep(.milkdown-code-block .cm-gutters) {
  color: var(--text-tertiary);
}

.editor-root :deep(.milkdown-code-block .language-list),
.editor-root :deep(.milkdown-code-block .list-wrapper) {
  color: var(--text-primary);
}

.editor-root :deep(.milkdown-code-block input::placeholder) {
  color: var(--text-tertiary);
  opacity: 1;
}

:global(html.dark) .editor-root :deep(.milkdown-code-block) {
  border-color: #3a404b;
  background: #171a1f;
  --crepe-color-surface: #171a1f;
  --crepe-color-surface-low: #20242b;
}

:global(html.dark) .editor-root :deep(.milkdown-code-block .cm-cursor) {
  border-left-color: #edf0f5;
}

.editor-root :deep(.milkdown-code-block .preview) {
  display: flex;
  justify-content: center;
  overflow-x: auto;
  padding: 20px;
  background: var(--editor-paper);
}

.editor-root :deep(.milkdown-code-block .preview svg) {
  display: block;
  max-width: 100%;
  height: auto;
}

.editor-root :global(.mermaid-preview-host) {
  position: relative;
  max-width: 100%;
  cursor: zoom-in;
}

.editor-root :global(.mermaid-preview-host > svg) {
  display: block;
  max-width: 100%;
  height: auto;
}

.editor-root :global(.mermaid-zoom-button) {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  height: 30px;
  cursor: pointer;
  align-items: center;
  border: 1px solid var(--border-default);
  border-radius: 5px;
  background: var(--surface-elevated);
  box-shadow: var(--shadow-panel);
  padding: 0 10px;
  color: var(--text-primary);
  font-family: Inter, ui-sans-serif, system-ui, "Microsoft YaHei UI", sans-serif;
  font-size: 12px;
  font-weight: 600;
  opacity: 0;
  pointer-events: none;
  transition: opacity 140ms ease;
}

.editor-root :global(.mermaid-preview-host:hover .mermaid-zoom-button),
.editor-root :global(.mermaid-zoom-button:focus-visible) {
  opacity: 1;
  pointer-events: auto;
}

.editor-root :global(.mermaid-zoom-button:focus-visible) {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.editor-root :deep(.mermaid-preview-error) {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--border-default));
  border-radius: 4px;
  background: color-mix(in srgb, var(--danger) 8%, var(--editor-paper));
  color: var(--danger);
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.editor-root :deep(.ProseMirror img) {
  border-radius: 4px;
}

.editor-root :deep(.ProseMirror hr) {
  border-color: var(--border-default);
}

.editor-root :deep(.ProseMirror-selectednode) {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

@keyframes pulse {
  0%, 100% { opacity: 0.46; }
  50% { opacity: 0.86; }
}

.markdown-context-menu {
  position: fixed;
  z-index: 100;
  width: 210px;
  max-height: calc(100vh - 16px);
  overflow-y: auto;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background: var(--surface-elevated);
  box-shadow: var(--shadow-panel);
  padding: 5px;
  color: var(--text-primary);
}

.markdown-context-menu button {
  display: grid;
  width: 100%;
  height: 31px;
  cursor: pointer;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  padding: 0 8px;
  color: inherit;
  font-size: 12px;
  text-align: left;
}

.markdown-context-menu button:hover,
.markdown-context-menu button:focus-visible {
  outline: 0;
  background: var(--surface-hover);
}

.markdown-context-menu kbd {
  color: var(--text-tertiary);
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 9px;
}

.context-menu-separator {
  height: 1px;
  margin: 4px 3px;
  background: var(--border-default);
}

@media (max-width: 720px) {
  .editor-root :deep(.ProseMirror) {
    width: calc(100% - 36px);
    padding-top: 48px;
    font-size: 16px;
  }
}
</style>
