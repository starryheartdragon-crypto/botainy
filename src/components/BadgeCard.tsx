"use client";

import { BadgeCategory, Badge } from "@/types";

const CATEGORY_COLORS: Record<BadgeCategory, { bg: string; border: string; text: string; dot: string }> = {
  elite_storytelling: {
    bg: "bg-yellow-900/30",
    border: "border-yellow-500/40",
    text: "text-yellow-300",
    dot: "bg-yellow-400",
  },
  community_pillars: {
    bg: "bg-blue-900/30",
    border: "border-blue-400/40",
    text: "text-blue-300",
    dot: "bg-blue-400",
  },
  silly_flavor: {
    bg: "bg-pink-900/30",
    border: "border-pink-400/40",
    text: "text-pink-300",
    dot: "bg-pink-400",
  },
  infamous_spicy: {
    bg: "bg-red-900/30",
    border: "border-red-500/40",
    text: "text-red-300",
    dot: "bg-red-400",
  },
  event: {
    bg: "bg-purple-900/30",
    border: "border-purple-400/40",
    text: "text-purple-300",
    dot: "bg-purple-400",
  },
};

const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  elite_storytelling: "Elite Storytelling",
  community_pillars: "Community Pillar",
  silly_flavor: "Silly / Flavor",
  infamous_spicy: "Infamous / Spicy",
  event: "Event",
};

interface BadgeCardProps {
  badge: Badge;
  /** Show the reputation point value */
  showPoints?: boolean;
  /** Show a "Gift" button */
  onGift?: () => void;
  /** Compact 1-slot display (used in pinned badge row) */
  compact?: boolean;
  /** Tooltip/message shown below (e.g. gifter note) */
  message?: string | null;
  /** Optional count overlay (used in niche leaderboard) */
  count?: number;
}

export default function BadgeCard({
  badge,
  showPoints = false,
  onGift,
  compact = false,
  message,
  count,
}: BadgeCardProps) {
  const colors = CATEGORY_COLORS[badge.category] ?? CATEGORY_COLORS.silly_flavor;

  if (compact) {
    return (
      <div
        title={`${badge.name} — ${badge.description}`}
        className={`
          relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
          backdrop-blur-sm border text-xs font-semibold
          ${colors.bg} ${colors.border} ${colors.text}
        `}
      >
        {badge.iconUrl ? (
          <img src={badge.iconUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
        ) : (
          <span className={`w-2 h-2 rounded-full inline-block ${colors.dot}`} />
        )}
        {badge.name}
        {count !== undefined && (
          <span className="ml-1 bg-white/10 rounded-full px-1.5 py-0.5 text-[10px]">×{count}</span>
        )}
        {badge.isEvent && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-purple-400 border border-gray-900" title="Event badge" />
        )}
      </div>
    );
  }

  return (
    <div
      className={`
        relative flex flex-col gap-2 p-4 rounded-xl border backdrop-blur-md
        ${colors.bg} ${colors.border}
        transition-all duration-200 hover:scale-[1.02]
      `}
    >
      {/* Event shimmer ring */}
      {badge.isEvent && (
        <div className="absolute inset-0 rounded-xl ring-1 ring-purple-400/50 animate-pulse pointer-events-none" />
      )}

      <div className="flex items-start gap-3">
        {badge.iconUrl ? (
          <img src={badge.iconUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
        ) : (
          <div className={`w-10 h-10 rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center shrink-0`}>
            <span className={`w-4 h-4 rounded-full ${colors.dot}`} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-bold text-sm ${colors.text}`}>{badge.name}</span>
            {badge.isEvent && (
              <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full px-2 py-0.5">
                Event
              </span>
            )}
          </div>
          <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">{badge.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className={`text-[10px] uppercase tracking-wider font-medium ${colors.text}/70`}>
          {CATEGORY_LABELS[badge.category]}
        </span>
        {showPoints && (
          <span className="text-[10px] text-gray-400">
            +{badge.reputationPoints} rep
          </span>
        )}
      </div>

      {message && (
        <p className="text-xs text-gray-400 italic border-t border-white/5 pt-2">"{message}"</p>
      )}

      {onGift && (
        <button
          onClick={onGift}
          className={`
            mt-1 w-full py-1.5 rounded-lg text-xs font-semibold transition-all
            bg-white/5 hover:bg-white/10 border border-white/10 text-white
          `}
        >
          Gift This Badge
        </button>
      )}
    </div>
  );
}
