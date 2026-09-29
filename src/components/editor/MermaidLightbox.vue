<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { Maximize2, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-vue-next'
import { clampZoom, computeFitScale, zoomAroundPoint } from './mermaidZoom'

const props = defineProps<{
  svg: string
}>()

const emit = defineEmits<{
  close: []
}>()

const ZOOM_STEP = 1.25
const WHEEL_FACTOR = 1.2
const FIT_PADDING = 48
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'

let restoreTarget: HTMLElement | null = null

const stage = useTemplateRef<HTMLDivElement>('stage')
const content = useTemplateRef<HTMLDivElement>('content')
const closeButton = useTemplateRef<HTMLButtonElement>('closeButton')
const overlay = useTemplateRef<HTMLDivElement>('overlay')

const scale = ref(1)
const panX = ref(0)
const panY = ref(0)
const dragging = ref(false)

let dragOrigin = { x: 0, y: 0, panX: 0, panY: 0 }

const percent = computed(() => `${Math.round(scale.value * 100)}%`)
const stageStyle = computed(() => ({
  transform: `translate(calc(-50% + ${panX.value}px), calc(-50% + ${panY.value}px)) scale(${scale.value})`,
}))

function applyView(nextScale: number) {
  const rect = stage.value?.getBoundingClientRect()
  const width = content.value?.offsetWidth ?? 0
  const height = content.value?.offsetHeight ?? 0
  scale.value = clampZoom(nextScale)
  panX.value = ((rect?.width ?? 0) - width * scale.value) / 2
  panY.value = ((rect?.height ?? 0) - height * scale.value) / 2
}

function zoomAtCenterOffset(offsetX: number, offsetY: number, factor: number) {
  const next = zoomAroundPoint(
    { scale: scale.value, panX: panX.value, panY: panY.value },
    offsetX,
    offsetY,
    factor,
  )
  scale.value = next.scale
  panX.value = next.panX
  panY.value = next.panY
}

function zoomStepAtCenter(factor: number) {
  zoomAtCenterOffset(0, 0, factor)
}

function onWheel(event: WheelEvent) {
  const rect = stage.value?.getBoundingClientRect()
  if (!rect)
    return

  const factor = event.deltaY < 0 ? WHEEL_FACTOR : 1 / WHEEL_FACTOR
  zoomAtCenterOffset(
    event.clientX - rect.left - rect.width / 2,
    event.clientY - rect.top - rect.height / 2,
    factor,
  )
}

function fitToWindow() {
  const rect = stage.value?.getBoundingClientRect()
  if (!rect || !content.value)
    return

  applyView(computeFitScale(
    content.value.offsetWidth,
    content.value.offsetHeight,
    rect.width,
    rect.height,
    FIT_PADDING,
  ))
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0)
    return

  dragging.value = true
  dragOrigin = { x: event.clientX, y: event.clientY, panX: panX.value, panY: panY.value }
  stage.value?.setPointerCapture?.(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value)
    return

  panX.value = dragOrigin.panX + event.clientX - dragOrigin.x
  panY.value = dragOrigin.panY + event.clientY - dragOrigin.y
}

function endDrag(event: PointerEvent) {
  dragging.value = false
  stage.value?.releasePointerCapture?.(event.pointerId)
}

function trapFocus(event: KeyboardEvent) {
  const root = overlay.value
  if (!root)
    return

  const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last)
    return

  const active = document.activeElement
  const inside = active instanceof HTMLElement && root.contains(active)

  if (event.shiftKey && (!inside || active === first)) {
    event.preventDefault()
    last.focus()
  }
  else if (!event.shiftKey && (!inside || active === last)) {
    event.preventDefault()
    first.focus()
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    emit('close')
    return
  }
  if (event.key === 'Tab') {
    trapFocus(event)
    return
  }
  if (event.key === '+' || event.key === '=') {
    event.preventDefault()
    zoomStepAtCenter(ZOOM_STEP)
  }
  else if (event.key === '-') {
    event.preventDefault()
    zoomStepAtCenter(1 / ZOOM_STEP)
  }
  else if (event.key === '0') {
    event.preventDefault()
    applyView(1)
  }
}

