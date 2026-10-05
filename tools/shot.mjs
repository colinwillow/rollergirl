// npm run shot -- [name ...]   screenshots of the real page in headless chromium (swiftshader).
// Each shot: a spot to stand her at (CITY.spots) and optionally a fixed lens {pos, look}.
// Writes shots/<name>.png. Slow (software GL) -- for art passes, not for every build.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
// `--json file` reads the shot list from that file instead (`npm run plan` writes one)
const ji = process.argv.indexOf('--json');
const SHOTS = JSON.parse(fs.readFileSync(ji > 0 ? process.argv[ji + 1] : new URL('./shots.json', import.meta.url)));
const want = ji > 0 ? [] : process.argv.slice(2);
const list = want.length ? SHOTS.filter(s => want.includes(s.name)) : SHOTS;
// r73: a shot may carry `query` (?world=kit), `view` [w,h], `up` (a top-down lens needs one), `far`, and `fog: false`.
// Shots are grouped by query, one page load per group.
const port = 8000 + Math.floor(Math.random() * 900);
const srv = spawn('python3', ['-m', 'http.server', String(port)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 600));
fs.mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const groups = {}; for (const s of list) (groups[s.query || ''] = groups[s.query || ''] || []).push(s);
  for (const [q, group] of Object.entries(groups)) {
  const v = group[0].view || [1280, 640];
  const page = await browser.newPage({ viewport: { width: v[0], height: v[1] }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html${q}`);
  await page.waitForFunction(() => window.rg && window.rg.girl && window.rg.girl.ready, null, { timeout: 180000 });
  await page.addStyleTag({ content: 'body > *:not(canvas){visibility:hidden !important}' });
  for (const s of group) {
    await page.evaluate(s => {
      const rg = window.rg;
      if (s.spot) rg.goSpot(s.spot);
      if (s.at) { rg.player.pos.set(s.at[0], s.at[1], s.at[2]); rg.player.heading = rg.player.faceH = s.at[3] || 0; rg.cam.az = rg.cam.steerAz = s.at[3] || 0; }
      const sc = rg.scene;
      window.__shotCam = s.pos ? (c => { c.position.set(...s.pos); if (s.up) c.up.set(...s.up); c.lookAt(...s.look); c.fov = s.fov || 55; c.far = s.far || 900; c.near = s.near || 0.1;
        c.updateProjectionMatrix(); if (s.fog === false && sc.fog) { sc.fog.near = 1e5; sc.fog.far = 2e5; } }) : null;
    }, s);
    await page.waitForTimeout(s.wait || 2500);
    await page.screenshot({ path: `shots/${s.name}.png` });
    console.log('shot', s.name);
  }
  await page.close(); }
} finally { await browser.close(); srv.kill(); }
