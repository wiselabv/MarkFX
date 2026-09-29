import { computed, shallowRef } from 'vue'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'installed' | 'error'

export interface AvailableUpdate {
  version: string
  notes: string | null
}

export function useUpdater() {
  const available = shallowRef<AvailableUpdate | null>(null)
  const status = shallowRef<UpdateStatus>('idle')
  const errorMessage = shallowRef<string | null>(null)
  const downloaded = shallowRef(0)
  const total = shallowRef(0)
  let pendingUpdate: Awaited<ReturnType<typeof check>> = null

  const progress = computed(() => {
    if (total.value <= 0)
      return 0

    return Math.min(100, Math.round((downloaded.value / total.value) * 100))
  })

  async function checkForUpdate() {
    status.value = 'checking'
    errorMessage.value = null

    try {
      const update = await check()
      pendingUpdate = update
      if (!update) {
        available.value = null
        status.value = 'idle'
        return null
      }

      available.value = {
        version: update.version,
        notes: update.body?.trim() || null,
      }
      status.value = 'available'
      return update
    }
    catch (error) {
      pendingUpdate = null
      available.value = null
      status.value = 'error'
      errorMessage.value = error instanceof Error ? error.message : String(error)
      return null
    }
  }

  async function installUpdate() {
    const update = pendingUpdate ?? await checkForUpdate()
    if (!update)
      return false

    status.value = 'downloading'
    downloaded.value = 0
    total.value = 0

    try {
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started')
          total.value = event.data.contentLength ?? 0
        else if (event.event === 'Progress')
          downloaded.value += event.data.chunkLength ?? 0
      })
      pendingUpdate = null
      status.value = 'installed'
      await relaunch()
      return true
    }
    catch (error) {
      status.value = 'error'
      errorMessage.value = error instanceof Error ? error.message : String(error)
      return false
    }
  }

  function dismiss() {
    available.value = null
    pendingUpdate = null
    if (status.value !== 'downloading')
      status.value = 'idle'
  }

  return {
    available,
    status,
    errorMessage,
    progress,
    checkForUpdate,
    installUpdate,
    dismiss,
  }
}
