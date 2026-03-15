import { sendChatMessage, AVAILABLE_MODELS } from './openrouter';

export async function callOpenRouter({ prompt }: { prompt: string }) {
  // Use GPT-4 Turbo as default model
  const model = AVAILABLE_MODELS.includes('openai/gpt-4-turbo') ? 'openai/gpt-4-turbo' : AVAILABLE_MODELS[0];
  const request = {
    model,
    messages: [
      { role: 'system' as const, content: 'You are an AI assistant helping users roleplay and answer questions in chat.' },
      { role: 'user' as const, content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 256,
  };
  try {
    const response = await sendChatMessage(request);
    return response.choices[0]?.message?.content || '';
  } catch (err) {
    return null;
  }
}
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
