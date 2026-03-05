"use client"

import { create } from 'zustand'
import { User } from '@/types'
import { supabase } from '@/lib/supabase'

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  logout: () => Promise<void>
  fetchUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null, error: null })
  },
  fetchUser: async () => {
    try {
      set({ loading: true })
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (authUser) {
        const { data: userData, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()
        
        if (error) throw error
        set({ user: userData as User })
      } else {
        set({ user: null })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch user'
      set({ error: message, user: null })
    } finally {
      set({ loading: false })
    }
  },
}))
