import { LoginForm } from '@/components/LoginForm'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950">
      {/* Navigation */}
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            Botainy
          </Link>
          <div className="flex gap-4">
            <Link href="/login" className="px-4 py-2 text-gray-300 hover:text-white transition font-medium">
              Sign In
            </Link>
            <Link href="/signup" className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-full hover:from-purple-700 hover:to-purple-800 transition font-semibold shadow-md">
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Login Container */}
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
        <div className="w-full max-w-md mx-auto px-4 py-8">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8">
            <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-gray-400 mb-8">Sign in to your Botainy account</p>
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  )
}
