<script setup lang="ts">
import { Cloud, GitBranch, PanelLeft, PenTool, Save, Settings, TextQuote } from 'lucide-vue-next'

const props = defineProps<{
  fileName: string
  isDirty: boolean
  isBusy: boolean
  sidebarOpen: boolean
  saveShortcut: string
}>()

const emit = defineEmits<{
  diagram: []
  draw: []
  openSettings: []
  save: []
  toggleSidebar: []
}>()
</script>

<template>
  <header class="toolbar">
    <div class="toolbar-left">
      <button
        v-if="!props.sidebarOpen"
        class="icon-button"
        type="button"
        title="展开侧栏"
        aria-label="展开侧栏"
        @click="emit('toggleSidebar')"
      >
        <PanelLeft :size="18" />
      </button>
      <div class="document-title" :title="props.fileName">
        <TextQuote :size="16" aria-hidden="true" />
        <span>{{ props.fileName }}</span>
        <i v-if="props.isDirty" class="dirty-dot" title="有未保存的更改" />
      </div>
    </div>

    <div class="toolbar-center" aria-label="编辑工具">
      <button class="toolbar-button" type="button" title="打开手绘" @click="emit('draw')">
        <PenTool :size="16" aria-hidden="true" />
        手绘
      </button>
      <button class="toolbar-button" type="button" title="打开结构图" @click="emit('diagram')">
        <GitBranch :size="16" aria-hidden="true" />
        结构图
      </button>
    </div>

    <div class="toolbar-right">
      <div class="sync-status" :class="{ 'is-busy': props.isBusy }" role="status">
        <Cloud :size="14" aria-hidden="true" />
        {{ props.isBusy ? '处理中' : props.isDirty ? '未保存' : '已保存' }}
      </div>
      <button class="save-button" type="button" :disabled="props.isBusy" :title="`保存 ${props.saveShortcut}`" @click="emit('save')">
        <Save :size="16" aria-hidden="true" />
        保存
      </button>
      <button class="icon-button settings-button" type="button" title="设置" aria-label="打开设置" @click="emit('openSettings')">
        <Settings :size="17" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.toolbar {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) auto minmax(220px, 1fr);
  min-width: 0;
  align-items: center;
  border-bottom: 1px solid var(--border-default);
  background: var(--surface-elevated);
  padding: 0 12px;
}

.toolbar-left,
.toolbar-center,
.toolbar-right {
  display: flex;
  min-width: 0;
  align-items: center;
}

.toolbar-left {
  gap: 5px;
}

.toolbar-center {
  justify-content: center;
  gap: 4px;
}

.toolbar-right {
  justify-content: flex-end;
  gap: 6px;
}

.document-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  color: var(--text-secondary);
  font-size: 12px;
}

.document-title span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dirty-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--warning);
}

.sync-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px;
  color: var(--text-tertiary);
  font-size: 10px;
}

.sync-status.is-busy svg {
  animation: breathe 900ms ease-in-out infinite alternate;
}

.save-button {
  display: inline-flex;
  height: 34px;
  cursor: pointer;
  align-items: center;
  gap: 7px;
  border: 0;
  border-radius: 5px;
  background: var(--text-primary);
  padding: 0 13px;
  color: var(--surface-elevated);
  font-size: 12px;
  font-weight: 650;
  transition: opacity 150ms ease;
}

.save-button:hover {
  opacity: 0.82;
}

.save-button:disabled {
  cursor: wait;
  opacity: 0.5;
}

.save-button:focus-visible,
.settings-button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.settings-button {
  margin-left: 2px;
}

@keyframes breathe {
  from { opacity: 0.4; }
  to { opacity: 1; }
}

@media (max-width: 860px) {
  .toolbar {
    grid-template-columns: minmax(120px, 1fr) auto auto;
  }

  .toolbar-center .toolbar-button {
    width: 36px;
    justify-content: center;
    padding: 0;
    font-size: 0;
  }

  .sync-status {
    display: none;
  }
}
</style>
