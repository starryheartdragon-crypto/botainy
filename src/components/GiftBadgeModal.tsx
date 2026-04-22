"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { BadgeInventoryItem, Badge } from "@/types";
import BadgeCard from "./BadgeCard";

interface GiftBadgeModalProps {
  recipientId: string;
  recipientUsername: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function GiftBadgeModal({
  recipientId,
  recipientUsername,
  onClose,
  onSuccess,
}: GiftBadgeModalProps) {
  const { session } = useAuthStore();
  const [inventory, setInventory] = useState<BadgeInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BadgeInventoryItem | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInventory() {
      setLoading(true);
      const res = await fetch("/api/badges/inventory", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInventory(data);
      }
      setLoading(false);
    }
    if (session) fetchInventory();
  }, [session]);

  async function handleGift() {
    if (!selected || !session) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/badges/gift", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          inventoryId: selected.id,
          recipientId,
          message: message.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send gift");
      } else {
        onSuccess?.();
        onClose();
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[80vh] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">Gift a Badge</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>

        <p className="text-gray-400 text-sm">
          Choose a badge from your inventory to gift to{" "}
          <span className="text-white font-semibold">@{recipientUsername}</span>.
        </p>

        {loading ? (
          <p className="text-gray-500 text-sm text-center py-8">Loading inventory…</p>
        ) : inventory.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            You don't have any badges to gift right now.
          </p>
        ) : (
          <div className="overflow-y-auto flex-1 grid gap-2 pr-1">
            {inventory.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelected(item)}
                className={`cursor-pointer rounded-xl transition-all ${
                  selected?.id === item.id ? "ring-2 ring-purple-500" : ""
                }`}
              >
                <BadgeCard
                  badge={item.badge as Badge}
                  showPoints
                />
              </div>
            ))}
          </div>
        )}

        {selected && (
          <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
            <textarea
              placeholder="Add a personal note (optional)…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={300}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-purple-500/50"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              onClick={handleGift}
              disabled={sending}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition"
            >
              {sending ? "Sending…" : `Gift "${selected.badge?.name}" to @${recipientUsername}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
