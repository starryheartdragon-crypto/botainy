import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let supabaseClient: SupabaseClient | null = null

const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const publicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function resolveSupabaseCredentials() {
  const isServer = typeof window === 'undefined'
  const supabaseUrl = publicSupabaseUrl ?? (isServer ? process.env.SUPABASE_URL : undefined)
  const supabaseAnonKey = publicSupabaseAnonKey ?? (isServer ? process.env.SUPABASE_ANON_KEY : undefined)

  if (supabaseUrl && supabaseAnonKey) {
    return { supabaseUrl, supabaseAnonKey }
  }

  const missing: string[] = []
  if (!supabaseUrl) {
    missing.push(isServer ? 'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL' : 'NEXT_PUBLIC_SUPABASE_URL')
  }
  if (!supabaseAnonKey) {
    missing.push(isServer ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY' : 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  const runtime = isServer ? 'server' : 'client'
  throw new Error(`Missing Supabase env (${runtime}): ${missing.join(', ')}`)
}

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient
  const { supabaseUrl, supabaseAnonKey } = resolveSupabaseCredentials()

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'botainy-auth',
    },
  })

  return supabaseClient
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseClient()
    const value = Reflect.get(client as unknown as object, prop, receiver)

    return typeof value === 'function' ? (value as Function).bind(client) : value
  },
}) as SupabaseClient

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          username: string
          birthday: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          username: string
          birthday?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      bots: {
        Row: {
          id: string
          creator_id: string
          name: string
          universe: string | null
          description: string
          personality: string
          avatar_url: string | null
          is_published: boolean
          created_at: string
          updated_at: string
        }
      }
      personas: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string
          avatar_url: string | null
          created_at: string
        }
      }
      chats: {
        Row: {
          id: string
          user_id: string
          bot_id: string
          persona_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bot_id: string
          persona_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          chat_id: string
          sender_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          sender_id: string
          content: string
          created_at?: string
        }
      }
    }
  }
}
