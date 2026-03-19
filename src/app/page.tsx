import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950">
      {/* Navigation */}
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            Botainy
          </div>
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

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
            Chat & Roleplay with AI Characters
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Create custom AI bots based on your favorite characters and OCs. Chat one-on-one, join group conversations, and immerse yourself in interactive roleplay.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/signup" className="px-8 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-full hover:from-purple-700 hover:to-purple-800 transition font-semibold shadow-lg hover:shadow-xl">
              Get Started
            </Link>
            <Link href="/explore" className="px-8 py-3 border border-gray-600 hover:border-purple-500 text-white rounded-full hover:bg-purple-950 hover:bg-opacity-30 transition font-semibold">
              Explore Bots
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="text-3xl mb-4">🤖</div>
            <h3 className="text-xl font-bold mb-2">Create Bots</h3>
            <p className="text-gray-300">Build AI characters with custom personalities and backgrounds. Define their traits, speaking style, and behaviors.</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="text-3xl mb-4">💬</div>
            <h3 className="text-xl font-bold mb-2">Chat & Roleplay</h3>
            <p className="text-gray-300">Engage in immersive conversations with multiple bots. Switch between different personas for unique interactions.</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="text-3xl mb-4">🎵</div>
            <h3 className="text-xl font-bold mb-2">Customize Profile</h3>
            <p className="text-gray-300">Personalize your profile with music, bots, and personas. Share your creations with the community.</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-20 py-8 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-400 space-y-2">
          <p>&copy; 2026 Botainy. Built with Next.js + Supabase. For 18+ users only.</p>
          <p>
            <Link href="/donate" className="text-yellow-400 hover:text-yellow-300 transition font-medium">
              ☕ Support Botainy
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