onMounted(() => {
  restoreTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null
  window.addEventListener('keydown', onKeydown)
  closeButton.value?.focus()
  fitToWindow()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (restoreTarget?.isConnected)
    restoreTarget.focus()
})
</script>

<template>
  <Teleport to="body">
    <div ref="overlay" class="lightbox-overlay" role="dialog" aria-modal="true" aria-label="Mermaid 图表放大查看" @wheel.prevent>
      <header class="lightbox-header">
        <div class="lightbox-title-group">
          <span class="lightbox-kicker">DIAGRAM</span>
          <h2 class="lightbox-title">Mermaid 图表</h2>
          <span class="lightbox-percent">{{ percent }}</span>
        </div>
        <button
          ref="closeButton"
          class="lightbox-button lightbox-icon-button"
          type="button"
          aria-label="关闭放大查看"
          data-action="close"
          @click="emit('close')"
        >
          <X :size="17" aria-hidden="true" />
        </button>
      </header>

      <div
        ref="stage"
        class="lightbox-stage"
        :class="{ 'is-dragging': dragging }"
        @wheel="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="endDrag"
        @pointercancel="endDrag"
      >
        <div ref="content" class="lightbox-content" :style="stageStyle" v-html="props.svg" />
      </div>

      <footer class="lightbox-controls">
        <button class="lightbox-button lightbox-icon-button" type="button" aria-label="缩小" data-action="zoom-out" @click="zoomStepAtCenter(1 / ZOOM_STEP)">
          <ZoomOut :size="16" aria-hidden="true" />
        </button>
        <span class="lightbox-percent" aria-live="polite">{{ percent }}</span>
        <button class="lightbox-button lightbox-icon-button" type="button" aria-label="放大" data-action="zoom-in" @click="zoomStepAtCenter(ZOOM_STEP)">
          <ZoomIn :size="16" aria-hidden="true" />
        </button>
        <button class="lightbox-button" type="button" data-action="fit" @click="fitToWindow">
          <Maximize2 :size="15" aria-hidden="true" />
          适配窗口
        </button>
        <button class="lightbox-button" type="button" data-action="reset" @click="applyView(1)">
          <RotateCcw :size="15" aria-hidden="true" />
          100%
        </button>
      </footer>
    </div>
  </Teleport>
</template>

<style scoped>
.lightbox-overlay {
  position: fixed;
  z-index: 60;
  inset: 0;
  display: grid;
  grid-template-rows: 52px minmax(0, 1fr) 56px;
  background: color-mix(in srgb, var(--surface-base) 90%, transparent);
  backdrop-filter: blur(6px);
  animation: lightbox-in 160ms ease;
}

.lightbox-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-default);
  background: var(--surface-elevated);
  padding: 0 14px 0 20px;
}

.lightbox-title-group {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}

.lightbox-kicker {
  color: var(--accent);
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.lightbox-title {
  margin: 0;
  font-size: 14px;
  font-weight: 650;
}

.lightbox-percent {
  color: var(--text-tertiary);
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.lightbox-stage {
  position: relative;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
}

.lightbox-stage.is-dragging {
  cursor: grabbing;
}

.lightbox-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform-origin: center;
  user-select: none;
}

.lightbox-content :deep(svg) {
  display: block;
}

.lightbox-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-top: 1px solid var(--border-default);
  background: var(--surface-elevated);
  padding: 0 14px;
}

.lightbox-controls .lightbox-percent {
  min-width: 48px;
  text-align: center;
}

.lightbox-button {
  display: inline-flex;
  height: 32px;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--border-default);
  border-radius: 5px;
  background: var(--surface-base);
  padding: 0 10px;
  color: var(--text-primary);
  font-size: 12px;
}

.lightbox-button:hover {
  background: var(--surface-hover);
}

.lightbox-button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.lightbox-icon-button {
  width: 32px;
  padding: 0;
}

@keyframes lightbox-in {
  from { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .lightbox-overlay {
    animation: none;
  }
}
</style>
