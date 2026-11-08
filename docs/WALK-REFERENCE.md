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

## v5 — TRUE first person (issue #23, deliberate deviation from buildacountry)

buildacountry's walker is a third-person puppet in the isometric scene. The
owner's directive for v5 is explicit: *"the person walking in city should be
me."* Walk mode is therefore a **true first-person camera**, not a followed
avatar:

- **No body, no "You" tag.** `walk.js → view` IS the camera (x, y, yaw, pitch,
  head-bob). `render.js` hands walk mode entirely to `fpv.js`, a perspective
  projection renderer — buildings as sun-lit boxes with rooflines, kerbed
  roads with lane dashes and zebra crossings, billboards for trees and the
  four [NPC]s, rush-hour traffic you share the road with.
- **Looking**: drag anywhere to turn your head, or click the street to lock
  the mouse (Esc releases). Q/E or left/right arrows turn; WASD/joystick
  moves relative to where you face; Shift runs.
- **Orientation aids** (you have no body to anchor to): a marigold heading
  chevron on the ground ahead of you, a district + compass chip (top), and a
  pocket map with your heading arrow (top right; bottom right on phones).
- **Doors still talk**: hanging ACQUIRED nameplates and quiet TO-LET cards
  appear on doors within ~4.5 tiles (plate discipline — the street stays
  clean; the plan map keeps its doorstep dots).
- The old third-person buildacountry parity notes above still describe the
  movement *rules* (speeds, collision R=0.24, emote rate-limit, 4-NPC cap);
  only the camera and renderer changed.
