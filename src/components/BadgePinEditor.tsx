"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import { ReceivedBadge, PinnedBadge } from "@/types";
import BadgeCard from "./BadgeCard";

interface BadgePinEditorProps {
  onSave?: () => void;
}

export default function BadgePinEditor({ onSave }: BadgePinEditorProps) {
  const { user } = useAuthStore();
  const [received, setReceived] = useState<ReceivedBadge[]>([]);
  const [pins, setPins] = useState<PinnedBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const [recRes, pinRes] = await Promise.all([
      fetch("/api/badges/received", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      }),
      fetch(`/api/badges/pinned?userId=${user.id}`),
    ]);
    if (recRes.ok) setReceived(await recRes.json());
    if (pinRes.ok) setPins(await pinRes.json());
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Local draft of selected pins: array of received IDs indexed by position (0-based → position 1-3)
  const [draft, setDraft] = useState<(string | null)[]>([null, null, null]);

  useEffect(() => {
    // Sync pins to draft on load
    const d: (string | null)[] = [null, null, null];
    pins.forEach((p) => { d[p.position - 1] = p.receivedId; });
    setDraft(d);
  }, [pins]);

  function togglePin(receivedId: string) {
    const idx = draft.indexOf(receivedId);
    if (idx !== -1) {
      // Remove from slot
      setDraft((d) => d.map((v) => (v === receivedId ? null : v)));
    } else {
      // Add to first empty slot
      setDraft((d) => {
        const copy = [...d];
        const emptyIdx = copy.indexOf(null);
        if (emptyIdx === -1) return d; // all slots full
        copy[emptyIdx] = receivedId;
        return copy;
      });
    }
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const pinsPayload = draft
      .map((id, i) => (id ? { receivedId: id, position: (i + 1) as 1 | 2 | 3 } : null))
      .filter(Boolean);

    const res = await fetch("/api/badges/pinned", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ pins: pinsPayload }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to save");
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      onSave?.();
    }
    setSaving(false);
  }

  if (loading) return <p className="text-gray-500 text-sm py-4">Loading badges…</p>;

  const pinnedCount = draft.filter(Boolean).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">
          Select up to 3 badges to pin to your profile card.{" "}
          <span className="text-white font-medium">{pinnedCount}/3 selected</span>
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition"
        >
          {saving ? "Saving…" : success ? "Saved ✓" : "Save Pins"}
        </button>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {received.length === 0 ? (
        <p className="text-gray-500 text-sm">You haven't received any badges yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
          {received.map((rec) => {
            if (!rec.badge) return null;
            const isPinned = draft.includes(rec.id);
            return (
              <div
                key={rec.id}
                onClick={() => togglePin(rec.id)}
                className={`cursor-pointer rounded-xl transition-all ${
                  isPinned ? "ring-2 ring-purple-500 opacity-100" : "opacity-70 hover:opacity-100"
                }`}
              >
                <BadgeCard badge={rec.badge} message={rec.message} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
