<script setup lang="ts">
import { nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import { Check, Keyboard, MonitorUp, Palette, RotateCcw, Settings, X } from 'lucide-vue-next'
import { useEventListener } from '@vueuse/core'
import { formatShortcut, shortcutDefinitions, shortcutFromEvent } from '../../composables/useShortcuts'
import type { ShortcutId } from '../../composables/useShortcuts'
import type { ThemeId, ThemeOption } from '../../themes'

const props = defineProps<{
  open: boolean
  autostartEnabled: boolean
  autostartBusy: boolean
  closeToTrayEnabled: boolean
  outlineVisible: boolean
  themeId: ThemeId
  themes: ThemeOption[]
  bindings: Record<ShortcutId, string>
}>()

const emit = defineEmits<{
  close: []
  resetAllShortcuts: []
  resetShortcut: [id: ShortcutId]
  selectTheme: [id: ThemeId]
  setShortcut: [id: ShortcutId, binding: string]
  toggleAutostart: []
  toggleCloseToTray: []
  toggleOutline: []
}>()

const closeButton = useTemplateRef<HTMLButtonElement>('closeButton')
const recordingId = shallowRef<ShortcutId | null>(null)
const shortcutError = shallowRef<string | null>(null)

watch(() => props.open, async (open) => {
  if (!open) {
    recordingId.value = null
    shortcutError.value = null
    return
  }
  await nextTick()
  closeButton.value?.focus()
})

useEventListener(window, 'keydown', event => {
  if (!props.open)
    return

  if (recordingId.value) {
    event.preventDefault()
    event.stopImmediatePropagation()
    if (event.key === 'Escape') {
      recordingId.value = null
      shortcutError.value = null
      return
    }

    const binding = shortcutFromEvent(event)
    if (!binding) {
      shortcutError.value = '请同时按下 Ctrl、Alt、Shift 或 Win/Command。'
      return
    }

    emit('setShortcut', recordingId.value, binding)
    return
  }

  if (event.key === 'Escape' || (event.ctrlKey && event.key === ',')) {
    event.preventDefault()
    emit('close')
  }
}, { capture: true })

function startRecording(id: ShortcutId) {
  recordingId.value = id
  shortcutError.value = null
}

function finishRecording(error?: string) {
  if (error) {
    shortcutError.value = error
    return
  }
  recordingId.value = null
  shortcutError.value = null
}

defineExpose({ finishRecording })
</script>

<template>
  <Teleport to="body">
    <Transition name="settings-backdrop">
      <div v-if="props.open" class="settings-backdrop" @mousedown.self="emit('close')">
        <Transition name="settings-panel" appear>
          <aside class="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <header class="settings-header">
              <div>
                <Settings :size="18" aria-hidden="true" />
                <h2 id="settings-title">设置</h2>
              </div>
              <button ref="closeButton" class="icon-action" type="button" title="关闭设置" aria-label="关闭设置" @click="emit('close')">
                <X :size="18" />
              </button>
            </header>

            <div class="settings-content">
              <section class="settings-section" aria-labelledby="appearance-heading">
                <div class="section-heading">
                  <Palette :size="16" aria-hidden="true" />
                  <div>
                    <h3 id="appearance-heading">外观</h3>
                    <p>选择适合当前环境的编辑界面。</p>
                  </div>
                </div>
                <div class="theme-grid" role="radiogroup" aria-label="界面主题">
                  <button
                    v-for="theme in props.themes"
                    :key="theme.id"
                    class="theme-choice"
                    :class="{ 'is-selected': theme.id === props.themeId }"
                    type="button"
                    role="radio"
                    :aria-checked="theme.id === props.themeId"
                    @click="emit('selectTheme', theme.id)"
                  >
                    <span class="theme-preview" aria-hidden="true">
                      <i v-for="color in theme.swatches" :key="color" :style="{ backgroundColor: color }" />
                    </span>
                    <span class="theme-name">
                      <strong>{{ theme.name }}</strong>
                      <small>{{ theme.description }}</small>
                    </span>
                    <Check v-if="theme.id === props.themeId" :size="15" aria-hidden="true" />
                  </button>
                </div>
              </section>

              <section class="settings-section" aria-labelledby="app-heading">
                <div class="section-heading">
                  <MonitorUp :size="16" aria-hidden="true" />
                  <div>
                    <h3 id="app-heading">应用</h3>
                    <p>管理启动和后台运行方式。</p>
                  </div>
                </div>
                <div class="setting-list">
                  <button
                    class="setting-row"
                    type="button"
                    role="switch"
                    :aria-checked="props.autostartEnabled"
                    :disabled="props.autostartBusy"
                    @click="emit('toggleAutostart')"
                  >
                    <span>
                      <strong>开机自动启动</strong>
                      <small>登录系统后静默进入托盘</small>
                    </span>
                    <i class="switch-control" :class="{ 'is-on': props.autostartEnabled }"><b /></i>
                  </button>
                  <button
                    class="setting-row"
                    type="button"
                    role="switch"
                    :aria-checked="props.closeToTrayEnabled"
                    @click="emit('toggleCloseToTray')"
                  >
                    <span>
                      <strong>关闭时隐藏到托盘</strong>
                      <small>点击关闭按钮后继续在后台运行</small>
                    </span>
                    <i class="switch-control" :class="{ 'is-on': props.closeToTrayEnabled }"><b /></i>
                  </button>
                  <button
                    class="setting-row"
                    type="button"
                    role="switch"
                    :aria-checked="props.outlineVisible"
                    @click="emit('toggleOutline')"
                  >
                    <span>
                      <strong>显示文档大纲</strong>
                      <small>在编辑区右侧显示标题导航</small>
                    </span>
                    <i class="switch-control" :class="{ 'is-on': props.outlineVisible }"><b /></i>
                  </button>
                </div>
              </section>

              <section class="settings-section shortcuts-section" aria-labelledby="shortcuts-heading">
                <div class="section-heading with-action">
                  <Keyboard :size="16" aria-hidden="true" />
                  <div>
                    <h3 id="shortcuts-heading">快捷键</h3>
                    <p>点击按键组合后，直接录入新的快捷键。</p>
                  </div>
                  <button class="text-action" type="button" @click="emit('resetAllShortcuts')">
                    <RotateCcw :size="13" />
                    全部恢复
                  </button>
                </div>
                <p v-if="shortcutError" class="shortcut-error" role="alert">{{ shortcutError }}</p>
                <div class="shortcut-list">
                  <div v-for="shortcut in shortcutDefinitions" :key="shortcut.id" class="shortcut-row">
                    <span class="shortcut-copy">
                      <strong>{{ shortcut.label }}</strong>
                      <small>{{ shortcut.description }}</small>
                    </span>
                    <button
                      class="shortcut-binding"
                      :class="{ 'is-recording': recordingId === shortcut.id }"
                      type="button"
                      :aria-label="`修改${shortcut.label}快捷键`"
                      @click="startRecording(shortcut.id)"
                    >
                      {{ recordingId === shortcut.id ? '请按组合键…' : formatShortcut(props.bindings[shortcut.id]) }}
                    </button>
                    <button
                      class="reset-shortcut"
                      type="button"
                      :title="`恢复${shortcut.label}默认快捷键`"
                      :aria-label="`恢复${shortcut.label}默认快捷键`"
                      :disabled="props.bindings[shortcut.id] === shortcut.defaultBinding"
                      @click="emit('resetShortcut', shortcut.id)"
                    >
                      <RotateCcw :size="14" />
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </aside>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.settings-backdrop {
  position: fixed;
  z-index: 80;
  inset: 38px 0 0;
  display: flex;
  justify-content: flex-end;
  background: rgb(15 18 24 / 22%);
}

.settings-panel {
  display: flex;
  width: min(440px, 100vw);
  height: 100%;
  flex-direction: column;
  border-left: 1px solid var(--border-default);
  background: var(--surface-elevated);
  box-shadow: -18px 0 48px rgb(24 30 40 / 13%);
  color: var(--text-primary);
}

.settings-header {
  display: flex;
  min-height: 56px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-default);
  padding: 0 18px 0 20px;
}

