<script setup lang="ts">
import { computed } from 'vue'
import { Download, Sparkles, X } from 'lucide-vue-next'

const props = defineProps<{
  version: string
  notes: string | null
  status: string
  progress: number
  errorMessage: string | null
}>()

const emit = defineEmits<{
  install: []
  dismiss: []
}>()

const isDownloading = computed(() => props.status === 'downloading')

const actionLabel = computed(() => {
  if (isDownloading.value)
    return `正在下载 ${props.progress}%`

  return '下载并安装'
})
</script>

<template>
  <div class="update-notice" role="status">
    <Sparkles :size="18" aria-hidden="true" />
    <div class="update-copy">
      <strong>发现新版本 {{ version }}</strong>
      <pre v-if="notes" class="update-notes">{{ notes }}</pre>
      <p v-else>下载并安装后应用会自动重启。</p>
      <p v-if="errorMessage" class="update-error">更新失败：{{ errorMessage }}</p>
    </div>
    <div class="update-actions">
      <button
        type="button"
        class="update-button is-primary"
        :disabled="isDownloading"
        @click="emit('install')"
      >
        <Download :size="14" aria-hidden="true" />{{ actionLabel }}
      </button>
      <button type="button" class="update-button" :disabled="isDownloading" @click="emit('dismiss')">
        稍后
      </button>
    </div>
    <button
      class="icon-button update-dismiss"
      type="button"
      aria-label="关闭更新提示"
      :disabled="isDownloading"
      @click="emit('dismiss')"
    >
      <X :size="17" />
    </button>
  </div>
</template>

<style scoped>
.update-notice {
  display: flex;
  position: fixed;
  z-index: 45;
  right: 18px;
  bottom: 42px;
  width: min(420px, calc(100vw - 36px));
  align-items: flex-start;
  gap: 12px;
  border: 1px solid var(--border-default);
  border-radius: 7px;
  background: var(--surface-elevated);
  box-shadow: var(--shadow-panel);
  padding: 14px;
  color: var(--text-primary);
}

.update-copy {
  flex: 1;
  min-width: 0;
}

.update-copy strong {
  display: block;
  font-size: 13px;
  font-weight: 650;
}

.update-notes {
  max-height: 132px;
  overflow-y: auto;
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.update-copy p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.update-error {
  color: var(--danger);
}

.update-actions {
  display: grid;
  flex: 0 0 auto;
  gap: 6px;
}

.update-button {
  display: inline-flex;
  height: 28px;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px solid var(--border-default);
  border-radius: 5px;
  background: var(--surface-base);
  padding: 0 10px;
  color: var(--text-primary);
  font-size: 12px;
  white-space: nowrap;
}

.update-button.is-primary {
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 620;
}

.update-button:disabled,
.update-dismiss:disabled {
  cursor: default;
  opacity: 0.62;
}

.update-button:focus-visible,
.update-dismiss:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.update-dismiss {
  flex: 0 0 auto;
}
</style>
