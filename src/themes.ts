export type ThemeId = 'paper' | 'ink' | 'pine' | 'letterpress'

export interface ThemeOption {
  id: ThemeId
  name: string
  description: string
  dark: boolean
  swatches: [string, string, string]
}

export const themes: ThemeOption[] = [
  { id: 'paper', name: '纸白', description: '清透冷白', dark: false, swatches: ['#f2f4f7', '#ffffff', '#3d6fd6'] },
  { id: 'ink', name: '墨夜', description: '低眩深灰', dark: true, swatches: ['#111317', '#1c2026', '#84a7ff'] },
  { id: 'pine', name: '松林', description: '沉静青绿', dark: true, swatches: ['#101715', '#19231f', '#71b89b'] },
  { id: 'letterpress', name: '铅字', description: '温润纸墨', dark: false, swatches: ['#eeeae2', '#faf8f3', '#a24732'] },
]

export function isThemeId(value: string | null): value is ThemeId {
  return themes.some(theme => theme.id === value)
}