.settings-header > div,
.section-heading {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.settings-header > div {
  align-items: center;
}

.settings-header h2,
.section-heading h3,
.section-heading p {
  margin: 0;
}

.settings-header h2 {
  font-size: 14px;
  font-weight: 680;
}

.icon-action {
  display: grid;
  width: 32px;
  height: 32px;
  cursor: pointer;
  place-items: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--text-secondary);
}

.icon-action:hover,
.icon-action:focus-visible {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.icon-action:focus-visible,
.theme-choice:focus-visible,
.setting-row:focus-visible,
.shortcut-binding:focus-visible,
.reset-shortcut:focus-visible,
.text-action:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.settings-content {
  overflow: auto;
  padding: 4px 20px 28px;
}

.settings-section {
  padding: 22px 0 24px;
  border-bottom: 1px solid var(--border-default);
}

.settings-section:last-child {
  border-bottom: 0;
}

.section-heading {
  margin-bottom: 14px;
  color: var(--text-secondary);
}

.section-heading > div {
  min-width: 0;
  flex: 1;
}

.section-heading h3 {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 680;
}

.section-heading p {
  margin-top: 3px;
  color: var(--text-tertiary);
  font-size: 10px;
  line-height: 1.45;
}

.section-heading.with-action {
  align-items: center;
}

.theme-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}

