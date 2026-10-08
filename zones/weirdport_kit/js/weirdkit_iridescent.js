// weirdkit_iridescent.js -- swirly iridescent crystal bands (matches WK_M_crystal_irid in Blender).
// Materials exported with extras.wk_iridescent (JSON string) get wavy, noise-distorted colour bands that flow through
// OBJECT space (so every petal of one spire shares one continuous pattern), shown in soft noise patches, faded out
// above fade_z0..fade_z1 (object-space height), plus a light sheen at grazing angles.
// Usage (after GLTFLoader, and after applyWeirdKit / applyDetile):
//   import { applyIridescent } from './weirdkit_iridescent.js';  applyIridescent(gltf.scene);
import * as THREE from 'three';

const GLSL = /* glsl */`
varying vec3 vIrObj; varying vec3 vIrN; varying vec3 vIrView;
uniform float uIrBand, uIrNoise, uIrDistort, uIrMask, uIrCov, uIrEdge, uIrZ0, uIrZ1, uIrSheen;
uniform vec4 uIrC[5];
float ir_hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float ir_noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(ir_hash(i), ir_hash(i + vec3(1,0,0)), f.x), mix(ir_hash(i + vec3(0,1,0)), ir_hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(ir_hash(i + vec3(0,0,1)), ir_hash(i + vec3(1,0,1)), f.x), mix(ir_hash(i + vec3(0,1,1)), ir_hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float ir_fbm(vec3 p){ return 0.55 * ir_noise(p) + 0.3 * ir_noise(p * 2.03 + 7.1) + 0.15 * ir_noise(p * 4.1 + 3.3); }
vec3 ir_ramp(float t){
  vec3 c = uIrC[0].yzw;
  for (int k = 1; k < 5; k++) { float a = uIrC[k-1].x, b = uIrC[k].x; c = mix(c, uIrC[k].yzw, smoothstep(a, b, t) * step(a, t)); }
  return c;
}
`;

export function applyIridescent(root) {
  const done = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m || done.has(m) || !m.userData || !m.userData.wk_iridescent) continue;
      done.add(m);
      const cfg = typeof m.userData.wk_iridescent === 'string' ? JSON.parse(m.userData.wk_iridescent) : m.userData.wk_iridescent;
      const prev = m.onBeforeCompile;          // keep the tint / detile patches
      m.onBeforeCompile = (sh, r) => {
        if (prev) prev(sh, r);
        Object.assign(sh.uniforms, {
          uIrBand: { value: cfg.band_freq }, uIrNoise: { value: cfg.noise_scale }, uIrDistort: { value: cfg.distort },
          uIrMask: { value: cfg.mask_scale }, uIrCov: { value: cfg.coverage }, uIrEdge: { value: cfg.edge },
          uIrZ0: { value: cfg.fade_z0 }, uIrZ1: { value: cfg.fade_z1 }, uIrSheen: { value: cfg.sheen },
          uIrC: { value: cfg.colors.map((c) => new THREE.Vector4(c[0], c[1], c[2], c[3])) },
        });
        sh.vertexShader = 'varying vec3 vIrObj; varying vec3 vIrN; varying vec3 vIrView;\n' + sh.vertexShader.replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
           vIrObj = vec3(position.x, -position.z, position.y);           // glTF Y-up -> Blender Z-up object space
           vIrN = normalize(normalMatrix * objectNormal);
           vIrView = normalize(-(modelViewMatrix * vec4(transformed, 1.0)).xyz);`);
        sh.fragmentShader = GLSL + sh.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           float irPhase = vIrObj.z * uIrBand + (ir_fbm(vIrObj * uIrNoise) - 0.5) * uIrDistort * 2.0;
           float irBand = 0.5 + 0.5 * sin(irPhase * 6.2831853);
           vec3 irCol = ir_ramp(irBand);
           float irLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
           irCol = mix(irCol, irCol * (0.6 + 0.4 * irLum), 0.5);
           float irM = smoothstep(1.0 - uIrCov - uIrEdge, 1.0 - uIrCov + uIrEdge, ir_fbm(vIrObj * uIrMask + 11.0));
           irM *= 1.0 - smoothstep(uIrZ0, uIrZ1, vIrObj.z);
           diffuseColor.rgb = mix(diffuseColor.rgb, irCol, irM);
           float irF = pow(1.0 - max(dot(normalize(vIrN), normalize(vIrView)), 0.0), 2.0);
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.96, 1.0), irF * uIrSheen);`);
      };
      m.customProgramCacheKey = () => 'weirdkit_iridescent|' + (m.customProgramCacheKey ? '' : '');
      m.roughness = Math.min(m.roughness ?? 1, 0.35);
      m.needsUpdate = true;
    }
  });
}
