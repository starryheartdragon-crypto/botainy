#!/usr/bin/env node
/**
 * Stubs out @vercel/og after `opennextjs-cloudflare build` but BEFORE the
 * wrangler upload, saving ~502 KiB from the Cloudflare Worker bundle.
 *
 * Why this is needed
 * ------------------
 * This project has no OG image routes.  Despite that, opennextjs marks
 * `@vercel/og/index.edge.js` as an esbuild "external".  Wrangler resolves
 * that import at upload time, pulling in the real 415 KiB index.edge.js and
 * its 86 KiB yoga.wasm dependency — pushing the worker over the free-tier
 * 3 MiB limit.
 *
 * By replacing index.edge.js with a tiny stub that does NOT import yoga.wasm,
 * Wrangler uploads only a negligible file instead of the 502 KiB pair.
 *
 * Run `npm install` to restore the original files after a local patch.
 */

import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

// Minimal ESM stub — same public API as the real @vercel/og but no yoga.wasm.
const STUB =
  "// Stub: @vercel/og is not used in this project.\n" +
  "// Created by scripts/patch-og.mjs to keep the worker under 3 MiB.\n" +
  "export function ImageResponse() {\n" +
  '  throw new Error("@vercel/og ImageResponse is not available in this deployment");\n' +
  "}\n" +
  "export default {};\n";

// Candidate locations.  opennextjs copies index.edge.js into .open-next when
// it detects OG usage (useOg=true).  When useOg=false the file stays in
// node_modules and Wrangler resolves it from there.
const candidates = [
  "node_modules/next/dist/compiled/@vercel/og/index.edge.js",
  ".open-next/server-functions/default/node_modules/next/dist/compiled/@vercel/og/index.edge.js",
];

let patched = 0;
for (const rel of candidates) {
  const target = resolve(rootDir, rel);
  if (existsSync(target)) {
    writeFileSync(target, STUB, "utf8");
    console.log("[patch-og] Stubbed: " + rel);
    patched++;
  }
}

if (patched === 0) {
  console.log("[patch-og] No @vercel/og/index.edge.js found — nothing to patch");
} else {
  console.log(
    "[patch-og] Done: stubbed " + patched + " file(s), saving ~502 KiB from worker bundle",
  );
}
