<script setup lang="ts">
import { computed, nextTick, reactive, shallowRef, useTemplateRef } from 'vue'
import { useEventListener } from '@vueuse/core'
import { Copy, ExternalLink, FileText, FolderOpen, PanelLeftClose, Plus, Search, Trash2, X } from 'lucide-vue-next'
import { revealItemInDir } from '@tauri-apps/plugin-opener'

const props = defineProps<{
  currentPath: string | null
  fileName: string
  recentFiles: string[]
}>()

const emit = defineEmits<{
  close: []
  create: []
  open: [path?: string]
  removeRecent: [path: string]
}>()

const searchInput = useTemplateRef<HTMLInputElement>('searchInput')
const contextMenu = useTemplateRef<HTMLDivElement>('contextMenu')
const searchQuery = shallowRef('')
const menu = reactive({ open: false, x: 0, y: 0, path: '', recent: false })

const normalizedQuery = computed(() => searchQuery.value.trim().toLocaleLowerCase())
const currentDocumentMatches = computed(() => matchesSearch(props.fileName))
const filteredRecentFiles = computed(() => props.recentFiles.filter(matchesSearch))
const hasMatches = computed(() => currentDocumentMatches.value || filteredRecentFiles.value.length > 0)

function displayName(path: string) {
  return path.split(/[\\/]/).pop() || path
}

function matchesSearch(path: string) {
  const query = normalizedQuery.value
  return !query || path.toLocaleLowerCase().includes(query) || displayName(path).toLocaleLowerCase().includes(query)
}

function clearSearch() {
  searchQuery.value = ''
  searchInput.value?.focus()
}

function openContextMenu(event: MouseEvent, path: string | null, recent: boolean) {
  if (!path)
    return

  event.preventDefault()
  menu.open = true
  menu.x = event.clientX
  menu.y = event.clientY
  menu.path = path
  menu.recent = recent

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

async function copyPath() {
  await navigator.clipboard.writeText(menu.path)
  closeContextMenu()
}

async function revealFile() {
  await revealItemInDir(menu.path)
  closeContextMenu()
}

function removeRecent() {
  emit('removeRecent', menu.path)
  closeContextMenu()
}

useEventListener(window, 'pointerdown', event => {
  if (menu.open && !contextMenu.value?.contains(event.target as Node))
    closeContextMenu()
})
useEventListener(window, 'blur', closeContextMenu)
useEventListener(window, 'resize', closeContextMenu)
useEventListener(window, 'keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
    event.preventDefault()
    searchInput.value?.focus()
    searchInput.value?.select()
    return
  }

  if (event.key === 'Escape' && menu.open) {
    event.preventDefault()
    closeContextMenu()
  }
  else if (event.key === 'Escape' && document.activeElement === searchInput.value) {
    event.preventDefault()
    clearSearch()
  }
})
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-heading">
      <div class="brand-mark" aria-hidden="true">M</div>
      <span class="brand-name">MarkFX</span>
      <button class="icon-button ml-auto" type="button" title="收起侧栏" aria-label="收起侧栏" @click="emit('close')">
        <PanelLeftClose :size="18" />
      </button>
    </div>

    <div class="quick-actions">
      <button class="sidebar-action" type="button" @click="emit('create')">
        <Plus :size="16" aria-hidden="true" />
        新建文档
      </button>
      <button class="sidebar-action" type="button" @click="emit('open')">
        <FolderOpen :size="16" aria-hidden="true" />
        打开文件
      </button>
    </div>

    <label class="sidebar-search">
      <Search :size="15" aria-hidden="true" />
      <input
        ref="searchInput"
        v-model="searchQuery"
        type="search"
        placeholder="搜索文档"
        aria-label="搜索文档"
        autocomplete="off"
        spellcheck="false"
      >
      <button
        v-if="searchQuery"
        class="search-clear"
        type="button"
        title="清除搜索"
        aria-label="清除搜索"
        @click="clearSearch"
      >
        <X :size="14" />
      </button>
      <kbd v-else>Ctrl K</kbd>
    </label>

    <nav class="document-list" aria-label="文档">
      <template v-if="currentDocumentMatches">
        <p class="panel-label list-label">当前文档</p>
        <button class="document-row is-active" type="button" @contextmenu="openContextMenu($event, props.currentPath, false)">
          <FileText :size="16" aria-hidden="true" />
          <span class="document-name">{{ props.fileName }}</span>
          <span class="active-dot" aria-label="当前文档" />
        </button>
      </template>

      <template v-if="filteredRecentFiles.length">
        <p class="panel-label list-label" :class="{ 'recent-label': currentDocumentMatches }">最近打开</p>
        <button
          v-for="path in filteredRecentFiles"
          :key="path"
          class="document-row"
          type="button"
          :title="path"
          @click="emit('open', path)"
          @contextmenu="openContextMenu($event, path, true)"
        >
          <FileText :size="16" aria-hidden="true" />
          <span class="document-name">{{ displayName(path) }}</span>
        </button>
      </template>

      <p v-if="!hasMatches" class="search-empty" role="status">
        没有匹配的文档
      </p>
    </nav>

    <div class="sidebar-footer">
      <span class="status-pulse" aria-hidden="true" />
      本地优先 · 标准 Markdown
    </div>

    <Teleport to="body">
      <div
        v-if="menu.open"
        ref="contextMenu"
        class="file-context-menu"
        role="menu"
        aria-label="文件操作"
        :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
        @contextmenu.prevent
      >
        <button v-if="menu.recent" type="button" role="menuitem" @click="emit('open', menu.path); closeContextMenu()">
          <ExternalLink :size="15" />
          打开文档
        </button>
        <button type="button" role="menuitem" @click="revealFile">
          <FolderOpen :size="15" />
          在资源管理器中显示
        </button>
        <button type="button" role="menuitem" @click="copyPath">
          <Copy :size="15" />
          复制文件路径
        </button>
        <template v-if="menu.recent">
          <div class="file-menu-separator" role="separator" />
          <button class="danger-item" type="button" role="menuitem" @click="removeRecent">
            <Trash2 :size="15" />
            从最近列表移除
          </button>
        </template>
      </div>
    </Teleport>
  </aside>
