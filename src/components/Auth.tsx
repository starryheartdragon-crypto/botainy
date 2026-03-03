import React from 'react'
import toast from 'react-hot-toast'

export function Auth() {
  const handleLogin = async () => {
    toast.loading('Logging in...')
    // Auth logic will be implemented
    toast.dismiss()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-8">Welcome</h1>
        <button
          onClick={handleLogin}
          className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold"
        >
          Sign In
        </button>
      </div>
    </div>
  )
}
