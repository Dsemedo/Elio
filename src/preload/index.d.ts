import type { ElioApi } from './index'

declare global {
  interface Window {
    elio: ElioApi
  }
}

export {}
