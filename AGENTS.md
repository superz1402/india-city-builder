# AGENTS.md — operating manual for AI agents working on this repo

Read this file fully before writing any code. It exists because the dev
environment is **session-sensitive**: the machine you are running on can be
wiped or recycled at any moment. Git is the only source of truth.

---

## 0. The one non-negotiable rule

**Commit and push at every session close. Don't trust the server — it will be
wiped.** When a task is completed: test it, commit it, push it, then update
`worklog.md` in the same push. A session that ends without pushing is a failed
session, even if the code worked.

- Small, semantic commits (`feat:`, `fix:`, `docs:`, `chore:`).
- Never force-push `main`. Never commit secrets, tokens or keys — if one
  appears in chat or a file, say so and tell the owner to rotate it.
- `health.yml` rejects pushes that contain token-like strings (`ghp_…`).

## 1. Session recovery protocol (first 5 minutes of any new session)

1. `git pull` — re-establish the codebase.
2. Read `worklog.md` — last entries tell you exactly where things stopped.
3. `gh issue list --state open` (or the GitHub API) — the open issues ARE the
   todo list. Pick the highest-priority one.
4. Run the local health check:
   `for f in js/*.js; do node --input-type=module --check < "$f"; done`
5. Serve the folder (`python3 -m http.server 8080`), open it in a browser,
   confirm the game boots before changing anything.
6. Continue. Do not rebuild what already exists.

## 2. Issue-driven workflow

Every unit of work = one GitHub issue, even when the agent could "just do it".

1. **Create the issue first** — title as the deliverable, body with acceptance
   criteria. Label it (`enhancement`, `bug`, `documentation`).
2. **Build it.**
3. **Verify it** — run the health check, exercise the real flow in a browser,
   screenshot UI changes (before/after).
4. **Close it** with a comment that shows the evidence (what changed, how it
   was verified). Reference the issue in the commit message (`Closes #N`).
5. **Update `worklog.md`** in the same push.

This keeps the board truthful across session restarts: anyone (human or
agent) can reconstruct project state from issues + worklog alone.

## 3. Auto-health system

- `.github/workflows/health.yml` runs on every push: syntax-checks every
  `js/*.js` module, verifies required files exist, and greps for
  token-like secrets. Keep it green; a red `main` blocks every future session.
- After any code change, run the same check locally before committing.
- If the runtime dies mid-session (tool calls start failing), do not panic:
  everything already pushed is safe. On the next session, the recovery
  protocol (§1) rebuilds local state from git — that is the restart-safety
  mechanism. There is deliberately nothing to "restart": progress lives in
  git, not in the sandbox.

## 4. UI laws (from agent-ui-playbook — mandatory for this game)

1. Tokens only: components use `var(--…)`, never raw hex. Dark chrome is a
   second token column.
2. Color never carries meaning alone — status = color + text label.
3. Every async/error surface states what happened, why, and the next action.
   Dead-end errors are bugs (see `bootError` in `main.js`).
4. Tabular numerals on anything countable (`tnum`).
5. Touch targets ≥ 44 px on mobile; visible focus rings; keyboard paths.
6. No emoji as UI icons — the inline SVG symbol set in `index.html`.
7. One loud thing per screen (the festival banner; everything else whispers).
8. Motion pays rent — animations must show what changed.
9. Screenshot before and after every UI change. A UI change without a
   before/after didn't happen.
10. The canvas is content, not chrome — the world can be colorful; the HUD
    stays disciplined.

## 5. Code map & conventions

See the architecture tree in `README.md`. Conventions:

- ES modules, no build step, no runtime dependencies. If a feature cannot be
  done dependency-free, argue it in the issue before adding a library.
- Game state lives in `state.js` (`S`); modules read it, `sim.js` advances it.
  UI never mutates state directly except through `place/removeAt`.
- All art is procedural canvas in `arts.js`. New building = new `case` in
  `drawBuilding` + def in `data.js` + thumbnail automatically works.
- Save format changes bump `S.v` and add a migration in `save.js`.

