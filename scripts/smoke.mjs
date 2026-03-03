#!/usr/bin/env node

const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000'
const authToken = process.env.SMOKE_AUTH_TOKEN
const botId = process.env.SMOKE_BOT_ID
const personaId = process.env.SMOKE_PERSONA_ID || null

function fail(message, details) {
  console.error(`❌ ${message}`)
  if (details !== undefined) {
    console.error(details)
  }
  process.exit(1)
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {
    Authorization: `Bearer ${authToken}`,
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const raw = await response.text()
  let data = null
  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch {
      data = raw
    }
  }

  return { response, data }
}

async function run() {
  if (!authToken) {
    fail('Missing SMOKE_AUTH_TOKEN')
  }

  if (!botId) {
    fail('Missing SMOKE_BOT_ID')
  }

  console.log(`🔎 Running smoke tests against ${baseUrl}`)

  const chatsBefore = await request('/api/chats')
  if (!chatsBefore.response.ok || !Array.isArray(chatsBefore.data)) {
    fail('GET /api/chats failed', chatsBefore)
  }
  console.log(`✅ GET /api/chats (${chatsBefore.data.length} chats)`)

  const createChat = await request('/api/chats', {
    method: 'POST',
    body: {
      botId,
      ...(personaId ? { personaId } : {}),
    },
  })

  if (!createChat.response.ok || !createChat.data?.id) {
    fail('POST /api/chats failed', createChat)
  }

  const chatId = createChat.data.id
  console.log(`✅ POST /api/chats (chatId=${chatId})`)

  const sendMessage = await request(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    body: {
      content: `Smoke test ping ${new Date().toISOString()}`,
      ...(personaId ? { personaId } : {}),
    },
  })

  if (!sendMessage.response.ok || !sendMessage.data?.userMessage?.id) {
    fail(`POST /api/chats/${chatId}/messages failed`, sendMessage)
  }
  console.log(`✅ POST /api/chats/${chatId}/messages`)

  const chatMessages = await request(`/api/chats/${chatId}/messages`)
  if (!chatMessages.response.ok || !Array.isArray(chatMessages.data) || chatMessages.data.length === 0) {
    fail(`GET /api/chats/${chatId}/messages failed`, chatMessages)
  }
  console.log(`✅ GET /api/chats/${chatId}/messages (${chatMessages.data.length} messages)`)

  console.log('🎉 Smoke tests passed')
}

run().catch((error) => {
  fail('Smoke run crashed', error instanceof Error ? error.stack || error.message : String(error))
})
