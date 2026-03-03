import axios from 'axios'

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
  try {
    const response = await axios.post<ChatCompletionResponse>(
      `${OPENROUTER_BASE_URL}/chat/completions`,
      request,
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'Content-Type': 'application/json',
        },
      }
    )

    return response.data
  } catch (error) {
    console.error('OpenRouter API error:', error)
    throw error
  }
}

export const AVAILABLE_MODELS = [
  'openai/gpt-4-turbo',
  'openai/gpt-4',
  'openai/gpt-3.5-turbo',
  'anthropic/claude-3-opus',
  'anthropic/claude-3-sonnet',
  'anthropic/claude-3-haiku',
  'google/palm-2-chat-bison',
  'mistralai/mistral-7b-instruct',
]
