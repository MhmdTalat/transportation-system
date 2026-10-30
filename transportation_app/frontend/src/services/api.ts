import type { AuthTokenResponse } from '../types'
import i18n from '../i18n'

function localize(message: string) {
  return i18n.t(message)
}

export class ApiError extends Error {
  status: number
  details: string[]
  code?: string

  constructor(status: number, message: string, details: string[] = [], code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
    this.code = code
  }
}

let refreshInFlight: Promise<string | null> | null = null

function addLanguageHeader(headers: Headers) {
  headers.set('Accept-Language', window.localStorage.getItem('wasalni.language') ?? 'ar')
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    const refresh = window.localStorage.getItem('transport.refresh')
    if (!refresh) return null

    let response: Response
    try {
      response = await fetch('/api/token/refresh/', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Accept-Language': window.localStorage.getItem('wasalni.language') ?? 'ar',
        },
        body: JSON.stringify({ refresh }),
      })
    } catch {
      return null
    }
    if (!response.ok) return null

    const body = await response.json() as { access?: unknown; refresh?: unknown }
    if (typeof body.access !== 'string') return null
    window.localStorage.setItem('transport.access', body.access)
    if (typeof body.refresh === 'string') {
      window.localStorage.setItem('transport.refresh', body.refresh)
    }
    return body.access
  })()
  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

function messageFromBody(body: unknown): { message: string; details: string[] } {
  if (typeof body === 'string') {
    return { message: localize(body), details: [] }
  }
  if (!body || typeof body !== 'object') {
    const message = localize('The request failed. Please try again.')
    return { message, details: [] }
  }
  const messages = Object.entries(body).filter(([field]) => field !== 'code').flatMap(([field, value]) => {
    const values = Array.isArray(value) ? value : [value]
    return values
      .filter((item): item is string => typeof item === 'string')
      .map((item) => (
        field === 'detail' || field === 'documents'
          ? localize(item)
          : `${localize(field)}: ${localize(item)}`
      ))
  })
  const localizedMessages = messages.map(localize)
  return {
    message: localizedMessages[0] ?? localize('The request failed. Please try again.'),
    details: localizedMessages,
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let token = window.localStorage.getItem('transport.access')
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  addLanguageHeader(headers)
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(path, { ...init, headers })
  } catch {
    throw new ApiError(0, 'The API cannot be reached. Check that Django is running.')
  }

  if (
    response.status === 401
    && token
    && path !== '/api/token/'
    && path !== '/api/token/refresh/'
    && path !== '/api/auth/logout/'
  ) {
    const refreshedToken = await refreshAccessToken()
    if (refreshedToken) {
      token = refreshedToken
      headers.set('Authorization', `Bearer ${token}`)
      try {
        response = await fetch(path, { ...init, headers })
      } catch {
        throw new ApiError(0, 'The API cannot be reached. Check that Django is running.')
      }
    }
  }

  if (response.status === 204) {
    return undefined as T
  }
  const contentType = response.headers.get('content-type') ?? ''
  const body: unknown = contentType.includes('application/json')
    ? await response.json()
    : await response.text()
  if (!response.ok) {
    if (response.status === 401) {
      window.localStorage.removeItem('transport.access')
      window.localStorage.removeItem('transport.refresh')
      window.dispatchEvent(new Event('transport:unauthorized'))
    }
    const error = messageFromBody(body)
    const code = body && typeof body === 'object' && 'code' in body && typeof body.code === 'string'
      ? body.code
      : undefined
    throw new ApiError(response.status, error.message, error.details, code)
  }
  return body as T
}

async function requestBlob(path: string): Promise<Blob> {
  let token = window.localStorage.getItem('transport.access')
  const headers = new Headers({ Accept: '*/*' })
  addLanguageHeader(headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const send = () => fetch(path, { headers })
  let response: Response
  try {
    response = await send()
  } catch {
    throw new ApiError(0, 'The API cannot be reached. Check that Django is running.')
  }
  if (response.status === 401 && token) {
    const refreshedToken = await refreshAccessToken()
    if (refreshedToken) {
      token = refreshedToken
      headers.set('Authorization', `Bearer ${token}`)
      try {
        response = await send()
      } catch {
        throw new ApiError(0, 'The API cannot be reached. Check that Django is running.')
      }
    }
  }
  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    const body: unknown = contentType.includes('application/json')
      ? await response.json()
      : await response.text()
    if (response.status === 401) {
      window.localStorage.removeItem('transport.access')
      window.localStorage.removeItem('transport.refresh')
      window.dispatchEvent(new Event('transport:unauthorized'))
    }
    const error = messageFromBody(body)
    throw new ApiError(response.status, error.message, error.details)
  }
  return response.blob()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown, headers?: HeadersInit) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body), headers }),
  upload: <T>(path: string, body: FormData) =>
    request<T>(path, { method: 'POST', body }),
  download: (path: string) => requestBlob(path),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
}

export async function signIn(username: string, password: string): Promise<AuthTokenResponse> {
  return request<AuthTokenResponse>('/api/token/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function revokeSession(refresh: string): Promise<void> {
  await request<void>('/api/auth/logout/', {
    method: 'POST',
    body: JSON.stringify({ refresh }),
  })
}

export async function registerAccount(payload: {
  username: string
  first_name: string
  last_name: string
  email: string
  phone_number: string
  password: string
  role: 'passenger' | 'driver'
}): Promise<void> {
  await request<unknown>('/api/register/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function requestPasswordReset(email: string): Promise<void> {
  await request<unknown>('/api/auth/forgot-password/', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function verifyEmail(email: string, code: string): Promise<void> {
  await request<unknown>('/api/auth/verify-email/', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  })
}

export async function requestEmailVerification(email: string): Promise<void> {
  await request<unknown>('/api/auth/email-verification/', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function resetPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  await request<unknown>('/api/auth/reset-password/', {
    method: 'POST',
    body: JSON.stringify({ email, code, new_password: newPassword }),
  })
}
