// test-city.mjs — headless integrity harness for the Mahanagar Edition.
// Run: node scripts/test-city.mjs   (exit 1 on any failure)
import { S, MAP, newGame, isWater, gridAt, recomputeStats } from '../js/state.js';
import { BUILDINGS, KNOBS } from '../js/data.js';
import { ASSIGNMENTS, RESIDENTS } from '../js/owners.js';

let fails = 0;
const ok = (cond, msg) => { if (cond) console.log('  PASS', msg); else { fails++; console.error('  FAIL', msg); } };

console.log('== Mahanagar city harness ==');
newGame(1);

// 1. map + scale
ok(MAP === 48, `MAP is 48 (got ${MAP})`);
const total = Object.entries(S.counts).reduce((n, [, c]) => n + c, 0);
ok(total > 380, `city is big: ${total} placed tiles`);

// 2. every deed tile holds the intended deedable building
const want = {
  '13,32': 'pakka', '20,32': 'kirana', '12,34': 'flats', '28,24': 'saree',
  '13,10': 'bungalow', '22,26': 'dhaba', '29,16': 'villa', '36,24': 'office',
};
for (const [tile, key] of Object.entries(want)) {
  const [x, y] = tile.split(',').map(Number);
  const g = gridAt(x, y);
  ok(g && g.k === key, `deed tile ${tile} holds ${key} (got ${g ? g.k : 'nothing'})`);
}
// owners.js quotes exactly the reserved tiles
for (const a of ASSIGNMENTS) {
  for (const kind of ['home', 'shop']) ok(!!a[kind], `${a.name} has a ${kind}: ${a[kind]}`);
}
const assigned = new Set(ASSIGNMENTS.flatMap(a => [a.home, a.shop]));
for (const t of Object.keys(want)) ok(assigned.has(t), `tile ${t} is quoted in owners.js`);
ok(RESIDENTS.length === 4 && RESIDENTS.every(n => n.startsWith('[NPC]')), 'exactly four [NPC] residents');

// 3. nothing stands on water
let onWater = 0;
for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) {
  const g = S.grid[y][x];
  if (g && isWater(x, y) && g.k !== 'bridge') onWater++;
}
ok(onWater === 0, `no buildings on water (${onWater} found)`);

// 4. road network: BFS from the chowk — at least 90% of road tiles connected
const roadTiles = [];
for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) {
  const g = S.grid[y][x];
  if (g && (g.k === 'road' || g.k === 'bridge')) roadTiles.push([x, y]);
}
const seen = new Set(['25,25']);
const q = [[25, 25]];
while (q.length) {
  const [x, y] = q.pop();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    const key = nx + ',' + ny;
    if (seen.has(key)) continue;
    const g = gridAt(nx, ny);
    if (g && (g.k === 'road' || g.k === 'bridge')) { seen.add(key); q.push([nx, ny]); }
  }
}
ok(seen.size / roadTiles.length > 0.9, `road network connected: ${seen.size}/${roadTiles.length} (${(seen.size / roadTiles.length * 100).toFixed(1)}%)`);

// 5. economy sanity after a day of sim
recomputeStats(true);
ok(S.stats.homes > 400, `housing for a city: ${S.stats.homes} homes`);
ok(S.stats.jobs > 200, `jobs for a city: ${S.stats.jobs}`);
ok(S.stats.buildings === total, `counts match grid (${S.stats.buildings})`);
ok(S.pop >= 150, `city population: ${Math.round(S.pop)}`);
ok(S.tierIdx >= 3, `tier unlocked: ${S.tierIdx} (>= Kasba/Town)`);

// 6. new buildings render-knobbed and complete
for (const k of ['chawl', 'villa', 'office', 'tower', 'mall', 'hotel', 'petrol']) {
  ok(!!BUILDINGS[k] && !!BUILDINGS[k].draw, `building ${k} defined`);
  ok(!!KNOBS[k], `building ${k} has polyfork knobs`);
}

// 7. walkable chowk: player spawn area has street
const spawn = gridAt(24, 26);
ok(spawn && (spawn.k === 'road'), `chowk spawn tile is road (got ${spawn ? spawn.k : 'nothing'})`);

console.log(fails ? `\n${fails} FAILURES` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
