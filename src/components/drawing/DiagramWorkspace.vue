<script setup lang="ts">
import { nextTick, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { Check, Code2, Eye, X } from 'lucide-vue-next'

const props = defineProps<{
  theme: 'light' | 'dark'
}>()

const emit = defineEmits<{
  close: []
  insert: [markdown: string]
}>()

const source = shallowRef(`flowchart LR
  Idea[想法] --> Draft[开始写作]
  Draft --> Review{需要修改?}
  Review -->|是| Draft
  Review -->|否| Publish[完成文档]`)
const preview = useTemplateRef<HTMLDivElement>('preview')
const renderError = shallowRef<string | null>(null)
const activeView = shallowRef<'split' | 'preview'>('split')
let renderId = 0

async function renderDiagram() {
  const target = preview.value
  if (!target)
    return

  try {
    const { default: mermaid } = await import('mermaid')
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: props.theme === 'dark' ? 'dark' : 'neutral',
      fontFamily: 'Inter, Microsoft YaHei UI, sans-serif',
    })
    const id = `markfx-diagram-${++renderId}`
    const { svg } = await mermaid.render(id, source.value)
    target.innerHTML = svg
    renderError.value = null
  }
  catch (error) {
    target.replaceChildren()
    renderError.value = String(error).replace(/^Error:\s*/, '')
  }
}

let renderTimer: ReturnType<typeof setTimeout> | undefined
watch([source, () => props.theme], () => {
  clearTimeout(renderTimer)
  renderTimer = setTimeout(() => void renderDiagram(), 260)
})

onMounted(async () => {
  await nextTick()
  await renderDiagram()
})

function insertDiagram() {
  if (!source.value.trim() || renderError.value)
    return

  emit('insert', `\n\`\`\`mermaid\n${source.value.trim()}\n\`\`\`\n`)
}
</script>

<template>
  <section class="diagram-workspace" aria-label="结构图工作区">
    <header class="diagram-header">
      <div class="diagram-title-group">
        <span class="diagram-kicker">DIAGRAM</span>
        <h2 class="diagram-title">结构图</h2>
      </div>
      <div class="view-switch" aria-label="视图模式">
        <button type="button" :class="{ active: activeView === 'split' }" @click="activeView = 'split'">
          <Code2 :size="15" aria-hidden="true" />
          编辑
        </button>
        <button type="button" :class="{ active: activeView === 'preview' }" @click="activeView = 'preview'">
          <Eye :size="15" aria-hidden="true" />
          预览
        </button>
      </div>
      <div class="diagram-actions">
        <button class="toolbar-button" type="button" @click="emit('close')">
          <X :size="17" aria-hidden="true" />
          取消
        </button>
        <button class="insert-button" type="button" :disabled="!!renderError" @click="insertDiagram">
          <Check :size="17" aria-hidden="true" />
          插入文档
        </button>
      </div>
    </header>

    <div class="diagram-body" :class="{ 'preview-only': activeView === 'preview' }">
      <label v-if="activeView === 'split'" class="source-panel">
        <span class="panel-label">Mermaid 源码</span>
        <textarea v-model="source" spellcheck="false" aria-label="Mermaid 源码" />
      </label>
      <section class="preview-panel" aria-label="结构图预览">
        <span class="panel-label">实时预览</span>
        <div class="preview-canvas">
          <div ref="preview" class="diagram-preview" />
          <p v-if="renderError" class="diagram-error" role="alert">{{ renderError }}</p>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.diagram-workspace {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  grid-template-rows: 56px minmax(0, 1fr);
  background: var(--surface-base);
}

.diagram-header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  border-bottom: 1px solid var(--border-default);
  background: var(--surface-elevated);
  padding: 0 14px 0 20px;
}

.diagram-title-group,
.diagram-actions,
.view-switch,
.view-switch button,
.insert-button {
  display: flex;
  align-items: center;
}

.diagram-title-group {
  gap: 12px;
}

.diagram-kicker {
  color: var(--accent);
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.diagram-title {
  margin: 0;
  font-size: 14px;
  font-weight: 650;
}

.view-switch {
  gap: 2px;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background: var(--surface-base);
  padding: 2px;
}

.view-switch button {
  height: 29px;
  cursor: pointer;
  gap: 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  padding: 0 10px;
  color: var(--text-secondary);
  font-size: 11px;
}

.view-switch button.active {
  background: var(--surface-elevated);
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgb(20 28 24 / 10%);
}

.diagram-actions {
  justify-content: flex-end;
  gap: 6px;
}

.insert-button {
  height: 36px;
  cursor: pointer;
  gap: 7px;
  border: 0;
  border-radius: 5px;
  background: var(--accent);
  padding: 0 14px;
  color: white;
  font-size: 13px;
  font-weight: 650;
}

.insert-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.diagram-body {
  display: grid;
  min-height: 0;
  grid-template-columns: minmax(300px, 0.82fr) minmax(420px, 1.18fr);
}

.diagram-body.preview-only {
  grid-template-columns: 1fr;
}

.source-panel,
.preview-panel {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: 44px minmax(0, 1fr);
}

.source-panel {
  border-right: 1px solid var(--border-default);
  background: var(--surface-elevated);
}

.source-panel > .panel-label,
.preview-panel > .panel-label {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border-default);
  padding: 0 16px;
}

.source-panel textarea {
  width: 100%;
  height: 100%;
  resize: none;
  border: 0;
  outline: none;
  background: var(--surface-elevated);
  padding: 24px;
  color: var(--text-primary);
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 13px;
  line-height: 1.75;
  tab-size: 2;
}

.preview-panel {
  background: var(--surface-base);
}

.preview-canvas {
  display: grid;
  min-height: 0;
  place-items: center;
  overflow: auto;
  padding: 36px;
}

.diagram-preview {
  width: min(880px, 100%);
  color: var(--text-primary);
  text-align: center;
}

.diagram-preview :deep(svg) {
  max-width: 100%;
  height: auto;
}

.diagram-error {
  max-width: 620px;
  border-left: 3px solid var(--danger);
  margin: 0;
  padding: 10px 14px;
  color: var(--danger);
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
}

@media (max-width: 780px) {
  .diagram-header {
    grid-template-columns: 1fr auto;
  }

  .view-switch {
    display: none;
  }

  .diagram-body {
    grid-template-columns: 1fr;
  }

  .preview-panel {
    display: none;
  }
}
</style>
