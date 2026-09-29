import { beforeEach, describe, expect, it, vi } from 'vitest'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { useUpdater } from './useUpdater'

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn(),
}))

const checkMock = vi.mocked(check)
const relaunchMock = vi.mocked(relaunch)

function fakeUpdate(overrides: Record<string, unknown> = {}) {
  return {
    version: '2.4.0',
    body: '### 新增\n\n- 示例功能',
    date: '2026-10-01',
    downloadAndInstall: vi.fn(async (onEvent?: (event: unknown) => void) => {
      onEvent?.({ event: 'Started', data: { contentLength: 200 } })
      onEvent?.({ event: 'Progress', data: { chunkLength: 50 } })
      onEvent?.({ event: 'Progress', data: { chunkLength: 150 } })
      onEvent?.({ event: 'Finished' })
    }),
    ...overrides,
  }
}

describe('useUpdater', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('stays quiet when no update is available', async () => {
    checkMock.mockResolvedValue(null)
    const updater = useUpdater()

    await updater.checkForUpdate()

    expect(updater.available.value).toBeNull()
    expect(updater.status.value).toBe('idle')
  })

  it('exposes the new version and release notes', async () => {
    checkMock.mockResolvedValue(fakeUpdate() as never)
    const updater = useUpdater()

    await updater.checkForUpdate()

    expect(updater.available.value?.version).toBe('2.4.0')
    expect(updater.available.value?.notes).toContain('示例功能')
  })

  it('downloads, reports progress and relaunches', async () => {
    const update = fakeUpdate()
    checkMock.mockResolvedValue(update as never)
    const updater = useUpdater()
    await updater.checkForUpdate()

    await updater.installUpdate()

    expect(update.downloadAndInstall).toHaveBeenCalled()
    expect(updater.status.value).toBe('installed')
    expect(relaunchMock).toHaveBeenCalled()
  })

  it('surfaces check failures without throwing', async () => {
    checkMock.mockRejectedValue(new Error('network unreachable'))
    const updater = useUpdater()

    await updater.checkForUpdate()

    expect(updater.status.value).toBe('error')
    expect(updater.errorMessage.value).toContain('network unreachable')
  })

  it('can be dismissed', async () => {
    checkMock.mockResolvedValue(fakeUpdate() as never)
    const updater = useUpdater()
    await updater.checkForUpdate()

    updater.dismiss()

    expect(updater.available.value).toBeNull()
  })
})
