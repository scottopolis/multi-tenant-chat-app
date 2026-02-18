export function getWorkerHost(): string {
  if (typeof window === 'undefined') return ''

  const envHost = (import.meta as any).env?.VITE_WORKER_URL as string | undefined
  if (envHost && envHost.trim().length > 0) {
    return envHost.replace(/\/+$/, '')
  }

  const origin = window.location.origin
  const isLocal =
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.includes('0.0.0.0')

  if (isLocal) {
    return origin.replace(/:\d+$/, ':8787')
  }

  return origin
}

export function toWebSocketUrl(httpUrl: string): string {
  if (httpUrl.startsWith('https://')) return httpUrl.replace('https://', 'wss://')
  if (httpUrl.startsWith('http://')) return httpUrl.replace('http://', 'ws://')
  return httpUrl
}
