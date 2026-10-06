# asset_factory.py -- the Skyline look as standalone, drop-in assets (one GLB each, base centred at the origin).
#   copies: SK8 tower, both market stacks, start plaza, alien gardens, sky islands, waterfalls (from the built Skyline)
#   new:    a building family (block_skin on fresh boxes) and a tower family (bridge_tower), many sizes and seeds
import bpy, json, math, os, random
from mathutils import Vector

ns = bpy.app.driver_namespace
H = ns['HS']; W = ns['W']; K = ns['K']
ROOT = ns['SKB']['ROOT']; OUT = os.path.join(ROOT, 'exports', 'assets_skyline')
SRC = bpy.data.scenes['Skyline_Blockout']
FAR = 3000.0          # build new assets out here, away from the level

def scene():
    sc = bpy.data.scenes.get('Assets') or bpy.data.scenes.new('Assets')
    sc.world = SRC.world
    return sc

def acoll(name):
    sc = scene(); c = bpy.data.collections.get('AS_' + name)
    if c:
        for o in list(c.all_objects): bpy.data.objects.remove(o, do_unlink=True)
    else:
        c = bpy.data.collections.new('AS_' + name)
    if c.name not in sc.collection.children: sc.collection.children.link(c)
    return c

def visible(o): return o.type in ('MESH',) and not o.hide_render

def copy_from(name, src_objs, drop=()):
    c = acoll(name); n = 0
    for o in src_objs:
        if not visible(o) or any(o.name.startswith(d) for d in drop): continue
        k = o.copy(); k.parent = None; k.matrix_world = o.matrix_world.copy()
        c.objects.link(k); n += 1
    return c, n

def move_out(c, sc_from=None):
    """objects built into some other collection -> into c (keep world transform)"""
    pass

def bbox(c):
    vs = []
    for o in c.all_objects:
        if o.type == 'MESH': vs += [o.matrix_world @ Vector(v) for v in o.bound_box]
    return (min(v.x for v in vs), max(v.x for v in vs), min(v.y for v in vs), max(v.y for v in vs), min(v.z for v in vs), max(v.z for v in vs))

def recentre(c, base_z=None):
    x0, x1, y0, y1, z0, z1 = bbox(c)
    off = Vector(((x0 + x1) / 2, (y0 + y1) / 2, z0 if base_z is None else base_z))
    for o in c.objects:
        if o.parent is None: o.location -= off
    bpy.context.view_layer.update()
    x0, x1, y0, y1, z0, z1 = bbox(c)
    return dict(w=round(x1 - x0, 1), d=round(y1 - y0, 1), h=round(z1 - z0, 1), below=round(-min(0, z0), 1))

def grab(collection_names, into):
    """move every object of hero collections (built by HS into the Skyline scene) into `into`"""
    n = 0
    for cn in collection_names:
        c = bpy.data.collections.get(cn)
        if not c: continue
        for o in list(c.all_objects):
            for u in list(o.users_collection): u.objects.unlink(o)
            if visible(o): into.objects.link(o); n += 1
            else: bpy.data.objects.remove(o, do_unlink=True)
        for p in bpy.data.collections:
            if c.name in p.children: p.children.unlink(c)
        bpy.data.collections.remove(c)
    return n

CATALOG = []
def add(name, kind, c, note, base_z=None):
    dims = recentre(c, base_z)
    CATALOG.append(dict(name=name, kind=kind, file='%s.glb' % name, **dims, note=note))

