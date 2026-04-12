"use client";
import dynamic from "next/dynamic";
const NotificationBell = dynamic(() => import("./NotificationBell"), { ssr: false });
const MiniMusicPlayer = dynamic(
  () => import("./MiniMusicPlayer").then((m) => ({ default: m.MiniMusicPlayer })),
  { ssr: false }
);

export default function GlobalClientUI() {
  return (
    <>
      <NotificationBell />
      <MiniMusicPlayer />
    </>
  );
}
