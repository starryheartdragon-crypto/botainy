import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Terms of Service</h1>
          <Link href="/" className="text-sm text-purple-300 hover:text-purple-200">
            Back to home
          </Link>
        </div>

        <div className="space-y-6 text-sm leading-6 text-gray-300">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Acceptance</h2>
            <p>
              By using Botainy, you agree to these terms and any community/policy updates posted in
              the app.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">18+ Requirement</h2>
            <p>
              This service is only for adults. You must be 18 or older (or legal age in your
              jurisdiction, whichever is higher) to use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">User Content</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You are responsible for content you create, upload, or publish.</li>
              <li>You must not upload illegal, non-consensual, or rights-infringing material.</li>
              <li>We may remove content or restrict accounts for policy violations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Account Security</h2>
            <p>
              Keep your credentials secure. You are responsible for activity under your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Service Availability</h2>
            <p>
              Features may change, pause, or be discontinued. We do not guarantee uninterrupted
              availability or model output quality.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Enforcement</h2>
            <p>
              We may suspend or terminate accounts for abuse, circumvention of safeguards, or severe
              policy violations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Liability</h2>
            <p>
              To the extent permitted by law, the service is provided &quot;as is&quot; without warranties.
              We are not liable for indirect or consequential damages from use of the platform.
            </p>
          </section>

          <p className="text-xs text-gray-500 pt-4">Last updated: March 3, 2026</p>
        </div>
      </div>
    </div>
  )
}
