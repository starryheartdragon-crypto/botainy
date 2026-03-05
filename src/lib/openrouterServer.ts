export function resolveOpenRouterApiKey() {
  const key = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY
  return key && key.trim().length > 0 ? key.trim() : null
}

export function resolveOpenRouterModel(defaultModel = 'openrouter/auto') {
  const configuredModel = process.env.OPENROUTER_MODEL
  if (configuredModel && configuredModel.trim().length > 0) {
    return configuredModel.trim()
  }

  return defaultModel
}

export function resolveOpenRouterReferer() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return configured

  const vercelUrl = process.env.VERCEL_URL?.trim()
  if (vercelUrl) {
    return vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`
  }

  return 'http://localhost:3000'
}

export function getOpenRouterErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') {
    return fallback
  }

  const typedPayload = payload as {
    error?: unknown
    message?: unknown
  }

  if (typedPayload.error && typeof typedPayload.error === 'object') {
    const nestedMessage = (typedPayload.error as { message?: unknown }).message
    if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
      return nestedMessage
    }
  }

  if (typeof typedPayload.error === 'string' && typedPayload.error.trim()) {
    return typedPayload.error
  }

  if (typeof typedPayload.message === 'string' && typedPayload.message.trim()) {
    return typedPayload.message
  }

  return fallback
}
