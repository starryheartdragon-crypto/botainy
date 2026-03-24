// Empty shim — used to exclude @vercel/og (ImageResponse + WASM files)
// from the Cloudflare Worker bundle. This project does not use OG image
// generation, so the ~2.2 MiB of resvg/yoga WASM is unnecessary.
export default {};
