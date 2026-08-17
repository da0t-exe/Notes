import { useEffect, useState } from 'react'
import { IconWinClose, IconWinMax, IconWinMin, IconWinRestore } from '../icons'
import { isNative } from '../lib/native'

export function TitleBar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!isNative()) return
    let stop: (() => void) | undefined
    void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      const win = getCurrentWindow()
      setMaximized(await win.isMaximized())
      stop = await win.onResized(async () => setMaximized(await win.isMaximized()))
    })
    return () => stop?.()
  }, [])

  if (!isNative()) return null

  return (
    <div className="titlebar">
      <div className="titlebar-brand" data-tauri-drag-region>
        <img className="titlebar-icon" src="/icon.png" width={16} height={16} alt="" />
        <span className="titlebar-name">Notes</span>
      </div>
      <div className="titlebar-drag" data-tauri-drag-region />
      <div className="titlebar-controls">
        <button type="button" className="win-btn" title="Minimize" onClick={() => window.notesNative?.minimize()}>
          <IconWinMin />
        </button>
        <button
          type="button"
          className="win-btn"
          title={maximized ? 'Restore' : 'Maximize'}
          onClick={() => window.notesNative?.maximize()}
        >
          {maximized ? <IconWinRestore /> : <IconWinMax />}
        </button>
        <button type="button" className="win-btn close" title="Close" onClick={() => window.notesNative?.close()}>
          <IconWinClose />
        </button>
      </div>
    </div>
  )
}
