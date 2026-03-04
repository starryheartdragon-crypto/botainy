'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { AuthApiError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export function LoginForm() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const getFriendlyLoginError = (error: unknown) => {
    if (error instanceof AuthApiError) {
      const message = error.message.toLowerCase()
      if (message.includes('email not confirmed')) {
        return 'Your email is not verified yet. Check your inbox and verify your account before signing in.'
      }
      if (message.includes('invalid login credentials')) {
        return 'Incorrect email/username or password.'
      }
      if (message.includes('rate limit')) {
        return 'Too many login attempts. Please wait a moment and try again.'
      }
    }

    if (error instanceof Error && error.message === 'Invalid login credentials') {
      return 'Incorrect email/username or password.'
    }

    return error instanceof Error ? error.message : 'Login failed'
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const normalizedIdentifier = identifier.trim()
      const isEmail = normalizedIdentifier.includes('@')
      let emailToUse = isEmail ? normalizedIdentifier.toLowerCase() : normalizedIdentifier

      if (!isEmail) {
        const { data: userRow, error: lookupError } = await supabase
          .from('users')
          .select('email')
          .ilike('username', normalizedIdentifier.toLowerCase())
          .maybeSingle()

        if (lookupError) {
          throw lookupError
        }

        if (!userRow?.email) {
          throw new Error('Invalid login credentials')
        }

        emailToUse = userRow.email.toLowerCase()
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      })

      if (error) throw error

      toast.success('Logged in successfully!')
      router.push('/dashboard')
    } catch (error) {
      const message = getFriendlyLoginError(error)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4 w-full max-w-md">
      <div>
        <label htmlFor="identifier" className="block text-sm font-medium text-gray-300 mb-1">
          Email or Username
        </label>
        <input
          id="identifier"
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="your@email.com or username"
          required
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-full font-semibold transition duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
      >
        {loading ? 'Logging in...' : 'Sign In'}
      </button>

      <p className="text-center text-gray-400 text-sm">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-purple-400 hover:text-purple-300 font-semibold">
          Sign up
        </Link>
      </p>

      <p className="text-center text-xs text-gray-500">
        By continuing, you agree to our{' '}
        <Link href="/terms" className="text-purple-400 hover:text-purple-300">
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="text-purple-400 hover:text-purple-300">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  )
}