# ---------------------------------------------------------------- 1. copies of the built heroes
def heroes():
    col = lambda n: list(bpy.data.collections[n].all_objects)
    c, _ = copy_from('SK8_TOWER', col('SKH_SK8Tower'), drop=('HR_',)); add('SK8_TOWER', 'landmark', c, 'the skate HQ castle: crown, 56 m deck, SK8 signs, spiral. Base at its plinth.')
    c, _ = copy_from('MARKET_WEST', col('SKH_MK_West')); add('MARKET_WEST', 'landmark', c, 'stacked shop pile with stairs, billboard, shop fronts, awnings')
    c, _ = copy_from('MARKET_EAST', col('SKH_MK_East')); add('MARKET_EAST', 'landmark', c, 'shop stack with balcony and roof ledge')
    c, _ = copy_from('START_PLAZA', col('SKH_StartArea')); add('START_PLAZA', 'landmark', c, 'logo plaza: rings, star totem, lamps, coping')
    c, _ = copy_from('GARDEN_NORTH', col('SKH_Garden_North')); add('GARDEN_NORTH', 'landmark', c, 'alien garden: egg pod, crystals, waterfalls')
    c, _ = copy_from('GARDEN_SOUTH', col('SKH_Garden_South')); add('GARDEN_SOUTH', 'landmark', c, 'alien garden, second variant')
    # sky islands: rock skin + moss + crystals + trees, plus their waterfall if they have one
    picks = ['S_Small00', 'S_Small03', 'S_Small07', 'S_Small12', 'S_Small17', 'S_SouthSmall02', 'S_SouthSmall05', 'S_Fountain', 'S_RingIsle', 'S_Crystal', 'S_HaloIsle', 'S_Target']
    for i, p in enumerate(picks):
        objs = [o for o in SRC.objects if o.name.startswith(p + '_') and visible(o)]
        objs += [o for o in SRC.objects if o.name.startswith('CL_W_' + p[2:]) and visible(o)]
        if p == 'S_Crystal': objs += [o for o in SRC.objects if o.name.startswith('S_CrystalSpire') and visible(o)]
        if not objs: continue
        nm = 'SKY_ISLAND_%02d' % (i + 1)
        c, _ = copy_from(nm, objs)
        # base = the island's top surface (its deck height) so it can be dropped at any altitude
        top = max((o.matrix_world @ Vector(v)).z for o in c.objects if o.name.endswith('_Skin') for v in o.bound_box) if any(o.name.endswith('_Skin') for o in c.objects) else None
        add(nm, 'sky_island', c, 'floating rock island, origin on its walkable top; rock and crystals hang below', base_z=top)
    for o in SRC.objects:
        if o.name.startswith('CL_W_') and visible(o):
            nm = 'WATERFALL_' + o.name[5:].replace('_Fall', '').upper()
            c, _ = copy_from(nm, [o]); x0, x1, y0, y1, z0, z1 = bbox(c)
            add(nm, 'waterfall', c, 'waterfall ribbon, origin at its top (it hangs down)', base_z=z1)

# ---------------------------------------------------------------- 2. building family (fresh boxes, the block skin)
BUILD = [  # w, d, h
 (8, 8, 7), (10, 8, 10), (12, 10, 14), (10, 10, 22), (18, 10, 8), (14, 14, 18), (8, 16, 12), (20, 14, 11),
 (12, 12, 30), (16, 8, 16), (24, 18, 9), (9, 9, 26), (14, 10, 6), (22, 22, 14), (10, 18, 20), (30, 12, 7)]
def buildings():
    sc = scene(); tmp = bpy.data.collections.get('AS_tmp') or bpy.data.collections.new('AS_tmp')
    if tmp.name not in SRC.collection.children: SRC.collection.children.link(tmp)
    for i, (w, d, h) in enumerate(BUILD):
        nm = 'BUILDING_%02d' % (i + 1); c = acoll(nm)
        me = bpy.data.meshes.new('tmpbox'); x, y = FAR + i * 60, FAR
        me.from_pydata([(x - w / 2, y - d / 2, 0), (x + w / 2, y - d / 2, 0), (x + w / 2, y + d / 2, 0), (x - w / 2, y + d / 2, 0),
                        (x - w / 2, y - d / 2, h), (x + w / 2, y - d / 2, h), (x + w / 2, y + d / 2, h), (x - w / 2, y + d / 2, h)], [],
                       [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]])
        box = bpy.data.objects.new('B_AS_%02d' % (i + 1), me); tmp.objects.link(box)
        trees = H['block_skin'](box, c, i * 7 + 3)
        if trees: W['trees'](K, nm + '_Trees', c, trees, seed=i, scale=.75)
        bpy.data.objects.remove(box, do_unlink=True)
        add(nm, 'building', c, 'pastel block: windows, stickers, trim bands, roof planter / tank / antenna, moss. %g x %g x %g m' % (w, d, h))
    SRC.collection.children.unlink(tmp); bpy.data.collections.remove(tmp)

