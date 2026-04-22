"use client";

import { useState, useEffect } from "react";
import { LeaderboardEntry } from "@/types";
import Image from "next/image";

type BoardType = "all_time" | "monthly";

const BOARD_LABELS: Record<BoardType, string> = {
  all_time: "All-Time Legends",
  monthly: "Rising Stars (This Month)",
};

const RANK_STYLE: Record<number, string> = {
  1: "text-yellow-400",
  2: "text-gray-300",
  3: "text-amber-600",
};

export default function Leaderboard() {
  const [boardType, setBoardType] = useState<BoardType>("all_time");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBoard() {
      setLoading(true);
      const res = await fetch(`/api/leaderboard?type=${boardType}&limit=25`);
      if (res.ok) {
        setEntries(await res.json());
      } else {
        setEntries([]);
      }
      setLoading(false);
    }
    fetchBoard();
  }, [boardType]);

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden">
      {/* Header + tabs */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
        <h2 className="text-white font-bold text-base">Leaderboard</h2>
        <div className="flex gap-1">
          {(["all_time", "monthly"] as BoardType[]).map((type) => (
            <button
              key={type}
              onClick={() => setBoardType(type)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                boardType === type
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {type === "all_time" ? "All-Time" : "This Month"}
            </button>
          ))}
        </div>
      </div>

      {/* Subtitle */}
      <p className="text-xs text-gray-500 px-5 pt-3 pb-1">{BOARD_LABELS[boardType]}</p>

      {/* Entries */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-gray-500 text-sm animate-pulse">Loading…</span>
        </div>
      ) : entries.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-12">No rankings yet. Be the first!</p>
      ) : (
        <ul className="divide-y divide-white/5 pb-2">
          {entries.map((entry) => {
            const user = entry.user;
            const rankColor = RANK_STYLE[entry.rank] ?? "text-gray-500";
            return (
              <li
                key={entry.userId}
                className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition"
              >
                {/* Rank */}
                <span className={`w-8 text-center font-bold text-sm shrink-0 ${rankColor}`}>
                  {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
                </span>

                {/* Avatar */}
                {user?.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.username ?? ""}
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/10 shrink-0 flex items-center justify-center text-xs text-gray-400">
                    {user?.username?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}

                {/* Username */}
                <span className="flex-1 text-sm text-white font-medium truncate">
                  @{user?.username ?? entry.userId}
                </span>

                {/* Score */}
                <span className="text-xs text-purple-300 font-semibold shrink-0">
                  {entry.score.toLocaleString()} rep
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer */}
      <p className="text-[10px] text-gray-600 text-center pb-3">
        Updated daily · Earn rep by creating bots, chatting, and receiving badges
      </p>
    </div>
  );
}
