/**
 * Botainy Anachronistic Soundtrack Dataset
 *
 * RULE 1 – THE METADIEGETIC RULE: This music is for the User's immersion only.
 * Bots CANNOT hear, react to, or acknowledge the soundtrack in any way.
 *
 * RULE 2 – NO CANCELED ARTISTS: The dataset must never include artists such as
 * Kanye West, Diddy, Chris Brown, or Kid Rock.
 *
 * RULE 3 – MANUAL TRIGGERING: The UI exposes this as a manual jukebox.
 * Music is never played automatically — the user opts in.
 */

export interface SoundtrackEntry {
  title: string;
  artist: string;
  vibe: string;
  tags: string[];
  play_when: string;
}

export const SOUNDTRACK_DATASET: SoundtrackEntry[] = [
  {
    title: 'Flood',
    artist: 'Jars of Clay',
    vibe: 'Moral Ambiguity',
    tags: ['rain', 'guilt', 'messy', 'overwhelmed'],
    play_when: 'Characters face difficult moral choices where no one stays clean.',
  },
  {
    title: 'Masterpiece',
    artist: 'Motionless in White',
    vibe: 'Cinematic Regret',
    tags: ['tragedy', 'broken', 'aftermath', 'sadness'],
    play_when: 'Reflecting on a self-inflicted disaster or a tragic loss.',
  },
  {
    title: 'Not Like Us',
    artist: 'Kendrick Lamar',
    vibe: 'Power Shift',
    tags: ['confrontation', 'calling out', 'triumph', 'rival'],
    play_when: 'A public power move or exposing a fraud.',
  },
  {
    title: 'Gladiator',
    artist: 'Zayde Wølf',
    vibe: 'Epic Combat',
    tags: ['arena', 'battle', 'revolution', 'underdog'],
    play_when: 'Entering a fight or starting an uprising.',
  },
  {
    title: "Arsonist's Lullabye",
    artist: 'Hozier',
    vibe: 'Internal Darkness',
    tags: ['secrets', 'fire', 'demons', 'brooding'],
    play_when: 'A character accepts their dark side or hides a secret.',
  },
  {
    title: 'Dog Days Are Over',
    artist: 'Florence + The Machine',
    vibe: 'Catharsis',
    tags: ['freedom', 'running', 'hope', 'escape'],
    play_when: 'A frantic escape or the sudden relief of freedom.',
  },
];

/** Artists whose work must never appear in suggestions. */
const BANNED_ARTISTS = ['kanye', 'ye', 'diddy', 'chris brown', 'kid rock'];

function isBanned(artist: string): boolean {
  const lower = artist.toLowerCase();
  return BANNED_ARTISTS.some((banned) => lower.includes(banned));
}

/**
 * Score a single track against a scene description.
 * Matches keywords from play_when and tags against the scene text.
 */
function scoreTrack(entry: SoundtrackEntry, scene: string): number {
  if (isBanned(entry.artist)) return -1;

  const sceneLower = scene.toLowerCase();
  let score = 0;

  // Tokenise the scene into words
  const sceneWords = new Set(sceneLower.match(/\b\w+\b/g) ?? []);

  // Score each tag keyword present in the scene
  for (const tag of entry.tags) {
    if (sceneLower.includes(tag.toLowerCase())) score += 2;
  }

  // Score words from play_when description
  const playWhenWords = (entry.play_when.toLowerCase().match(/\b\w{4,}\b/g) ?? []);
  for (const word of playWhenWords) {
    if (sceneWords.has(word)) score += 1;
  }

  // Vibe as a loose bonus
  const vibeWords = entry.vibe.toLowerCase().split(/\s+/);
  for (const word of vibeWords) {
    if (sceneWords.has(word)) score += 1;
  }

  return score;
}

/**
 * Select the best-matching tracks from the dataset for a given scene description.
 * Returns up to `limit` entries ordered by relevance score, falling back to the
 * full dataset (minus banned artists) when nothing matches.
 */
export function selectSong(scene_description: string, limit = 3): SoundtrackEntry[] {
  const safe = SOUNDTRACK_DATASET.filter((e) => !isBanned(e.artist));

  const scored = safe
    .map((entry) => ({ entry, score: scoreTrack(entry, scene_description) }))
    .sort((a, b) => b.score - a.score);

  // If top score is 0, all are equally relevant — return first `limit` entries
  return scored.slice(0, limit).map((s) => s.entry);
}
