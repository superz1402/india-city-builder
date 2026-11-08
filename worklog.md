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
