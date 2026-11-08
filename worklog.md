# worklog.md

Append-only. One entry per completed task, newest last. Every entry ends with
what was pushed and to which commit. Agents: read this first (see AGENTS.md §1).

---

## 2026-11-08 — v1.0 "Chhota Gaon" shipped by Z.ai agent session

**Research (before writing code)**
- Dissected the reference game `buildacountry/buildacountry.github.io` (472 KB
  single-file Three.js app): grid placement, drag-pan/wheel-zoom camera, day
  counter, citizens, night toggle, walk/auto-tour modes. Apna Shehar mirrors
  the camera + placement affordances in a dependency-free isometric engine.
- Studied owner's UI standard `agent-ui-playbook` (13 laws) and adopted it as
  this repo's UI law set; studied `emberwake` for versioned-save + Pages
  patterns; inventoried owner profiles (bilal140202, ansaribilal14,
  superz1402) for UI reference repos.
- Reviewed uploaded `faceless-shorts` skill zip: borrowed its QA discipline
  ("never ship a frame you haven't looked at") for screenshot-driven game QA.
  No video generation involved.
- Checked all owner-referenced repos (teardown, rea, rea-video, revideo,
  awesome-reverse-engineering) — all live; recorded in AGENTS.md §6 for
  future sessions; none needed for v1.

