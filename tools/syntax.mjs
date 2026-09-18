// ~1s gate: pulls every <script type="module"> out of index.html and parses it.
import fs from 'fs'; import { execFileSync } from 'child_process'; import os from 'os'; import path from 'path';
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const re = /<script type="module">([\s\S]*?)<\/script>/g; let m, n = 0, bad = 0;
while ((m = re.exec(html))) {
  const f = path.join(os.tmpdir(), `rg-syntax-${n++}.mjs`); fs.writeFileSync(f, m[1]);
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { bad++; console.error(e.stderr.toString()); }
}
// A STATE THAT POSES HER MUST ALSO HAVE SET HER CLIP WEIGHTS.
// City lost a build to a branch that called `poseColin` and returned, so the one function that
// sets weights was skipped for the whole time he was on a bar -- the mixer keeps whatever it
// last had, and he hangs in the idle pose for ever while every offline tool passes. This is the
// cheapest possible guard against the class: it is a source shape, so it costs nothing and
// always runs.
{
  let miss = 0;
  html.split('\n').forEach((ln, i) => {
    if (!/poseGirl\s*\(/.test(ln) || !/\breturn\b/.test(ln)) return;
    if (/girlAnim\s*\(/.test(ln) || /setWeights\s*\(/.test(ln)) return;
    miss++; console.error('line ' + (i + 1) + ': poses and returns without setting clip weights');
  });
  if (miss) { console.error('POSE WITHOUT ANIM'); bad++; }
}
console.log(bad ? 'SYNTAX FAIL' : `syntax ok (${n} module script${n === 1 ? '' : 's'})`); process.exit(bad ? 1 : 0);
