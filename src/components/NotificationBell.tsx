"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserAndNotifications() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUserId(null);
        setNotifications([]);
        setLoading(false);
        return;
      }
      setUserId(user.id);
      const { data } = await supabase
        .from("notifications")
        .select("id,message,is_read,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setNotifications(data || []);
      setLoading(false);
    }
    fetchUserAndNotifications();
  }, []);

  async function markAsRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications(n => n.map(notif => notif.id === id ? { ...notif, is_read: true } : notif));
  }

  if (!userId) return null;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="fixed top-6 right-6 z-[9999]">
      <button
        className="relative w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center hover:bg-gray-700 transition"
        onClick={() => setOpen(v => !v)}
        aria-label="Notifications"
      >
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-white">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{unreadCount}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-lg p-4 animate-fade-in">
          <h3 className="text-lg font-bold mb-2 text-white">Notifications</h3>
          {loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="text-gray-400">No notifications.</div>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {notifications.map(n => (
                <li key={n.id} className={`p-2 rounded ${n.is_read ? "bg-gray-800 text-gray-400" : "bg-purple-900/40 text-white"}`}>
                  <div className="flex justify-between items-center gap-2">
                    <span>{n.message}</span>
                    {!n.is_read && (
                      <button className="text-xs text-purple-400 hover:underline ml-2" onClick={() => markAsRead(n.id)}>Mark as read</button>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
