import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(resolve(root, 'src/assets/main.css'), 'utf8')

const AA_TEXT = 4.5
const AA_NON_TEXT = 3

function extractThemes(source) {
  const themes = {}
  const rootBlock = source.match(/:root\s*\{([\s\S]*?)\}/)
  if (rootBlock)
    themes.paper = parseVars(rootBlock[1])

  const themeBlocks = source.matchAll(/html\[data-theme='([a-z]+)'\]\s*\{([\s\S]*?)\}/g)
  for (const [, name, body] of themeBlocks)
    themes[name] = { ...themes.paper, ...parseVars(body) }

  return themes
}

function parseVars(body) {
  const vars = {}
  for (const [, name, value] of body.matchAll(/(--[a-z-]+):\s*([^;]+);/g))
    vars[name] = value.trim()

  return vars
}

const srgbToLinear = value => (value / 255 <= 0.03928 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4)

function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(clean))
    return null

  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ]
}

function luminance(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb)
    return null

  return 0.2126 * srgbToLinear(rgb[0]) + 0.7152 * srgbToLinear(rgb[1]) + 0.0722 * srgbToLinear(rgb[2])
}

function contrast(foreground, background) {
  const a = luminance(foreground)
  const b = luminance(background)
  if (a === null || b === null)
    return null

  const [high, low] = a > b ? [a, b] : [b, a]
  return (high + 0.05) / (low + 0.05)
}

const checks = [
  { pair: ['--text-primary', '--surface-base'], min: AA_TEXT, label: '正文/底色' },
  { pair: ['--text-primary', '--editor-paper'], min: AA_TEXT, label: '正文/纸面' },
  { pair: ['--text-primary', '--surface-elevated'], min: AA_TEXT, label: '正文/浮层' },
  { pair: ['--text-secondary', '--surface-base'], min: AA_TEXT, label: '次要文字/底色' },
  { pair: ['--text-secondary', '--editor-paper'], min: AA_TEXT, label: '次要文字/纸面' },
  { pair: ['--text-secondary', '--surface-elevated'], min: AA_TEXT, label: '次要文字/浮层' },
  { pair: ['--text-tertiary', '--surface-base'], min: AA_TEXT, label: '三级文字/底色' },
  { pair: ['--text-tertiary', '--editor-paper'], min: AA_TEXT, label: '三级文字/纸面' },
  { pair: ['--text-tertiary', '--surface-elevated'], min: AA_TEXT, label: '三级文字/浮层' },
  { pair: ['--accent', '--surface-base'], min: AA_TEXT, label: '强调文字/底色' },
  { pair: ['--accent', '--editor-paper'], min: AA_TEXT, label: '链接/纸面' },
  { pair: ['--accent', '--surface-elevated'], min: AA_TEXT, label: '强调文字/浮层' },
  { pair: ['--accent-strong', '--surface-subtle'], min: AA_TEXT, label: '行内代码' },
  { pair: ['--danger', '--editor-paper'], min: AA_TEXT, label: '错误文字/纸面' },
  { pair: ['--danger', '--surface-elevated'], min: AA_TEXT, label: '错误文字/浮层' },
  { pair: ['--focus-ring', '--surface-base'], min: AA_NON_TEXT, label: '焦点环/底色' },
  { pair: ['--focus-ring', '--editor-paper'], min: AA_NON_TEXT, label: '焦点环/纸面' },
  { pair: ['--focus-ring', '--surface-elevated'], min: AA_NON_TEXT, label: '焦点环/浮层' },
  { pair: ['--switch-track', '--surface-elevated'], min: AA_NON_TEXT, label: '开关关态轨道/浮层' },
]

const themes = extractThemes(css)
const failures = []

for (const [theme, vars] of Object.entries(themes)) {
  for (const { pair, min, label } of checks) {
    const [foreground, background] = pair
    const value = contrast(vars[foreground], vars[background])
    if (value === null) {
      failures.push(`${theme} ${label}：无法解析 ${foreground} 或 ${background}`)
      continue
    }
    if (value < min)
      failures.push(`${theme} ${label}：${value.toFixed(2)} 低于 ${min}（${vars[foreground]} / ${vars[background]}）`)
  }
}

if (failures.length > 0) {
  console.error(`对比度检查未通过，共 ${failures.length} 项：`)
  for (const failure of failures)
    console.error(`  - ${failure}`)

  process.exit(1)
}

console.log(`对比度检查通过：${Object.keys(themes).length} 套主题 × ${checks.length} 项组合均达到 WCAG AA 基线。`)
