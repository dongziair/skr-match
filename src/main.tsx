import { Buffer } from 'buffer';
// @solana/web3.js 需要全局 Buffer
(window as unknown as Record<string, unknown>).Buffer = Buffer;

import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <App />,
)
