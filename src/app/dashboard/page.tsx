"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Leaderboard from "@/components/Leaderboard"

type DashboardStats = {
  botsCreated: number
  activeChats: number
  personas: number
  messages: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadStats(showLoading = false) {
      if (showLoading) {
        setLoading(true)
      }
      setError(null)

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.access_token) {
          if (!isMounted) return
          setStats({ botsCreated: 0, activeChats: 0, personas: 0, messages: 0 })
          setError("Sign in to view your dashboard stats")
          return
        }

        const resp = await fetch("/api/dashboard/stats", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        const data = await resp.json()
        if (!resp.ok) {
          throw new Error(data.error || "Failed to load stats")
        }

        if (!isMounted) return
        setStats({
          botsCreated: data.botsCreated ?? 0,
          activeChats: data.activeChats ?? 0,
          personas: data.personas ?? 0,
          messages: data.messages ?? 0,
        })
      } catch (err: unknown) {
        if (!isMounted) return
        const message = err instanceof Error ? err.message : "Failed to load stats"
        setError(message)
      } finally {
        if (!isMounted) return
        setLoading(false)
      }
    }

    loadStats(true)

    const intervalId = window.setInterval(() => {
      loadStats(false)
    }, 45000)

    const onWindowFocus = () => {
      loadStats(false)
    }

    window.addEventListener("focus", onWindowFocus)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
      window.removeEventListener("focus", onWindowFocus)
    }
  }, [])

  const botsCreated = stats?.botsCreated ?? 0
  const activeChats = stats?.activeChats ?? 0
  const personas = stats?.personas ?? 0
  const messages = stats?.messages ?? 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950">
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            Botainy
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-white mb-8">Dashboard</h1>

        {error && (
          <div className="mb-6 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
        
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="text-3xl font-bold text-purple-400">{loading ? "..." : botsCreated}</div>
            <p className="text-gray-400 text-sm mt-2">Bots Created</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="text-3xl font-bold text-pink-400">{loading ? "..." : activeChats}</div>
            <p className="text-gray-400 text-sm mt-2">Active Chats</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="text-3xl font-bold text-blue-400">{loading ? "..." : personas}</div>
            <p className="text-gray-400 text-sm mt-2">Personas</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="text-3xl font-bold text-green-400">{loading ? "..." : messages}</div>
            <p className="text-gray-400 text-sm mt-2">Messages</p>
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-white mb-4">Get Started</h2>
          <p className="text-gray-300 mb-6">Welcome to Botainy! Here are some things you can do:</p>
          <ul className="space-y-3 text-gray-300">
            <li className="flex items-center gap-2">
              <span className="text-purple-400">→</span> Create your first bot
            </li>
            <li className="flex items-center gap-2">
              <span className="text-purple-400">→</span> Set up your personas
            </li>
            <li className="flex items-center gap-2">
              <span className="text-purple-400">→</span> Customize your profile
            </li>
            <li className="flex items-center gap-2">
              <span className="text-purple-400">→</span> Start chatting with bots
            </li>
          </ul>
        </div>

        <div className="mt-8">
          <Leaderboard />
        </div>
      </div>
    </div>
  )
}
