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

## In progress

_(nothing right now)_

## Ideas

- **Important file storage module** — store & retrieve important documents.
  - Note: explore connecting to Google Drive via a Google Drive MCP (store/retrieve docs through Drive rather than hosting files ourselves).

---

_How this works: shout an idea in chat, it lands here. Later, say "build X from the list" and it gets picked up one at a time._
