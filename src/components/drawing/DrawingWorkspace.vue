<script setup lang="ts">
import { markRaw, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { exportToSvg } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { Check, X } from 'lucide-vue-next'
import { ExcalidrawRoot } from '../../react/ExcalidrawRoot'
import type { ExcalidrawImperativeAPI } from '../../react/ExcalidrawRoot'

const props = defineProps<{
  theme: 'light' | 'dark'
}>()

const emit = defineEmits<{
  close: []
  insert: [markdown: string]
}>()

const host = useTemplateRef<HTMLDivElement>('host')
const reactRoot = shallowRef<Root | null>(null)
const api = shallowRef<ExcalidrawImperativeAPI | null>(null)
const isExporting = shallowRef(false)

function renderCanvas() {
  reactRoot.value?.render(createElement(ExcalidrawRoot, {
    theme: props.theme,
    onReady: (instance: ExcalidrawImperativeAPI) => {
      api.value = markRaw(instance)
    },
  }))
}

onMounted(() => {
  if (!host.value)
    return

  reactRoot.value = markRaw(createRoot(host.value))
  renderCanvas()
})

watch(() => props.theme, renderCanvas)

onBeforeUnmount(() => {
  reactRoot.value?.unmount()
  reactRoot.value = null
  api.value = null
})

async function insertDrawing() {
  if (!api.value || isExporting.value)
    return

  const elements = api.value.getSceneElements()
  if (!elements.length)
    return

  isExporting.value = true
  try {
    const svg = await exportToSvg({
      elements,
      appState: {
        ...api.value.getAppState(),
        exportBackground: true,
        exportWithDarkMode: props.theme === 'dark',
      },
      files: api.value.getFiles(),
      exportPadding: 24,
    })
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.outerHTML)}`
    emit('insert', `\n![MarkFX 绘图](${dataUrl})\n`)
  }
  finally {
    isExporting.value = false
  }
}
</script>

<template>
  <section class="drawing-workspace" aria-label="绘图工作区">
    <header class="drawing-header">
      <div class="drawing-title-group">
        <span class="drawing-kicker">CANVAS</span>
        <h2 class="drawing-title">自由绘图</h2>
      </div>
      <div class="drawing-actions">
        <button class="toolbar-button" type="button" aria-label="关闭绘图" @click="emit('close')">
          <X :size="17" aria-hidden="true" />
          取消
        </button>
        <button class="insert-button" type="button" :disabled="isExporting" @click="insertDrawing">
          <Check :size="17" aria-hidden="true" />
          {{ isExporting ? '正在插入' : '插入文档' }}
        </button>
      </div>
    </header>
    <div ref="host" class="drawing-host" />
  </section>
</template>

<style scoped>
.drawing-workspace {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  grid-template-rows: 56px minmax(0, 1fr);
  background: var(--surface-base);
}

.drawing-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-default);
  background: var(--surface-elevated);
  padding: 0 14px 0 20px;
}

.drawing-title-group {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.drawing-kicker {
  color: var(--accent);
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.drawing-title {
  margin: 0;
  font-size: 14px;
  font-weight: 650;
}

.drawing-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.insert-button {
  display: inline-flex;
  height: 36px;
  cursor: pointer;
  align-items: center;
  gap: 7px;
  border: 0;
  border-radius: 5px;
  background: var(--accent);
  padding: 0 14px;
  color: white;
  font-size: 13px;
  font-weight: 650;
  transition: background 150ms ease;
}

.insert-button:hover {
  background: var(--accent-strong);
}

.insert-button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.insert-button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.drawing-host {
  min-height: 0;
}

.drawing-host :deep(.excalidraw) {
  --color-primary: var(--accent);
  --color-primary-darker: var(--accent-strong);
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
</style>
