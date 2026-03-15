
"use client";
import AdminChatRoomEditor from "@/components/AdminChatRoomEditor";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

const TABS = ["Reports", "Bots", "Users", "Chat Rooms", "Requests"];

type ReportRow = {
  id: string;
  reporter_id: string | null;
  reported_user_id: string | null;
  reported_bot_id: string | null;
  reason: string;
  status: "open" | "resolved" | "rejected";
};

type BotRow = {
  id: string;
  name: string;
  creator_id: string;
  description: string | null;
  is_published: boolean;
};

type UserRow = {
  id: string;
  username: string | null;
  email: string | null;
  is_banned: boolean | null;
  is_silenced: boolean | null;
  is_admin: boolean | null;
};

type RoomRow = {
  id: string;
  name: string;
  description: string | null;
  background_url: string | null;
  city_info: string | null;
  notable_bots: string | null;
  universe: string | null;
  created_at: string;
};

type ModerationRequestRow = {
  id: string;
  requested_name: string;
  request_details: string;
  requester_id: string;
  created_at: string;
  status: "pending" | "reviewed" | "approved" | "rejected";
};

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function fetchAdminResource(resource: "reports" | "bots" | "users") {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error("Missing access token");
  }

  const resp = await fetch(`/api/admin/moderation/data?resource=${resource}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await resp.json();
  if (!resp.ok) {
    throw new Error(payload?.error || `Failed to load ${resource}`);
  }

  return payload;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAdmin() {
      try {
        setChecking(true);
        setAccessError(null);

        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;

        if (!user) {
          setIsAdmin(false);
          return;
        }

        const accessToken = session?.access_token;
        if (!accessToken) {
          setAccessError("Missing access token");
          setIsAdmin(false);
          return;
        }

        const resp = await fetch("/api/admin/status", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const payload = await resp.json();
        if (!resp.ok) {
          setAccessError(payload?.error || "Failed to verify admin status");
          setIsAdmin(false);
          return;
        }

        setIsAdmin(!!payload?.isAdmin);
      } catch (err: unknown) {
        setAccessError(err instanceof Error ? err.message : "Failed to verify admin access");
        setIsAdmin(false);
      } finally {
        setChecking(false);
      }
    }

    checkAdmin();
  }, []);

  if (checking) {
    return <div className="p-8 text-center text-gray-400">Checking admin access...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-gray-400">
        Admin access required. You are still signed in.
        {accessError ? <div className="mt-2 text-xs text-red-400">{accessError}</div> : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-gray-100 pt-20">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Admin Panel</h1>
        <div className="flex gap-4 mb-8">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2 rounded-full font-semibold transition ${
                activeTab === i
                  ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 min-h-[300px]">
          {activeTab === 0 && <ReportsTab />}
          {activeTab === 1 && <BotsTab />}
          {activeTab === 2 && <UsersTab />}
          {activeTab === 3 && <ChatRoomsTab />}
          {activeTab === 4 && <RequestsTab />}
        </div>
      </div>
    </div>
  );
}

function ReportsTab() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  async function refreshReports() {
    try {
      const payload = await fetchAdminResource("reports");
      setReports(payload?.reports || []);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to load reports");
      setReports([]);
    }
  }

  useEffect(() => {
    refreshReports();
  }, []);

  async function handleAction(id: string, status: "resolved" | "rejected") {
    setLoading(id + status);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        alert("Missing access token");
        return;
      }

      const resp = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status }),
      });

      const payload = await resp.json();
      if (!resp.ok) {
        alert(payload?.error || "Failed to update report");
        return;
      }

      await refreshReports();
    } finally {
      setLoading(null);
    }
  }
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Reports</h2>
      {reports.length === 0 ? <div className="text-gray-400">No reports.</div> : (
        <ul className="space-y-4">
          {reports.map(r => (
            <li key={r.id} className="bg-gray-900 rounded p-4 border border-gray-700">
              <div className="mb-1 text-sm text-gray-400">Reported by: {r.reporter_id} | User: {r.reported_user_id} | Bot: {r.reported_bot_id}</div>
              <div className="mb-2">Reason: <span className="text-red-300">{r.reason}</span></div>
              <div>Status: <span className="font-semibold">{r.status}</span></div>
              {r.status === "open" && (
                <div className="flex gap-2 mt-2">
                  <button className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-4 py-1.5 rounded-full disabled:opacity-60 transition font-medium shadow-md" disabled={loading === r.id + "resolved"} onClick={() => handleAction(r.id, "resolved")}>Resolve</button>
                  <button className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-4 py-1.5 rounded-full disabled:opacity-60 transition font-medium shadow-md" disabled={loading === r.id + "rejected"} onClick={() => handleAction(r.id, "rejected")}>Reject</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BotsTab() {
  const [bots, setBots] = useState<BotRow[]>([]);
  const [modReason, setModReason] = useState<{[id:string]:string}>({});
  const [modLoading, setModLoading] = useState<string | null>(null);

  async function refreshBots() {
    try {
      const payload = await fetchAdminResource("bots");
      setBots(payload?.bots || []);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to load bots");
      setBots([]);
    }
  }

  useEffect(() => {
    refreshBots();
  }, []);

  async function handleModAction(bot: BotRow, action: "private"|"delete") {
    if (!modReason[bot.id] || !modReason[bot.id].trim()) {
      alert("Please provide an explanation for this action.");
      return;
    }
    setModLoading(bot.id + action);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        alert("Missing access token");
        return;
      }

      const resp = await fetch("/api/admin/moderation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          targetType: "bot",
          targetId: bot.id,
          action: action === "private" ? "silence" : "delete",
          explanation: modReason[bot.id],
        }),
      });

      const payload = await resp.json();
      if (!resp.ok) {
        alert(payload?.error || "Failed moderation action");
        return;
      }

      setModReason(r => ({ ...r, [bot.id]: "" }));
      await refreshBots();
    } finally {
      setModLoading(null);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Bots</h2>
      {bots.length === 0 ? <div className="text-gray-400">No bots.</div> : (
        <ul className="space-y-4">
          {bots.map(b => (
            <li key={b.id} className="bg-gray-900 rounded p-4 border border-gray-700">
              <div className="font-semibold text-white">{b.name}</div>
              <div className="text-gray-400 text-sm mb-1">By: {b.creator_id}</div>
              <div className="mb-2">{b.description}</div>
              <div>Status: <span className="font-semibold">{b.is_published ? "Published" : "Unpublished"}</span></div>
              <div className="mt-2 flex flex-col gap-2">
                <textarea
                  className="w-full p-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200"
                  placeholder="Explanation to user (required)"
                  value={modReason[b.id] || ""}
                  onChange={e => setModReason(r => ({ ...r, [b.id]: e.target.value }))}
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded disabled:opacity-60"
                    disabled={modLoading === b.id + "private"}
                    onClick={() => handleModAction(b, "private")}
                  >Private</button>
                  <button
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded disabled:opacity-60"
                    disabled={modLoading === b.id + "delete"}
                    onClick={() => handleModAction(b, "delete")}
                  >Delete</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  async function refreshUsers() {
    try {
      const payload = await fetchAdminResource("users");
      setUsers(payload?.users || []);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to load users");
      setUsers([]);
    }
  }

  useEffect(() => {
    refreshUsers();
  }, []);
  async function handleUserAction(id: string, action: "ban"|"unban"|"silence"|"unsilence") {
    setLoading(id + action);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        alert("Missing access token");
        return;
      }

      const resp = await fetch("/api/admin/moderation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          targetType: "user",
          targetId: id,
          action,
        }),
      });

      const payload = await resp.json();
      if (!resp.ok) {
        alert(payload?.error || "Failed moderation action");
        return;
      }

      await refreshUsers();
    } finally {
      setLoading(null);
    }
  }
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Users</h2>
      {users.length === 0 ? <div className="text-gray-400">No users.</div> : (
        <ul className="space-y-4">
          {users.map(u => (
            <li key={u.id} className="bg-gray-900 rounded p-4 border border-gray-700">
              <div className="font-semibold text-white">{u.username} ({u.email})</div>
              <div className="mb-2 text-sm">ID: {u.id}</div>
              <div>Status: {u.is_banned ? <span className="text-red-400">Banned</span> : u.is_silenced ? <span className="text-yellow-400">Silenced</span> : <span className="text-green-400">Active</span>}</div>
              <div>Admin: {u.is_admin ? "Yes" : "No"}</div>
              <div className="flex gap-2 mt-2">
                {u.is_banned ? (
                  <button className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-4 py-1.5 rounded-full disabled:opacity-60 transition font-medium shadow-md" disabled={loading === u.id + "unban"} onClick={() => handleUserAction(u.id, "unban")}>Unban</button>
                ) : (
                  <button className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-4 py-1.5 rounded-full disabled:opacity-60 transition font-medium shadow-md" disabled={loading === u.id + "ban"} onClick={() => handleUserAction(u.id, "ban")}>Ban</button>
                )}
                {u.is_silenced ? (
                  <button className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-4 py-1.5 rounded-full disabled:opacity-60 transition font-medium shadow-md" disabled={loading === u.id + "unsilence"} onClick={() => handleUserAction(u.id, "unsilence")}>Unsilence</button>
                ) : (
                  <button className="bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white px-4 py-1.5 rounded-full disabled:opacity-60 transition font-medium shadow-md" disabled={loading === u.id + "silence"} onClick={() => handleUserAction(u.id, "silence")}>Silence</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChatRoomsTab() {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [bgUrl, setBgUrl] = useState("");
  const [cityInfo, setCityInfo] = useState("");
  const [notableBots, setNotableBots] = useState("");
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("chat_rooms").select("*").order("created_at", { ascending: false }).then(({ data }) => setRooms(data || []));
  }, []);
  async function handleUploadBg(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBgFile(files[0]);
  }
  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name) return;
    setLoading(true);
    let finalBgUrl = bgUrl;
    try {
      if (bgFile) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          alert('You must be signed in as admin to upload an image.');
          return;
        }

        const fd = new FormData();
        fd.append('file', bgFile);
        fd.append('bucket', 'chatroom-backgrounds');

        const uploadResp = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: fd,
        });

        const uploadPayload = await uploadResp.json();
        if (!uploadResp.ok || !uploadPayload?.url) {
          alert(uploadPayload?.error || 'Image upload failed');
          return;
        }

        finalBgUrl = uploadPayload.url;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('Missing session token');
        return;
      }

      const createResp = await fetch('/api/chat-rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name,
          description: desc,
          background_url: finalBgUrl,
          city_info: cityInfo,
          notable_bots: notableBots,
        }),
      });

      const createPayload = await createResp.json();
      if (!createResp.ok) {
        alert(createPayload?.error || 'Failed to create chat room');
        return;
      }

      setName(""); setDesc(""); setBgUrl(""); setCityInfo(""); setNotableBots(""); setBgFile(null);
      const { data } = await supabase.from("chat_rooms").select("*").order("created_at", { ascending: false });
      setRooms(data || []);
    } finally {
      setLoading(false);
    }
  }

  // ...existing code...
  const [editingRoom, setEditingRoom] = useState<RoomRow | null>(null);
  const [editToken, setEditToken] = useState<string | null>(null);

  useEffect(() => {
    async function fetchToken() {
      const token = await getAccessToken();
      setEditToken(token);
    }
    fetchToken();
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Chat Rooms</h2>
      <form onSubmit={handleCreate} className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Room name" className="px-3 py-2 rounded bg-gray-900 border border-gray-700 text-white" />
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Short description" className="px-3 py-2 rounded bg-gray-900 border border-gray-700 text-white" />
        <input value={bgUrl} onChange={e => setBgUrl(e.target.value)} placeholder="Background image URL (optional)" className="px-3 py-2 rounded bg-gray-900 border border-gray-700 text-white" />
        <input type="file" accept="image/*" onChange={handleUploadBg} className="px-3 py-2 rounded bg-gray-900 border border-gray-700 text-white" />
        <textarea value={cityInfo} onChange={e => setCityInfo(e.target.value)} placeholder="City info / lore" className="px-3 py-2 rounded bg-gray-900 border border-gray-700 text-white" rows={2} />
        <input value={notableBots} onChange={e => setNotableBots(e.target.value)} placeholder="Notable bots (comma-separated)" className="px-3 py-2 rounded bg-gray-900 border border-gray-700 text-white" />
        <button type="submit" disabled={loading} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded col-span-1 md:col-span-2">{loading ? "Creating..." : "Create"}</button>
      </form>
      {editingRoom && editToken && (
        <div className="mb-8">
          <AdminChatRoomEditor
            room={{
              ...editingRoom,
              universe: (editingRoom as RoomRow).universe || '',
              description: editingRoom.description || '',
              background_url: editingRoom.background_url || '',
              city_info: editingRoom.city_info || '',
              notable_bots: editingRoom.notable_bots || '',
            }}
            token={editToken}
            onSave={() => {
              setEditingRoom(null);
              supabase.from("chat_rooms").select("*").order("created_at", { ascending: false }).then(({ data }) => setRooms(data || []));
            }}
          />
        </div>
      )}
      {rooms.length === 0 ? <div className="text-gray-400">No chat rooms.</div> : (
        <ul className="space-y-4">
          {rooms.map(r => (
            <li key={r.id} className="bg-gray-900 rounded p-4 border border-gray-700 relative group overflow-hidden">
              {r.background_url && (
                <Image src={r.background_url} alt="bg" fill className="object-cover opacity-20 group-hover:opacity-40 transition-all duration-500" />
              )}
              <div className="relative z-10">
                <div className="font-semibold text-white text-xl mb-1">{r.name}</div>
                <div className="mb-2 text-gray-400 text-sm">{r.description}</div>
                <div className="flex gap-2 mt-2">
                  <div className="text-xs text-gray-500">Created: {new Date(r.created_at).toLocaleString()}</div>
                  {r.city_info && (
                    <div className="ml-2 text-xs text-purple-300 bg-purple-900/30 px-2 py-1 rounded hover:bg-purple-900/60 transition-all cursor-pointer" title={r.city_info}>City Info</div>
                  )}
                  {r.notable_bots && (
                    <div className="ml-2 text-xs text-blue-300 bg-blue-900/30 px-2 py-1 rounded hover:bg-blue-900/60 transition-all cursor-pointer" title={r.notable_bots}>Notable Bots</div>
                  )}
                  <button className="ml-2 px-2 py-1 bg-blue-700 text-white rounded text-xs hover:bg-blue-800" onClick={() => setEditingRoom(r)}>Edit</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestsTab() {
  const [roomRequests, setRoomRequests] = useState<ModerationRequestRow[]>([]);
  const [universeRequests, setUniverseRequests] = useState<ModerationRequestRow[]>([]);
  const [requestLoading, setRequestLoading] = useState<string | null>(null);

  async function refreshUniverseRequests() {
    const { data } = await supabase
      .from("bot_universe_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setUniverseRequests(data || []);
  }

  async function refreshRoomRequests() {
    const { data } = await supabase
      .from("chat_room_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setRoomRequests(data || []);
  }

  useEffect(() => {
    refreshUniverseRequests();
    refreshRoomRequests();
  }, []);

  async function handleRequestStatus(
    source: "bot_universe_requests" | "chat_room_requests",
    requestId: string,
    status: "reviewed" | "approved" | "rejected",
  ) {
    const loadingKey = `${source}:${requestId}:${status}`;
    setRequestLoading(loadingKey);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from(source)
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq("id", requestId);

      if (source === "bot_universe_requests") {
        await refreshUniverseRequests();
      } else {
        await refreshRoomRequests();
      }
    } finally {
      setRequestLoading(null);
    }
  }

  function renderRequestList(source: "bot_universe_requests" | "chat_room_requests", requests: ModerationRequestRow[]) {
    if (requests.length === 0) {
      return <div className="text-gray-400">No requests yet.</div>;
    }

    return (
      <ul className="space-y-3 mb-6">
        {requests.map((req) => (
          <li key={req.id} className="bg-gray-900 rounded p-4 border border-gray-700">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="font-semibold text-white">{req.requested_name}</div>
              <span className={`text-xs px-2 py-1 rounded-full border ${
                req.status === "approved"
                  ? "bg-green-900/40 border-green-700 text-green-200"
                  : req.status === "rejected"
                    ? "bg-red-900/40 border-red-700 text-red-200"
                    : req.status === "reviewed"
                      ? "bg-blue-900/40 border-blue-700 text-blue-200"
                      : "bg-yellow-900/30 border-yellow-700 text-yellow-200"
              }`}>
                {req.status}
              </span>
            </div>
            <div className="text-sm text-gray-300 mb-2 whitespace-pre-wrap">{req.request_details}</div>
            <div className="text-xs text-gray-500 mb-3">
              Requested by {req.requester_id} • {new Date(req.created_at).toLocaleString()}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded disabled:opacity-60"
                disabled={requestLoading === `${source}:${req.id}:reviewed`}
                onClick={() => handleRequestStatus(source, req.id, "reviewed")}
              >
                Mark Reviewed
              </button>
              <button
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded disabled:opacity-60"
                disabled={requestLoading === `${source}:${req.id}:approved`}
                onClick={() => handleRequestStatus(source, req.id, "approved")}
              >
                Approve
              </button>
              <button
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded disabled:opacity-60"
                disabled={requestLoading === `${source}:${req.id}:rejected`}
                onClick={() => handleRequestStatus(source, req.id, "rejected")}
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Requests</h2>

      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-3">Universe Requests</h3>
        {renderRequestList("bot_universe_requests", universeRequests)}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Chat Room Requests</h3>
        {renderRequestList("chat_room_requests", roomRequests)}
      </div>
    </div>
  );
}
