// npm run shot -- [name ...]   screenshots of the real page in headless chromium (swiftshader).
// Each shot: a spot to stand her at (CITY.spots) and optionally a fixed lens {pos, look}.
// Writes shots/<name>.png. Slow (software GL) -- for art passes, not for every build.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const SHOTS = JSON.parse(fs.readFileSync(new URL('./shots.json', import.meta.url)));
const want = process.argv.slice(2);
const list = want.length ? SHOTS.filter(s => want.includes(s.name)) : SHOTS;
const port = 8000 + Math.floor(Math.random() * 900);
const srv = spawn('python3', ['-m', 'http.server', String(port)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 600));
fs.mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.rg && window.rg.girl && window.rg.girl.ready, null, { timeout: 120000 });
  await page.addStyleTag({ content: 'body > *:not(canvas){visibility:hidden !important}' });
  for (const s of list) {
    await page.evaluate(s => {
      const rg = window.rg;
      if (s.spot) rg.goSpot(s.spot);
      if (s.at) { rg.player.pos.set(s.at[0], s.at[1], s.at[2]); rg.player.heading = rg.player.faceH = s.at[3] || 0; rg.cam.az = rg.cam.steerAz = s.at[3] || 0; }
      window.__shotCam = s.pos ? (c => { c.position.set(...s.pos); c.lookAt(...s.look); c.fov = s.fov || 55; c.updateProjectionMatrix(); }) : null;
    }, s);
    await page.waitForTimeout(s.wait || 2500);
    await page.screenshot({ path: `shots/${s.name}.png` });
    console.log('shot', s.name);
  }
} finally { await browser.close(); srv.kill(); }