## 6. Learning sources for agents (UI is the weak point — study these)

- The owner's UI standard: [superz1402/agent-ui-playbook](https://github.com/superz1402/agent-ui-playbook)
- The owner's isometric game: [Bilal140202/emberwake](https://github.com/Bilal140202/emberwake)
  (versioned saves, mobile-first HUD, Pages deploy pattern)
- Owner profiles to analyze before UI work: `bilal140202`, `ansaribilal14`,
  `superz1402` — especially HTML/CSS/landing repos (`design-showcase`,
  `ahyeon-vision-v2`, `clinic-demos`, `agent-ui-playbook`).
- Owner-referenced toolkits for future work: `elvarofficial/teardown`
  (3D simulation skill), `morluto/rea` + `morluto/awesome-reverse-engineering`
  (reverse-engineering agent pipelines), `JuneYaooo/rea-video`
  (shot-by-shot video reverse engineering), `midrender/revideo`
  (videos with code). Not needed for v1; listed so future sessions know the
  intended toolkit.
- `lucas-martinic/polyfork-catalog` (owner directive, v2): 2,700+ low-poly
  three.js assets organised as themed kits with a generated `catalog.json`.
  **Adopted:** the content-catalog pattern — `scripts/catalog.mjs` generates
  `catalog.json` (buildings, residents, deeds, festivals, tiers) from the
  code-side registries so tools/owners consume the city without parsing JS.
  **Adopted (v3):** the polyfork SCHEMA and the parametric-knob idea —
  `catalog.json` v3 uses `site/licence/api/kits[]/assets[]`; `KNOBS`
  (js/data.js) gives 14 buildings named options resolved deterministically
  from the plot seed ("a model is a program"); `place(x,y,key,{knobs})`
  pins one per tile and persists in save v2; `llms.txt` is the agent-facing
  API doc.
  **Kit discipline:** new buildings/residents must stay coherent with the
  existing palette/scale/seed-variant system (see data.js + arts.js).
- **buildacountry (the play-pattern reference, cloned & read line-by-line):**
  `buildacountry/buildacountry.github.io` — the whole game is one ~472 KB
  `index.html`. The one-person view (WALK state, collision grid, camera,
  joystick, emotes, HUD copy) is documented with numbers in
  `docs/WALK-REFERENCE.md`. Read it BEFORE touching walk.js / ui.js walk
  parts; keep behaviour and copy in parity with it.

## 7. Definition of done

- [ ] Health check green locally (`node --check` every module).
- [ ] Real browser pass: boot → build → economy tick → save/load, at desktop
      **and** mobile viewport, zero console errors.
- [ ] Screenshots attached for UI changes.
- [ ] Issue closed with evidence; `worklog.md` updated.
- [ ] Everything pushed to `origin/main`.
- [ ] Push VERIFIED: `git ls-remote --heads origin` shows your HEAD sha. A
      commit that only exists locally is not done.

## 9. Credentials & auto-health (v2 addendum — owner directive)

**Token handling (hard rules):**
- The GitHub token lives in exactly ONE place: the `origin` remote URL inside
  `.git/config` (`git remote set-url origin https://user:TOKEN@github.com/…`).
  `.git/config` is never committed. NEVER write it into any tracked file,
  script, doc, issue or worklog. NEVER echo it to chat output.
- If the owner pastes a token in chat (they will), configure it silently,
  confirm auth with a status-code check only, and remind them — once, briefly
  — to rotate it after the session since chat is not a secret store.
- `health.yml` greps pushes for token-like strings; keep it that way.

**Session-sensitivity & auto-health:**
- This sandbox is wiped without warning. Git is the only memory. Commit early,
  commit often — a clean working tree at every natural pause, not just at
  session end.
- A scheduled auto-health job (cron "Apna Shehar auto-health checkpoint",
  every 15 min) runs: `git pull` → syntax-check `js/*.js` → if green,
  commit any dirty files as `chore: auto-health checkpoint` and push; if a
  file is broken it does NOT commit (broken code never reaches main).
