<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, ListTree } from 'lucide-vue-next'

const props = defineProps<{
  markdown: string
}>()

const emit = defineEmits<{
  navigate: [index: number]
}>()

interface OutlineItem {
  index: number
  level: number
  text: string
  hasChildren: boolean
}

const collapsed = shallowRef<Set<number>>(new Set())

const headings = computed<OutlineItem[]>(() => {
  const items: Omit<OutlineItem, 'hasChildren'>[] = []
  let fenced = false

  for (const line of props.markdown.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced
      continue
    }
    if (fenced)
      continue

    const match = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (!match)
      continue

    const text = match[2]!.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`~]/g, '').trim()
    if (text)
      items.push({ index: items.length, level: match[1]!.length, text })
  }

  return items.map((item, index) => ({
    ...item,
    hasChildren: items[index + 1]?.level > item.level,
  }))
})

const collapsibleIndices = computed(() => headings.value.filter(item => item.hasChildren).map(item => item.index))
const allCollapsed = computed(() => collapsibleIndices.value.length > 0 && collapsibleIndices.value.every(index => collapsed.value.has(index)))

const visibleHeadings = computed(() => headings.value.filter(item => {
  for (let index = item.index - 1; index >= 0; index--) {
    const ancestor = headings.value[index]!
    if (ancestor.level < item.level) {
      if (collapsed.value.has(ancestor.index))
        return false
      item = ancestor
    }
  }
  return true
}))

function toggle(index: number) {
  const next = new Set(collapsed.value)
  if (next.has(index))
    next.delete(index)
  else
    next.add(index)
  collapsed.value = next
}

function toggleAll() {
  collapsed.value = allCollapsed.value ? new Set() : new Set(collapsibleIndices.value)
}
</script>

<template>
  <aside class="document-outline" aria-label="文档大纲">
    <header class="outline-header">
      <ListTree :size="15" aria-hidden="true" />
      <h2>大纲</h2>
      <span v-if="headings.length">{{ headings.length }}</span>
      <button
        v-if="collapsibleIndices.length"
        class="outline-action"
        type="button"
        :title="allCollapsed ? '全部展开' : '全部折叠'"
        :aria-label="allCollapsed ? '全部展开大纲' : '全部折叠大纲'"
        @click="toggleAll"
      >
        <ChevronsUpDown v-if="allCollapsed" :size="14" />
        <ChevronsDownUp v-else :size="14" />
      </button>
    </header>

    <nav v-if="headings.length" class="outline-list" aria-label="文档标题">
      <div
        v-for="heading in visibleHeadings"
        :key="`${heading.index}-${heading.text}`"
        class="outline-row"
        :style="{ paddingLeft: `${5 + (heading.level - 1) * 11}px` }"
      >
        <button
          v-if="heading.hasChildren"
          class="collapse-button"
          type="button"
          :aria-expanded="!collapsed.has(heading.index)"
          :aria-label="`${collapsed.has(heading.index) ? '展开' : '折叠'}${heading.text}`"
          @click="toggle(heading.index)"
        >
          <ChevronRight v-if="collapsed.has(heading.index)" :size="13" />
          <ChevronDown v-else :size="13" />
        </button>
        <span v-else class="collapse-spacer" />
        <button class="heading-button" type="button" :title="heading.text" @click="emit('navigate', heading.index)">
          {{ heading.text }}
        </button>
      </div>
    </nav>

    <div v-else class="outline-empty">
      <ListTree :size="18" aria-hidden="true" />
      <p>暂无标题</p>
      <small>添加 Markdown 标题后会显示在这里</small>
    </div>
  </aside>
</template>

<style scoped>
.document-outline { display: flex; min-width: 0; min-height: 0; flex-direction: column; border-left: 1px solid var(--border-default); background: var(--surface-elevated); }
.outline-header { display: flex; height: 43px; flex: 0 0 auto; align-items: center; gap: 7px; border-bottom: 1px solid var(--border-default); padding: 0 8px 0 12px; color: var(--text-secondary); }
.outline-header h2 { flex: 1; margin: 0; color: var(--text-primary); font-size: 11px; font-weight: 650; }
.outline-header > span { color: var(--text-tertiary); font-size: 9px; font-variant-numeric: tabular-nums; }
.outline-action, .collapse-button { display: grid; cursor: pointer; place-items: center; border: 0; border-radius: 4px; background: transparent; color: var(--text-tertiary); }
.outline-action { width: 27px; height: 27px; }
.outline-action:hover, .collapse-button:hover { background: var(--surface-hover); color: var(--text-primary); }
.outline-action:focus-visible, .collapse-button:focus-visible, .heading-button:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -2px; }
.outline-list { overflow-y: auto; padding: 7px 6px 18px; }
.outline-row { display: grid; height: 31px; grid-template-columns: 20px minmax(0, 1fr); align-items: center; }
.collapse-button { width: 20px; height: 25px; }
.collapse-spacer { width: 20px; }
.heading-button { width: 100%; height: 29px; cursor: pointer; overflow: hidden; border: 0; border-radius: 4px; background: transparent; padding: 0 7px 0 2px; color: var(--text-secondary); font-size: 10px; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.heading-button:hover { background: var(--surface-hover); color: var(--text-primary); }
.outline-empty { display: grid; min-height: 150px; place-items: center; align-content: center; gap: 5px; padding: 20px; color: var(--text-tertiary); text-align: center; }
.outline-empty p, .outline-empty small { margin: 0; }
.outline-empty p { color: var(--text-secondary); font-size: 11px; font-weight: 620; }
.outline-empty small { max-width: 150px; font-size: 9px; line-height: 1.5; }
</style>
