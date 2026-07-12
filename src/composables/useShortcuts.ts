import { computed, shallowRef } from 'vue'

export type ShortcutId = 'new' | 'open' | 'save' | 'saveAs' | 'draw' | 'diagram' | 'toggleSidebar' | 'settings' | 'heading1' | 'heading2' | 'heading3' | 'heading4' | 'heading5' | 'heading6' | 'bold' | 'italic' | 'strikethrough' | 'inlineCode' | 'link'

export interface ShortcutDefinition {
  id: ShortcutId
  label: string
  description: string
  defaultBinding: string
}

export const shortcutDefinitions: ShortcutDefinition[] = [
  { id: 'new', label: '新建文档', description: '创建一个空白 Markdown 文档', defaultBinding: 'Ctrl+N' },
  { id: 'open', label: '打开文档', description: '从本地选择 Markdown 文件', defaultBinding: 'Ctrl+O' },
  { id: 'save', label: '保存文档', description: '保存当前文档的更改', defaultBinding: 'Ctrl+S' },
  { id: 'saveAs', label: '另存为', description: '将当前文档保存到新位置', defaultBinding: 'Ctrl+Shift+S' },
  { id: 'draw', label: '打开手绘', description: '打开自由绘图工作区', defaultBinding: 'Ctrl+Shift+D' },
  { id: 'diagram', label: '打开结构图', description: '打开结构图工作区', defaultBinding: 'Ctrl+Shift+G' },
  { id: 'toggleSidebar', label: '切换侧栏', description: '显示或隐藏文档侧栏', defaultBinding: 'Ctrl+Shift+B' },
  { id: 'settings', label: '打开设置', description: '打开或关闭应用设置', defaultBinding: 'Ctrl+,' },
  { id: 'heading1', label: '一级标题', description: '将当前段落设为一级标题', defaultBinding: 'Ctrl+Alt+1' },
  { id: 'heading2', label: '二级标题', description: '将当前段落设为二级标题', defaultBinding: 'Ctrl+Alt+2' },
  { id: 'heading3', label: '三级标题', description: '将当前段落设为三级标题', defaultBinding: 'Ctrl+Alt+3' },
  { id: 'heading4', label: '四级标题', description: '将当前段落设为四级标题', defaultBinding: 'Ctrl+Alt+4' },
  { id: 'heading5', label: '五级标题', description: '将当前段落设为五级标题', defaultBinding: 'Ctrl+Alt+5' },
  { id: 'heading6', label: '六级标题', description: '将当前段落设为六级标题', defaultBinding: 'Ctrl+Alt+6' },
  { id: 'bold', label: '加粗', description: '切换所选文本的粗体格式', defaultBinding: 'Ctrl+B' },
  { id: 'italic', label: '斜体', description: '切换所选文本的斜体格式', defaultBinding: 'Ctrl+I' },
  { id: 'strikethrough', label: '删除线', description: '切换所选文本的删除线格式', defaultBinding: 'Ctrl+Shift+X' },
  { id: 'inlineCode', label: '行内代码', description: '切换所选文本的行内代码格式', defaultBinding: 'Ctrl+E' },
  { id: 'link', label: '插入链接', description: '为所选文本添加或编辑链接', defaultBinding: 'Ctrl+K' },
]

const STORAGE_KEY = 'markfx:shortcuts'
const modifierOrder = ['Ctrl', 'Alt', 'Shift', 'Meta']
const modifierKeys = new Set(['Control', 'Alt', 'Shift', 'Meta'])
const blockedBindings = new Set(['Alt+F4', 'Ctrl+Alt+Delete', 'Meta+L'])

function loadOverrides(): Partial<Record<ShortcutId, string>> {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return typeof value === 'object' && value ? value : {}
  }
  catch {
    return {}
  }
}

function normalizeKey(key: string) {
  if (key === ' ')
    return 'Space'
  if (key.length === 1)
    return key.toUpperCase()
  return key === 'Esc' ? 'Escape' : key
}

export function shortcutFromEvent(event: KeyboardEvent) {
  if (modifierKeys.has(event.key))
    return null

  const parts = [
    event.ctrlKey && 'Ctrl',
    event.altKey && 'Alt',
    event.shiftKey && 'Shift',
    event.metaKey && 'Meta',
  ].filter(Boolean) as string[]

  const key = normalizeKey(event.key)
  if (!parts.length && key.length === 1)
    return null

  return [...modifierOrder.filter(modifier => parts.includes(modifier)), key].join('+')
}

export function formatShortcut(binding: string) {
  return binding.replace('Meta', navigator.platform.includes('Mac') ? '⌘' : 'Win')
}

export function useShortcuts() {
  const overrides = shallowRef<Partial<Record<ShortcutId, string>>>(loadOverrides())

  const bindings = computed<Record<ShortcutId, string>>(() => Object.fromEntries(
    shortcutDefinitions.map(definition => [definition.id, overrides.value[definition.id] ?? definition.defaultBinding]),
  ) as Record<ShortcutId, string>)

  function persist(next: Partial<Record<ShortcutId, string>>) {
    overrides.value = next
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function conflictFor(id: ShortcutId, binding: string) {
    return shortcutDefinitions.find(definition => definition.id !== id && bindings.value[definition.id] === binding)
  }

  function setBinding(id: ShortcutId, binding: string) {
    if (blockedBindings.has(binding))
      return { ok: false as const, message: '该组合键由系统保留，请使用其他组合键。' }

    const conflict = conflictFor(id, binding)
    if (conflict)
      return { ok: false as const, message: `已用于“${conflict.label}”。` }

    const definition = shortcutDefinitions.find(item => item.id === id)!
    const next = { ...overrides.value }
    if (binding === definition.defaultBinding)
      delete next[id]
    else
      next[id] = binding
    persist(next)
    return { ok: true as const }
  }

  function resetBinding(id: ShortcutId) {
    const next = { ...overrides.value }
    delete next[id]
    persist(next)
  }

  function resetAll() {
    persist({})
  }

  function matches(event: KeyboardEvent, id: ShortcutId) {
    return shortcutFromEvent(event) === bindings.value[id]
  }

  return {
    bindings,
    conflictFor,
    matches,
    resetAll,
    resetBinding,
    setBinding,
  }
}
