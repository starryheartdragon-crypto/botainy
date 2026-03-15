"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type MenuUser = {
  id: string
  username?: string | null
  avatar_url?: string | null
  is_admin?: boolean | null
}

type MenuItem = {
  href: string
  label: string
  icon: "user" | "users" | "chat" | "sparkles" | "compass" | "shield" | "login" | "logout"
  action?: "signout"
}

export default function DropdownMenu() {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<MenuUser | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const itemsRef = useRef<Array<HTMLElement | null>>([])
  const focusedIndex = useRef<number>(-1)

  function getStoredAccessToken() {
    if (typeof window === "undefined") return null

    try {
      const raw = window.localStorage.getItem("botainy-auth")
      if (!raw) return null

      const parsed = JSON.parse(raw) as {
        access_token?: string
        expires_at?: number
        currentSession?: { access_token?: string; expires_at?: number }
        session?: { access_token?: string; expires_at?: number }
      }

      const token = parsed.access_token ?? parsed.currentSession?.access_token ?? parsed.session?.access_token
      const expiresAt = parsed.expires_at ?? parsed.currentSession?.expires_at ?? parsed.session?.expires_at

      if (!token) return null
      if (typeof expiresAt === "number" && expiresAt * 1000 <= Date.now()) return null

      return token
    } catch {
      return null
    }
  }

  async function fetchProfile(token: string): Promise<{ username: string | null; avatar_url: string | null }> {
    try {
      const resp = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!resp.ok) return { username: null, avatar_url: null }
      const data = await resp.json() as { username?: string | null; avatar_url?: string | null }
      return { username: data.username ?? null, avatar_url: data.avatar_url ?? null }
    } catch {
      return { username: null, avatar_url: null }
    }
  }

  async function checkAdminStatus(token: string | null, mounted: boolean) {
    if (!token) {
      if (mounted) setIsAdmin(false)
      return
    }

    try {
      const resp = await fetch("/api/admin/status", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (resp.ok) {
        const data = await resp.json()
        if (mounted) {
          setIsAdmin(!!data.isAdmin)
        }
      } else if (mounted) {
        setIsAdmin(false)
      }
    } catch {
      if (mounted) setIsAdmin(false)
    }
  }

  useEffect(() => {
    let mounted = true

    async function hydrateUser() {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const authUser = sessionData?.session?.user

        if (!authUser) {
          if (mounted) {
            setUser(null)
            setIsAdmin(false)
          }
          return
        }

        const token = sessionData.session?.access_token ?? null
        const profile = token ? await fetchProfile(token) : { username: null, avatar_url: null }

        if (mounted) {
          setUser({
            id: authUser.id,
            username: profile.username ?? authUser.user_metadata?.username ?? "User",
            avatar_url: profile.avatar_url ?? authUser.user_metadata?.avatar_url ?? null,
            is_admin: false,
          })
        }

        await checkAdminStatus(token, mounted)
      } catch {
        const fallbackToken = getStoredAccessToken()
        if (fallbackToken) {
          await checkAdminStatus(fallbackToken, mounted)
        } else if (mounted) {
          setUser(null)
          setIsAdmin(false)
        }
      }
    }

    void hydrateUser()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        try {
          const authUser = session?.user

          if (!authUser) {
            if (mounted) {
              setUser(null)
              setIsAdmin(false)
            }
            return
          }

          const token = session?.access_token ?? getStoredAccessToken()
          const profile = token ? await fetchProfile(token) : { username: null, avatar_url: null }

          if (mounted) {
            setUser({
              id: authUser.id,
              username: profile.username ?? authUser.user_metadata?.username ?? "User",
              avatar_url: profile.avatar_url ?? authUser.user_metadata?.avatar_url ?? null,
              is_admin: false,
            })
          }

          await checkAdminStatus(token, mounted)
        } catch {
          if (mounted) setIsAdmin(false)
        }
      })()
    })

    return () => {
      mounted = false
      listener?.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return
      if (e.target instanceof Node && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }

    document.addEventListener("click", onDoc)
    return () => document.removeEventListener("click", onDoc)
  }, [])

  useEffect(() => {
    if (!open) {
      focusedIndex.current = -1
      return
    }

    setTimeout(() => {
      focusedIndex.current = 0
      itemsRef.current[0]?.focus()
    }, 0)
  }, [open])

  function onKeyDown(e: React.KeyboardEvent) {
    const items = itemsRef.current
    if (!items || items.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      focusedIndex.current = (focusedIndex.current + 1) % items.length
      items[focusedIndex.current]?.focus()
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      focusedIndex.current = (focusedIndex.current - 1 + items.length) % items.length
      items[focusedIndex.current]?.focus()
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
    setIsAdmin(false)
    setOpen(false)
  }

  const menuItems: MenuItem[] = [
    ...(user ? [{ href: "/profile", label: "Profile", icon: "user" as const }] : []),
    ...(user ? [{ href: "/conversations", label: "Conversations", icon: "chat" as const }] : []),
    ...(user ? [{ href: "/connections", label: "Connections", icon: "users" as const }] : []),
    ...(user ? [{ href: "/group-chats", label: "Group Chats", icon: "users" as const }] : []),
    { href: "/create", label: "Create", icon: "sparkles" },
    ...(user ? [{ href: "/my-bots", label: "My Bots", icon: "sparkles" as const }] : []),
    { href: "/explore", label: "Explore", icon: "compass" },
    { href: "/chat-rooms", label: "Chat Rooms", icon: "chat" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin Page", icon: "shield" as const }] : []),
    user
      ? { href: "#", label: "Sign Out", icon: "logout", action: "signout" }
      : { href: "/login", label: "Sign In", icon: "login" },
  ]

  return (
    <div className="fixed top-4 sm:top-6 left-4 sm:left-6 z-[9999]" ref={ref} onKeyDown={onKeyDown}>
      <button
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 text-white hover:from-gray-700 hover:to-gray-800 hover:border-gray-600 transition transform hover:scale-105 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40"
        title="Menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 6H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="mt-2 w-56 bg-gray-950 border border-gray-800 rounded-lg shadow-2xl overflow-hidden animate-fade-in backdrop-blur-sm bg-opacity-95">
          <div className="p-4 border-b border-gray-800 flex items-center gap-3 bg-gradient-to-r from-gray-900 to-gray-950">
            {user?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt="avatar" className="w-10 h-10 rounded-full object-cover border border-gray-700 shadow" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-sm font-bold text-white">{user?.username?.[0]?.toUpperCase() ?? "?"}</div>
            )}
            <div>
              <div className="text-sm font-semibold text-gray-100">{user?.username ?? "Guest"}</div>
              <div className="text-xs text-gray-500">{user ? "Signed in" : "Not signed in"}</div>
            </div>
          </div>
          <nav className="flex flex-col py-1 max-h-[60vh] overflow-y-auto" aria-label="Main menu">
            {menuItems.map((it, idx) => (
              it.action === "signout" ? (
                <button
                  key={it.label}
                  ref={(el) => { itemsRef.current[idx] = el as unknown as HTMLElement | null }}
                  onClick={async () => {
                    await handleSignOut()
                  }}
                  className="text-left px-4 py-2.5 text-xs sm:text-sm text-red-400 hover:bg-red-950 hover:bg-opacity-50 flex items-center gap-3 focus:outline-none focus:bg-red-950 focus:bg-opacity-50 transition"
                >
                  <span className="font-medium">Sign Out</span>
                </button>
              ) : (
                <Link
                  key={it.label}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  ref={(el) => { itemsRef.current[idx] = el as unknown as HTMLElement | null }}
                  className="px-4 py-2.5 text-xs sm:text-sm text-gray-300 hover:text-white hover:bg-gray-800 flex items-center gap-3 focus:outline-none focus:bg-gray-800 focus:text-white transition"
                >
                  <span className="font-medium">{it.label}</span>
                </Link>
              )
            ))}
          </nav>
        </div>
      )}
    </div>
  )
}
