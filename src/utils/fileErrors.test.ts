import { describe, expect, it } from 'vitest'
import { describeFileError } from './fileErrors'

describe('describeFileError', () => {
  it('explains permission failures', () => {
    expect(describeFileError('io error: Access is denied. (os error 5)')).toContain('权限')
    expect(describeFileError('os error 5')).toContain('权限')
  })

  it('explains missing disk space', () => {
    expect(describeFileError('There is not enough space on the disk. (os error 112)')).toContain('空间不足')
  })

  it('explains missing files', () => {
    expect(describeFileError('The system cannot find the file specified. (os error 2)')).toContain('不存在')
  })

  it('explains files locked by another program', () => {
    expect(describeFileError('The process cannot access the file because it is being used by another process. (os error 32)')).toContain('占用')
  })

  it('explains read-only media', () => {
    expect(describeFileError('The disk is write-protected. (os error 19)')).toContain('只读')
  })

  it('keeps the original message when nothing matches', () => {
    expect(describeFileError('some unexpected failure')).toBe('some unexpected failure')
  })

  it('never returns an empty message', () => {
    expect(describeFileError('').length).toBeGreaterThan(0)
  })
})
