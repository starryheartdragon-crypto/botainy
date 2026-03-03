# Beta Launch Checklist

Use this checklist before opening beta access.

## 1) Build & Code Quality

- [ ] `npm run lint -- --max-warnings=0` passes
- [ ] `npm run build` passes
- [ ] `npm run smoke` passes with valid `SMOKE_*` env vars
- [ ] No unresolved critical errors in browser console for core flows

## 2) Environment & Secrets

- [ ] Production env vars are configured:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `OPENROUTER_API_KEY`
  - [ ] `NEXT_PUBLIC_APP_URL`
- [ ] No secrets are exposed in client-side logs or responses
- [ ] API keys are rotated if previously shared in insecure channels

## 3) Database & Supabase

- [ ] All required migrations are applied in the beta database
- [ ] RLS policies are enabled for sensitive tables
- [ ] Storage buckets required by app exist and permissions are correct
- [ ] Admin account has `is_admin = true` in `users`

## 4) Security & Abuse Protection

- [ ] Middleware auth protection active for sensitive API paths
- [ ] OpenRouter endpoint requires auth token
- [ ] Rate limits active on AI/upload endpoints
- [ ] Verify 401 for unauthenticated requests to protected APIs
- [ ] Verify 429 behavior under repeated request bursts

## 5) Product Flows (Manual QA)

- [ ] Sign up (18+ birthday validation) and sign in work end-to-end
- [ ] Bot creation/edit/publish flow works
- [ ] One-on-one chat works (send + AI response)
- [ ] Chat rooms join/send/read works
- [ ] Group chats join/send/read works
- [ ] Personas create/select/use works
- [ ] Profile + music upload/settings work
- [ ] Admin panel critical actions function correctly

## 6) Policy & Compliance

- [ ] Terms page available at `/terms`
- [ ] Privacy page available at `/privacy`
- [ ] Terms/Privacy links visible in auth flows
- [ ] 18+ content warning visible and accurate

## 7) Monitoring & Ops

- [ ] Error logging destination confirmed (server + client)
- [ ] Basic alerting/notification path defined for severe incidents
- [ ] Rollback plan documented (env rollback + deployment rollback)
- [ ] Ownership assigned for beta support window

## 8) Beta Go/No-Go

- [ ] Known issues documented and triaged
- [ ] Blocking issues = 0
- [ ] Team sign-off complete (engineering + moderation/admin)
- [ ] Beta invite message and support instructions prepared

---

## Quick Commands

```bash
npm run lint -- --max-warnings=0
npm run build
npm run smoke
```
