import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <Link href="/" className="text-sm text-purple-300 hover:text-purple-200">
            Back to home
          </Link>
        </div>

        <div className="space-y-6 text-sm leading-6 text-gray-300">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Overview</h2>
            <p>
              Botainy is an 18+ roleplay platform. This page explains what information we collect,
              why we collect it, and how we use it for account, safety, and service operation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Data We Collect</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Account data (email, username, birthday, profile fields)</li>
              <li>User-generated content (bots, personas, chat messages, room posts)</li>
              <li>Operational data (API request metadata, moderation signals, error logs)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">How We Use Data</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Authenticate users and secure accounts</li>
              <li>Deliver chat, bot, and roleplay features</li>
              <li>Moderate abuse, enforce policies, and investigate reports</li>
              <li>Improve reliability and performance</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Third-Party Services</h2>
            <p>
              We use Supabase for auth/data infrastructure and OpenRouter/model providers for AI
              responses. Content you submit may be processed by these providers to deliver outputs.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Retention & Deletion</h2>
            <p>
              We retain account and content data while your account is active, and longer where
              needed for abuse prevention, legal obligations, or dispute handling.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Age Restriction</h2>
            <p>
              Botainy is strictly for users 18+ only. If we learn an underage user has registered,
              the account may be removed.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Contact</h2>
            <p>
              For privacy requests or questions, contact the project administrator through your
              support channel.
            </p>
          </section>

          <p className="text-xs text-gray-500 pt-4">Last updated: March 3, 2026</p>
        </div>
      </div>
    </div>
  )
}
