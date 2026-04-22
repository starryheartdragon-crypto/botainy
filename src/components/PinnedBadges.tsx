"use client";

import { PinnedBadge } from "@/types";
import BadgeCard from "./BadgeCard";

interface PinnedBadgesProps {
  pins: PinnedBadge[];
}

export default function PinnedBadges({ pins }: PinnedBadgesProps) {
  if (pins.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {pins
        .sort((a, b) => a.position - b.position)
        .map((pin) => {
          const received = pin.received;
          if (!received?.badge) return null;
          return (
            <BadgeCard
              key={pin.receivedId}
              badge={received.badge}
              compact
              message={received.message}
            />
          );
        })}
    </div>
  );
}
