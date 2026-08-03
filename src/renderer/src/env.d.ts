/// <reference types="vite/client" />

import type { Api } from '../../preload/index'
import type { WebviewTag } from 'electron'

declare global {
  interface Window {
    api: Api
  }

  namespace JSX {
    interface IntrinsicElements {
      // Fase 8's verification panel — nodeIntegration/contextIsolation locked down
      // in main/index.ts's will-attach-webview handler regardless of what's set here.
      webview: React.DetailedHTMLProps<React.HTMLAttributes<WebviewTag>, WebviewTag> & {
        src?: string
        allowpopups?: boolean
        partition?: string
      }
    }
  }
}

export {}
