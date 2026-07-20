# cosmos — Feature Backlog

Running list of ideas. Drop new ones under **Ideas**; move to **In progress** when building, **Done** when shipped.
Keep entries short — a line or two. Details get fleshed out at build time.

---

## Done

- **My Day home view** — unified timeline (default landing tab) merging a daily routine, today's to-dos, and work priorities. Routine builder (title, time, daily/weekday recurrence) with per-day completion; missed-and-undone routines drop off the home view and get reconciled in the Routine manager. Neon-backed (works on phone).
- **Work module** — team priority tracker: line items with P1–P4 priority, deadlines, team assignees (add-inline, dedup), labels, My Work / Team views, deadline agenda layout. Neon-backed (works on phone).
- **Finance module** — CSV/Excel statement import, per-issuer column mapping memory, category/subcategory tagging, local AI auto-categorization (Ollama), spend dashboard. Mac-local only (SQLite).
- **AI Assistant tab** — Open WebUI embedded in-app, voice mode (Kitten TTS + local Whisper), answers questions over live task/finance/gym data. Mac-local only.
- **Push notifications** — real Web Push for task reminders that fire when the app is closed (needs Vercel env vars + GitHub Actions secret set to go fully live).
- **Password manager** — zero-knowledge vault (🔒 header icon). Master password → client-side PBKDF2 + AES-GCM; server (Neon) only stores ciphertext, never the key or plaintext. Reveal/copy, strong-password generator. Works on phone.
- **Personal diary** — private journal (📖 header icon → full-screen glass overlay). One entry per calendar day, auto-saving as you write, optional mood emoji, ‹ › day navigation, searchable browse panel of past days. Neon-backed (works on phone). Future option: encrypt bodies with the vault crypto if desired.
- **File storage module** — Google-Drive-backed file manager (📁 header icon → full-screen glass overlay). Real `cosmos` folder in your own Drive via `drive.file` scope (cosmos only sees files it creates). Upload / download / create folders / rename / delete (→ Drive trash) / breadcrumb navigation / name search. Works on phone. Note: uses ~4.5MB Vercel request-body limit for uploads on the deployed side (no limit locally); large-file resumable upload is a future upgrade.

## In progress

_(nothing right now)_

## Ideas

_(nothing right now — drop new ideas here)_

---

_How this works: shout an idea in chat, it lands here. Later, say "build X from the list" and it gets picked up one at a time._
