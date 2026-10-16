import type { AuthTokenResponse } from '../types'

export class ApiError extends Error {
  status: number
  details: string[]

  constructor(status: number, message: string, details: string[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

function messageFromBody(body: unknown): { message: string; details: string[] } {
  if (typeof body === 'string') {
    return { message: body, details: [] }
  }
  if (!body || typeof body !== 'object') {
    return { message: 'The request failed. Please try again.', details: [] }
  }
  const messages = Object.entries(body).flatMap(([field, value]) => {
    const values = Array.isArray(value) ? value : [value]
    return values
      .filter((item): item is string => typeof item === 'string')
      .map((item) => (field === 'detail' ? item : `${field}: ${item}`))
  })
  return {
    message: messages[0] ?? 'The request failed. Please try again.',
    details: messages,
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = window.localStorage.getItem('transport.access')
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) {
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
      window.dispatchEvent(new Event('transport:unauthorized'))
    }
    const error = messageFromBody(body)
    throw new ApiError(response.status, error.message, error.details)
  }
  return body as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
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

export async function resetPassword(
  uid: string,
  token: string,
  newPassword: string,
): Promise<void> {
  await request<unknown>('/api/auth/reset-password/', {
    method: 'POST',
    body: JSON.stringify({ uid, token, new_password: newPassword }),
  })
}
