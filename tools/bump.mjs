// Bumps BUILD, stamps a content hash onto every asset, and writes version.json.
// Run before every push: npm run bump
//
// Two places have to agree or the badge lies: the BUILD constant the game reports,
// and the markup it is stamped into so the number is on screen before a single line
// of the module has run. version.json is the third, and it is what a running copy
// polls to find out that it is now the old build.
//
// THE ASSET HASHES ARE THE OTHER HALF, AND THEY EXIST BECAUSE HE REPLACES FILES IN PLACE.
// He repaints a sky, exports a new colin.glb, re-cuts a sound -- same folder, same filename,
// new contents -- and a phone that already has that URL keeps what it has for ever. Nothing
// here is baked; the file really did change; the browser simply never asked again. Hand-bumped
// version constants (SFXV, MUSICV, IMGV) worked but only when somebody remembered, and
// "somebody remembered" is not a mechanism. Stamping BUILD on everything would work too and
// would re-download fifteen megabytes on every push.
// So: the hash of each file's CONTENTS. A file that changed gets a new URL and arrives; a file
// that did not keeps its URL and stays cached. No remembering, and nothing wasted.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const F = 'index.html';
let s = fs.readFileSync(F, 'utf8');
const m = s.match(/const BUILD = '([A-Za-z]*)(\d+)';/);
if (!m) { console.error('no BUILD line in ' + F); process.exit(1); }
const next = process.argv[2] || m[1] + (parseInt(m[2], 10) + 1);
s = s.replace(/const BUILD = '[^']*';/, `const BUILD = '${next}';`);
s = s.replace(/<b id="buildN">[^<]*<\/b>/, `<b id="buildN">${next}</b>`);

// Every asset the game fetches at runtime. NOT icons/ -- iOS drops an apple-touch-icon link
// whose href carries a query string, which is why those version their FILENAME instead.
const DIRS = ['images', 'models', 'models/ramps', 'models/chars', 'audio', 'audio/songs', 'audio/skateboarding_sound_effects', 'audio/jetpack_sound'];
const EXT = /\.(png|jpe?g|webp|glb|mp3|ogg|wav)$/i;
const map = {};
for (const d of DIRS) {
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    const rel = d + '/' + f;
    if (!EXT.test(f) || !fs.statSync(rel).isFile()) continue;
    map[rel] = crypto.createHash('sha1').update(fs.readFileSync(rel)).digest('hex').slice(0, 8);
  }
}
const A = '/* ASSETS:START */', B = '/* ASSETS:END */';
const block = A + '\nconst ASSETS = ' + JSON.stringify(map, null, 0) + ';\n' + B;
const i = s.indexOf(A), j = s.indexOf(B);
if (i < 0 || j < 0) { console.error('no ASSETS block in ' + F + ' -- add ' + A + ' ... ' + B); process.exit(1); }
const before = s.slice(i, j + B.length);
s = s.slice(0, i) + block + s.slice(j + B.length);

fs.writeFileSync(F, s);
fs.writeFileSync('version.json', JSON.stringify({ build: next, time: new Date().toISOString() }) + '\n');
console.log('BUILD ' + m[1] + m[2] + ' -> ' + next);
const n = Object.keys(map).length;
if (before === block) console.log('assets: ' + n + ' hashed, none changed');
else {
  // say WHICH, because "I replaced it and nothing happened" is the bug this prevents
  const old = {}; const om = before.match(/const ASSETS = (\{.*\});/);
  if (om) try { Object.assign(old, JSON.parse(om[1])); } catch (e) {}
  const moved = Object.keys(map).filter(k => old[k] !== map[k]);
  console.log('assets: ' + n + ' hashed, ' + moved.length + ' CHANGED -> ' + (moved.join(' ') || '(first run)'));
}
