<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Maximize2, Minus, Square, X } from 'lucide-vue-next'
import { isTauri } from '../../utils/env'

const props = defineProps<{
  fileName: string
  isDirty: boolean
}>()

const appWindow = isTauri() ? getCurrentWindow() : null
const isMaximized = shallowRef(false)

async function syncMaximized() {
  isMaximized.value = (await appWindow?.isMaximized().catch(() => false)) ?? false
}

async function toggleMaximize() {
  if (!appWindow)
    return
  await appWindow.toggleMaximize()
  await syncMaximized()
}

function handleDragDoubleClick(event: MouseEvent) {
  if (event.button === 0)
    void toggleMaximize()
}

let unlistenResize: (() => void) | undefined

onMounted(async () => {
  await syncMaximized()
  if (appWindow)
    unlistenResize = await appWindow.onResized(syncMaximized)
})

onUnmounted(() => unlistenResize?.())
</script>

<template>
  <header class="titlebar">
    <div class="titlebar-brand" data-tauri-drag-region>
      <span class="brand-mark" aria-hidden="true">M</span>
      <span class="brand-name">MarkFX</span>
    </div>

    <div
      class="titlebar-document"
      data-tauri-drag-region
      :title="props.fileName"
      @dblclick="handleDragDoubleClick"
    >
      <span>{{ props.fileName }}</span>
      <i v-if="props.isDirty" class="unsaved-indicator" title="有未保存的更改" />
    </div>

    <div class="window-controls">
      <button type="button" title="最小化" aria-label="最小化窗口" @click="appWindow?.minimize()">
        <Minus :size="16" :stroke-width="1.7" />
      </button>
      <button
        type="button"
        :title="isMaximized ? '还原' : '最大化'"
        :aria-label="isMaximized ? '还原窗口' : '最大化窗口'"
        @click="toggleMaximize"
      >
        <Square v-if="!isMaximized" :size="12" :stroke-width="1.7" />
        <Maximize2 v-else :size="13" :stroke-width="1.7" />
      </button>
      <button class="close-button" type="button" title="关闭" aria-label="关闭窗口" @click="appWindow?.close()">
        <X :size="16" :stroke-width="1.7" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.titlebar {
  display: grid;
  height: 38px;
  grid-template-columns: minmax(150px, 1fr) minmax(180px, 2fr) minmax(150px, 1fr);
  align-items: stretch;
  border-bottom: 1px solid var(--border-default);
  background: var(--surface-base);
  color: var(--text-secondary);
  user-select: none;
}

.titlebar-brand,
.titlebar-document {
  display: flex;
  min-width: 0;
  align-items: center;
}

.titlebar-brand {
  gap: 8px;
  padding-left: 12px;
}

.brand-mark {
  display: grid;
  width: 21px;
  height: 21px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 5px;
  background: var(--text-primary);
  color: var(--surface-base);
  font-size: 12px;
  font-weight: 780;
  line-height: 1;
}

.brand-name {
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 650;
}

.titlebar-document {
  justify-content: center;
  gap: 7px;
  overflow: hidden;
  padding: 0 20px;
  font-size: 11px;
}

.titlebar-document span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unsaved-indicator {
  width: 5px;
  height: 5px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--warning);
}

.window-controls {
  display: flex;
  justify-content: flex-end;
}

.window-controls button {
  display: grid;
  width: 46px;
  height: 37px;
  cursor: default;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  transition: background 120ms ease, color 120ms ease;
}

.window-controls button:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.window-controls button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -3px;
}

.window-controls .close-button:hover {
  background: #c42b1c;
  color: #fff;
}

@media (max-width: 680px) {
  .titlebar {
    grid-template-columns: 90px minmax(80px, 1fr) 138px;
  }

  .brand-name {
    display: none;
  }
}
</style>
