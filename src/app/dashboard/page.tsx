import { redirect } from 'next/navigation'

export default function DashboardPage() {
  // This will redirect to login if not authenticated
  // You'll need to add middleware for proper auth protection
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
        
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="text-3xl font-bold text-purple-400">0</div>
            <p className="text-gray-400 text-sm mt-2">Bots Created</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="text-3xl font-bold text-pink-400">0</div>
            <p className="text-gray-400 text-sm mt-2">Active Chats</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="text-3xl font-bold text-blue-400">0</div>
            <p className="text-gray-400 text-sm mt-2">Personas</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="text-3xl font-bold text-green-400">0</div>
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
      </div>
    </div>
  )
}
