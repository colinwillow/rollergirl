// npm run check:boot -- DOES THE MODULE ACTUALLY EVALUATE?
//
// `npm run check:syntax` parses. It cannot see a `const` read above its own declaration, a
// throw at module top level, or a missing identifier -- and all three of those are a BLANK
// PAGE: the boot card sits at the text it was born with, `init()` never runs, and there is
// nothing on screen or in a phone's console to say why. Plutopia lost a whole build to exactly
// that and wrote `check:intro` to catch it; this is Rollergirl's.
//
// It runs the real module. `three` resolves to the VENDORED build through a shim that swaps
// `WebGLRenderer` for a fake, because a headless node has no GL context and the renderer is
// the only thing in this file that needs one. Everything else -- the canvases, the audio, the
// DOM, `localStorage` -- is stubbed to the surface the file actually touches.
import fs from 'fs'; import os from 'os'; import path from 'path';
import { pathToFileURL } from 'url';

// THE `three` SHIM, WRITTEN HERE RATHER THAN ASSUMED. `vendor/GLTFLoader.js` imports the bare
// specifier 'three', which the page resolves through its <script type="importmap"> and node
// cannot resolve at all. `wear.mjs` writes a three-line shim package for it -- but an ordinary
// `npm i` of ANYTHING rewrites node_modules and takes it away, and then this gate fails with a
// module-not-found that looks exactly like the blank page it exists to catch. A gate that
// cries wolf after an unrelated install is a gate nobody runs, so it writes its own. It has to
// point at the VENDORED build: testing r180's loader against some other r180 is the same class
// of mistake as testing a copy of the code.
if (!fs.existsSync('node_modules/three/package.json')) {
  fs.mkdirSync('node_modules/three', { recursive: true });
  fs.writeFileSync('node_modules/three/package.json', JSON.stringify({
    name: 'three', version: '0.180.0-vendored', type: 'module', main: 'index.js', exports: { '.': './index.js' } }, null, 2));
  fs.writeFileSync('node_modules/three/index.js', "export * from '../../vendor/three.module.min.js';\n");
}

const html = fs.readFileSync('index.html', 'utf8');
const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!m) { console.error('no module script'); process.exit(1); }

const TMP = path.join(os.tmpdir(), 'rollergirl-boot');
fs.mkdirSync(TMP, { recursive: true });
const ROOT = pathToFileURL(process.cwd() + '/').href;

// ---- the three shim: the vendored build, with the one class that needs a GPU replaced ----
fs.writeFileSync(path.join(TMP, 'three-shim.mjs'), `
export * from '${ROOT}vendor/three.module.min.js';
import * as T from '${ROOT}vendor/three.module.min.js';
class FakeTarget { constructor(w, h, o) { this.width = w; this.height = h; this.texture = new T.Texture(); this.depthTexture = (o && o.depthTexture) || null; }
  setSize() {} dispose() {} }
export { FakeTarget as WebGLRenderTarget };
class FakeRenderer {
  constructor() { this.domElement = mkCanvas(); this.shadowMap = { enabled: false, type: 0 };
    this.info = { autoReset: true, render: { calls: 0, triangles: 0 }, reset() {} };
    this.capabilities = { isWebGL2: true, getMaxAnisotropy: () => 1, precision: 'highp' };
    this.outputColorSpace = ''; this.toneMapping = 0; this.toneMappingExposure = 1; }
  setSize(w, h) { this.domElement.width = w; this.domElement.height = h; }
  setPixelRatio() {} setClearColor() {} setRenderTarget() {} clear() {} render() {} dispose() {}
  compile() {} getContext() { return { getParameter: () => 0 }; } getDrawingBufferSize(v) { return v.set(1280, 720); }
  initTexture() {}
}
export { FakeRenderer as WebGLRenderer };
class FakePMREM { constructor() {} fromEquirectangular() { return { texture: new T.Texture() }; }
  compileEquirectangularShader() {} dispose() {} }
export { FakePMREM as PMREMGenerator };
function mkCanvas() { return globalThis.document.createElement('canvas'); }
`);

