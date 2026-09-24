import { clearToken, getToken } from '../auth/token'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

export class ApiError extends Error {
  readonly status: number
  readonly details?: Record<string, string>

  constructor(status: number, message: string, details?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

const SOC_STORAGE_KEY = 'soc360.selectedSocId'

function persistedSocId(): number | null {
  const raw = localStorage.getItem(SOC_STORAGE_KEY)
  if (!raw) return null
  const id = Number(raw)
  return Number.isFinite(id) ? id : null
}

let currentSocId: number | null = persistedSocId()

const socListeners = new Set<() => void>()

export function subscribeSocId(listener: () => void): () => void {
  socListeners.add(listener)
  return () => {
    socListeners.delete(listener)
  }
}

export function setCurrentSocId(id: number | null): void {
  if (currentSocId === id) return
  currentSocId = id
  socListeners.forEach((listener) => listener())
}

export function getCurrentSocId(): number | null {
  return currentSocId
}

let activeRequests = 0
let loadingListener: ((loading: boolean) => void) | null = null

export function setLoadingListener(listener: ((loading: boolean) => void) | null): void {
  loadingListener = listener
}

function isNotificationPath(path: string): boolean {
  return path.startsWith('/notifications') || path.startsWith('/public/i18n')
}

function beginLoading(path: string): void {
  if (isNotificationPath(path)) return
  activeRequests += 1
  if (activeRequests === 1) loadingListener?.(true)
}

function endLoading(path: string): void {
  if (isNotificationPath(path)) return
  activeRequests = Math.max(0, activeRequests - 1)
  if (activeRequests === 0) loadingListener?.(false)
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (currentSocId != null) headers['X-SOC-Id'] = String(currentSocId)
  return headers
}

function buildQuery(params?: Record<string, string | number | boolean | null | undefined>): string {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

async function parseError(response: Response): Promise<ApiError> {
  let message = `Erreur ${response.status}`
  let details: Record<string, string> | undefined
  try {
    const body = await response.json()
    if (typeof body.message === 'string') message = body.message
    details = body.details
  } catch {
    // réponse non JSON : on garde le message générique
  }
  return new ApiError(response.status, message, details)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  beginLoading(path)
  try {
    return await doRequest<T>(path, options)
  } finally {
    endLoading(path)
  }
}

async function doRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders(),
    ...(options.headers as Record<string, string> | undefined),
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api${path}`, { ...options, headers })
  } catch {
    throw new ApiError(0, 'Impossible de joindre le serveur')
  }

  if (response.status === 401) {
    clearToken()
    unauthorizedHandler?.()
  }

  if (!response.ok) {
    throw await parseError(response)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
  beginLoading(path)
  try {
    return await doUpload<T>(path, formData)
  } finally {
    endLoading(path)
  }
}

async function doUpload<T>(path: string, formData: FormData): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api${path}`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    })
  } catch {
    throw new ApiError(0, 'Impossible de joindre le serveur')
  }

  if (response.status === 401) {
    clearToken()
    unauthorizedHandler?.()
  }

  if (!response.ok) {
    throw await parseError(response)
  }

  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

async function download(path: string, fallbackName: string): Promise<void> {
  beginLoading(path)
  try {
    await doDownload(path, fallbackName)
  } finally {
    endLoading(path)
  }
}

async function doDownload(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api${path}`, { headers: authHeaders() })
  if (!response.ok) {
    throw await parseError(response)
  }
  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const match = disposition.match(/filename="?([^";]+)"?/)
  const filename = match ? match[1] : fallbackName
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | boolean | null | undefined>) =>
    request<T>(path + buildQuery(params)),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  postText: <T>(path: string, body: string) =>
    request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body,
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => upload<T>(path, formData),
  download: (path: string, fallbackName: string) => download(path, fallbackName),
}
