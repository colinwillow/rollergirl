// weirdkit_tint.js — makes three.js match the WeirdKit paint look from Blender.
// Materials exported with extras.wk_tint = 1 tint ONLY the near-white "paint" pixels of their texture
// by the vertex colour (rust, brick, bare concrete keep their own colour). Vertex-colour alpha = grime / AO.
// Usage (after GLTFLoader):  import { applyWeirdKit } from './weirdkit_tint.js';  applyWeirdKit(gltf.scene);

export function applyWeirdKit(root) {
  const done = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || done.has(m)) continue;
      done.add(m);
      if (!m.userData || !m.userData.wk_tint) continue;
      m.vertexColors = true;
      m.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace(
          '#include <color_fragment>',
          `
          #if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
            vec3 tex = diffuseColor.rgb;
            float mx = max(max(tex.r, tex.g), tex.b);
            float mn = min(min(tex.r, tex.g), tex.b);
            float sat = mx > 1e-4 ? (mx - mn) / mx : 0.0;
            float mask = clamp((mx - 0.28) * 2.5, 0.0, 1.0) * clamp((0.75 - sat) * 4.0, 0.0, 1.0);
            vec3 tinted = vec3(clamp(mx * 1.25, 0.0, 1.0)) * pow(max(vColor.rgb, vec3(0.0)), vec3(1.45));
            diffuseColor.rgb = mix(tex, tinted, mask);
            #ifdef USE_COLOR_ALPHA
              diffuseColor.rgb *= vColor.a;      // grime / ambient-occlusion stored in vertex alpha
            #endif
          #endif
          `
        );
      };
      m.customProgramCacheKey = () => 'weirdkit_tint';
      m.needsUpdate = true;
    }
  });
}