</template>

<style scoped>
.sidebar {
  display: grid;
  grid-template-rows: 54px auto auto minmax(0, 1fr) 42px;
  min-width: 0;
  border-right: 1px solid var(--border-default);
  background: var(--surface-elevated);
}

.sidebar-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px 0 14px;
}

.brand-mark {
  display: grid;
  width: 25px;
  height: 25px;
  place-items: center;
  border-radius: 5px;
  background: var(--text-primary);
  color: var(--surface-elevated);
  font-family: Georgia, serif;
  font-size: 15px;
  font-weight: 700;
}

.brand-name {
  font-size: 14px;
  font-weight: 680;
}

.quick-actions {
  display: grid;
  gap: 3px;
  padding: 6px 10px 10px;
}

.sidebar-action,
.document-row {
  display: flex;
  width: 100%;
  cursor: pointer;
  align-items: center;
  gap: 9px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--text-secondary);
  text-align: left;
  transition: background 150ms ease, color 150ms ease;
}

.sidebar-action {
  height: 34px;
  padding: 0 9px;
  font-size: 13px;
  font-weight: 520;
}

.sidebar-action:hover,
.document-row:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.sidebar-action:focus-visible,
.document-row:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}

.sidebar-search {
  display: flex;
  height: 34px;
  align-items: center;
  gap: 8px;
  margin: 2px 10px 10px;
  border: 1px solid var(--border-default);
  border-radius: 5px;
  background: var(--surface-base);
  padding: 0 9px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.sidebar-search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus-ring);
  color: var(--text-secondary);
}

.sidebar-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
}

.sidebar-search input::placeholder {
  color: var(--text-tertiary);
  opacity: 1;
}

.sidebar-search input::-webkit-search-cancel-button {
  display: none;
}

.sidebar-search kbd {
  flex: 0 0 auto;
  margin-left: auto;
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 10px;
}

.search-clear {
  display: grid;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  cursor: pointer;
  place-items: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  padding: 0;
  color: var(--text-tertiary);
}

.search-clear:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.document-list {
  overflow-y: auto;
  padding: 2px 10px 14px;
}

.list-label {
  margin: 8px 8px 6px;
}

.recent-label {
  margin-top: 22px;
}

.search-empty {
  margin: 28px 8px;
  color: var(--text-tertiary);
  font-size: 12px;
  text-align: center;
}

.document-row {
  height: 34px;
  padding: 0 9px;
  font-size: 12px;
}

.document-row.is-active {
  background: var(--surface-active);
  color: var(--text-primary);
  font-weight: 560;
}

.document-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.active-dot {
  width: 5px;
  height: 5px;
  flex: 0 0 auto;
  margin-left: auto;
  border-radius: 50%;
  background: var(--accent);
}

.sidebar-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--border-default);
  padding: 0 14px;
  color: var(--text-tertiary);
  font-size: 10px;
}

.status-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}

.file-context-menu {
  position: fixed;
  z-index: 100;
  width: 224px;
  border: 1px solid var(--border-default);
  border-radius: 7px;
  background: var(--surface-elevated);
  box-shadow: var(--shadow-panel);
  padding: 5px;
}

.file-context-menu button {
  display: grid;
  width: 100%;
  height: 34px;
  cursor: pointer;
  grid-template-columns: 20px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  padding: 0 8px;
  color: var(--text-primary);
  font-size: 12px;
  text-align: left;
}

.file-context-menu button:hover,
.file-context-menu button:focus-visible {
  outline: none;
  background: var(--surface-hover);
}

.file-context-menu .danger-item {
  color: var(--danger);
}

.file-menu-separator {
  height: 1px;
  margin: 4px 6px;
  background: var(--border-default);
}
</style>
