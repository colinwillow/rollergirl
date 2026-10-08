# kit_export.py -- the original skate_city environment (scene "Scene") as a drop-in kit: one GLB per piece.
import bpy, json, os
from mathutils import Vector

ns = bpy.app.driver_namespace
ROOT = r'C:\Users\colin\Desktop\3D STUFF\5_ENVIRONMENTS\3_LEVELS\skate_city'
OUT = os.path.join(ROOT, 'exports', 'kit_skate_city')
SC = bpy.data.scenes['Scene']
CAT = []

def ok(o): return o.type == 'MESH' and not o.hide_render and len(o.data.polygons) > 0

def export_set(name, kind, objs, note, origin='base'):
    objs = [o for o in objs if ok(o)]
    if not objs: return None
    vs = [o.matrix_world @ Vector(b) for o in objs for b in o.bound_box]
    x0, x1 = min(v.x for v in vs), max(v.x for v in vs); y0, y1 = min(v.y for v in vs), max(v.y for v in vs)
    z0, z1 = min(v.z for v in vs), max(v.z for v in vs)
    off = Vector(((x0 + x1) / 2, (y0 + y1) / 2, z0))
    S = set(objs); roots = [o for o in objs if o.parent not in S]
    # parents outside the set (hierarchy empties) are moved instead of the child, so the whole piece shifts once
    movers = set()
    for o in roots: movers.add(o.parent if o.parent is not None else o)
    saved = {m: m.matrix_world.copy() for m in movers}
    for m in movers: m.matrix_world.translation -= off
    bpy.context.view_layer.update()
    vl = SC.view_layers[0]
    for o in SC.objects: o.select_set(False, view_layer=vl)
    for o in objs: o.select_set(True, view_layer=vl)
    p = os.path.join(OUT, kind, name + '.glb'); os.makedirs(os.path.dirname(p), exist_ok=True)
    try:
        with bpy.context.temp_override(scene=SC, view_layer=vl):
            bpy.ops.export_scene.gltf(filepath=p, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                                      export_extras=False, use_active_scene=True, export_animations=False, export_cameras=False,
                                      export_lights=False, export_image_format='WEBP', export_image_quality=85, export_materials='EXPORT')
    finally:
        for m, mw in saved.items(): m.matrix_world = mw
        bpy.context.view_layer.update()
    a = dict(name=name, kind=kind, file='%s/%s.glb' % (kind, name), w=round(x1 - x0, 2), d=round(y1 - y0, 2), h=round(z1 - z0, 2),
             parts=len(objs), mb=round(os.path.getsize(p) / 1e6, 2), note=note)
    CAT.append(a); return a

HEROES = {
 'SciFiTower': 'sci-fi skate tower with pods, stairs, railings, murals', 'SkatePark': 'skate park building: ramps, decks, stairs, railings, lights',
 'KickflipShop': 'Kickflip skate shop with sign, props, ramps out front', 'FloatIsland': 'floating island deck with railings, lights, underside',
 'SkatePlatform': 'raised skate platform with railings, lights, underside (pairs with the Plat_* ramps)',
 'CosmicFuel': 'Cosmic Fuel station with sign and props', 'SkyBridge': 'enclosed sky bridge with railings, lights, underside',
 'AlienIsland': 'alien rock island: spire, moss, trees, boulders, pendant lights', 'SkateHQ': 'Skate HQ: stairs, balconies, ramps, sign, camo'}
BRIDGE = {'BK_HubA': 'hub', 'BK_HubB': 'hub', 'BK_HubC': 'hub', 'BK_HubD': 'hub', 'BK_Mock_A_to_B': 'span', 'BK_Mock_A_to_D': 'span',
          'BK_Mock_B_to_C': 'span', 'BK_Mock_D_Loop_C': 'loop span', 'BK_Mock_RampIn': 'ramp up', 'BK_Mock_RampOut': 'ramp down',
          'BK_BridgePath_Demo': 'long path'}

def build():
    CAT.clear(); os.makedirs(OUT, exist_ok=True)
    for c, note in HEROES.items():
        export_set(c, 'buildings', list(bpy.data.collections[c].all_objects), note)
    for e in [o for o in bpy.data.collections['RampKit'].objects if o.type == 'EMPTY']:
        export_set(e.name[3:], 'ramps', [c for c in e.children_recursive], 'ramp kit piece: %s' % e.name[3:])
    for c in bpy.data.collections['RailKit'].children:
        export_set(c.name[3:], 'rails', list(c.all_objects), 'rail kit piece: %s' % c.name[8:])
    for c, kind in BRIDGE.items():
        export_set(c[3:], 'highway', list(bpy.data.collections[c].all_objects), 'highway/bridge kit: %s' % kind)
    json.dump(dict(units='metres, Y up (glTF). Origin at the centre of each piece\'s footprint, on its lowest point.', pieces=CAT),
              open(os.path.join(OUT, 'catalog.json'), 'w'), indent=1)
    return dict(n=len(CAT), mb=round(sum(a['mb'] for a in CAT), 1), kinds={k: sum(1 for a in CAT if a['kind'] == k) for k in set(a['kind'] for a in CAT)})
