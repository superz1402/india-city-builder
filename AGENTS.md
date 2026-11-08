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

## 7. Definition of done

- [ ] Health check green locally (`node --check` every module).
- [ ] Real browser pass: boot → build → economy tick → save/load, at desktop
      **and** mobile viewport, zero console errors.
- [ ] Screenshots attached for UI changes.
- [ ] Issue closed with evidence; `worklog.md` updated.
- [ ] Everything pushed to `origin/main`.

## 8. Roadmap ideas (claim via issue before building)

Walk mode (street-level camera like the original's), camera rotation, building
upgrade levels, policies (tax slider, night curfew), train station + tracks,
save export codes, Hindi-first i18n toggle, PWA offline mode.
