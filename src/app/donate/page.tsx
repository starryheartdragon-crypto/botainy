import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Support Botainy – Keep the Adventures Going!',
  description:
    'Help keep Botainy free and ad-free. Your donation covers server costs, AI fees, and new feature development so everyone can enjoy immersive roleplay without interruption.',
}

export default function DonatePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-gray-100">
      <div className="max-w-2xl mx-auto px-6 py-14">

        {/* Back link */}
        <div className="mb-10 flex justify-end">
          <Link href="/" className="text-sm text-purple-300 hover:text-purple-200 transition-colors">
            ← Back to home
          </Link>
        </div>

        {/* Hero */}
        <div className="text-center mb-12">
          <span className="text-5xl mb-4 block">✨</span>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-purple-300 via-pink-300 to-purple-400 bg-clip-text text-transparent">
            Support Botainy
          </h1>
          <p className="text-xl text-gray-300 font-medium">
            Keep the Adventures Going!
          </p>
        </div>

        {/* Intro */}
        <div className="bg-gray-800/50 border border-gray-700/60 rounded-2xl p-6 mb-8 text-gray-300 leading-7">
          <p>
            Right now, keeping the lights on for this platform—funding the servers and the AI that
            powers our dynamic narrative generator and group chats—comes entirely out of my own
            pocket.
          </p>
          <p className="mt-4">
            My goal from the start has been to keep this service{' '}
            <span className="text-white font-semibold">100% free</span> and{' '}
            <span className="text-white font-semibold">completely ad-free</span> for everyone.
            Immersive role-playing shouldn&apos;t be interrupted by banner ads or hidden behind a
            paywall. But to maintain that vision as the community grows, I need your support.
          </p>
        </div>

        {/* Where donations go */}
        <div className="mb-10">
          <h2 className="text-xl font-semibold text-white mb-5">
            Where does your donation go?
          </h2>
          <p className="text-gray-400 text-sm mb-5">
            Every single contribution goes directly toward:
          </p>

          <div className="space-y-4">
            <div className="flex gap-4 bg-gray-800/40 border border-gray-700/40 rounded-xl p-5">
              <span className="text-2xl shrink-0">💡</span>
              <div>
                <h3 className="font-semibold text-white mb-1">Keeping the lights on</h3>
                <p className="text-gray-400 text-sm leading-6">
                  Covering the monthly server costs and API fees needed to keep the platform running
                  smoothly.
                </p>
              </div>
            </div>

            <div className="flex gap-4 bg-gray-800/40 border border-gray-700/40 rounded-xl p-5">
              <span className="text-2xl shrink-0">🚀</span>
              <div>
                <h3 className="font-semibold text-white mb-1">Improving the service</h3>
                <p className="text-gray-400 text-sm leading-6">
                  Funding the development of new features to make your stories and role-playing
                  experiences even better.
                </p>
              </div>
            </div>

            <div className="flex gap-4 bg-gray-800/40 border border-gray-700/40 rounded-xl p-5">
              <span className="text-2xl shrink-0">🚫</span>
              <div>
                <h3 className="font-semibold text-white mb-1">Staying ad-free</h3>
                <p className="text-gray-400 text-sm leading-6">
                  Ensuring you never have to deal with annoying ads breaking your immersion.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/30 border border-purple-700/50 rounded-2xl p-8 text-center">
          <p className="text-gray-300 leading-7 mb-6">
            If you&apos;ve enjoyed the platform and want to help it thrive, please consider chipping
            in. Even a small amount makes a massive difference in keeping this project alive and
            accessible to everyone.
          </p>

          <a
            href="https://buymeacoffee.com/starrydragon"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 text-gray-900 font-bold text-lg px-8 py-4 rounded-full transition-colors shadow-lg shadow-yellow-400/20"
          >
            <span className="text-2xl">☕</span>
            Support on Buy Me a Coffee
          </a>
        </div>

        {/* Thank you */}
        <p className="text-center text-gray-500 text-sm mt-10">
          Thank you so much for your support! 💜
        </p>
      </div>
    </div>
  )
}
