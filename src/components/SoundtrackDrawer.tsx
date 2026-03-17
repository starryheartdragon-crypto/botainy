import React, { useState } from 'react';

interface Track {
  title: string;
  youtubeId: string;
  reasoning: string;
  addedBy: 'AI' | 'User';
  timestamp?: number;
}

interface SoundtrackDrawerProps {
  aiTracks: Track[];
  onAddUserTrack: (track: Track) => void;
  userTracks: Track[];
  onSelectTrack: (track: Track) => void;
  selectedTrack: Track | null;
  open: boolean;
  onClose: () => void;
}

export const SoundtrackDrawer: React.FC<SoundtrackDrawerProps> = ({
  aiTracks,
  onAddUserTrack,
  userTracks,
  onSelectTrack,
  selectedTrack,
  open,
  onClose,
}) => {
  const [title, setTitle] = useState('');
  const [youtubeLink, setYoutubeLink] = useState('');
  const [reasoning, setReasoning] = useState('');

  // Extract YouTube video ID from link
  const extractYoutubeId = (url: string) => {
    const match = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]+)/);
    return match ? match[1] : '';
  };

  const handleAddTrack = () => {
    const youtubeId = extractYoutubeId(youtubeLink);
    if (!title || !youtubeId || !reasoning) return;
    onAddUserTrack({
      title,
      youtubeId,
      reasoning,
      addedBy: 'User',
      timestamp: Date.now(),
    });
    setTitle('');
    setYoutubeLink('');
    setReasoning('');
  };

  const allTracks = [...aiTracks, ...userTracks];

  return (
    <div className={`fixed inset-0 z-50 bg-black bg-opacity-40 transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}> 
      <div className="absolute right-0 top-0 h-full w-[400px] bg-gray-900 border border-gray-700 shadow-lg flex flex-col p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Suggested Soundtrack</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">✕</button>
        </div>
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Add Your Own Track</h3>
          <input
            type="text"
            placeholder="Song Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full mb-2 border border-gray-700 bg-gray-800 text-gray-200 rounded px-2 py-1"
          />
          <input
            type="text"
            placeholder="YouTube Link"
            value={youtubeLink}
            onChange={e => setYoutubeLink(e.target.value)}
            className="w-full mb-2 border border-gray-700 bg-gray-800 text-gray-200 rounded px-2 py-1"
          />
          <textarea
            placeholder="Why does this fit?"
            value={reasoning}
            onChange={e => setReasoning(e.target.value)}
            className="w-full mb-2 border border-gray-700 bg-gray-800 text-gray-200 rounded px-2 py-1"
          />
          <button
            onClick={handleAddTrack}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Add Track
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <h3 className="font-semibold mb-2 text-gray-200">All Tracks</h3>
          <ul>
            {allTracks.map((track, idx) => (
              <li key={track.youtubeId + idx} className="mb-4 border-b pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-100">{track.title}</span>
                    <span className="ml-2 text-xs text-gray-400">{track.addedBy === 'AI' ? 'AI Suggestion' : 'User Added'}</span>
                  </div>
                  <button
                    onClick={() => onSelectTrack(track)}
                    className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                  >
                    Play
                  </button>
                </div>
                <div className="text-sm mt-1 text-gray-300">{track.reasoning}</div>
              </li>
            ))}
          </ul>
        </div>
        {selectedTrack && (
          <div className="mt-4">
            <h3 className="font-semibold mb-2 text-gray-200">Now Playing</h3>
            <div className="aspect-video w-full">
              <iframe
                width="100%"
                height="200"
                src={`https://www.youtube.com/embed/${selectedTrack.youtubeId}?autoplay=1`}
                title={selectedTrack.title}
                frameBorder="0"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            </div>
            <div className="mt-2 text-sm text-gray-300">{selectedTrack.reasoning}</div>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-6">
          <button className="bg-gray-700 text-gray-200 px-4 py-2 rounded hover:bg-gray-600" onClick={onClose}>Cancel</button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700" onClick={handleAddTrack}>Save</button>
        </div>
      </div>
    </div>
  );
};