- The cron is a safety net, not a substitute for the §0 rule: session close
  still means test → commit → push → worklog.

**Task board discipline (owner directive):**
- Every unit of work = one GitHub issue, filed BEFORE the code (§2). Build →
  verify with screenshots → close with evidence in the same session.
- `worklog.md` is upgraded after EVERY task, same push, with what shipped,
  how it was verified, and the commit sha. An out-of-date worklog is a
  failed task.

**Learning mandate (UI is the weak point):**
- Before UI work, analyse the owner's repos in depth: `bilal140202`,
  `ansaribilal14`, `superz1402` (see §6). UI changes follow
  agent-ui-playbook laws (§4) without exception.

## 8. v2 product direction (owner directive, Nov 2025)

The play pattern is buildacountry.github.io: visitors WALK the city anytime
(avatar + joystick/controller), day-night follows REAL Indian Standard Time,
and residents own their homes and shops like a metaverse deed book. Building
and resident creation is code-side (data.js + owners.js) — the owner extends
the city by editing code, not by clicking. See `js/owners.js` header for the
owner's guide and `README.md` for the code-side building guide.

## 9. Roadmap ideas (claim via issue before building)

Building upgrade levels, policies (tax slider, night curfew), train station +
tracks, save export codes, Hindi-first i18n toggle, PWA offline mode,
auto-tour camera (reference-style).

## 10. Owner directives (Nov 2026 rehaul addendum)

1. **Fake humans are capped at FOUR, bracket-named.** `RESIDENTS` ships
   exactly `[NPC] Ramu / [NPC] Meera / [NPC] Arjun / [NPC] Zoya` — the `[NPC]`
   tag is part of the name so no visitor mistakes scripted people for real
   players. Do not add more residents unless the owner asks; if they do, keep
   the `[NPC]` prefix. (Deed-storage note: resident-name changes require
   bumping `DEEDS_KEY` in owners.js so stale localStorage deeds never ghost.)
2. **One-person view = the real buildacountry source, not a guess.** The
   reference repo is cloned and reverse-engineered ("use rea GitHub to clone
   how the one person view is used"); the distillation lives in
   `docs/WALK-REFERENCE.md` (state machine, numbers, HUD structure, copy).
   Match it when touching walk mode; record deviations with reasons.
3. **Tokens:** see §9 — remote URL only, rotate after chat exposure.
   The current token was pasted in chat on 2026-11-09 and must be rotated.

## 11. Mahanagar Edition (owner directive, Nov 2026 rehaul #2)

Owner asked (2026-11-09): "Add Indian style houses, bungalows, companies,
buildings and everything, build roads, cars, build a whole city. On the doors
when walking they can see which one is acquired which one is not. Rehaul the
UI/UX." Shipped as v3 (issue #20):

1. **The city is pre-built in code.** `generateCity()` in state.js lays out
   the 48×48 Mahanagar (avenues every 8 tiles, chowk plaza, river bridges,
   five district bands). Deed tiles for the four [NPC] residents are
   RESERVED constants (`CITY_DEED_TILES`); owners.js ASSIGNMENTS must quote
   exactly those tiles — `scripts/test-city.mjs` asserts the sync. Run it
   after touching layout or deeds.
2. **Door plates are a core mechanic, not garnish.** Every deed-able building
   renders an ACQUIRED nameplate (green, owner name) or TO-LET board (cream,
   red) at its door in walk mode (radius ~9.5 tiles from the player), and
   green/amber doorstep dots in plan mode. Keep this pairing when touching
   render.js or owners.js.
3. **UI is the "Mahanagar Metro" design system.** Dark glass chrome (never
   opaque white), Outfit font, marigold gradient CTA, floating HUD slab +
   build dock, bottom-sheet panels on phones. All element IDs from v2 are
   preserved — JS wiring depends on them.
4. Balance rule: the pre-built city must boot green (water/power/food cover
   its population). If you add companies (pw demand) or housing, size
   substations/water tanks in generateCity() and re-run the harness.
