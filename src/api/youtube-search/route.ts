import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const { query } = await req.json();

  // Call YouTube Data API v3
  const youtubeResp = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&key=${process.env.YOUTUBE_API_KEY}&maxResults=1`, {
    method: 'GET',
  });

  if (!youtubeResp.ok) {
    return NextResponse.json({ error: 'Failed to search YouTube.' }, { status: 500 });
  }

  const data = await youtubeResp.json();
  const videoId = data.items?.[0]?.id?.videoId || null;

  return NextResponse.json({ videoId });
}
