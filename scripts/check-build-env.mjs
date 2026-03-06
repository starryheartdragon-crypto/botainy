import fs from "node:fs"
import path from "node:path"

const requiredPublic = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
]

function loadEnvFile(fileName) {
  const envPath = path.join(process.cwd(), fileName)
  if (!fs.existsSync(envPath)) return

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue

    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    const existing = process.env[key]
    if (!existing || !String(existing).trim()) {
      process.env[key] = value
    }
  }
}

loadEnvFile(".env.local")
loadEnvFile(".env")
loadEnvFile(".env.production")

const missing = requiredPublic.filter((name) => {
  const value = process.env[name]
  return !value || !String(value).trim()
})

if (missing.length > 0) {
  console.error("[build-env-check] Missing required build-time env vars:")
  for (const name of missing) {
    console.error(`- ${name}`)
  }
  console.error(
    "[build-env-check] Configure these in Cloudflare for BOTH Production and Preview, then redeploy.",
  )
  process.exit(1)
}

console.log("[build-env-check] NEXT_PUBLIC Supabase build vars are present.")
