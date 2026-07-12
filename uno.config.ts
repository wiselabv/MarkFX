import { defineConfig, presetIcons, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [
    presetWind3(),
    presetIcons({
      scale: 1.1,
      warn: true,
    }),
  ],
  shortcuts: {
    'bg-base': 'bg-[var(--surface-base)]',
    'bg-elevated': 'bg-[var(--surface-elevated)]',
    'bg-subtle': 'bg-[var(--surface-subtle)]',
    'color-base': 'text-[var(--text-primary)]',
    'color-muted': 'text-[var(--text-secondary)]',
    'color-faint': 'text-[var(--text-tertiary)]',
    'border-base': 'border-[var(--border-default)]',
    'border-strong': 'border-[var(--border-strong)]',
    'focus-ring': 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)]',
    'icon-button': 'focus-ring inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent color-muted transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:color-base disabled:cursor-not-allowed disabled:opacity-40',
    'toolbar-button': 'focus-ring inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-3 text-sm font-medium color-muted transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:color-base disabled:cursor-not-allowed disabled:opacity-40',
    'panel-label': 'text-[11px] font-semibold uppercase tracking-[0.08em] color-faint',
    'z-top-nav': 'z-30',
    'z-panel-content': 'z-40',
    'z-drawer-content': 'z-50',
  },
})
