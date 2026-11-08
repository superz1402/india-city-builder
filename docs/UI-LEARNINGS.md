# UI Learnings — what this project took from the owner's own work

The owner asked that agents study their GitHub profiles (bilal140202,
ansaribilal14, superz1402) "especially to learn about UI, cause that's a weak
point for AI". This file records what was learned and exactly where it was
applied, so future sessions don't re-derive it.

## Sources actually studied (2026-11-08)

| Source | What it gave this project |
| --- | --- |
| `superz1402/agent-ui-playbook` (PLAYBOOK.md, AGENTS.md) | 13 frontend laws + paste-ready agent rules — adopted wholesale into this repo's AGENTS.md §4 |
| `Bilal140202/emberwake` (README, architecture) | Versioned localStorage saves, mobile-first HUD, GitHub Pages via Actions, procedural assets philosophy |
| Profile scans (all three accounts) | Identified the UI-reference repos worth mining: `design-showcase`, `ahyeon-vision-v2`, `clinic-demos`, `clinic-hubs`, `urban-smiles-demo`, `Unsent-Letters`, `Resume` |
| `faceless-shorts` skill zip (uploaded) | QA discipline: "never show a frame you haven't looked at" → every game screen verified by screenshot; phone-first readability |
| `buildacountry` source (reference site) | Camera/controls model: drag-pan, wheel zoom, tap-place, day counter, night toggle, walk/tour ambitions |

## Laws applied, with receipts

1. **Token-first identity (Law 1)** — `css/style.css` defines
   `--bg/--chrome/--ink/--accent/…` with a dark-mode column; zero raw hex
   outside the token block in chrome components. Verified by grep.
2. **Color + label (Law 2)** — Khush-hali shows "Content 55% / Meh 43% /
   Upset" with the color; Shehar Report rows pair green/red with words
   ("needs work", "clean", "90+ days").
3. **Loading/empty/error (Law 3)** — `bootError` in `main.js` shows the actual
   error message + Reload; placement rejections explain the exact reason
   ("Road is already here", "Bridges go over water"); the report panel
   explains *why* a number is short and what to build.
4. **Tabular numerals (Law 6)** — `.tnum` on money/population/day.
5. **Touch targets (Law 10)** — 44×44 buttons, 44px tabs, ≥44px cards.
6. **No emoji as UI icons (Law 11)** — inline SVG symbol set
   (`#i-rupee`, `#i-people`, `#i-warn`, `#i-diya`, …). Zero emoji in chrome.
7. **One loud thing (Law 9)** — festival banner is the only banner; toasts
   are small and self-dismiss; HUD pills stay quiet.
8. **Motion pays rent (Law 16)** — notices slide to show arrival; the ghost
   tint exists to show placement validity; no decorative animation in chrome.
9. **Screenshot before/after (working rule 4)** — all QA screenshots live in
   this session's log and the two shipped in `docs/`.
10. **Answer first (candidate 15)** — the HUD answers "should I worry?" in one
    glance: money, people, khush-hali label, day/season.

## Anti-"AI look" choices (anti-pattern catalog, §VI)

- Palette is sandalwood-paper + marigold saffron — deliberately *not*
  purple/indigo gradients, no glassmorphism, no cards inside cards.
- One accent color carries the brand; everything else is ink-on-paper.
- Iconography is a real vector set, drawn for this game's dome/diya motifs.
