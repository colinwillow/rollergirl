// weirdkit_detile.js -- breaks up visible texture tiling on WeirdKit / WeirdRoad materials.
//
// Usage (after every city GLB is loaded, and AFTER applyWeirdKit so the tint patch is already in place):
//   import { applyDetile } from './weirdkit_detile.js';
//   applyDetile([cityVisualRoot, kitBuildingsRoot]);
//
// It reads material.userData.wk_detile (exported from Blender as material extras) and patches the shader:
//   - "reveal":   partner texture is the base, this material's own texture shows through in world-space noise patches
//                 (e.g. clean plaster everywhere, brick peeking through in patches)
//   - "mix":      this material's texture everywhere, a partner texture (e.g. grass_b, brick_b) in noise patches
//   - "self":     blends the texture with a rotated / rescaled copy of itself in soft noise patches (kills the grid look)
//   - "macro":    only a very low-frequency brightness wobble (safe for brick courses, sidewalk slabs, siding)
//   - extra:      optional third texture (e.g. dirt patches on grass)
// Noise is 3D world-space, so neighbouring buildings and lots never line up.
import * as THREE from 'three';

const NOISE = /* glsl */`
varying vec3 vDtWorld;
uniform sampler2D uDtMap2; uniform sampler2D uDtMap3;
uniform vec2 uDtCS; uniform float uDtScale; uniform vec2 uDtOffset;
uniform float uDtFreq; uniform float uDtCov; uniform float uDtEdge; uniform float uDtMacro;
uniform float uDtFreq3; uniform float uDtCov3; uniform float uDtEdge3;
float dt_hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float dt_noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dt_hash(i), dt_hash(i + vec3(1,0,0)), f.x), mix(dt_hash(i + vec3(0,1,0)), dt_hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(dt_hash(i + vec3(0,0,1)), dt_hash(i + vec3(1,0,1)), f.x), mix(dt_hash(i + vec3(0,1,1)), dt_hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float dt_fbm(vec3 p){ return 0.62 * dt_noise(p) + 0.38 * dt_noise(p * 2.03 + 7.1); }
vec2 dt_uv2(vec2 uv){ vec2 p = uv * uDtScale; return vec2(uDtCS.x * p.x - uDtCS.y * p.y, uDtCS.y * p.x + uDtCS.x * p.y) + uDtOffset; }
`;

function mask(n, cov, edge) { return `smoothstep(1.0 - ${cov} - ${edge}, 1.0 - ${cov} + ${edge}, ${n})`; }

function fragBody(cfg, uv) {
  const mode = cfg.mode || 'macro';
  let s = `#ifdef USE_MAP\n  vec4 dtC = texture2D( map, ${uv} );\n`;
  if (mode !== 'macro') {
    s += `  vec4 dtB = texture2D( uDtMap2, dt_uv2(${uv}) );\n`;
    s += `  float dtM = ${mask('dt_fbm(vDtWorld * uDtFreq)', 'uDtCov', 'uDtEdge')};\n`;
    s += mode === 'reveal' ? `  dtC = mix(dtB, dtC, dtM);\n` : `  dtC = mix(dtC, dtB, dtM);\n`;
  }
  if (cfg.extra) {
    s += `  float dtM3 = ${mask('dt_fbm(vDtWorld * uDtFreq3 + 31.7)', 'uDtCov3', 'uDtEdge3')};\n`;
    s += `  dtC = mix(dtC, texture2D( uDtMap3, ${uv} ), dtM3);\n`;
  }
  s += `  dtC.rgb *= 1.0 + uDtMacro * (dt_noise(vDtWorld * 0.045 + 5.3) - 0.5) * 2.0;\n`;
  s += `  diffuseColor *= dtC;\n#endif\n`;
  return s;
}

export function applyDetile(roots, opts = {}) {
  roots = Array.isArray(roots) ? roots : [roots];
  const maps = new Map();                       // material name -> texture, so partners can be found across GLBs
  const mats = new Set();
  for (const r of roots) r.traverse(o => {
    if (o.userData && o.userData.dt_carrier) o.visible = false;   // tiny hidden meshes that only carry partner textures
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m) continue;
      if (m.map && m.name && !maps.has(m.name)) maps.set(m.name, m.map);
      if (m.userData && m.userData.wk_detile) mats.add(m);
    }
  });
  const uv = Number(THREE.REVISION) >= 151 ? 'vMapUv' : 'vUv';
  let patched = 0;
  for (const m of mats) {
    if (m.userData.__dt || !m.map) continue;
    const cfg = typeof m.userData.wk_detile === 'string' ? JSON.parse(m.userData.wk_detile) : m.userData.wk_detile;
    const mode = cfg.mode || 'macro';
    const partner = mode === 'self' ? m.map : (maps.get(cfg.partner) || (mode === 'mix' ? m.map : null));
    if (mode === 'reveal' && !partner) { console.warn('[detile] partner not found', m.name, cfg.partner); continue; }
    const extraMap = cfg.extra ? maps.get(cfg.extra.partner) : null;
    const c = extraMap ? cfg : { ...cfg, extra: null };
    const a = THREE.MathUtils.degToRad(cfg.uv_rot_deg || 0);
    const u = {
      uDtMap2: { value: partner || m.map }, uDtMap3: { value: extraMap || m.map },
      uDtCS: { value: new THREE.Vector2(Math.cos(a), Math.sin(a)) },
      uDtScale: { value: cfg.uv_scale ?? 1 }, uDtOffset: { value: new THREE.Vector2(...(cfg.uv_offset || [0.37, 0.61])) },
      uDtFreq: { value: cfg.freq ?? 0.2 }, uDtCov: { value: cfg.coverage ?? 0.4 }, uDtEdge: { value: cfg.edge ?? 0.1 },
      uDtMacro: { value: (cfg.macro ?? 0.1) * (opts.macroScale ?? 1) },
      uDtFreq3: { value: cfg.extra?.freq ?? 0.1 }, uDtCov3: { value: cfg.extra?.coverage ?? 0.2 }, uDtEdge3: { value: cfg.extra?.edge ?? 0.1 },
    };
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh, renderer) => {
      if (prev) prev.call(m, sh, renderer);
      Object.assign(sh.uniforms, u);
      sh.vertexShader = 'varying vec3 vDtWorld;\n' + sh.vertexShader.replace('#include <project_vertex>',
        `#include <project_vertex>
  vec4 dtW = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    dtW = instanceMatrix * dtW;
  #endif
  vDtWorld = ( modelMatrix * dtW ).xyz;`);
      sh.fragmentShader = NOISE + sh.fragmentShader.replace('#include <map_fragment>', fragBody(c, uv));
    };
    const prevKey = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : null;
    const key = `dt:${mode}:${c.extra ? 1 : 0}`;
    m.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|' + key;
    m.userData.__dt = true; m.needsUpdate = true; patched++;
  }
  return patched;
}