// STUBS:START -- lifted verbatim by `tools/jam.mjs`, which needs the same headless page but a
// REAL fetch. A second harness with its own copy of these is two things to keep in step, which
// is the mistake `normals.mjs` made about `normGeo`; markers mean there is one copy.


// ---- the DOM, stubbed to the surface this file touches ----
const CTX2D = ['clearRect','fillRect','beginPath','moveTo','lineTo','arc','arcTo','closePath','fill','stroke',
  'save','restore','translate','rotate','scale','drawImage','fillText','strokeText','setTransform','clip','quadraticCurveTo',
  'bezierCurveTo','createLinearGradient','createRadialGradient','createImageData','putImageData','getImageData','measureText','ellipse','rect','setLineDash'];
function ctx2d() {
  const g = {};
  for (const k of CTX2D) g[k] = () => ({ addColorStop() {}, data: new Uint8ClampedArray(4), width: 1, height: 1 });
  g.createLinearGradient = g.createRadialGradient = () => ({ addColorStop() {} });
  g.createImageData = g.getImageData = () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
  g.measureText = () => ({ width: 10 });
  return g;
}
const NODES = new Map();
function mkEl(tag = 'div', id = '') {
  const el = {
    tagName: (tag || 'div').toUpperCase(), id, nodeType: 1, children: [], childNodes: [], parentNode: null,
    style: new Proxy({}, { get: (t, k) => (k === 'setProperty' || k === 'removeProperty' ? () => {} : t[k] || ''), set: (t, k, v) => (t[k] = v, true) }),
    dataset: {}, hidden: false, textContent: '', innerHTML: '', value: '', width: 1280, height: 720, checked: false,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild(c) { this.children.push(c); this.childNodes.push(c); c.parentNode = this; return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); this.childNodes.splice(i, 1); } return c; },
    insertBefore(c) { return this.appendChild(c); },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    setAttribute() {}, getAttribute: () => null, removeAttribute() {},
    setPointerCapture() {}, releasePointerCapture() {}, focus() {}, blur() {}, click() {}, remove() {},
    querySelector: () => null, querySelectorAll: () => [], contains: () => false, closest: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0 }),
    getContext: () => ctx2d(), toDataURL: () => 'data:,',
  };
  return el;
}
// READ HERE RATHER THAN TAKEN FROM `html`, because this block is lifted verbatim by `jam.mjs`
// and `optboot.mjs` and only one of the three had that binding in scope -- a gate that dies on
// an unrelated harness is a gate nobody runs.
// AND IT READS THE FILE THROUGH `process.getBuiltinModule`, which needs no import at all:
// `optboot.mjs` runs this text through INDIRECT eval, so module-scope bindings -- `fs`, `html`
// -- are simply not there. A block lifted by three harnesses may only depend on globals.
const DOMSRC = process.getBuiltinModule('fs').readFileSync('index.html', 'utf8');
const DOMIDS = new Set();
for (const m of DOMSRC.matchAll(/\bid\s*=\s*["']([A-Za-z0-9_-]+)["']/g)) DOMIDS.add(m[1]);
for (const m of DOMSRC.matchAll(/\.id\s*=\s*["'`]([A-Za-z0-9_-]+)["'`]/g)) DOMIDS.add(m[1]);
const doc = {
  body: mkEl('body'), documentElement: mkEl('html'), head: mkEl('head'),
  createElement: t => mkEl(t), createElementNS: (n, t) => mkEl(t), createTextNode: () => mkEl('text'),
  // **A STUB THAT INVENTS AN ELEMENT FOR EVERY ID CAN NEVER CATCH A MISSING ONE (c192).** This
  // returned a fresh div for whatever it was asked for, so `getElementById('actB')` succeeded
  // here and returned NULL on the phone -- a TypeError at module scope, `init()` never running,
  // and the boot card sitting for ever at the text it was born with. That is EXACTLY the failure
  // this gate exists for, and it passed six builds running because the harness was answering a
  // question the browser does not answer the same way. The repo's oldest mistake, in the gate.
  // The id set comes from the page itself -- markup attributes AND `el.id = '...'` assignments,
  // so anything the settings panel or the kit row builds at runtime still resolves.
  getElementById: id => {
    if (!DOMIDS.has(id)) return null;
    if (!NODES.has(id)) NODES.set(id, mkEl('div', id));
    return NODES.get(id);
  },
  querySelector: () => null, querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {}, exitPointerLock() {}, hidden: false,
  visibilityState: 'visible', fonts: { ready: Promise.resolve(), load: () => Promise.resolve() },
};
globalThis.document = doc;
globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.innerWidth = 1280; globalThis.innerHeight = 720; globalThis.devicePixelRatio = 2;
// node 22 defines `navigator` as a getter-only global, so it has to be redefined rather than
// assigned -- the same for anything else the runtime already owns.
Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true,
  value: { userAgent: 'node', maxTouchPoints: 0, audioSession: {} } });
globalThis.location = { href: 'http://x/', search: '', hash: '', reload() {} };
globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
  setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };
globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {};
globalThis.requestAnimationFrame = () => 0; globalThis.cancelAnimationFrame = () => {};
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
globalThis.fetch = () => Promise.reject(new Error('offline'));
globalThis.Image = class { set src(v) {} addEventListener() {} };
globalThis.AudioContext = globalThis.webkitAudioContext = class { constructor() { this.destination = {}; this.currentTime = 0; this.state = 'running'; }
  createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  createBufferSource() { return { buffer: null, playbackRate: { value: 1 }, connect() {}, start() {}, stop() {}, disconnect() {} }; }
  createBuffer() { return { getChannelData: () => new Float32Array(8) }; }
  createBiquadFilter() { return { type: '', frequency: { value: 0, setValueAtTime() {} }, Q: { value: 1 }, connect() {}, disconnect() {} }; }
  createOscillator() { return { type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {}, disconnect() {} }; }
  decodeAudioData() { return Promise.resolve({ duration: 1, getChannelData: () => new Float32Array(8) }); }
  resume() { return Promise.resolve(); } close() { return Promise.resolve(); } };

// STUBS:END
// ---- run it ----
let src = m[1].replace(/(from\s*)['"]three['"]/g, `$1'${pathToFileURL(path.join(TMP, 'three-shim.mjs')).href}'`);
src = src.replace(/(from\s*)['"]\.\/vendor\//g, `$1'${ROOT}vendor/`);
const f = path.join(TMP, 'boot.mjs');
fs.writeFileSync(f, src);
// A HARD EXIT, BECAUSE A PASS LOOKS LIKE A HANG. Once the module evaluates, `init()` starts
// fetching assets -- which cannot resolve here and must not, because this gate is about the
// MODULE coming up, not about the network. So it waits a beat for a top-level chain to blow
// up and then leaves.
// AND THE ASSET FAILURES ARE THE ENVIRONMENT, NOT THE CODE. node has no relative-URL base, so
// every `loadGLB` rejects with ERR_INVALID_URL; failing on those would make the gate cry wolf
// on every run and nobody would read it twice. Anything ELSE that rejects is a real fault --
// which is how a throw inside `init()` reaches the boot card in the real game.
const ENVY = /Invalid URL|Failed to parse URL|ERR_INVALID_URL|ENOTFOUND|fetch failed|offline/i;
let failed = null;
const note = e => { const t = (e && (e.stack || e.message)) || String(e); if (!ENVY.test(t)) failed = failed || e; };
process.on('unhandledRejection', note);
process.on('uncaughtException', note);
const quiet = console.error; console.error = (...a) => { if (!ENVY.test(a.map(String).join(' '))) quiet(...a); };
try {
  await import(pathToFileURL(f).href + '?t=' + Date.now());
  await new Promise(r => setTimeout(r, 400));
} catch (e) { note(e); }
console.error = quiet;
if (failed) {
  console.error('BOOT FAIL -- the module threw, which is a blank page and a boot card stuck\n' +
                'on the text it was born with. Nothing on screen or in a phone console says why.\n');
  console.error(failed && failed.stack ? failed.stack : failed);
  process.exit(1);
}
console.log('boot ok -- the module evaluates and init() runs');
process.exit(0);
