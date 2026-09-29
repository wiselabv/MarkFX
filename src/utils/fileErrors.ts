const RULES: Array<{ pattern: RegExp, message: string }> = [
  { pattern: /os error 5\b|access is denied|permission denied/i, message: '没有写入权限。请检查文件是否被设为只读，或换用「另存为」保存到其他位置。' },
  { pattern: /os error 19\b|write-protected|read-only file system/i, message: '目标位置是只读的，无法写入。请换用「另存为」保存到其他位置。' },
  { pattern: /os error 32\b|being used by another process/i, message: '文件正被其他程序占用。请关闭占用的程序后重试，或使用「另存为」。' },
  { pattern: /os error 112\b|not enough space|disk full/i, message: '磁盘空间不足，无法保存。请清理空间后重试。' },
  { pattern: /os error 2\b|cannot find the file|no such file/i, message: '文件或所在目录不存在。请确认路径后重试，或使用「另存为」。' },
  { pattern: /os error 3\b|cannot find the path/i, message: '路径不存在。请确认目录后重试，或使用「另存为」。' },
]

export function describeFileError(message: string): string {
  const trimmed = message.trim()
  if (trimmed.length === 0)
    return '保存失败，原因未知。请使用「另存为」保存到其他位置。'

  const rule = RULES.find(item => item.pattern.test(trimmed))

  return rule ? `${rule.message}（原始错误：${trimmed}）` : trimmed
}