**Build (issues #1–#12 on the tracker)**
- Static scaffold: `index.html` + tokens-first `css/style.css`
  (sandalwood paper / ink / marigold saffron accent, dark chrome column).
- `iso.js`: 64×32 isometric projection, drag-pan, wheel/pinch zoom around
  cursor, tap detection, camera clamping.
- `arts.js`: procedural art kit — 35+ building draw functions (jhuggi →
  textile mill, four faith places, mela ferris wheel), 7 outfit families for
  pedestrians (saree, salwar, kurta, dhoti, lungi, turban, school), autos /
  buses / HORN OK PLEASE trucks / cycles / bullock carts, sacred cows.
- `render.js`: terrain + depth-sorted world pass, camera-transformed draws,
  screen-space night light pass, monsoon rain / winter fog / summer tint,
  festival FX (diyas, fireworks, lanterns, colour splashes, tricolor
  bunting), build ghost with validity tint.
- `sim.js`: daily tick — taxes × khush-hali, shop income (halved on load
  shedding), farm seasons, food/water/power balances, unemployment, festival
  boosts, unity bonus for 3+ faith kinds, growth/leaving, tier promotions.
- `agents.js`: road-graph random walkers, population-scaled spawns, cow jams.
- `events.js` + festival calendar (Diwali/Eid/Holi/Republic/Baisakhi every
  10 days), celebrate spending.
- `ui.js`: HUD, category build menu with canvas thumbnails and tier locks,
  notice feed, tile inspector with refund, Shehar Report panel, help, honest
  new-game confirm, welcome screen with continue.
- `audio.js`: WebAudio tabla loop + tanpura drone + SFX, gesture-gated.
- `save.js`: versioned localStorage save (v1), autosave 10 s + on hide.

**QA (screenshot-verified, per playbook rule)**
- Caught and fixed via browser pass: module import error (`MAP` sourced from
  wrong module), pre-boot agent crash (empty-grid guard), `[hidden]` vs
  `display:flex` CSS override, `setPointerCapture` on stale pointer ids,
  lights-in-world-space vs screen-space mismatch, zoom-scaling of building
  art via camera transforms.
- Verified flows: welcome → new game → tap-to-place (money debited, ghost
  valid/invalid + reason toasts) → pan/zoom → Shehar Report states → save →
  mobile 390×844 layout → Diwali-night render (docs/screenshot.png) and day
  render (docs/screenshot-day.png).

**Ops**
- Repo `superz1402/india-city-builder` created (public), issues #1–#12 filed
  as the task board and closed with evidence, GitHub Pages enabled,
  `health.yml` CI (syntax + files + secret guard) active.
- Pushed: full game, README with live screenshots, AGENTS.md operating
  manual (session persistence + issue workflow), this worklog, LICENSE (MIT).

## 2026-11-08 — ops addendum (same session, second push)

- Repo created and board filed: issues #1–#12; #1–#10 closed by the v1.0
  feature commit `dc614a2`; #11/#12 closed with evidence after ops landed.
- GitHub Pages enabled (main / root): first build succeeded (`built`,
  error: none). Live URL: https://superz1402.github.io/india-city-builder/
- Post-deploy browser verification on the LIVE URL: boot → Start → build
  menu tabs render, zero page errors (qa10-live.png in session log).
- health.yml triggered on push; keep it green (see AGENTS.md §3).

## 2026-11-08 — v2.0 "Wander Edition" complete rehaul (issues #13–#16)

**Owner directives driving this rehaul**
- "The day night should follow exactly same as time of current indian times."
- "The play should be like same as the url (buildacountry.github.io). It has
  walking buttons through controller etc too."
- "The building creation and everything will be code side… if I assign someone
  homes shops etc they will have that ownerships like metaverse."
- "Learn and adapt from lucas-martinic/polyfork-catalog."

**Reference study (browser, live)** — opened buildacountry.github.io, entered
its Walk mode and captured its model: third-person walker, "WASD or arrow keys
to walk, Shift to run. Drag to look around.", Exit walk, "Just you here" chip,
bottom-right emote buttons, and ownership ("Search your Instagram name to find
your home, or tap any house to see who lives there"). Every element is mirrored
in Apna Shehar with Indian identity.

**Build (4 new modules, 9 modules touched)**
- `js/clock.js` — REAL Indian Standard Time (UTC+05:30, no DST). Sky gradient,
  night overlay, street lamps, festival lights and citizen schedules all key
  off the actual IST hour; HUD shows a live IST clock. Old fake hourOfDay
  (7 am start, compressed day) removed from sim.js (re-export keeps imports).
- `js/walk.js` — walk mode: third-person avatar with collision + wall-slide,
  WASD/arrows/Shift, on-screen joystick vector → world dir via inverse camera
  yaw, RUN toggle, gamepad polling (stick/A/X/B), emotes (wave, namaste,
  diya, heart) that nearby residents answer, teleportTo for visits, camera
  follow with lerp. Named residents spawn at their deed anchors and wander.
- `js/owners.js` — the deed book: RESIDENTS (14 names) + ASSIGNMENTS
  (starter hamlet pre-deeded: Aarav Sharma 17,18 · Meera Sharma 19,18 ·
  Chacha Ramu 18,17). Deeds attach to tiles (survive rebuilds; vacant marker
  on bulldoze). In-game assign/vacate persists to localStorage; code always
  wins. statusOf() drives schedules from the IST clock.
- `js/iso.js` — camera yaw (cam.rot) with rotation-aware worldToScreen /
  screenToWorld / screenToTile; drag = look-around in walk mode; per-mode
  zoom clamps (plan 0.45–2.4, walk 1.5–3.4); rotate buttons step ±45°.
- `js/render.js` — painter sort switched from (x+y) to rotated screen-y
  (correct depth at any orbit angle); player + residents drawn with name
  tags ("You" in saffron); procedural emote bubbles; rest unchanged.
- `js/ui.js` — search bar ("Find your home: type a name" → dropdown → visit),
  People & homes panel (deeds + live IST status + visit chips), assign panel
  (roster picker + vacate + code-deed lock), walk HUD wiring (joystick
  pointer-capture, RUN, emotes), IST clock stat, walk-mode tile info
  (no bulldoze at street level).
- `index.html` / `css/style.css` — walk HUD (128px joystick, 54px emote/run
  buttons, walk chip + Exit walk), search pill, deed rows, rotate buttons,
  9 new SVG icons (walk, run, rotate, wave, namaste, heart, search, clock,
  home). body.walking toggles chrome. All tokens-first, 44px+ targets.
- **Polyfork adaptation** — `scripts/catalog.mjs` generates `catalog.json`
  (41 buildings, 14 residents, deeds, festivals, tiers) from the code-side
  registries; recorded in AGENTS.md §6 with kit-discipline note.
- README rewritten (v2 features, controls table, "Own the code" guides);
  AGENTS.md gains §9 credentials/auto-health + §8 v2 direction.

**Ops (owner directives implemented)**
- Token stored ONLY in `.git/config` remote URL (never in tracked files,
  never echoed); §9 codifies the rule. Auto-health cron #515496 runs every
  15 min: pull → node syntax check → commit `chore: auto-health checkpoint`
  + push only if green (broken code never reaches main).
- Issues filed BEFORE build: #13 walk mode, #14 real-IST clock, #15 deed
  book, #16 search/docs — closed below with evidence.

**QA (screenshot-verified, desktop 1280×800 + mobile 390×844)**
- 11:26 pm IST boot renders a dark city (correct — real night in India);
  HUD clock matches `date` in Asia/Kolkata (verified in Node, h/m/s equal).
- Walk: WASD moves + camera follows ("You" tag, "You + 11 nearby" → "+7"
  after moving); wave emote shows bubble; Chacha Ramu / Priya Verma / Ravi
  Patel waved back; joystick drag moved player (18.50,20.50 → 18.24,18.25).
- Ownership: jhuggi placed (₹400 debited) → tap → "Assign owner…" → Priya
  Verma → toast + deed card "Priya Verma · home" + Vacate; RELOAD → deed
  persisted (`fromCode:false`); Priya then seen walking outside her new home
  (name tag in mobile shot). Diwali fired mid-QA (fireworks at real night).
- Search: "Meera" → "Meera Sharma · Home for the night" → visit jumped camera
  exactly to tile 19,18 (cam 32,608, zoom 1.60).
- Mobile: joystick + 5 emote buttons fit 390px; walk chip + Exit walk; tile
  inspect works at street level. Zero console errors across all passes.

**Pushed:** commit `366d3fa` (v2 feature work) + this worklog/ops commit.
**Live:** https://superz1402.github.io/india-city-builder/ (Pages rebuilds on push).

## 2026-11-09 — One-person view parity + 4-NPC cap (owner directive) by Z.ai agent session

**Owner directives this task:**
- "Use rea GitHub to clone how the one person view is used" → cloned the REAL
  reference source `buildacountry/buildacountry.github.io` (one ~472 KB
  index.html; lives outside the repo at /home/z/my-project/reference/) and
  reverse-engineered its walk system line-by-line. Distilled into
  **docs/WALK-REFERENCE.md** (WALK state machine, 0.5 m collision grid,
  4-corner+centre freeAt, axis-separated sliding, camera pull-in, joystick
  0.62R knob, drag-look 0.008/0.005, emote set 👋🎉🪔❤️ with 1.5 s rate
  limit, HUD structure, exact toast copy, "Just you here" chip).
- "Don't add fake humans — 4 is enough, bracket naming them npc" →
  owners.js RESIDENTS cut from 14 named people to exactly FOUR: [NPC] Ramu
  (17,18), [NPC] Meera (19,18), [NPC] Arjun (18,17), [NPC] Zoya (visitor,
  no deed). walkerOutfits trimmed 8→4 (one per NPC). DEEDS_KEY bumped
  v1→v2 so retired names can't ghost from old localStorage.

**Applied from the reference (parity):**
- walk.js: emote rate limit 1.5 s (reference lastEmoji rule); header docs.
- ui.js: NEW nearest-deed chip `#walk-near` (reference #walkNear) —
  "🏠 [NPC] Ramu's home / 🏪 …'s shop / 🏚️ … — vacant plot" within 6 tiles,
  refreshed on the 220 ms ui tick; enter-walk toast copy now matches the
  reference verbatim (phone vs desktop variants).
- index.html: `#walk-near` element; help text now explains the 4-NPC rule.
- style.css: `.walk-near` pill (bottom-centre desktop, above-joystick on
  ≤719px); RUN + 4 emotes wrap onto two 48px rows on phones (5×48px
  out-widthed 390px and collided with the joystick — found in QA);
  `body.walking .feed` and `.festival-banner` drop below the walk chip row
  so notices/Diwali banner never sit behind "You + N nearby".

**QA (agent-browser, zero console errors):**
- Desktop 1280×800: enter walk → dark sky at 11:49 pm IST ✓; "You + 4
  nearby" ✓; all four [NPC] tags visible ✓; walk-near chip ✓; WASD keydown
  1 s moves the player up-gully, camera follows ✓; Exit walk restores plan
  mode (build bar + search return, walkers cleared) ✓.
- Mobile 390×844 (iPhone 14): "You + 3 nearby", joystick + 5-button cluster
  fits with no joystick collision after the wrap fix; walk-near floats clear;
  Diwali banner (live today) below chips ✓.
- Deed book: exactly 4 rows; stale v1 entry ("Aarav Sharma") seeded into
  localStorage did NOT ghost after reload ✓. Search "ramu" → [NPC] Ramu →
  "Showing [NPC] Ramu's home" ✓.

**Ops:** new token configured per AGENTS.md §9 (remote URL only; AUTH-OK via
ls-remote). Owner reminder: token was pasted in chat 2026-11-09 — ROTATE it.
AGENTS.md gains §6 buildacountry pointer + §10 owner directives; README deed
examples use [NPC] names now.

**Pushed:** this task's commit (see git log — "walk-view parity + 4-NPC cap").
**Live:** https://superz1402.github.io/india-city-builder/

## 2026-11-09 — Polyfork round 2: parametric knobs, kit schema, llms.txt (issue #18)

**Owner directive:** "Adapt things from lucas-martinic/polyfork-catalog."
Round 1 (v2) adopted only the content-catalog pattern; this task adopted the
catalog's two signature ideas.

**Adapted from the real repo (cloned to /tmp, read line-by-line):**
- **"A model is a program" → parametric knobs.** `KNOBS` registry in data.js:
  14 buildings × 15 knobs (jhuggi.tarp, kaccha.wall+roof, pakka.paint,
  haveli.stone, bungalow.paint+roof, flats.paint, chai.awning,
  kirana.awning, dhaba.canopy, saree.silks, mandir.shikhara, masjid.dome,
  gurudwara.dome, panchayat.dome). `resolveKnobs(key, seed)` in arts.js picks
  an option deterministically per plot seed (cached; verified 0 invalid picks
  over 97 seeds, distribution 19/29/29/20 on jhuggi tarp). Option 0 of every
  knob = the original look, so existing cities render unchanged; extra
  options are kit-coherent recolours/variants.
- **Owner override API:** `place(x, y, key, { knobs: { paint: 'teal' } })`
  validates against the registry — unknown knob → "Pakka Ghar knobs: paint",
  bad value → "paint: 'neon' — valid options: cream, teal, pink, ochre".
- **Persistence:** save v2 carries `knobs: {"x,y": {...}}`; loadGame accepts
  v1 AND v2 (v1 = no pins, seeded looks; migration-free).
- **Catalog v3 = polyfork schema:** top-level `site/licence/api/repo`,
  `kits[]` (8 themed kits, one palette per family), `assets[]` (id/title/
  type/kit/stats/knobs/def/art/seasonResponse). Legacy `buildings` key
  renamed `assets` — single source, no dupes. 41 assets, 14 knobbed.
- **llms.txt** (repo root, served by Pages): agent-facing API doc mirroring
  polyfork's `api` pointer — schema, knobs API, code-side extension guide.

**Files:** data.js (KITS+KNOBS), arts.js (resolveKnobs + 14 wired cases),
state.js (S.v 2, place() knobs validation), save.js (v2 export/import),
render.js (env.knobs pass-through), scripts/catalog.mjs (v3), llms.txt (new),
README.md (knobs guide), AGENTS.md §6 (adoption note).

**Bonus bug fix (found by QA):** a visitor idling on the welcome panel for
14 s crashed the loop — `tick()` advanced the clock with no city, and
`newDay()` → `recomputeStats()` hit the empty grid (`S.grid[y]` undefined).
sim.js now returns early until the grid exists. Latent since v1; nobody
caught it because every QA session clicked Start within 14 seconds.

**QA (agent-browser, fresh browser context, zero console errors):**
- Welcome idle 16.5 s: no crash (fix verified), UI alive.
- Desktop 1280×800: Start → 7 pinned placements all ok → validation errors
  helpful → save v2 with 6 pins → reload → Continue → all 6 pins rehydrated
  into grid cells → night screenshot shows teal/pink/ochre pakka row, plum
  jhuggi, tile-roof kaccha, teal masjid dome.
- Mobile iPhone 14: Continue → boot clean, daytime screenshot confirms knob
  variety, Walk toggles, economy live across sessions (pop 8→15, day 3).
- Node: `--check` green on all 15 modules; catalog.mjs regen clean.

**Pushed:** commit "feat: polyfork knobs + kit schema (catalog v3, llms.txt), save v2; fix welcome-idle crash (Closes #18)".
**Live:** https://superz1402.github.io/india-city-builder/ (Pages rebuilds on push; llms.txt at /llms.txt).

**Addendum — in-game knob chips (parallel session, shipped together):**
while this task's QA ran, a parallel agent session staged an in-game look
picker on top of the same foundation: `pinKnob(x, y, name, value)` in
state.js (visual-only re-pin of an existing building; `null` unpins back to
the seeded look) + tile-card knob chip rows in ui.js ("Looks": one chip per
option, colour swatches, `aria-pressed` on the pinned chip) + styles + docs
in README/llms.txt. This session verified it end-to-end (DOM assertions:
4 chips with correct on/pressed states → tap pins pink → cell knobs update
→ tap pinned chip unpins → seeded look returns → save v2 reflects it) and
bumped chip touch targets for UI law §4.5 (26 → 32px, 44px on coarse
pointers). Both worksets merged in one feature commit.

## 2026-11-09 — Polyfork adaptation verified end-to-end; #19 reconciled with #18 (Z.ai session, Job 515496 slot)

**What this session did:** auto-health checkpoint found the round-2 WIP
uncommitted → syntax loop green (15/15 modules) → committed as `64d3677`
(session-safe WIP) → completed the missing player-facing piece (pinKnob +
tile-card "Looks" chips + css + docs) → QA'd it live → discovered a sibling
session had merged the SAME workset plus its own touch-target bump and the
welcome-idle fix as `1f3c2e1` (pushed, closes #18) on top of `64d3677`
while QA ran. `git diff HEAD` = empty → this session's files and the
pushed feature commit are byte-identical; no divergent history, nothing to
reconcile in code.

**Independent QA (agent-browser, against the merged HEAD content):**
- Desktop 1280×800: tile-card chip rows render with colour swatches
  (jhuggi tarp: slate/clay/teal/plum; kaccha wall+roof = 6 chips across
  2 rows); zero console/page errors.
- Full deterministic cycle: tap chip → pin (aria-pressed="true") →
  10 s autosave writes save v2 `knobs {"19,18":{"tarp":"teal"}}` →
  reload + Continue → pin SURVIVES → tap pinned chip → unpins back to
  seeded plum (aria-pressed=null) → autosave removes the pin from disk.
- Walk-mode guard: chips hidden at street level (walkActive()).
- Mobile 390×844: two-knob building (Kaccha Ghar, [NPC] Arjun's home)
  wraps cleanly; variant knob (roof thatch/tile) pins; 44px coarse
  touch targets confirmed on-screen.
- Pre-existing WIP-era pin (17,16 paint pink) coexisted correctly with
  new pins in one save.

**Issue hygiene:** filed #19 (polyfork adaptation acceptance list) before
reconciliation; every criterion verified against HEAD → closed as
implemented-in-#18 with this session's QA as independent evidence.
