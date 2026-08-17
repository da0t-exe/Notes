import { IconExternal, IconMinus, IconPlus } from '../icons'
import type { Theme } from '../lib/types'
import { setFontSize, setTheme, useStore } from '../store'

const THEMES: { id: Theme; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
]

const MIN_FONT = 12
const MAX_FONT = 22
const REPO = 'https://github.com/da0t-exe/Notes'

/**
 * Rebuilt rather than ported. v0.3's settings offered eight languages with no
 * translation layer behind any of them, and a "contribute to the translation"
 * link pointing at nothing. Only settings that change something are here.
 */
export function SettingsScreen() {
  const theme = useStore((s) => s.settings.theme)
  const fontSize = useStore((s) => s.settings.fontSize)

  return (
    <div className="page">
      <div className="section-label">Appearance</div>

      <div className="theme-row" role="radiogroup" aria-label="Color theme">
        {THEMES.map((t) => (
          <button
            key={t.id}
            className={`theme-circle ${t.id} ${theme === t.id ? 'active' : ''}`}
            type="button"
            role="radio"
            aria-checked={theme === t.id}
            onClick={() => setTheme(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="option-group">
        <div className="option">
          <div className="left">
            <span>Editor text size</span>
            <span className="desc">Also on Ctrl+plus and Ctrl+minus</span>
          </div>
          <div className="stepper">
            <button
              className="icon-btn"
              type="button"
              aria-label="Smaller"
              disabled={fontSize <= MIN_FONT}
              onClick={() => setFontSize(Math.max(MIN_FONT, fontSize - 1))}
            >
              <IconMinus />
            </button>
            <span className="stepper-value">{fontSize}</span>
            <button
              className="icon-btn"
              type="button"
              aria-label="Larger"
              disabled={fontSize >= MAX_FONT}
              onClick={() => setFontSize(Math.min(MAX_FONT, fontSize + 1))}
            >
              <IconPlus />
            </button>
          </div>
        </div>
      </div>

      <div className="section-label">About</div>

      <div className="option-group">
        <a className="option" href={REPO} target="_blank" rel="noreferrer noopener">
          <div className="left">
            <span>GitHub repository</span>
            <span className="desc">Source, issues and feature requests</span>
          </div>
          <IconExternal />
        </a>
        <a className="option" href={`${REPO}/releases`} target="_blank" rel="noreferrer noopener">
          <div className="left">
            <span>Version</span>
            <span className="desc">{__APP_VERSION__}</span>
          </div>
          <IconExternal />
        </a>
      </div>
    </div>
  )
}
