<script setup lang="ts">
import { computed } from 'vue'
import { FileWarning, RotateCcw, Save, Trash2, Upload, X } from 'lucide-vue-next'
import type { RecoveryDraft } from '../../stores/document'

const props = defineProps<{
  recovery: RecoveryDraft | null
  conflict: string | null
}>()

const emit = defineEmits<{
  recover: []
  discard: []
  overwrite: []
  reload: []
  saveAs: []
  dismissConflict: []
}>()

const draftName = computed(() => {
  const path = props.recovery?.path
  if (!path)
    return '未命名文档'

  return path.split(/[\\/]/).pop() || path
})

const draftTime = computed(() => {
  const savedAt = props.recovery?.savedAtMs
  if (!savedAt)
    return ''

  const date = new Date(savedAt)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
})
</script>

<template>
  <div v-if="recovery || conflict" class="document-notice" role="alert">
    <template v-if="recovery">
      <RotateCcw :size="18" aria-hidden="true" />
      <div>
        <strong>发现未保存的草稿</strong>
        <p>
          {{ draftName }}<template v-if="draftTime"> · {{ draftTime }}</template>
          — 上次退出时有内容尚未写入文件。
        </p>
      </div>
      <div class="notice-actions">
        <button type="button" class="notice-button is-primary" @click="emit('recover')">恢复</button>
        <button type="button" class="notice-button" @click="emit('discard')">
          <Trash2 :size="14" aria-hidden="true" />丢弃
        </button>
      </div>
    </template>

    <template v-else-if="conflict">
      <FileWarning :size="18" aria-hidden="true" />
      <div>
        <strong>文件已被外部修改</strong>
        <p>{{ conflict }}</p>
      </div>
      <div class="notice-actions">
        <button type="button" class="notice-button is-primary" @click="emit('overwrite')">
          <Save :size="14" aria-hidden="true" />覆盖保存
        </button>
        <button type="button" class="notice-button" @click="emit('reload')">
          <Upload :size="14" aria-hidden="true" />重新载入
        </button>
        <button type="button" class="notice-button" @click="emit('saveAs')">另存为</button>
      </div>
      <button class="icon-button notice-dismiss" type="button" aria-label="稍后处理" @click="emit('dismissConflict')">
        <X :size="17" />
      </button>
    </template>
  </div>
</template>

<style scoped>
.document-notice {
  display: flex;
  position: fixed;
  z-index: 40;
  top: 52px;
  left: 50%;
  width: min(720px, calc(100vw - 48px));
  transform: translateX(-50%);
  align-items: center;
  gap: 12px;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background: var(--surface-elevated);
  box-shadow: var(--shadow-panel);
  padding: 10px 12px 10px 14px;
  color: var(--text-primary);
}

.document-notice > div:not(.notice-actions) {
  flex: 1;
  min-width: 0;
}

.document-notice strong {
  display: block;
  font-size: 12px;
  font-weight: 650;
}

.document-notice p {
  margin: 3px 0 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.notice-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 6px;
}

.notice-button {
  display: inline-flex;
  height: 28px;
  cursor: pointer;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--border-default);
  border-radius: 5px;
  background: var(--surface-base);
  padding: 0 10px;
  color: var(--text-primary);
  font-size: 12px;
}

.notice-button:hover {
  background: var(--surface-hover);
}

.notice-button.is-primary {
  border-color: var(--accent);
  background: var(--surface-base);
  color: var(--accent);
  font-weight: 620;
}

.notice-button:focus-visible,
.notice-dismiss:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.notice-dismiss {
  flex: 0 0 auto;
}
</style>