.theme-choice {
  display: grid;
  min-width: 0;
  min-height: 58px;
  cursor: pointer;
  grid-template-columns: 40px minmax(0, 1fr) 16px;
  align-items: center;
  gap: 9px;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background: var(--surface-base);
  padding: 7px 8px;
  color: var(--text-primary);
  text-align: left;
}

.theme-choice:hover {
  border-color: var(--border-strong);
  background: var(--surface-hover);
}

.theme-choice.is-selected {
  border-color: var(--accent);
  background: var(--surface-active);
}

.theme-choice > svg {
  color: var(--accent);
}

.theme-preview {
  display: grid;
  width: 40px;
  height: 30px;
  overflow: hidden;
  grid-template-columns: 1fr 1fr 9px;
  border: 1px solid var(--border-strong);
  border-radius: 4px;
}

.theme-name,
.setting-row > span:first-child,
.shortcut-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.theme-name strong,
.setting-row strong,
.shortcut-copy strong {
  font-size: 11px;
  font-weight: 640;
}

.theme-name small,
.setting-row small,
.shortcut-copy small {
  overflow: hidden;
  color: var(--text-tertiary);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setting-list,
.shortcut-list {
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background: var(--surface-base);
}

.setting-row {
  display: flex;
  width: 100%;
  min-height: 56px;
  cursor: pointer;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border: 0;
  border-bottom: 1px solid var(--border-default);
  background: transparent;
  padding: 9px 12px;
  color: var(--text-primary);
  text-align: left;
}

.setting-row:last-child {
  border-bottom: 0;
}

.setting-row:hover {
  background: var(--surface-hover);
}

.setting-row:disabled {
  cursor: wait;
  opacity: 0.56;
}

.switch-control {
  position: relative;
  width: 30px;
  height: 17px;
  flex: 0 0 auto;
  border-radius: 10px;
  background: var(--switch-track);
  transition: background 160ms ease;
}

.switch-control b {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--surface-elevated);
  transition: transform 160ms ease;
}

.switch-control.is-on {
  background: var(--accent);
}

.switch-control.is-on b {
  transform: translateX(13px);
}

.text-action {
  color: var(--accent-strong);
  font-size: 10px;
  font-weight: 620;
}

.text-action {
  display: inline-flex;
  cursor: pointer;
  align-items: center;
  gap: 5px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  padding: 5px 6px;
}

.text-action:hover {
  background: var(--surface-hover);
}

.shortcut-error {
  margin: -4px 0 10px 26px;
  color: var(--danger);
  font-size: 10px;
}

.shortcut-row {
  display: grid;
  min-height: 53px;
  grid-template-columns: minmax(0, 1fr) 112px 28px;
  align-items: center;
  gap: 7px;
  border-bottom: 1px solid var(--border-default);
  padding: 7px 8px 7px 12px;
}

.shortcut-row:last-child {
  border-bottom: 0;
}

.shortcut-binding {
  min-width: 0;
  min-height: 28px;
  cursor: pointer;
  overflow: hidden;
  border: 1px solid var(--border-strong);
  border-radius: 5px;
  background: var(--surface-elevated);
  padding: 0 8px;
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 620;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shortcut-binding:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.shortcut-binding.is-recording {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.reset-shortcut {
  display: grid;
  width: 28px;
  height: 28px;
  cursor: pointer;
  place-items: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--text-tertiary);
}

.reset-shortcut:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.reset-shortcut:disabled {
  cursor: default;
  opacity: 0.25;
}

.settings-backdrop-enter-active,
.settings-backdrop-leave-active,
.settings-panel-enter-active,
.settings-panel-leave-active {
  transition: opacity 180ms ease-out, transform 180ms ease-out;
}

.settings-backdrop-enter-from,
.settings-backdrop-leave-to {
  opacity: 0;
}

.settings-panel-enter-from,
.settings-panel-leave-to {
  transform: translateX(24px);
}

@media (max-width: 540px) {
  .settings-panel {
    width: 100vw;
  }

  .theme-grid {
    grid-template-columns: 1fr;
  }

  .shortcut-row {
    grid-template-columns: minmax(0, 1fr) 104px 28px;
  }
}
</style>
