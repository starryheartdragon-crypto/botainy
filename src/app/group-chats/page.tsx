"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BOT_UNIVERSES } from "../../lib/botUniverses";
import { supabase } from "../../lib/supabase";
import { PersonaSelector } from "../../components/PersonaSelector";

type GroupFocus = "general" | "roleplay" | "ttrpg";
type GmMode = "user" | "bot" | "co-gm";
type InitiativeMode = "manual" | "automatic";

interface SelectableBot {
  id: string;
  name: string;
  universe?: string | null;
}

interface ConnectedUser {
  id: string;
  username: string | null;
}

export default function GroupChatsPage() {
  const router = useRouter();

  const [newGroupName, setNewGroupName] = useState("");
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [newUniverse, setNewUniverse] = useState("");
  const [newFocus, setNewFocus] = useState<GroupFocus>("general");
  const [newBots, setNewBots] = useState<string[]>([]);
  const [newUsers, setNewUsers] = useState<string[]>([]);
  const [newBestiary, setNewBestiary] = useState<string[]>([]);

  const [newScenario, setNewScenario] = useState("");
  const [newSetting, setNewSetting] = useState("");
  const [newNarrativeTone, setNewNarrativeTone] = useState("");
  const [newWorldState, setNewWorldState] = useState("");
  const [newCharacterDirectives, setNewCharacterDirectives] = useState("");
  const [newCharacterRelationships, setNewCharacterRelationships] = useState("");

  const [newGameSystem, setNewGameSystem] = useState("");
  const [newRulebookReferences, setNewRulebookReferences] = useState("");
  const [newCorebookName, setNewCorebookName] = useState("");
  const [newCorebookUrl, setNewCorebookUrl] = useState("");
  const [newGmMode, setNewGmMode] = useState<GmMode>("user");
  const [newBotGmId, setNewBotGmId] = useState("");
  const [newGM, setNewGM] = useState("");
  const [newSafetyRules, setNewSafetyRules] = useState("");
  const [newCampaignHook, setNewCampaignHook] = useState("");
  const [newMapDescription, setNewMapDescription] = useState("");
  const [newDifficultyLethality, setNewDifficultyLethality] = useState(50);
  const [newSpecialRules, setNewSpecialRules] = useState("");
  const [newDiceEngineEnabled, setNewDiceEngineEnabled] = useState(true);
  const [newPartyVitals, setNewPartyVitals] = useState("");
  const [newInitiativeMode, setNewInitiativeMode] = useState<InitiativeMode>("manual");
  const [initiativeToggle, setInitiativeToggle] = useState(false);
  const [diceEngine, setDiceEngine] = useState("");
  const [playerSheetByParticipant, setPlayerSheetByParticipant] = useState<Record<string, string>>({});

  const [botOptions, setBotOptions] = useState<SelectableBot[]>([]);
  const [botsLoading, setBotsLoading] = useState(false);
  const [botsLoadError, setBotsLoadError] = useState("");

  const [bestiaryOptions, setBestiaryOptions] = useState<SelectableBot[]>([]);
  const [bestiaryLoading, setBestiaryLoading] = useState(false);

  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoadError, setUsersLoadError] = useState("");

  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const toneOptions = ["Gritty", "Heroic", "Whimsical", "Noir"];
  const gameSystemOptions = [
    "D&D 5e",
    "D&D 3.5",
    "OneD&D",
    "Pathfinder 1e",
    "Pathfinder 2e",
    "Call of Cthulhu",
    "Cyberpunk RED",
    "Cyberpunk 2020",
    "Custom/Homebrew",
  ];
  const diceEngineOptions = ["Quick Roll", "Auto-Calculation", "Manual"];

  useEffect(() => {
    let cancelled = false;

    const loadConnectedUsers = async () => {
      try {
        setUsersLoading(true);
        setUsersLoadError("");

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          if (!cancelled) {
            setConnectedUsers([]);
            setUsersLoadError("Sign in to load connected users.");
          }
          return;
        }

        const resp = await fetch("/api/connections", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const payload = await resp.json().catch(() => null);

        if (!resp.ok) {
          throw new Error(
            payload && typeof payload === "object" && "error" in payload
              ? String((payload as { error?: unknown }).error || "Failed to load connected users")
              : "Failed to load connected users"
          );
        }

        const rows =
          payload && typeof payload === "object" && Array.isArray((payload as { connections?: unknown[] }).connections)
            ? (payload as {
                connections: Array<{ user?: { id?: string; username?: string | null } | null }>;
              }).connections
            : [];

        const users = rows
          .map((row) => row.user)
          .filter((user): user is { id: string; username?: string | null } => Boolean(user?.id))
          .map((user) => ({ id: user.id, username: user.username ?? null }));

        const deduped = Array.from(new Map(users.map((u) => [u.id, u])).values());
        if (!cancelled) {
          setConnectedUsers(deduped);
          setNewUsers((prev) => prev.filter((id) => deduped.some((u) => u.id === id)));
        }
      } catch (err) {
        if (!cancelled) {
          setConnectedUsers([]);
          setUsersLoadError(err instanceof Error ? err.message : "Failed to load connected users");
        }
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    };

    void loadConnectedUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!newUniverse) {
      setBotOptions([]);
      setNewBots([]);
      setBotsLoadError("");
      setBotsLoading(false);
      return;
    }

    const controller = new AbortController();

    const loadBots = async () => {
      try {
        setBotsLoading(true);
        setBotsLoadError("");

        const resp = await fetch(`/api/bots?universe=${encodeURIComponent(newUniverse)}`, {
          signal: controller.signal,
        });
        const payload = await resp.json().catch(() => null);

        if (!resp.ok) {
          throw new Error(
            payload && typeof payload === "object" && "error" in payload
              ? String((payload as { error?: unknown }).error || "Failed to load bots")
              : "Failed to load bots"
          );
        }

        const bots =
          payload && typeof payload === "object" && Array.isArray((payload as { bots?: unknown[] }).bots)
            ? (payload as { bots: Array<{ id: string; name: string; universe?: string | null }> }).bots
            : [];

        const normalized = bots
          .filter((bot) => Boolean(bot?.id) && Boolean(bot?.name))
          .map((bot) => ({ id: bot.id, name: bot.name, universe: bot.universe ?? null }));

        setBotOptions(normalized);
        setNewBots((prev) => prev.filter((id) => normalized.some((bot) => bot.id === id)));
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setBotOptions([]);
        setNewBots([]);
        setBotsLoadError(err instanceof Error ? err.message : "Failed to load bots");
      } finally {
        setBotsLoading(false);
      }
    };

    void loadBots();

    return () => {
      controller.abort();
    };
  }, [newUniverse]);

  const userOptions = useMemo(
    () => connectedUsers.map((u) => ({ id: u.id, label: u.username?.trim() || "User" })),
    [connectedUsers]
  );

  // Load TTRPG Encounter bots for the bestiary picker whenever the focus switches to ttrpg
  useEffect(() => {
    if (newFocus !== "ttrpg") {
      setBestiaryOptions([]);
      setNewBestiary([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setBestiaryLoading(true);
      try {
        const resp = await fetch("/api/bots?universe=TTRPG");
        const payload = await resp.json().catch(() => null);
        if (!resp.ok) return;
        const bots = Array.isArray((payload as { bots?: unknown[] })?.bots)
          ? (payload as { bots: Array<{ id: string; name: string; universe?: string | null }> }).bots
          : [];
        if (!cancelled) {
          setBestiaryOptions(
            bots
              .filter((b) => Boolean(b?.id) && Boolean(b?.name))
              .map((b) => ({ id: b.id, name: b.name, universe: b.universe ?? null }))
          );
        }
      } finally {
        if (!cancelled) setBestiaryLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [newFocus]);

  const selectedBotNames = useMemo(
    () => newBots.map((id) => botOptions.find((bot) => bot.id === id)?.name).filter((n): n is string => Boolean(n)),
    [botOptions, newBots]
  );

  const selectedBotParticipants = useMemo(
    () =>
      newBots
        .map((id) => {
          const bot = botOptions.find((item) => item.id === id);
          if (!bot) return null;
          return { key: `bot:${bot.id}`, id: bot.id, label: bot.name, type: "bot" as const };
        })
        .filter((item): item is { key: string; id: string; label: string; type: "bot" } => Boolean(item)),
    [botOptions, newBots]
  );

  const selectedUserNames = useMemo(
    () => newUsers.map((id) => userOptions.find((u) => u.id === id)?.label).filter((n): n is string => Boolean(n)),
    [newUsers, userOptions]
  );

  const selectedUserParticipants = useMemo(
    () =>
      newUsers
        .map((id) => {
          const user = userOptions.find((item) => item.id === id);
          if (!user) return null;
          return { key: `user:${user.id}`, id: user.id, label: user.label, type: "user" as const };
        })
        .filter((item): item is { key: string; id: string; label: string; type: "user" } => Boolean(item)),
    [newUsers, userOptions]
  );

  const selectedParticipants = useMemo(
    () => [...selectedUserParticipants, ...selectedBotParticipants],
    [selectedBotParticipants, selectedUserParticipants]
  );

  const gmOptions = useMemo(() => [...selectedBotNames, ...selectedUserNames], [selectedBotNames, selectedUserNames]);

  useEffect(() => {
    setPlayerSheetByParticipant((prev) => {
      const next: Record<string, string> = {};
      for (const participant of selectedParticipants) {
        next[participant.key] = prev[participant.key] ?? "";
      }
      return next;
    });
  }, [selectedParticipants]);

  useEffect(() => {
    if (newGmMode !== "bot") {
      setNewBotGmId("");
      setNewBestiary([]);
    }
  }, [newGmMode]);

  const buildRules = () => {
    if (newFocus === "roleplay") {
      return [
        newScenario.trim() ? `Scenario: ${newScenario.trim()}` : null,
        newSetting.trim() ? `Setting: ${newSetting.trim()}` : null,
        newNarrativeTone.trim() ? `Narrative Tone: ${newNarrativeTone.trim()}` : null,
        newWorldState.trim() ? `World State / Lore Rules: ${newWorldState.trim()}` : null,
        newCharacterDirectives.trim() ? `Character Directives: ${newCharacterDirectives.trim()}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    }

    if (newFocus === "ttrpg") {
      const playerSlots = selectedParticipants
        .map((participant) => {
          const sheet = playerSheetByParticipant[participant.key]?.trim();
          if (!sheet) return null;
          return `${participant.label}: ${sheet}`;
        })
        .filter(Boolean)
        .join(" | ");

      return [
        newGameSystem.trim() ? `Game System: ${newGameSystem.trim()}` : null,
        newRulebookReferences.trim() ? `Rulebook / House Rules: ${newRulebookReferences.trim()}` : null,
        `GM Mode: ${newGmMode}`,
        newGmMode === "bot" && newBotGmId
          ? `Bot GM: ${botOptions.find((bot) => bot.id === newBotGmId)?.name || "Unknown Bot"}`
          : null,
        newGmMode === "co-gm" ? "Co-GM: AI assists user with tracking and adjudication" : null,
        playerSlots ? `Player Slots: ${playerSlots}` : null,
        newCampaignHook.trim() ? `Campaign Hook: ${newCampaignHook.trim()}` : null,
        newMapDescription.trim() ? `Current Location / Map: ${newMapDescription.trim()}` : null,
        `Difficulty/Lethality: ${newDifficultyLethality}/100`,
        newSpecialRules.trim() ? `Special Rules/Modifiers: ${newSpecialRules.trim()}` : null,
        `Dice Engine Enabled: ${newDiceEngineEnabled ? "Yes" : "No"}`,
        newPartyVitals.trim() ? `Party Vitals: ${newPartyVitals.trim()}` : null,
        `Initiative Logic: ${newInitiativeMode}`,
        newGM.trim() ? `GM Assignment: ${newGM.trim()}` : null,
        newSafetyRules.trim() ? `Safety/Table Rules: ${newSafetyRules.trim()}` : null,
        `Initiative / Turn Order: ${initiativeToggle ? "Enabled" : "Disabled"}`,
        diceEngine.trim() ? `Dice Engine: ${diceEngine.trim()}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    }

    return "";
  };

  const handleCreateGroupChat = async () => {
    setCreateError("");

    if (!newGroupName.trim()) {
      setCreateError("Room name required");
      return;
    }
    if (!newUniverse.trim()) {
      setCreateError("Universe is required");
      return;
    }
    if (newBots.length < 1) {
      setCreateError("Select at least 1 bot");
      return;
    }
    if (newBots.length > 12) {
      setCreateError("Max 12 bots");
      return;
    }
    if (newUsers.length > 4) {
      setCreateError("Max 4 users");
      return;
    }
    if (newFocus === "ttrpg" && !newGameSystem.trim()) {
      setCreateError("Select a TTRPG system/edition");
      return;
    }
    if (newFocus === "ttrpg" && newGmMode === "bot" && !newBotGmId) {
      setCreateError("Select which bot is GM");
      return;
    }

    try {
      setCreateLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setCreateError("You must be logged in.");
        return;
      }

      const rules = buildRules();

      const payload = {
        name: newGroupName.trim(),
        visibility: "private",
        groupType: newFocus,
        universe: newUniverse,
        botIds: newBots,
        additionalUserIds: newUsers,
        selectedPersonaId,
        description:
          newFocus === "general"
            ? null
            : [newScenario.trim(), newSetting.trim()].filter(Boolean).join(" - ") || null,
        rules: rules || null,
        personaRelationshipContext: newCharacterRelationships.trim() || null,
        bestiaryBotIds: newFocus === "ttrpg" ? newBestiary : [],
        corebookName: newFocus === "ttrpg" && newCorebookName.trim() ? newCorebookName.trim() : undefined,
        corebookUrl: newFocus === "ttrpg" && newCorebookUrl.trim() ? newCorebookUrl.trim() : undefined,
      };

      const resp = await fetch("/api/group-chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        const message =
          data && typeof data === "object" && "error" in data
            ? String((data as { error?: unknown }).error || "Failed to create group chat")
            : "Failed to create group chat";
        throw new Error(message);
      }

      router.push("/conversations");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create group chat");
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-gray-700/70 bg-gray-900/70 p-6 sm:p-8 shadow-xl">
        <h1 className="text-2xl sm:text-3xl font-bold">Set Up Group Chat</h1>
        <p className="mt-2 text-sm text-gray-300">Create the group here. After setup, you will be redirected to Conversations.</p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Persona</label>
            <PersonaSelector
              selectedPersonaId={selectedPersonaId}
              onSelectPersona={setSelectedPersonaId}
            />
            <p className="mt-1 text-xs text-gray-400">Choose which persona this group setup should target.</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Room Name</label>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2"
              placeholder="Group name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Universe</label>
            <select
              value={newUniverse}
              onChange={(e) => setNewUniverse(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2"
            >
              <option value="">Select universe</option>
              {BOT_UNIVERSES.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Chat Focus</label>
            <select
              value={newFocus}
              onChange={(e) => setNewFocus(e.target.value as GroupFocus)}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2"
            >
              <option value="general">General</option>
              <option value="roleplay">Roleplay</option>
              <option value="ttrpg">TTRPG</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Bots (min 1, max 12)</label>
            <div className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2">
              {!newUniverse ? (
                <div className="text-xs text-gray-400 py-2">Select a universe first</div>
              ) : botsLoading ? (
                <div className="text-xs text-gray-400 py-2">Loading bots...</div>
              ) : botOptions.length === 0 && !botsLoadError ? (
                <div className="text-xs text-gray-400 py-2">No bots found for this universe.</div>
              ) : (
                <div className="flex flex-col max-h-32 overflow-y-auto">
                  {botOptions.map((b) => (
                    <label key={b.id} className="flex items-center space-x-2 py-1">
                      <input
                        type="checkbox"
                        value={b.id}
                        checked={newBots.includes(b.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            if (newBots.length < 12) setNewBots([...newBots, b.id]);
                          } else {
                            setNewBots(newBots.filter((id) => id !== b.id));
                          }
                        }}
                        disabled={newBots.length >= 12 && !newBots.includes(b.id)}
                        className="accent-indigo-500"
                      />
                      <span>{b.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {botsLoadError ? <div className="mt-1 text-xs text-red-400">{botsLoadError}</div> : null}
              <div className="mt-1 text-xs text-gray-400">Selected: {newBots.length}</div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Users (max 4, optional)</label>
            <select
              multiple
              value={newUsers}
              onChange={(e) => setNewUsers(Array.from(e.target.selectedOptions, (o) => o.value).slice(0, 4))}
              className="h-24 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2"
              disabled={usersLoading}
            >
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
            {usersLoading ? <div className="mt-1 text-xs text-gray-400">Loading connected users...</div> : null}
            {!usersLoading && userOptions.length === 0 && !usersLoadError ? (
              <div className="mt-1 text-xs text-gray-400">No connected users found.</div>
            ) : null}
            {usersLoadError ? <div className="mt-1 text-xs text-red-400">{usersLoadError}</div> : null}
            <div className="mt-1 text-xs text-gray-400">Selected: {newUsers.length}</div>
          </div>

          {newFocus === "roleplay" && (
            <div className="space-y-4 rounded-lg border border-gray-700/80 bg-gray-950/60 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-200">Roleplay Setup</h2>
              <textarea value={newScenario} onChange={(e) => setNewScenario(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2" placeholder="Scenario (The Hook)" />
              <input value={newSetting} onChange={(e) => setNewSetting(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2" placeholder="Setting / Location" />
              <select value={newNarrativeTone} onChange={(e) => setNewNarrativeTone(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2">
                <option value="">Select Narrative Tone</option>
                {toneOptions.map((tone) => (
                  <option key={tone} value={tone}>
                    {tone}
                  </option>
                ))}
              </select>
              <textarea value={newWorldState} onChange={(e) => setNewWorldState(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2" placeholder="World State / Lore Rules" />
              <textarea value={newCharacterRelationships} onChange={(e) => setNewCharacterRelationships(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2" placeholder="Character Relationships" />
              <textarea value={newCharacterDirectives} onChange={(e) => setNewCharacterDirectives(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2" placeholder="Character Directives (private guidance)" />
            </div>
          )}

          {newFocus === "ttrpg" && (
            <div className="space-y-4 rounded-lg border border-gray-700/80 bg-gray-950/60 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-200">TTRPG Setup</h2>

              <div>
                <label className="mb-1 block text-sm font-medium">System / Edition</label>
                <select value={newGameSystem} onChange={(e) => setNewGameSystem(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2">
                  <option value="">Select Game System</option>
                  {gameSystemOptions.map((system) => (
                    <option key={system} value={system}>
                      {system}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Rulebook References / House Rules</label>
                <textarea value={newRulebookReferences} onChange={(e) => setNewRulebookReferences(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2" placeholder="Paste references or homebrew rules" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Corebook / SRD Link <span className="text-gray-400 font-normal">(optional)</span></label>
                <p className="mb-2 text-xs text-gray-400">Link to the official rulebook or SRD (e.g. D&amp;D 5e, Pathfinder, Call of Cthulhu). The DM bot will use this ruleset for encounter stat blocks and rulings.</p>
                <input
                  type="text"
                  value={newCorebookName}
                  onChange={(e) => setNewCorebookName(e.target.value)}
                  placeholder="System name, e.g. D&D 5e SRD"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 mb-2 text-sm"
                />
                <input
                  type="url"
                  value={newCorebookUrl}
                  onChange={(e) => setNewCorebookUrl(e.target.value)}
                  placeholder="https://www.5esrd.com or https://2e.aonprd.com"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Game Master Mode</label>
                <select value={newGmMode} onChange={(e) => setNewGmMode(e.target.value as GmMode)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2">
                  <option value="user">User is GM</option>
                  <option value="bot">Bot is GM</option>
                  <option value="co-gm">Co-GM (AI assists User)</option>
                </select>
              </div>

              {newGmMode === "bot" && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Select Bot GM</label>
                  <select value={newBotGmId} onChange={(e) => setNewBotGmId(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2">
                    <option value="">Select bot</option>
                    {selectedBotParticipants.map((bot) => (
                      <option key={bot.id} value={bot.id}>
                        {bot.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Encounter Bestiary — pre-linked encounter bots, inactive until summoned */}
              <div>
                <label className="mb-1 block text-sm font-medium">Encounter Bestiary</label>
                <p className="mb-2 text-xs text-gray-400">Select Encounter bots that can be summoned mid-session by the DM. They won&apos;t join until triggered.</p>
                <div className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2">
                  {bestiaryLoading ? (
                    <div className="text-xs text-gray-400 py-2">Loading encounter bots...</div>
                  ) : bestiaryOptions.length === 0 ? (
                    <div className="text-xs text-gray-400 py-2">No TTRPG Encounter bots found. Create one on the /create page with TTRPG universe and Encounter role.</div>
                  ) : (
                    <div className="flex flex-col max-h-32 overflow-y-auto">
                      {bestiaryOptions.map((b) => (
                        <label key={b.id} className="flex items-center space-x-2 py-1">
                          <input
                            type="checkbox"
                            value={b.id}
                            checked={newBestiary.includes(b.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewBestiary((prev) => [...prev, b.id]);
                              } else {
                                setNewBestiary((prev) => prev.filter((id) => id !== b.id));
                              }
                            }}
                            className="accent-amber-500"
                          />
                          <span className="text-sm">{b.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-gray-400">Bestiary: {newBestiary.length} selected</div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Player Slots (Character Sheets)</label>
                <div className="space-y-2">
                  {selectedParticipants.length === 0 ? (
                    <div className="text-xs text-gray-400">Select bots/users above to assign character sheets.</div>
                  ) : (
                    selectedParticipants.map((participant) => (
                      <div key={participant.key} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm">
                          {participant.label} ({participant.type})
                        </div>
                        <input
                          value={playerSheetByParticipant[participant.key] ?? ""}
                          onChange={(e) =>
                            setPlayerSheetByParticipant((prev) => ({
                              ...prev,
                              [participant.key]: e.target.value,
                            }))
                          }
                          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2"
                          placeholder="Class/Level or sheet summary"
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Campaign Hook</label>
                <textarea value={newCampaignHook} onChange={(e) => setNewCampaignHook(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2" placeholder="Long-term goal/module hook" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Current Location / Map Description</label>
                <textarea value={newMapDescription} onChange={(e) => setNewMapDescription(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2" placeholder="Describe map, room dimensions, hazards" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Difficulty / Lethality</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={newDifficultyLethality}
                  onChange={(e) => setNewDifficultyLethality(Number(e.target.value))}
                  className="w-full"
                />
                <div className="mt-1 flex justify-between text-xs text-gray-400">
                  <span>Roleplay-Heavy</span>
                  <span>{newDifficultyLethality}</span>
                  <span>Meat Grinder</span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Special Rules / Modifiers (tags)</label>
                <input
                  value={newSpecialRules}
                  onChange={(e) => setNewSpecialRules(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2"
                  placeholder="Low Magic, Permanent Death, Sanity Mechanics"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Dice Engine Toggle</label>
                <select value={newDiceEngineEnabled ? "enabled" : "disabled"} onChange={(e) => setNewDiceEngineEnabled(e.target.value === "enabled")} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2">
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Auto-Sheet Reading: Party Vitals</label>
                <textarea value={newPartyVitals} onChange={(e) => setNewPartyVitals(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2" placeholder="HP, AC, Passive Perception for each participant" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Initiative Logic</label>
                <select value={newInitiativeMode} onChange={(e) => setNewInitiativeMode(e.target.value as InitiativeMode)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2">
                  <option value="manual">Manual</option>
                  <option value="automatic">Automatic</option>
                </select>
              </div>

              <select value={newGM} onChange={(e) => setNewGM(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2">
                <option value="">Select GM Assignment Label</option>
                {gmOptions.map((gm) => (
                  <option key={gm} value={gm}>
                    {gm}
                  </option>
                ))}
              </select>
              <textarea value={newSafetyRules} onChange={(e) => setNewSafetyRules(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2" placeholder="Safety / Table Rules" />
              <label className="flex items-center gap-2 text-sm text-gray-200">
                <input type="checkbox" checked={initiativeToggle} onChange={(e) => setInitiativeToggle(e.target.checked)} />
                Force initiative / turn order
              </label>
              <select value={diceEngine} onChange={(e) => setDiceEngine(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2">
                <option value="">Select Dice Engine</option>
                {diceEngineOptions.map((engine) => (
                  <option key={engine} value={engine}>
                    {engine}
                  </option>
                ))}
              </select>
            </div>
          )}

          {createError ? <div className="text-sm text-red-400">{createError}</div> : null}

          <button
            onClick={handleCreateGroupChat}
            disabled={createLoading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {createLoading ? "Creating..." : "Create Group Chat"}
          </button>
        </div>
      </div>
    </div>
  );
}
