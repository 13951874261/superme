# Context Snapshot: performance-bottlenecks

- **Task:** Analyze project performance bottlenecks; deliver surgical-modification solutions after interview.
- **Desired outcome:** Ranked root-cause bottlenecks + actionable surgical plan for chosen priority.
- **Stated solution:** Follow systematic-debugging → analyze → writing-plans → verification → deep-interview → surgical-modification.
- **Probable intent:** Reduce startup lag / interaction jank / API latency in super-agent.
- **Type:** brownfield
- **Prompt-safe initial-context summary status:** not_needed
- **Relevant docs inspected:** README.md (partial), DESIGN.md (listed), deployment notes, vite.config.ts, package.json
- **Likely touchpoints:** `src/App.tsx`, `src/components/MainContent.tsx`, `src/components/modules/EnglishModule.tsx`, `src/components/modules/english/context/EnglishContext.tsx`, `src/utils/difyChatbot.ts`, `vite.config.ts`, `vocab-server/server.js`
- **Unknowns:** Which user-visible symptom is primary (TTI vs tab switch vs oral latency vs TTS); whether prod or local-dev is the pain surface.
