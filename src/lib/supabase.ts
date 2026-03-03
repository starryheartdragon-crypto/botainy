import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'botainy-auth',
  },
})

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
