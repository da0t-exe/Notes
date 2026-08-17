import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { bootNative } from './store'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root is missing from index.html')

// The native bridge has to exist before App mounts: isNative() decides whether
// the custom titlebar renders at all.
void bootNative().then(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
