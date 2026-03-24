const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export interface MessageParam {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatCompletionRequest {
  model: string
  messages: MessageParam[]
  temperature?: number
  max_tokens?: number
  top_p?: number
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export async function sendChatMessage(
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  const response = await fetch(
    `${OPENROUTER_BASE_URL}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('OpenRouter API error:', response.status, errorText)
    throw new Error(`OpenRouter API error: ${response.status}`)
  }

  return response.json() as Promise<ChatCompletionResponse>
}

/** Primary model used for all AI completions. */
export const PRIMARY_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/hunter-alpha'

/** Fallback model used when the primary model fails. */
export const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || 'openai/gpt-4-turbo'

/**
 * Attempts the completion with PRIMARY_MODEL first.
 * On any error, transparently retries with FALLBACK_MODEL.
 */
export async function sendChatMessageWithFallback(
  request: Omit<ChatCompletionRequest, 'model'>
): Promise<ChatCompletionResponse> {
  try {
    return await sendChatMessage({ ...request, model: PRIMARY_MODEL })
  } catch (primaryError) {
    console.warn('Primary model failed, falling back to', FALLBACK_MODEL, primaryError)
    return await sendChatMessage({ ...request, model: FALLBACK_MODEL })
  }
}

export const AVAILABLE_MODELS = [
  PRIMARY_MODEL,
  FALLBACK_MODEL,
  'openai/gpt-4',
  'openai/gpt-3.5-turbo',
  'anthropic/claude-3-opus',
  'anthropic/claude-3-sonnet',
  'anthropic/claude-3-haiku',
  'google/palm-2-chat-bison',
  'mistralai/mistral-7b-instruct',
]
