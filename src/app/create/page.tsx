/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import dynamic from "next/dynamic"
import type { Area } from "react-easy-crop"
const Cropper = dynamic(() => import("react-easy-crop"), { ssr: false })
import { UNIVERSE_CATEGORIES } from "@/lib/botUniverses"
import { supabase } from "@/lib/supabase"

export default function CreateBotPage() {
  const router = useRouter()
  const [mode, setMode] = useState<"bot" | "persona" | "ttrpg">("bot")
  const [loading, setLoading] = useState(false)
  // ...existing code...

  const [botName, setBotName] = useState("")
  const [botUniverse, setBotUniverse] = useState("")
  const [universeRequestName, setUniverseRequestName] = useState("")
  const [universeRequestDetails, setUniverseRequestDetails] = useState("")
  const [universeRequestLoading, setUniverseRequestLoading] = useState(false)
  const [universeRequestMessage, setUniverseRequestMessage] = useState<string | null>(null)
  const [botDescription, setBotDescription] = useState("")
  const [botPersonality, setBotPersonality] = useState("")
  const [botBackstory, setBotBackstory] = useState("")
  const [botGoals, setBotGoals] = useState("")
  const [botGender, setBotGender] = useState("")
  const [botAge, setBotAge] = useState("")
  const [botRules, setBotRules] = useState("")
  const [botStyle, setBotStyle] = useState("")
  const [botSecrets, setBotSecrets] = useState("")
  const [botPublishNow, setBotPublishNow] = useState(true)
  const [botAvatarUrl, setBotAvatarUrl] = useState<string | null>(null)
  const [botTtrpgRole, setBotTtrpgRole] = useState<"NPC" | "DM" | "PC" | "Encounter">("NPC")

  const [botPcClassArchetype, setBotPcClassArchetype] = useState("")
  const [botPcAncestrySpecies, setBotPcAncestrySpecies] = useState("")
  const [botPcLevelRank, setBotPcLevelRank] = useState("")
  const [botPcBackgroundTrope, setBotPcBackgroundTrope] = useState("")
  const [botPcModifiers, setBotPcModifiers] = useState("")
  const [botPcSkills, setBotPcSkills] = useState("")
  const [botPcHpHealth, setBotPcHpHealth] = useState("")
  const [botPcAcDefense, setBotPcAcDefense] = useState("")
  const [botPcSpeed, setBotPcSpeed] = useState("")
  const [botPcResourcePools, setBotPcResourcePools] = useState("")
  const [botPcWeaponsAttacks, setBotPcWeaponsAttacks] = useState("")
  const [botPcFeaturesTalentsFeats, setBotPcFeaturesTalentsFeats] = useState("")
  const [botPcInventoryEquipment, setBotPcInventoryEquipment] = useState("")
  const [botPcWeightEncumbrance, setBotPcWeightEncumbrance] = useState("")
  const [botPcSpellsAbilities, setBotPcSpellsAbilities] = useState("")

  const [botDmSettingSummary, setBotDmSettingSummary] = useState("")
  const [botDmCurrentLocation, setBotDmCurrentLocation] = useState("")
  const [botDmActiveFactions, setBotDmActiveFactions] = useState("")
  const [botDmToneGrittiness, setBotDmToneGrittiness] = useState("5")
  const [botDmToneHumor, setBotDmToneHumor] = useState("5")
  const [botDmToneMagicLevel, setBotDmToneMagicLevel] = useState("5")
  const [botDmLastSessionRecap, setBotDmLastSessionRecap] = useState("")
  const [botDmOutstandingHooks, setBotDmOutstandingHooks] = useState("")
  const [botDmKeyPcDecisions, setBotDmKeyPcDecisions] = useState("")
  const [botDmSystemRuleset, setBotDmSystemRuleset] = useState("")
  const [botDmDcTable, setBotDmDcTable] = useState("")
  const [botDmRandomEncounters, setBotDmRandomEncounters] = useState("")
  const [botDmAdjudicationStyle, setBotDmAdjudicationStyle] = useState("Rule of Cool")
  const [botDmPacingController, setBotDmPacingController] = useState(
    "Push the narrative forward if players are stuck for more than 3 turns."
  )
  const [botDmDescriptionDensity, setBotDmDescriptionDensity] = useState("Balanced")

  const [botEncounterCreatureName, setBotEncounterCreatureName] = useState("")
  const [botEncounterDangerLevelCr, setBotEncounterDangerLevelCr] = useState("")
  const [botEncounterCombatRole, setBotEncounterCombatRole] = useState("Tank")
  const [botEncounterAbilitiesActions, setBotEncounterAbilitiesActions] = useState("")
  const [botEncounterTacticsAiLogic, setBotEncounterTacticsAiLogic] = useState("")
  const [botEncounterHarvestableLoot, setBotEncounterHarvestableLoot] = useState("")
  const [botEncounterAtmosphere, setBotEncounterAtmosphere] = useState("")
  const [botEncounterTerrainHazards, setBotEncounterTerrainHazards] = useState("")
  const [botEncounterLightingVisibility, setBotEncounterLightingVisibility] = useState("")
  const [botEncounterMoraleBreak, setBotEncounterMoraleBreak] = useState("")
  const [botEncounterObjective, setBotEncounterObjective] = useState("")
  const [botEncounterEscalation, setBotEncounterEscalation] = useState("")
  const [lastCreatedBotId, setLastCreatedBotId] = useState<string | null>(null)
  const [lastCreatedBotPublished, setLastCreatedBotPublished] = useState<boolean | null>(null)

  const [personaName, setPersonaName] = useState("")
  const [personaDescription, setPersonaDescription] = useState("")
  const [personaGender, setPersonaGender] = useState("")
  const [personaCustomGender, setPersonaCustomGender] = useState("")
  const [personaAppearance, setPersonaAppearance] = useState("")
  const [personaBackstory, setPersonaBackstory] = useState("")
  const [personaGoals, setPersonaGoals] = useState("")
  const [personaAvatarUrl, setPersonaAvatarUrl] = useState<string | null>(null)

  const [ttrpgName, setTtrpgName] = useState("")
  const [ttrpgClassArchetype, setTtrpgClassArchetype] = useState("")
  const [ttrpgAncestrySpecies, setTtrpgAncestrySpecies] = useState("")
  const [ttrpgLevelRank, setTtrpgLevelRank] = useState("")
  const [ttrpgBackgroundTrope, setTtrpgBackgroundTrope] = useState("")
  const [ttrpgModifiers, setTtrpgModifiers] = useState("")
  const [ttrpgSkills, setTtrpgSkills] = useState("")
  const [ttrpgHpHealth, setTtrpgHpHealth] = useState("")
  const [ttrpgAcDefense, setTtrpgAcDefense] = useState("")
  const [ttrpgSpeed, setTtrpgSpeed] = useState("")
  const [ttrpgResourcePools, setTtrpgResourcePools] = useState("")
  const [ttrpgWeaponsAttacks, setTtrpgWeaponsAttacks] = useState("")
  const [ttrpgFeaturesTalentsFeats, setTtrpgFeaturesTalentsFeats] = useState("")
  const [ttrpgInventoryEquipment, setTtrpgInventoryEquipment] = useState("")
  const [ttrpgWeightEncumbrance, setTtrpgWeightEncumbrance] = useState("")
  const [ttrpgSpellsAbilities, setTtrpgSpellsAbilities] = useState("")

  const [cropTarget, setCropTarget] = useState<"bot" | "persona" | null>(null)
  const [cropSourceImage, setCropSourceImage] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  function getStoredAccessToken() {
    if (typeof window === "undefined") return null

    try {
      const raw = window.localStorage.getItem("botainy-auth")
      if (!raw) return null

      const parsed = JSON.parse(raw) as {
        access_token?: string
        expires_at?: number
        currentSession?: { access_token?: string; expires_at?: number }
        session?: { access_token?: string; expires_at?: number }
      }

      const token =
        parsed.access_token ?? parsed.currentSession?.access_token ?? parsed.session?.access_token
      const expiresAt =
        parsed.expires_at ?? parsed.currentSession?.expires_at ?? parsed.session?.expires_at

      if (!token) return null
      if (typeof expiresAt === "number" && expiresAt * 1000 <= Date.now()) return null

      return token
    } catch {
      return null
    }
  }

  async function getAccessToken() {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (!error && session?.access_token) {
        return session.access_token
      }
    } catch {
      // fall through to local cache token
    }

    return getStoredAccessToken()
  }

  const closeCropper = () => {
    setCropTarget(null)
    setCropSourceImage(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
  }

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  async function getCroppedImageFile(source: string, area: Area, target: "bot" | "persona") {
    const image = new Image()
    image.src = source
    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = reject
    })

    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(area.width))
    canvas.height = Math.max(1, Math.round(area.height))

    const context = canvas.getContext("2d")
    if (!context) {
      throw new Error("Unable to process selected image")
    }

    context.drawImage(
      image,
      area.x,
      area.y,
      area.width,
      area.height,
      0,
      0,
      canvas.width,
      canvas.height
    )

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((fileBlob) => resolve(fileBlob), "image/jpeg", 0.92)
    })

    if (!blob) {
      throw new Error("Could not create cropped image")
    }

    return new File([blob], `${target}-avatar.jpg`, { type: "image/jpeg" })
  }

  async function uploadFile(file: File, target: "bot" | "persona") {
    try {
      const token = await getAccessToken()

      if (!token) {
        throw new Error("Not authenticated")
      }

      const formData = new FormData()
      formData.append("file", file)
      formData.append("bucket", "avatars")

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const payload = (await response.json()) as { url?: string; error?: string }
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Upload failed")
      }

      if (target === "bot") {
        setBotAvatarUrl(payload.url)
      } else {
        setPersonaAvatarUrl(payload.url)
      }
      toast.success("Avatar uploaded!")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed"
      toast.error(message)
    }
  }

  async function handleSelectImage(
    e: React.ChangeEvent<HTMLInputElement>,
    target: "bot" | "persona"
  ) {
    const files = e.target.files
    const file = files?.[0]
    e.target.value = ""
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== "string") {
        toast.error("Unable to load image")
        return
      }

      setCropTarget(target)
      setCropSourceImage(result)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)
    }
    reader.onerror = () => {
      toast.error("Unable to load image")
    }
    reader.readAsDataURL(file)
  }

  async function applyCroppedImage() {
    if (!cropTarget || !cropSourceImage || !croppedAreaPixels) {
      toast.error("Please adjust crop before saving")
      return
    }

    setLoading(true)
    try {
      const croppedFile = await getCroppedImageFile(cropSourceImage, croppedAreaPixels, cropTarget)
      await uploadFile(croppedFile, cropTarget)
      closeCropper()
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmitUniverseRequest(e: React.FormEvent) {
    e.preventDefault()
    setUniverseRequestMessage(null)

    const trimmedName = universeRequestName.trim()
    const trimmedDetails = universeRequestDetails.trim()

    if (!trimmedName || !trimmedDetails) {
      setUniverseRequestMessage("Please provide a universe name and request details.")
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = "/login"
      return
    }

    try {
      setUniverseRequestLoading(true)

      const { error } = await supabase.from("bot_universe_requests").insert({
        requester_id: user.id,
        requested_name: trimmedName,
        request_details: trimmedDetails,
      })

      if (error) throw error

      setUniverseRequestName("")
      setUniverseRequestDetails("")
      setUniverseRequestMessage("Request sent to admin for review.")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send request"
      setUniverseRequestMessage(message)
    } finally {
      setUniverseRequestLoading(false)
    }
  }

  async function handleCreateBot(e: React.FormEvent) {
    e.preventDefault()

    if (!botName.trim() || !botUniverse.trim()) {
      toast.error("Please fill in all required bot fields")
      return
    }

    if (botAge.trim() && parseInt(botAge.trim(), 10) < 18) {
      toast.error("Character age must be 18 or older")
      return
    }

    const valueOrNA = (value: string) => value.trim() || "N/A"

    let finalDescription = botDescription.trim()
    let finalPersonality = ""

    if (botUniverse === "TTRPG") {
      if (botTtrpgRole === "NPC") {
        if (!botDescription.trim() || !botPersonality.trim()) {
          toast.error("NPC bots require description and core personality")
          return
        }

        const npcSections = [
          "TTRPG Role: NPC",
          `Core Personality: ${botPersonality.trim()}`,
          botBackstory.trim() ? `### **Backstory**\n${botBackstory.trim()}` : null,
          botGoals.trim() ? `### **Goals**\n${botGoals.trim()}` : null,
          botGender.trim() ? `Gender: ${botGender.trim()}` : null,
          botAge.trim() ? `Age: ${botAge.trim()}` : null,
          botRules.trim() ? `### **Rules / Boundaries**\n${botRules.trim()}` : null,
          botStyle.trim() ? `### **Speaking Style**\n${botStyle.trim()}` : null,
        ].filter(Boolean)

        finalDescription = botDescription.trim()
        finalPersonality = npcSections.join("\n\n")
      }

      if (botTtrpgRole === "PC") {
        if (
          !botPcClassArchetype.trim() ||
          !botPcAncestrySpecies.trim() ||
          !botPcLevelRank.trim()
        ) {
          toast.error("PC bots require class/archetype, ancestry/species, and level/rank")
          return
        }

        const pcSheet = [
          "TTRPG Role: PC",
          "",
          "1. Identity & Narrative",
          `Name: ${valueOrNA(botName)}`,
          `Class/Archetype: ${valueOrNA(botPcClassArchetype)}`,
          `Ancestry/Species: ${valueOrNA(botPcAncestrySpecies)}`,
          `Level/Rank: ${valueOrNA(botPcLevelRank)}`,
          `Background/Trope: ${valueOrNA(botPcBackgroundTrope)}`,
          "",
          "2. Core Statistics",
          `Modifiers: ${valueOrNA(botPcModifiers)}`,
          `Skills: ${valueOrNA(botPcSkills)}`,
          "",
          "3. Vitality & Resource Tracking",
          `Hit Points (HP) / Health: ${valueOrNA(botPcHpHealth)}`,
          `Armor Class (AC) / Defense: ${valueOrNA(botPcAcDefense)}`,
          `Speed: ${valueOrNA(botPcSpeed)}`,
          `Resource Pools: ${valueOrNA(botPcResourcePools)}`,
          "",
          "4. Capabilities & Equipment",
          `Weapons/Attacks: ${valueOrNA(botPcWeaponsAttacks)}`,
          `Features/Talents/Feats: ${valueOrNA(botPcFeaturesTalentsFeats)}`,
          `Inventory/Equipment: ${valueOrNA(botPcInventoryEquipment)}`,
          `Weight/Encumbrance: ${valueOrNA(botPcWeightEncumbrance)}`,
          `Spells/Abilities: ${valueOrNA(botPcSpellsAbilities)}`,
        ].join("\n")

        finalDescription = `TTRPG PC (${botPcClassArchetype.trim()})`
        finalPersonality = pcSheet
      }

      if (botTtrpgRole === "DM") {
        if (!botDmSettingSummary.trim() || !botDmCurrentLocation.trim() || !botDmSystemRuleset.trim()) {
          toast.error("DM bots require world setting summary, current location, and system ruleset")
          return
        }

        const dmSheet = [
          "TTRPG Role: DM",
          "",
          "1. The World Seed (Core Lore)",
          `Setting Summary: ${valueOrNA(botDmSettingSummary)}`,
          `Current Location: ${valueOrNA(botDmCurrentLocation)}`,
          `Active Factions: ${valueOrNA(botDmActiveFactions)}`,
          `Tone - Grittiness: ${valueOrNA(botDmToneGrittiness)}/10, Humor: ${valueOrNA(botDmToneHumor)}/10, Magic Level: ${valueOrNA(botDmToneMagicLevel)}/10`,
          "",
          "2. The Campaign Log (Short-Term Memory)",
          `Last Session Recap: ${valueOrNA(botDmLastSessionRecap)}`,
          `Outstanding Hooks: ${valueOrNA(botDmOutstandingHooks)}`,
          `Key PC Decisions: ${valueOrNA(botDmKeyPcDecisions)}`,
          "",
          "3. The Toolbox (Mechanical Logic)",
          `System Ruleset: ${valueOrNA(botDmSystemRuleset)}`,
          `DC (Difficulty Class) Table: ${valueOrNA(botDmDcTable)}`,
          `Random Encounter Tables: ${valueOrNA(botDmRandomEncounters)}`,
          "",
          "4. Behavioral Directives",
          `Adjudication Style: ${valueOrNA(botDmAdjudicationStyle)}`,
          `Pacing Controller: ${valueOrNA(botDmPacingController)}`,
          `Description Density: ${valueOrNA(botDmDescriptionDensity)}`,
        ].join("\n")

        finalDescription = `TTRPG DM in ${botDmCurrentLocation.trim()}`
        finalPersonality = dmSheet
      }

      if (botTtrpgRole === "Encounter") {
        if (!botEncounterCreatureName.trim() || !botEncounterDangerLevelCr.trim() || !botEncounterTacticsAiLogic.trim()) {
          toast.error("Encounter bots require creature name, danger level/CR, and tactics/AI logic")
          return
        }

        const encounterSheet = [
          "TTRPG Role: Encounter",
          "",
          "1. Bestiary Entry (Specimen Card)",
          `Creature Name: ${valueOrNA(botEncounterCreatureName)}`,
          `Danger Level / CR: ${valueOrNA(botEncounterDangerLevelCr)}`,
          `Combat Role: ${valueOrNA(botEncounterCombatRole)}`,
          `Abilities / Actions: ${valueOrNA(botEncounterAbilitiesActions)}`,
          `Tactics / AI Logic: ${valueOrNA(botEncounterTacticsAiLogic)}`,
          `Harvestable Loot: ${valueOrNA(botEncounterHarvestableLoot)}`,
          "",
          "2. Encounter Builder (Environment Card)",
          `Atmosphere: ${valueOrNA(botEncounterAtmosphere)}`,
          `Terrain Hazards: ${valueOrNA(botEncounterTerrainHazards)}`,
          `Lighting/Visibility: ${valueOrNA(botEncounterLightingVisibility)}`,
          "",
          "3. Win/Loss Triggers",
          `Morale Break: ${valueOrNA(botEncounterMoraleBreak)}`,
          `Objective: ${valueOrNA(botEncounterObjective)}`,
          `Escalation: ${valueOrNA(botEncounterEscalation)}`,
        ].join("\n")

        finalDescription = `TTRPG Encounter: ${botEncounterCreatureName.trim()}`
        finalPersonality = encounterSheet
      }
    } else {
      if (!botDescription.trim() || !botPersonality.trim()) {
        toast.error("Please fill in all required bot fields")
        return
      }

      const personalitySections = [
        `Core Personality: ${botPersonality.trim()}`,
        botBackstory.trim() ? `### **Backstory**\n${botBackstory.trim()}` : null,
        botGoals.trim() ? `### **Goals**\n${botGoals.trim()}` : null,
        botGender.trim() ? `Gender: ${botGender.trim()}` : null,
        botAge.trim() ? `Age: ${botAge.trim()}` : null,
        botRules.trim() ? `### **Rules / Boundaries**\n${botRules.trim()}` : null,
        botStyle.trim() ? `### **Speaking Style**\n${botStyle.trim()}` : null,
      ].filter(Boolean)

      finalDescription = botDescription.trim()
      finalPersonality = personalitySections.join("\n\n")
    }

    setLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not authenticated")

      const response = await fetch("/api/bots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: botName.trim(),
          universe: botUniverse.trim(),
          description: finalDescription,
          personality: finalPersonality,
          avatarUrl: botAvatarUrl,
          isPublished: botPublishNow,
        }),
      })

      const payload = (await response.json()) as {
        error?: string
        bot?: { id?: string; is_published?: boolean }
      }

      if (!response.ok || !payload.bot) {
        throw new Error(payload.error || "Failed to create bot")
      }

      toast.success(botPublishNow ? "Bot created and published!" : "Bot created as private to My Bots")
      setLastCreatedBotId(payload.bot.id ?? null)
      setLastCreatedBotPublished(!!payload.bot.is_published)
      setBotName("")
      setBotUniverse("")
      setBotDescription("")
      setBotPersonality("")
      setBotBackstory("")
      setBotGoals("")
      setBotGender("")
      setBotAge("")
      setBotRules("")
      setBotStyle("")
      setBotTtrpgRole("NPC")

      setBotPcClassArchetype("")
      setBotPcAncestrySpecies("")
      setBotPcLevelRank("")
      setBotPcBackgroundTrope("")
      setBotPcModifiers("")
      setBotPcSkills("")
      setBotPcHpHealth("")
      setBotPcAcDefense("")
      setBotPcSpeed("")
      setBotPcResourcePools("")
      setBotPcWeaponsAttacks("")
      setBotPcFeaturesTalentsFeats("")
      setBotPcInventoryEquipment("")
      setBotPcWeightEncumbrance("")
      setBotPcSpellsAbilities("")

      setBotDmSettingSummary("")
      setBotDmCurrentLocation("")
      setBotDmActiveFactions("")
      setBotDmToneGrittiness("5")
      setBotDmToneHumor("5")
      setBotDmToneMagicLevel("5")
      setBotDmLastSessionRecap("")
      setBotDmOutstandingHooks("")
      setBotDmKeyPcDecisions("")
      setBotDmSystemRuleset("")
      setBotDmDcTable("")
      setBotDmRandomEncounters("")
      setBotDmAdjudicationStyle("Rule of Cool")
      setBotDmPacingController("Push the narrative forward if players are stuck for more than 3 turns.")
      setBotDmDescriptionDensity("Balanced")

      setBotEncounterCreatureName("")
      setBotEncounterDangerLevelCr("")
      setBotEncounterCombatRole("Tank")
      setBotEncounterAbilitiesActions("")
      setBotEncounterTacticsAiLogic("")
      setBotEncounterHarvestableLoot("")
      setBotEncounterAtmosphere("")
      setBotEncounterTerrainHazards("")
      setBotEncounterLightingVisibility("")
      setBotEncounterMoraleBreak("")
      setBotEncounterObjective("")
      setBotEncounterEscalation("")

      setBotPublishNow(true)
      setBotAvatarUrl(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create bot"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreatePersona(e: React.FormEvent) {
    e.preventDefault()

    if (!personaName.trim() || !personaDescription.trim()) {
      toast.error("Please fill in persona name and overview")
      return
    }

    const genderLabel =
      personaGender === "male" ? "Male (he/him)" :
      personaGender === "female" ? "Female (she/her)" :
      personaGender === "non-binary" ? "Non-binary (they/them)" :
      personaGender === "gender-fluid" ? "Gender fluid (any/all pronouns)" :
      personaGender === "custom" ? (personaCustomGender.trim() || "Custom") :
      null

    const descriptionSections = [
      personaDescription.trim(),
      genderLabel ? `Gender/Pronouns: ${genderLabel}` : null,
      personaAppearance.trim() ? `Appearance: ${personaAppearance.trim()}` : null,
      personaBackstory.trim() ? `Backstory: ${personaBackstory.trim()}` : null,
      personaGoals.trim() ? `Goals & Intentions: ${personaGoals.trim()}` : null,
    ].filter(Boolean)

    setLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not authenticated")

      const response = await fetch("/api/personas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: personaName.trim(),
          description: descriptionSections.join("\n\n"),
          avatarUrl: personaAvatarUrl,
        }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create persona")
      }

      toast.success("Persona created and added to your chat personas")
      setPersonaName("")
      setPersonaDescription("")
      setPersonaGender("")
      setPersonaCustomGender("")
      setPersonaAppearance("")
      setPersonaBackstory("")
      setPersonaGoals("")
      setPersonaAvatarUrl(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create persona"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateTtrpgPersona(e: React.FormEvent) {
    e.preventDefault()

    if (
      !ttrpgName.trim() ||
      !ttrpgClassArchetype.trim() ||
      !ttrpgAncestrySpecies.trim() ||
      !ttrpgLevelRank.trim()
    ) {
      toast.error("Please fill in the required TTRPG identity fields")
      return
    }

    const valueOrNA = (value: string) => value.trim() || "N/A"

    const ttrpgSheet = [
      "TTRPG Persona Sheet",
      "",
      "1. Identity & Narrative",
      `Name: ${valueOrNA(ttrpgName)}`,
      `Class/Archetype: ${valueOrNA(ttrpgClassArchetype)}`,
      `Ancestry/Species: ${valueOrNA(ttrpgAncestrySpecies)}`,
      `Level/Rank: ${valueOrNA(ttrpgLevelRank)}`,
      `Background/Trope: ${valueOrNA(ttrpgBackgroundTrope)}`,
      "",
      "2. Core Statistics",
      `Modifiers: ${valueOrNA(ttrpgModifiers)}`,
      `Skills: ${valueOrNA(ttrpgSkills)}`,
      "",
      "3. Vitality & Resource Tracking",
      `Hit Points (HP) / Health: ${valueOrNA(ttrpgHpHealth)}`,
      `Armor Class (AC) / Defense: ${valueOrNA(ttrpgAcDefense)}`,
      `Speed: ${valueOrNA(ttrpgSpeed)}`,
      `Resource Pools: ${valueOrNA(ttrpgResourcePools)}`,
      "",
      "4. Capabilities & Equipment",
      `Weapons/Attacks: ${valueOrNA(ttrpgWeaponsAttacks)}`,
      `Features/Talents/Feats: ${valueOrNA(ttrpgFeaturesTalentsFeats)}`,
      `Inventory/Equipment: ${valueOrNA(ttrpgInventoryEquipment)}`,
      `Weight/Encumbrance: ${valueOrNA(ttrpgWeightEncumbrance)}`,
      `Spells/Abilities: ${valueOrNA(ttrpgSpellsAbilities)}`,
    ].join("\n")

    setLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not authenticated")

      const response = await fetch("/api/personas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: ttrpgName.trim(),
          description: ttrpgSheet,
          avatarUrl: personaAvatarUrl,
        }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create TTRPG persona")
      }

      toast.success("TTRPG persona created")
      setTtrpgName("")
      setTtrpgClassArchetype("")
      setTtrpgAncestrySpecies("")
      setTtrpgLevelRank("")
      setTtrpgBackgroundTrope("")
      setTtrpgModifiers("")
      setTtrpgSkills("")
      setTtrpgHpHealth("")
      setTtrpgAcDefense("")
      setTtrpgSpeed("")
      setTtrpgResourcePools("")
      setTtrpgWeaponsAttacks("")
      setTtrpgFeaturesTalentsFeats("")
      setTtrpgInventoryEquipment("")
      setTtrpgWeightEncumbrance("")
      setTtrpgSpellsAbilities("")
      setPersonaAvatarUrl(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create TTRPG persona"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-gray-100">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <header className="mb-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Create</h1>
          <p className="text-gray-400 mt-2">Build a bot, a standard persona, or a TTRPG persona sheet.</p>
        </header>

        <div className="mb-6 bg-gray-900/70 border border-gray-700 rounded-xl p-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("bot")
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
              mode === "bot"
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            Bot Creator
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("persona")
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
              mode === "persona"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            Persona Creator
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("ttrpg")
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
              mode === "ttrpg"
                ? "bg-emerald-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            TTRPG Creator
          </button>
        </div>

        {mode === "bot" ? (
          <>
            <div className="mb-6 rounded-xl border border-gray-700 bg-gray-900/70 p-4 sm:p-5">
              <h2 className="text-lg font-semibold mb-1">Request a New Universe</h2>
              <p className="text-sm text-gray-300 mb-4">
                Submit a short request and admins can review it in Admin -{'>'} Requests.
              </p>

              <form onSubmit={handleSubmitUniverseRequest} className="space-y-3">
                <input
                  value={universeRequestName}
                  onChange={(e) => setUniverseRequestName(e.target.value)}
                  placeholder="Requested universe name"
                  maxLength={80}
                  className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-white text-sm"
                  required
                />
                <textarea
                  value={universeRequestDetails}
                  onChange={(e) => setUniverseRequestDetails(e.target.value)}
                  placeholder="What should this universe include?"
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-white text-sm resize-none"
                  required
                />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-400">{universeRequestDetails.length}/500</span>
                  <button
                    type="submit"
                    disabled={universeRequestLoading}
                    className="px-4 py-2 text-sm rounded-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-60 transition"
                  >
                    {universeRequestLoading ? "Sending..." : "Send Request"}
                  </button>
                </div>
                {universeRequestMessage && (
                  <div className="text-sm text-gray-200 bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2">
                    {universeRequestMessage}
                  </div>
                )}
              </form>
            </div>

            {/* AI Bot Assist removed */}
            <form
              onSubmit={handleCreateBot}
              className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-5 sm:p-8 shadow-xl backdrop-blur-sm space-y-7"
            >
            <div className="flex flex-col items-center gap-6 pb-6 border-b border-gray-700/50">
              <div className="relative group">
                {botAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={botAvatarUrl}
                    alt="bot avatar"
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-purple-500/30 group-hover:border-purple-500 transition-all shadow-lg shadow-purple-500/10"
                  />
                ) : (
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gray-950 border-4 border-dashed border-gray-700 flex items-center justify-center text-3xl text-gray-500 group-hover:border-purple-500 transition-all">
                    ?
                  </div>
                )}
              </div>
              <div className="w-full max-w-xs text-center">
                <label className="block text-sm font-medium text-gray-400 mb-2">Bot Avatar</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleSelectImage(e, "bot")}
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-600/10 file:text-purple-400 hover:file:bg-purple-600/20 cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                  Bot Name <span className="text-red-400">*</span>
                </label>
                <input
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="e.g. Captain Nyx"
                  maxLength={60}
                  className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">{botName.length}/60 characters</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                  Universe / IP <span className="text-red-400">*</span>
                </label>
                <select
                  value={botUniverse}
                  onChange={(e) => setBotUniverse(e.target.value)}
                  className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                  required
                >
                  <option value="" disabled>
                    Select a universe
                  </option>
                  {Object.entries(UNIVERSE_CATEGORIES).map(([genre, universes]) => (
                    <optgroup key={genre} label={genre}>
                      {universes.map((universe) => (
                        <option key={universe} value={universe}>
                          {universe}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {botUniverse === "TTRPG" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                    TTRPG Role <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={botTtrpgRole}
                    onChange={(e) => setBotTtrpgRole(e.target.value as "NPC" | "DM" | "PC" | "Encounter")}
                    className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                    required
                  >
                    <option value="NPC">NPC</option>
                    <option value="DM">DM</option>
                    <option value="PC">PC</option>
                    <option value="Encounter">Encounter</option>
                  </select>
                </div>
              )}

              {(botUniverse !== "TTRPG" || botTtrpgRole === "NPC") && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                      Description <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={botDescription}
                      onChange={(e) => setBotDescription(e.target.value)}
                      placeholder="Who is this character and what is their role?"
                      className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      rows={3}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Tip: Keep this concise and lore-focused.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                      Core Personality <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={botPersonality}
                      onChange={(e) => setBotPersonality(e.target.value)}
                      placeholder="Temperament, values, quirks, emotional tone..."
                      className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      rows={4}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">Backstory</label>
                    <textarea
                      value={botBackstory}
                      onChange={(e) => setBotBackstory(e.target.value)}
                      placeholder="Key events, origin, history, and lived experiences..."
                      className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">Goals / Motivations</label>
                    <textarea
                      value={botGoals}
                      onChange={(e) => setBotGoals(e.target.value)}
                      placeholder="What this character wants and what drives them..."
                      className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Gender</label>
                      <select
                        value={botGender}
                        onChange={(e) => setBotGender(e.target.value)}
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                      >
                        <option value="">Select gender...</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Non-binary">Non-binary</option>
                        <option value="Genderfluid">Genderfluid</option>
                        <option value="Agender">Agender</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                        Age <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        min={18}
                        value={botAge}
                        onChange={(e) => setBotAge(e.target.value)}
                        placeholder="Must be 18 or older"
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Characters must be 18 or older.</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">Rules / Boundaries</label>
                    <textarea
                      value={botRules}
                      onChange={(e) => setBotRules(e.target.value)}
                      placeholder="Hard constraints, off-limits topics, or strict behavior rules..."
                      className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">Speaking Style</label>
                    <textarea
                      value={botStyle}
                      onChange={(e) => setBotStyle(e.target.value)}
                      placeholder="Formal, poetic, sarcastic, short answers..."
                      className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      rows={3}
                    />
                  </div>
                </>
              )}

              {botUniverse === "TTRPG" && botTtrpgRole === "PC" && (
                <>
                  <div>
                    <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wide">1. Identity & Narrative</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                        Class/Archetype <span className="text-red-400">*</span>
                      </label>
                      <input
                        value={botPcClassArchetype}
                        onChange={(e) => setBotPcClassArchetype(e.target.value)}
                        placeholder="Fighter, Rogue, Bard..."
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                        Ancestry/Species <span className="text-red-400">*</span>
                      </label>
                      <input
                        value={botPcAncestrySpecies}
                        onChange={(e) => setBotPcAncestrySpecies(e.target.value)}
                        placeholder="Elf, Human, Tiefling..."
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                        Level/Rank <span className="text-red-400">*</span>
                      </label>
                      <input
                        value={botPcLevelRank}
                        onChange={(e) => setBotPcLevelRank(e.target.value)}
                        placeholder="Level 5, Rank II..."
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Background/Trope</label>
                      <input
                        value={botPcBackgroundTrope}
                        onChange={(e) => setBotPcBackgroundTrope(e.target.value)}
                        placeholder="Mercenary, noble exile, chosen one..."
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wide">2. Core Statistics</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Modifiers</label>
                      <textarea
                        value={botPcModifiers}
                        onChange={(e) => setBotPcModifiers(e.target.value)}
                        placeholder="STR +3, DEX +2, etc."
                        rows={3}
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Skills</label>
                      <textarea
                        value={botPcSkills}
                        onChange={(e) => setBotPcSkills(e.target.value)}
                        placeholder="Stealth, Arcana, Athletics..."
                        rows={3}
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wide">3. Vitality & Resource Tracking</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Hit Points (HP) / Health</label>
                      <input
                        value={botPcHpHealth}
                        onChange={(e) => setBotPcHpHealth(e.target.value)}
                        placeholder="Current / Max"
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Armor Class (AC) / Defense</label>
                      <input
                        value={botPcAcDefense}
                        onChange={(e) => setBotPcAcDefense(e.target.value)}
                        placeholder="AC 16, Defense 12..."
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Speed</label>
                      <input
                        value={botPcSpeed}
                        onChange={(e) => setBotPcSpeed(e.target.value)}
                        placeholder="30 ft, 6 tiles..."
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Resource Pools</label>
                      <input
                        value={botPcResourcePools}
                        onChange={(e) => setBotPcResourcePools(e.target.value)}
                        placeholder="Mana, stamina, ki, spell slots..."
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wide">4. Capabilities & Equipment</h3>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">Weapons/Attacks</label>
                    <textarea
                      value={botPcWeaponsAttacks}
                      onChange={(e) => setBotPcWeaponsAttacks(e.target.value)}
                      placeholder="Primary attacks, hit bonuses, damage profiles..."
                      rows={3}
                      className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">Features/Talents/Feats</label>
                    <textarea
                      value={botPcFeaturesTalentsFeats}
                      onChange={(e) => setBotPcFeaturesTalentsFeats(e.target.value)}
                      placeholder="Passive and active character features..."
                      rows={3}
                      className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">Inventory/Equipment</label>
                    <textarea
                      value={botPcInventoryEquipment}
                      onChange={(e) => setBotPcInventoryEquipment(e.target.value)}
                      placeholder="Armor, tools, consumables, magic items..."
                      rows={3}
                      className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Weight/Encumbrance</label>
                      <input
                        value={botPcWeightEncumbrance}
                        onChange={(e) => setBotPcWeightEncumbrance(e.target.value)}
                        placeholder="Current load / max load"
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Spells/Abilities</label>
                      <input
                        value={botPcSpellsAbilities}
                        onChange={(e) => setBotPcSpellsAbilities(e.target.value)}
                        placeholder="Known spells, powers, cooldowns..."
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </div>
                </>
              )}

              {botUniverse === "TTRPG" && botTtrpgRole === "DM" && (
                <>
                  <div>
                    <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wide">1. World Seed (Core Lore)</h3>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                      Setting Summary <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={botDmSettingSummary}
                      onChange={(e) => setBotDmSettingSummary(e.target.value)}
                      placeholder='High-fantasy western where magic is fueled by silver.'
                      rows={3}
                      className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                        Current Location <span className="text-red-400">*</span>
                      </label>
                      <input
                        value={botDmCurrentLocation}
                        onChange={(e) => setBotDmCurrentLocation(e.target.value)}
                        placeholder="The Mossy Grotto"
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Active Factions</label>
                      <input
                        value={botDmActiveFactions}
                        onChange={(e) => setBotDmActiveFactions(e.target.value)}
                        placeholder="The Rose Knights, The Blight-Seekers"
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Tone: Grittiness (1-10)</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={botDmToneGrittiness}
                        onChange={(e) => setBotDmToneGrittiness(e.target.value)}
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Tone: Humor (1-10)</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={botDmToneHumor}
                        onChange={(e) => setBotDmToneHumor(e.target.value)}
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Tone: Magic Level (1-10)</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={botDmToneMagicLevel}
                        onChange={(e) => setBotDmToneMagicLevel(e.target.value)}
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wide">2. Campaign Log (Short-Term Memory)</h3>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">Last Session Recap</label>
                    <textarea
                      value={botDmLastSessionRecap}
                      onChange={(e) => setBotDmLastSessionRecap(e.target.value)}
                      placeholder="Three-sentence recap of recent events..."
                      rows={3}
                      className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Outstanding Hooks</label>
                      <textarea
                        value={botDmOutstandingHooks}
                        onChange={(e) => setBotDmOutstandingHooks(e.target.value)}
                        rows={3}
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Key PC Decisions</label>
                      <textarea
                        value={botDmKeyPcDecisions}
                        onChange={(e) => setBotDmKeyPcDecisions(e.target.value)}
                        rows={3}
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wide">3. Toolbox (Mechanical Logic)</h3>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                      System Ruleset <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={botDmSystemRuleset}
                      onChange={(e) => setBotDmSystemRuleset(e.target.value)}
                      placeholder="D&D 5e, Pathfinder 2e, custom rules-lite..."
                      className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">DC (Difficulty Class) Table</label>
                      <textarea
                        value={botDmDcTable}
                        onChange={(e) => setBotDmDcTable(e.target.value)}
                        placeholder="Easy 10, Moderate 15, Hard 20..."
                        rows={3}
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Random Encounter Tables</label>
                      <textarea
                        value={botDmRandomEncounters}
                        onChange={(e) => setBotDmRandomEncounters(e.target.value)}
                        rows={3}
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wide">4. Behavioral Directives</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Adjudication Style</label>
                      <select
                        value={botDmAdjudicationStyle}
                        onChange={(e) => setBotDmAdjudicationStyle(e.target.value)}
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                      >
                        <option value="Rules Lawyer">Rules Lawyer</option>
                        <option value="Rule of Cool">Rule of Cool</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Description Density</label>
                      <select
                        value={botDmDescriptionDensity}
                        onChange={(e) => setBotDmDescriptionDensity(e.target.value)}
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                      >
                        <option value="Purple Prose">Purple Prose</option>
                        <option value="Balanced">Balanced</option>
                        <option value="Snappy Action">Snappy Action</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">Pacing Controller</label>
                    <textarea
                      value={botDmPacingController}
                      onChange={(e) => setBotDmPacingController(e.target.value)}
                      rows={3}
                      className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                    />
                  </div>
                </>
              )}

              {botUniverse === "TTRPG" && botTtrpgRole === "Encounter" && (
                <>
                  <div>
                    <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wide">1. Bestiary Entry (Specimen Card)</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                        Creature Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        value={botEncounterCreatureName}
                        onChange={(e) => setBotEncounterCreatureName(e.target.value)}
                        placeholder='The "ID" the AI uses to pull data'
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                        Danger Level / CR <span className="text-red-400">*</span>
                      </label>
                      <input
                        value={botEncounterDangerLevelCr}
                        onChange={(e) => setBotEncounterDangerLevelCr(e.target.value)}
                        placeholder="1-20+"
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Combat Role</label>
                      <select
                        value={botEncounterCombatRole}
                        onChange={(e) => setBotEncounterCombatRole(e.target.value)}
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                      >
                        <option value="Tank">Tank</option>
                        <option value="Glass Cannon">Glass Cannon</option>
                        <option value="Controller">Controller</option>
                        <option value="Sniper">Sniper</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Harvestable Loot</label>
                      <input
                        value={botEncounterHarvestableLoot}
                        onChange={(e) => setBotEncounterHarvestableLoot(e.target.value)}
                        placeholder="What players get if they win"
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">Abilities / Actions</label>
                    <textarea
                      value={botEncounterAbilitiesActions}
                      onChange={(e) => setBotEncounterAbilitiesActions(e.target.value)}
                      placeholder="Bite, Fire Breath, grapple, venom spit..."
                      rows={3}
                      className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                      Tactics / AI Logic <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={botEncounterTacticsAiLogic}
                      onChange={(e) => setBotEncounterTacticsAiLogic(e.target.value)}
                      placeholder='"Targets the weakest player first"'
                      rows={3}
                      className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      required
                    />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wide">2. Encounter Builder (Environment Card)</h3>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">Atmosphere</label>
                    <textarea
                      value={botEncounterAtmosphere}
                      onChange={(e) => setBotEncounterAtmosphere(e.target.value)}
                      placeholder="Smell of ozone, dripping water, eerie spores..."
                      rows={2}
                      className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Terrain Hazards</label>
                      <textarea
                        value={botEncounterTerrainHazards}
                        onChange={(e) => setBotEncounterTerrainHazards(e.target.value)}
                        placeholder="Slippery moss: DC 12 Dex save or fall prone"
                        rows={3}
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Lighting/Visibility</label>
                      <textarea
                        value={botEncounterLightingVisibility}
                        onChange={(e) => setBotEncounterLightingVisibility(e.target.value)}
                        placeholder="Darkness, fog, flickering torchlight..."
                        rows={3}
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wide">3. Win/Loss Triggers</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Morale Break</label>
                      <textarea
                        value={botEncounterMoraleBreak}
                        onChange={(e) => setBotEncounterMoraleBreak(e.target.value)}
                        placeholder="Flees below 25% HP"
                        rows={3}
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Objective</label>
                      <textarea
                        value={botEncounterObjective}
                        onChange={(e) => setBotEncounterObjective(e.target.value)}
                        placeholder="Ends if players close portal"
                        rows={3}
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Escalation</label>
                      <textarea
                        value={botEncounterEscalation}
                        onChange={(e) => setBotEncounterEscalation(e.target.value)}
                        placeholder="Turn 3: more vines from ceiling"
                        rows={3}
                        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Visibility</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBotPublishNow(true)}
                    className={`text-left rounded-xl border px-4 py-3 transition ${
                      botPublishNow
                        ? "border-purple-500 bg-purple-500/10 text-white"
                        : "border-gray-700 bg-gray-950 text-gray-300 hover:border-gray-500"
                    }`}
                  >
                    <div className="font-semibold">Public</div>
                    <div className="text-xs text-gray-400">Shows in Explore right after creation.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBotPublishNow(false)}
                    className={`text-left rounded-xl border px-4 py-3 transition ${
                      !botPublishNow
                        ? "border-purple-500 bg-purple-500/10 text-white"
                        : "border-gray-700 bg-gray-950 text-gray-300 hover:border-gray-500"
                    }`}
                  >
                    <div className="font-semibold">Private (My Bots)</div>
                    <div className="text-xs text-gray-400">Visible to you and eligible group members only.</div>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 disabled:opacity-60 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Bot"
                )}
              </button>

              {lastCreatedBotId && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {lastCreatedBotPublished ? (
                    <button
                      type="button"
                      onClick={() => router.push("/explore")}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 text-gray-200 rounded-xl hover:bg-gray-800 transition text-sm font-semibold"
                    >
                      View in Explore
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => router.push("/my-bots")}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 text-gray-200 rounded-xl hover:bg-gray-800 transition text-sm font-semibold sm:col-span-2"
                    >
                      Manage Drafts
                    </button>
                  )}
                  {lastCreatedBotPublished && (
                    <button
                      type="button"
                      onClick={() => router.push("/my-bots")}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 text-gray-200 rounded-xl hover:bg-gray-800 transition text-sm font-semibold"
                    >
                      Open Draft Manager
                    </button>
                  )}
                </div>
              )}
            </div>
            </form>
          </>
        ) : mode === "persona" ? (
          <form
            onSubmit={handleCreatePersona}
            className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-5 sm:p-8 shadow-xl backdrop-blur-sm space-y-7"
          >
            <div className="flex flex-col items-center gap-6 pb-6 border-b border-gray-700/50">
              <div className="relative group">
                {personaAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={personaAvatarUrl}
                    alt="persona avatar"
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-blue-500/30 group-hover:border-blue-500 transition-all shadow-lg shadow-blue-500/10"
                  />
                ) : (
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gray-950 border-4 border-dashed border-gray-700 flex items-center justify-center text-2xl text-gray-500 group-hover:border-blue-500 transition-all">
                    P
                  </div>
                )}
              </div>
              <div className="w-full max-w-xs text-center">
                <label className="block text-sm font-medium text-gray-400 mb-2">Persona Avatar</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleSelectImage(e, "persona")}
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600/10 file:text-blue-400 hover:file:bg-blue-600/20 cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                  Persona Name <span className="text-red-400">*</span>
                </label>
                <input
                  value={personaName}
                  onChange={(e) => setPersonaName(e.target.value)}
                  placeholder="e.g. The Scarlet Diplomat"
                  maxLength={60}
                  className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">{personaName.length}/60 characters</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Gender / Pronouns</label>
                <select
                  value={personaGender}
                  onChange={(e) => { setPersonaGender(e.target.value); if (e.target.value !== "custom") setPersonaCustomGender("") }}
                  className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                >
                  <option value="">— Select —</option>
                  <option value="male">Male (he/him)</option>
                  <option value="female">Female (she/her)</option>
                  <option value="non-binary">Non-binary (they/them)</option>
                  <option value="gender-fluid">Gender fluid (any/all pronouns)</option>
                  <option value="custom">Custom...</option>
                </select>
                {personaGender === "custom" && (
                  <input
                    value={personaCustomGender}
                    onChange={(e) => setPersonaCustomGender(e.target.value)}
                    placeholder="e.g. she/they, xe/xem, it/its..."
                    className="w-full mt-2 p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                  Persona Overview <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={personaDescription}
                  onChange={(e) => setPersonaDescription(e.target.value)}
                  placeholder="How do you want this persona to appear in conversations?"
                  className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Appearance</label>
                <textarea
                  value={personaAppearance}
                  onChange={(e) => setPersonaAppearance(e.target.value)}
                  placeholder="Physical description: hair, eyes, build, clothing style, distinguishing features..."
                  className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Backstory</label>
                  <textarea
                    value={personaBackstory}
                    onChange={(e) => setPersonaBackstory(e.target.value)}
                    placeholder="Origin, status, or personal history..."
                    className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Goals / Motives</label>
                  <textarea
                    value={personaGoals}
                    onChange={(e) => setPersonaGoals(e.target.value)}
                    placeholder="What this persona usually wants in roleplay..."
                    className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-60 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Persona"
                )}
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={handleCreateTtrpgPersona}
            className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-5 sm:p-8 shadow-xl backdrop-blur-sm space-y-7"
          >
            <div className="flex flex-col items-center gap-6 pb-6 border-b border-gray-700/50">
              <div className="relative group">
                {personaAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={personaAvatarUrl}
                    alt="ttrpg persona avatar"
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-emerald-500/30 group-hover:border-emerald-500 transition-all shadow-lg shadow-emerald-500/10"
                  />
                ) : (
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gray-950 border-4 border-dashed border-gray-700 flex items-center justify-center text-2xl text-gray-500 group-hover:border-emerald-500 transition-all">
                    T
                  </div>
                )}
              </div>
              <div className="w-full max-w-xs text-center">
                <label className="block text-sm font-medium text-gray-400 mb-2">TTRPG Avatar</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleSelectImage(e, "persona")}
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-600/10 file:text-emerald-400 hover:file:bg-emerald-600/20 cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-wide">1. Identity & Narrative</h3>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  value={ttrpgName}
                  onChange={(e) => setTtrpgName(e.target.value)}
                  placeholder="Character name"
                  className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                    Class/Archetype <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={ttrpgClassArchetype}
                    onChange={(e) => setTtrpgClassArchetype(e.target.value)}
                    placeholder="Fighter, Rogue, Bard..."
                    className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                    Ancestry/Species <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={ttrpgAncestrySpecies}
                    onChange={(e) => setTtrpgAncestrySpecies(e.target.value)}
                    placeholder="Elf, Human, Tiefling..."
                    className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                    Level/Rank <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={ttrpgLevelRank}
                    onChange={(e) => setTtrpgLevelRank(e.target.value)}
                    placeholder="Level 5, Rank II..."
                    className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Background/Trope</label>
                  <input
                    value={ttrpgBackgroundTrope}
                    onChange={(e) => setTtrpgBackgroundTrope(e.target.value)}
                    placeholder="Mercenary, noble exile, chosen one..."
                    className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-wide">2. Core Statistics</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Modifiers</label>
                  <textarea
                    value={ttrpgModifiers}
                    onChange={(e) => setTtrpgModifiers(e.target.value)}
                    placeholder="STR +3, DEX +2, etc."
                    rows={3}
                    className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Skills</label>
                  <textarea
                    value={ttrpgSkills}
                    onChange={(e) => setTtrpgSkills(e.target.value)}
                    placeholder="Stealth, Arcana, Athletics..."
                    rows={3}
                    className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-wide">3. Vitality & Resource Tracking</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Hit Points (HP) / Health</label>
                  <input
                    value={ttrpgHpHealth}
                    onChange={(e) => setTtrpgHpHealth(e.target.value)}
                    placeholder="Current / Max"
                    className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Armor Class (AC) / Defense</label>
                  <input
                    value={ttrpgAcDefense}
                    onChange={(e) => setTtrpgAcDefense(e.target.value)}
                    placeholder="AC 16, Defense 12..."
                    className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Speed</label>
                  <input
                    value={ttrpgSpeed}
                    onChange={(e) => setTtrpgSpeed(e.target.value)}
                    placeholder="30 ft, 6 tiles..."
                    className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Resource Pools</label>
                  <input
                    value={ttrpgResourcePools}
                    onChange={(e) => setTtrpgResourcePools(e.target.value)}
                    placeholder="Mana, stamina, ki, spell slots..."
                    className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-wide">4. Capabilities & Equipment</h3>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Weapons/Attacks</label>
                <textarea
                  value={ttrpgWeaponsAttacks}
                  onChange={(e) => setTtrpgWeaponsAttacks(e.target.value)}
                  placeholder="Primary attacks, hit bonuses, damage profiles..."
                  rows={3}
                  className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Features/Talents/Feats</label>
                <textarea
                  value={ttrpgFeaturesTalentsFeats}
                  onChange={(e) => setTtrpgFeaturesTalentsFeats(e.target.value)}
                  placeholder="Passive and active character features..."
                  rows={3}
                  className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Inventory/Equipment</label>
                <textarea
                  value={ttrpgInventoryEquipment}
                  onChange={(e) => setTtrpgInventoryEquipment(e.target.value)}
                  placeholder="Armor, tools, consumables, magic items..."
                  rows={3}
                  className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Weight/Encumbrance</label>
                  <input
                    value={ttrpgWeightEncumbrance}
                    onChange={(e) => setTtrpgWeightEncumbrance(e.target.value)}
                    placeholder="Current load / max load"
                    className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Spells/Abilities</label>
                  <input
                    value={ttrpgSpellsAbilities}
                    onChange={(e) => setTtrpgSpellsAbilities(e.target.value)}
                    placeholder="Known spells, powers, cooldowns..."
                    className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-60 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create TTRPG Persona"
                )}
              </button>
            </div>
          </form>
        )}

        {cropSourceImage && cropTarget && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl p-5 sm:p-6 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white">Crop Avatar</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Position and zoom your {cropTarget === "bot" ? "bot" : "persona"} avatar.
                </p>
              </div>

              <div className="relative w-full h-72 bg-gray-950 rounded-xl overflow-hidden border border-gray-700">
                <Cropper
                  image={cropSourceImage}
                  crop={crop}
                  zoom={zoom}
                  rotation={0}
                  aspect={1}
                  minZoom={1}
                  maxZoom={3}
                  cropShape="round"
                  showGrid={false}
                  zoomSpeed={1}
                  restrictPosition={true}
                  style={{}}
                  classes={{}}
                  mediaProps={{}}
                  cropperProps={{}}
                  keyboardStep={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Zoom</label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeCropper}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 bg-gray-950 text-gray-300 hover:bg-gray-800 transition disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyCroppedImage}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-500 transition disabled:opacity-60"
                >
                  {loading ? "Saving..." : "Use Crop"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}