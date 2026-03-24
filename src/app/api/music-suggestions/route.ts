import { NextRequest, NextResponse } from 'next/server';
import { selectSong } from '@/api/music-suggestions/route';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const scene_description: string = typeof body?.scene_description === 'string'
    ? body.scene_description.slice(0, 2000)
    : '';

  if (!scene_description.trim()) {
    return NextResponse.json({ error: 'scene_description is required.' }, { status: 400 });
  }

  const tracks = selectSong(scene_description, 3).map((entry) => ({
    title: entry.title,
    artist: entry.artist,
    vibe: entry.vibe,
    reasoning: entry.play_when,
    youtubeId: '',
    addedBy: 'AI' as const,
  }));

  return NextResponse.json({ tracks });
}
