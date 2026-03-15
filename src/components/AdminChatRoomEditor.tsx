import React, { useState } from 'react';

interface ChatRoom {
  id: string;
  name: string;
  description: string;
  background_url: string;
  city_info: string;
  notable_bots: string;
  universe: string;
}

interface AdminChatRoomEditorProps {
  room: ChatRoom;
  token: string;
  onSave?: (room: ChatRoom) => void;
}

function AdminChatRoomEditor({ room, token, onSave }: AdminChatRoomEditorProps) {
  const [form, setForm] = useState<ChatRoom>({ ...room });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const resp = await fetch('/api/chat-rooms', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to update chat room');
      onSave?.(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 border rounded bg-white max-w-lg mx-auto">
      <h2 className="text-xl font-bold mb-4">Edit Chat Room</h2>
      <div className="space-y-2">
        <input name="name" value={form.name} onChange={handleChange} placeholder="Room Name" className="w-full border p-2 rounded" />
        <textarea name="description" value={form.description} onChange={handleChange} placeholder="Description" className="w-full border p-2 rounded" />
        <input name="background_url" value={form.background_url} onChange={handleChange} placeholder="Background URL" className="w-full border p-2 rounded" />
        <input name="city_info" value={form.city_info} onChange={handleChange} placeholder="City Info" className="w-full border p-2 rounded" />
        <input name="notable_bots" value={form.notable_bots} onChange={handleChange} placeholder="Notable Bots" className="w-full border p-2 rounded" />
        <input name="universe" value={form.universe} onChange={handleChange} placeholder="Universe" className="w-full border p-2 rounded" />
      </div>
      {error && <div className="text-red-500 mt-2">{error}</div>}
      <button onClick={handleSave} disabled={saving} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

export default AdminChatRoomEditor;
