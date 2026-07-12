import { Excalidraw } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

interface ExcalidrawRootProps {
  theme: 'light' | 'dark'
  onReady: (api: ExcalidrawImperativeAPI) => void
}

export function ExcalidrawRoot({ theme, onReady }: ExcalidrawRootProps) {
  return (
    <Excalidraw
      excalidrawAPI={onReady}
      theme={theme}
      name="MarkFX 绘图"
      UIOptions={{
        canvasActions: {
          changeViewBackgroundColor: true,
          clearCanvas: true,
          export: false,
          loadScene: true,
          saveAsImage: false,
          toggleTheme: false,
        },
      }}
    />
  )
}

export type { ExcalidrawImperativeAPI }
