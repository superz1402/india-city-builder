# Walk-view reference — buildacountry (real source study)

Studied from the actual GitHub repo `buildacountry/buildacountry.github.io`
(cloned to `/home/z/my-project/reference/buildacountry`; the whole game is one
~472 KB `index.html`). This is our reference for the **one-person view** —
 Apna Shehar v2 "Wander Edition" mirrors it in native canvas 2.5D.

## Architecture of their one-person view

- **One real walker = you.** `WALK = { x, z, ang (body facing), yaw (camera),
  pitch, keys, joy, others, moving, phase, count, near, lastEmoji, idle }`.
  Slot 0 of the body batch is always the player; everything else is either
  street citizens (scenery) or live visitors.
- **Solo mode needs no server.** Their other walkers come via Supabase
  Realtime broadcast/presence and expire after **20 s unseen**; with nobody
  connected the label reads **"Just you here"**. No names, no chat — others
  render as "Visitor", and the only interaction is **4 emoji waves**.
- **Collision grid**: 0.5 m cells rasterised once from the scene mesh
  (`buildWalkGrid`), then `freeAt()` does a **4-corner + centre circle test**
  (radius 0.32 m). Movement is **axis-separated** so you slide along walls.
  Spawn uses `nearestFree()` — a ring search outwards for the first free cell.
- **HUD** (`#walkHud`): count chip + `✕ Exit walk` (top right), 4 emoji
  buttons (bottom right), joystick (bottom left), a `#walkNear` chip, a hint
  toast, and a tag layer for emoji bubbles. `body.walking` hides all map-mode
  chrome (controls, tabs, search, cards) via CSS `display:none !important`.

## Numbers worth copying (we did)

| Behaviour | buildacountry | Apna Shehar |
| --- | --- | --- |
| Move dead zone | mag > 0.12 | 0.08 (tuned for isometric) |
| Speed / run | 6.2 m/s, Shift ×1.9 | 2.1 tiles/s, run 4.4 |
| Joystick knob | clamped at 0.62 × radius, pointer capture | clamp at radius, capture |
| Drag-to-look | yaw −= dx × (0.008 phone / 0.005 desktop) | `orbitBy(dx*0.0062)` |
| Camera follow | behind + above, wall pulls camera in, slow release | soft follow, `cam.py=0.62` anchor |
| Camera swing | yaw drifts behind the body while walking forward | n/a (isometric orbit instead) |
| Emotes | 👋 🎉 🪔 ❤️, **1.5 s rate limit**, bubble floats up ~3.2 s | wave/namaste/diya/heart, 1.5 s limit, canvas bubbles |
| Nearby chip | "Just you here" / "👣 N walking now" | "Just you here" / "You + N nearby" |
| Nearest deed | `#walkNear`: "@user's home · job" within 10 m, 250 ms re-check | `#walk-near`: "[NPC] Ramu's home" within 6 tiles, 220 ms tick |
| Enter toast | "WASD or arrow keys to walk, Shift to run. Drag to look around." (phone: "Use the joystick to walk. Drag anywhere to look around.") | same copy |
| Keys | `keydown` ignores typing in `input,textarea`; Escape exits; `blur` clears keys | same via main.js `clearKeys` |
| Walk count UI | top-right chip | same (`#walk-chip`) |
| `#walkNear` on phones | moves to top (below the top bar) | same (`@media (pointer: coarse)`) |

## Fake-humans rule (owner directive, Nov 2025)

> "don't add fake humans too many — 4 is enough, add bracket naming them npc"

So the deed book ships exactly **four** citizens, each named with a literal
`[NPC]` prefix: `[NPC] Ramu`, `[NPC] Meera`, `[NPC] Arjun`, `[NPC] Zoya`
(Zoya owns nothing and strolls as a visitor). They spawn from
`owners.js → RESIDENTS`, walk with the same body renderer, and are the only
pretend people in the world. Anyone can be added in code — keep the `[NPC]`
tag so visitors never mistake scripted residents for real players.

## v5.2 — back to buildacountry parity: the visible walker (issue #24)

v5 shipped a skull-mounted camera (no body) per the "first person" reading of
issue #23. Live testing on mobile showed two things:

> "The viewer mode looks fine but as soon as we go to walk mode our drag is
> changing the land too it's not fixed to its place"
>
> "Also the visuals should look like this and smoothest rendering"
> (screenshots of buildacountry's walk mode — the player's own character from
> behind, bright low-poly streets)

An anchored world with nothing anchored ON screen reads as "the land slides".
v5.2 returns to the reference model, calibrated from its real source:

| Behaviour | buildacountry | Apna Shehar v5.2 |
| --- | --- | --- |
| Camera | third person, behind + above slot-0 body | same — visible green-kurta avatar, "You" tag |
| Orbit distance | 8.4 landscape / 11.5 portrait | 6.2 / 8.2 lots (our lots are smaller) |
| Pitch | 0.05–0.9, default 0.36 | same clamp, default 0.26 (roofs are lower) |
| Projection | lookAt(body head) | pitch derived from look-at (chest 1.45) — stays framed at ANY distance |
| Drag | yaw −= dx × (0.008 phone / 0.005 desktop) | identical |
| Auto-follow | yaw eases behind body at dt×1.6 while walking forward | identical, paused 0.4 s after a drag |
| Wall pull-in | ray-march 0.25 steps, fast-in/slow-out cd, lift ×0.35 | identical rule, floor 2.8 lots |
| Body | slot 0 of the batch | `walk.js → player` (green kurta, drawn by the same sprite kit as the [NPC]s) |
| Lens | none (clean render) | tilt-shift lens now plan-mode only; streets draw straight to the canvas |
| Night | bright toggle | real IST clock with a raised ambient floor (0.46) in walk mode only |

**Fixes shipped with it** (bugs found while rebuilding):

- `agents.js`: two `const` → `let` (the rush-hour spawn backfill reassigned a
  `const`, killing the render loop mid-frame on the deployed site);
- `fpv.js → drawWalker`: passed pixel height into `drawBillSprite` (world
  units) — every street person was double-scaled into off-screen giants;
- `fpv.js → personSprite/cowSprite`: the plan-mode sketches (~13 px) are now
  rendered enlarged inside the sprite canvas (×2 resolution) — street people
  were invisible specks before;
- perf: memoised `mix`/`shade`/`hazeCol` (thousands of string builds per
  frame), cached sky/haze gradients, one cached radial sprite per night-light
  colour, culling radii retuned for the higher camera.
