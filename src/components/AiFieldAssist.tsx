"use client"

import { useRef, useState, useEffect } from "react"

interface AiFieldAssistProps {
  /** Label shown in the popover header */
  fieldLabel: string
  /** The field key sent to the API (e.g. 'description', 'personality') */
  fieldKey: string
  /** 'bot' or 'persona' */
  formType: "bot" | "persona"
  /** All current form values — used to give the AI context */
  formData: Record<string, string>
  /** Current value of the field — determines append vs. set behavior */
  currentValue: string
  /** Called when the user approves the suggestion */
  onApply: (suggestion: string) => void
  /** Async function that returns a Bearer token */
  getToken: () => Promise<string | null>
}

export default function AiFieldAssist({
  fieldLabel,
  fieldKey,
  formType,
  formData,
  currentValue,
  onApply,
  getToken,
}: AiFieldAssistProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  async function fetchSuggestion() {
    setLoading(true)
    setError(null)
    setSuggestion(null)

    try {
      const token = await getToken()
      if (!token) {
        setError("Not authenticated")
        return
      }

      const res = await fetch("/api/ai-assist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ formType, field: fieldKey, formData }),
      })

      const payload = (await res.json()) as { suggestion?: string; error?: string }

      if (!res.ok || !payload.suggestion) {
        setError(payload.error ?? "Failed to generate suggestion")
        return
      }

      setSuggestion(payload.suggestion)
    } catch {
      setError("Network error — please try again")
    } finally {
      setLoading(false)
    }
  }

  function handleToggle() {
    if (!open) {
      setOpen(true)
      setSuggestion(null)
      setError(null)
      fetchSuggestion()
    } else {
      setOpen(false)
    }
  }

  function handleApply() {
    if (!suggestion) return
    const trimmed = suggestion.trim()
    if (currentValue.trim()) {
      // Append, preserving existing content
      onApply(currentValue.trimEnd() + "\n\n" + trimmed)
    } else {
      onApply(trimmed)
    }
    setOpen(false)
    setSuggestion(null)
  }

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        title={`AI suggestions for ${fieldLabel}`}
        className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-900/60 text-purple-300 border border-purple-700/50 hover:bg-purple-800/80 hover:text-purple-100 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
      >
        <span>✦</span>
        <span>Suggest</span>
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute z-50 left-0 top-full mt-2 w-80 sm:w-96 bg-gray-900 border border-purple-700/60 rounded-2xl shadow-2xl shadow-purple-900/30 p-4 space-y-3"
          role="dialog"
          aria-label={`AI suggestion for ${fieldLabel}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-purple-400 text-sm">✦</span>
              <span className="text-xs font-bold text-purple-300 uppercase tracking-wide">
                AI Suggestion
              </span>
            </div>
            <span className="text-xs text-gray-500">{fieldLabel}</span>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
              <svg
                className="animate-spin h-4 w-4 text-purple-400 shrink-0"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Generating suggestion…
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="space-y-2">
              <p className="text-sm text-red-400">{error}</p>
              <button
                type="button"
                onClick={fetchSuggestion}
                className="text-xs text-purple-400 hover:text-purple-300 underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Suggestion preview */}
          {suggestion && !loading && (
            <>
              <div className="bg-gray-950 border border-gray-700 rounded-xl p-3 text-sm text-gray-200 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                {suggestion}
              </div>

              {currentValue.trim() && (
                <p className="text-xs text-amber-400/80">
                  This will be appended to your existing content.
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleApply}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => { setSuggestion(null); fetchSuggestion() }}
                  className="px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors"
                  title="Generate another suggestion"
                >
                  ↻
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </span>
  )
}