# ---------------------------------------------------------------- 3. tower family (bridge_tower design)
TOWERS = [  # tag, shape, width, height, decks [(deck height, deck radius)], cap
 ('TOWER_A', 'cyl', 10, 60, [(56, 10.0)], True), ('TOWER_B', 'box', 9, 52, [(44, 9.0)], True),
 ('TOWER_C', 'cyl', 8, 40, [(30, 8.0), (16, 6.5)], True), ('TOWER_D', 'box', 12, 70, [(60, 11.0), (34, 9.0)], True),
 ('TOWER_E', 'cyl', 6, 30, [(24, 6.5)], True), ('TOWER_F', 'box', 6, 22, [(18, 6.0)], False),
 ('TOWER_G', 'cyl', 14, 80, [(72, 13.0), (48, 11.0), (24, 9.0)], True), ('TOWER_H', 'cyl', 7, 46, [], True)]
def towers():
    for i, (tag, shape, w, h, decks, cap) in enumerate(TOWERS):
        x, y = FAR + i * 70, FAR + 200
        d = decks or [(h - 9, 0.1)]
        H['bridge_tower'](tag, x, y, 0.0, h, shape, w, d if decks else [(h - 9, w / 2 + .5)], None, cap)
        c = acoll(tag); grab(['SKH_BT_' + tag], c)
        add(tag, 'tower', c, '%s tower, %g m, decks at %s; lantern + spire' % (shape, h, [dz for dz, _ in decks] or 'none') if cap else '%s tower, %g m, flat top' % (shape, h))

def layout():
    """lay every asset out on a grid in the Assets scene for viewing (after export)"""
    sc = scene(); kinds = ['landmark', 'tower', 'building', 'sky_island', 'waterfall']; y = 0.0
    for k in kinds:
        row = [a for a in CATALOG if a['kind'] == k]; x = 0.0; rowd = 0
        for a in row:
            c = bpy.data.collections['AS_' + a['name']]
            for o in c.objects:
                if o.parent is None: o.location += Vector((x + a['w'] / 2, y, 0))
            x += a['w'] + 12; rowd = max(rowd, a['d'])
        y -= rowd + 30

def export():
    os.makedirs(OUT, exist_ok=True); sc = scene(); vl = sc.view_layers[0]; sizes = {}
    for a in CATALOG:
        c = bpy.data.collections['AS_' + a['name']]
        for o in sc.objects: o.select_set(False, view_layer=vl)
        for o in c.all_objects: o.select_set(True, view_layer=vl)
        p = os.path.join(OUT, a['file'])
        with bpy.context.temp_override(scene=sc, view_layer=vl):
            bpy.ops.export_scene.gltf(filepath=p, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                                      export_extras=False, use_active_scene=True, export_animations=False, export_cameras=False,
                                      export_lights=False, export_image_format='WEBP', export_image_quality=85,
                                      export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_materials='EXPORT')
        a['mb'] = round(os.path.getsize(p) / 1e6, 2)
    json.dump(dict(units='metres, Y up (glTF). Origin at the base centre (sky islands: on their walkable top; waterfalls: at their top).',
                   assets=CATALOG), open(os.path.join(OUT, 'catalog.json'), 'w'), indent=1)

def build_all():
    CATALOG.clear()
    heroes(); buildings(); towers()
    export(); layout()
    return dict(n=len(CATALOG), by_kind={k: sum(1 for a in CATALOG if a['kind'] == k) for k in set(a['kind'] for a in CATALOG)},
                mb=round(sum(a.get('mb', 0) for a in CATALOG), 1), out=OUT)
