"""
Rollergirl level helpers for Blender (4.x). Paste into the Text Editor and Run, or exec() it over MCP.

Everything here writes the names and custom properties that the game's importer (`levelIngest` in index.html)
reads. Read LEVEL_BUILDING.md first; this file only saves typing, and it has NOT been run inside Blender by
the game session (there is no Blender there). If a call fails, the doc says what the result has to be.

Conventions
  * 1 unit = 1 metre, Blender Z up. The glTF exporter turns that into +Y up; the game reads glTF.
  * Two collections: VISUAL (the picture) and COLLISION (floors, boxes, rails, markers, kit pieces).
  * A Blender point (x, y, z) is glTF [x, z, -y]. Every `*_gltf` property below is written in glTF terms
    and in the FILE's frame (world coordinates of the scene), never an object's local frame.
  * A game heading h faces (sin h, cos h) in glTF x/z, which is Blender direction (sin h, -cos h).
    So heading 0 faces Blender -Y, and heading 90 faces Blender +X.
"""
import bpy, bmesh, json, math
from mathutils import Vector

VIS, COL = 'VISUAL', 'COLLISION'


# ---------------------------------------------------------------- frames
def to_gltf(v):
    """Blender point -> glTF [x, y, z] (y up)."""
    return [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]


def heading_deg(dx, dy):
    """Game heading (degrees) for a Blender facing direction (dx, dy)."""
    return math.degrees(math.atan2(dx, -dy))


def coll(name):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def _link(ob, cname=COL):
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    coll(cname).objects.link(ob)
    return ob


def _empty(name, loc, size=0.5, kind='PLAIN_AXES'):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_type = kind
    ob.empty_display_size = size
    ob.location = loc
    return _link(ob)


def _polyline(name, pts):
    """An edge-only mesh through `pts` (a visual guide; the game reads the *_gltf property)."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(p) for p in pts], [(i, i + 1) for i in range(len(pts) - 1)], [])
    ob = bpy.data.objects.new(name, me)
    return _link(ob)


# ---------------------------------------------------------------- rails, lanes
def rail(name, pts, closed=False, boost=0, gems=0):
    """A grind rail exactly along `pts` (Blender world points: the TOP of the bar, where her wheels go).
    closed: a ring. boost: a booster rail's speed in m/s (use it on anything that climbs; ~14-18).
    gems: a collectible every `gems` metres along it. A rail that turns upside down (a loop) is detected by the
    game and gets a booster and an upside-down body for free. Model the visible tube yourself in VISUAL."""
    ob = _polyline('rail_' + name, pts)
    ob['grind_path_gltf'] = json.dumps([to_gltf(p) for p in pts])
    if closed: ob['closed'] = True
    if boost: ob['boost'] = float(boost)
    if gems: ob['gems'] = float(gems)
    return ob


def rail_from_curve(name, curve_ob, step=1.0, lift=0.0, **kw):
    """Sample a curve object (world space) every `step` m into a rail; `lift` raises it (e.g. to a railing top)."""
    dg = bpy.context.evaluated_depsgraph_get()
    me = curve_ob.evaluated_get(dg).to_mesh()
    vs = [curve_ob.matrix_world @ v.co for v in me.vertices]
    # vertices of an evaluated curve come out in order along each spline
    out = [vs[0]]
    for v in vs[1:]:
        if (v - out[-1]).length >= step: out.append(v)
    if (vs[-1] - out[-1]).length > 0.05: out.append(vs[-1])
    curve_ob.evaluated_get(dg).to_mesh_clear()
    return rail(name, [v + Vector((0, 0, lift)) for v in out], closed=kw.pop('closed', curve_ob.data.splines[0].use_cyclic_u), **kw)


def lane(name, pts, half_width=2.0, speed=20.0, accel=14.0, governed=0.0):
    """A boost lane: a centreline ON a floor (deck_/ramp_). Grounded and going its way she is pushed up to `speed`.
    governed > 0 also holds her near that speed (use it on spirals so she cannot out-run the bend)."""
    ob = _polyline('lane_' + name, pts)
    ob['path_gltf'] = json.dumps([to_gltf(p) for p in pts])
    ob['half_width'] = float(half_width); ob['speed'] = float(speed); ob['accel'] = float(accel); ob['governed'] = float(governed)
    return ob


# ---------------------------------------------------------------- markers
def spawn(name, loc, facing=(0, -1)):
    """Where she starts. One per level (the first one found wins). `facing` is a Blender direction."""
    ob = _empty('marker_spawn_' + name, loc, 1.0, 'SINGLE_ARROW')
    ob['heading'] = heading_deg(*facing)
    return ob


def spot(name, loc, facing=(0, -1)):
    """A fast-travel stop for the in-game travel key. Stand it ON a floor, a few metres short of the feature."""
    ob = _empty('marker_spot_' + name, loc, 1.0, 'SINGLE_ARROW')
    ob['heading'] = heading_deg(*facing)
    return ob


def launcher(name, pad, target, apex, radius=2.0):
    """A launch pad: stand on it (within `radius`, at its height) and it throws her onto `target`.
    `apex` is the WORLD height of the top of the arc (Blender Z). The game raises the arc if it hits something."""
    ob = _empty('marker_launcher_' + name, pad, radius, 'CIRCLE')
    ob['kind'] = 'launcher'; ob['target_gltf'] = json.dumps(to_gltf(target)); ob['apex'] = float(apex); ob['radius'] = float(radius)
    _polyline('guide_launch_' + name, [Vector(pad), Vector(target)])   # reference only, ignored
    return ob


def trampoline(name, loc, radius=2.0):
    """Land on it and it throws her ~9 m up (the Orbital mushrooms). `loc` = the bouncy surface's centre and height;
    put a floor (deck_ or a bld_ box top) there too, or she falls through it."""
    ob = _empty('marker_trampoline_' + name, loc, radius, 'CIRCLE')
    ob['radius'] = float(radius)
    return ob


def gem(name, loc):
    """A collectible. Put it ~0.9 m over the surface (her body height). For a string of them, use rail(..., gems=)."""
    return _empty('marker_gem_' + name, loc, 0.4, 'SPHERE')


def water(ob, lava=False, splash=True):
    """Turn a flat mesh (plane at the surface) into water or lava: falling in puts her back where she last stood."""
    if not ob.name.startswith('zone_water_'): ob.name = 'zone_water_' + ob.name
    if lava: ob['hazard'] = 'lava'
    if not splash: ob['splash'] = False
    return _link(ob)


# ---------------------------------------------------------------- tagging your own geometry
def floor(ob, kind='deck'):
    """Your own walkable mesh (deck_/ramp_/ground_/road_): ridden exactly as modelled. Faces must point UP."""
    if not ob.name.startswith(kind + '_'): ob.name = kind + '_' + ob.name
    return _link(ob)


def box(ob, kind='bld', metal=False):
    """A solid (bld_/solid_/prop_): reduced to a yaw-only box; walls push her out, the top is a floor whose edges
    grind on a swipe down. metal=True on a narrow one (< 1.2 m wide) makes its top a grind rail too."""
    if not ob.name.startswith(kind + '_'): ob.name = kind + '_' + ob.name
    if metal:
        m = bpy.data.materials.get('metal') or bpy.data.materials.new('metal')
        ob.data.materials.clear(); ob.data.materials.append(m)
    return _link(ob)


def box_new(name, center, size, yaw_deg=0.0, kind='bld', metal=False):
    """A collider box from numbers: center (Blender), size (x, y, z) metres, turned about Z."""
    me = bpy.data.meshes.new(kind + '_' + name)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(kind + '_' + name, me)
    ob.location = center; ob.scale = size; ob.rotation_euler = (0, 0, math.radians(yaw_deg))
    _link(ob)
    bpy.context.view_layer.update()
    apply_transforms(ob)
    return box(ob, kind, metal)


def apply_transforms(ob):
    """Bake location/rotation/scale into the mesh (the importer reads world vertices; never leave negative scale)."""
    me = ob.data
    me.transform(ob.matrix_world)
    ob.matrix_world.identity()


# ---------------------------------------------------------------- kit pieces (fn_)
_fn_count = {}


def kit(kind, size, loc, yaw_deg=0.0, draw=True, **opts):
    """A tested piece from the ramp kit, rebuilt by the game from its name. The ramp goes UP toward its local -Y in
    Blender (glTF +Z) -- i.e. with yaw 0 the rider climbs it heading Blender -Y. Only position and the turn about Z
    are read. draw=False: collider only, your art on top. Lists/dicts in opts are written as JSON text.
    Sizes: S 1.2, M 2.4, L 3.6, XL 4.8, XXL 7.2, MEGA 9.6 (deck heights). Kinds and options: RAMP_KIT.md."""
    n = _fn_count[(kind, size)] = _fn_count.get((kind, size), 0) + 1
    ob = _empty('fn_%s_%s_%d' % (kind, size, n), loc, 1.0, 'SINGLE_ARROW')
    ob.rotation_euler = (0, 0, math.radians(yaw_deg))
    if not draw: ob['draw'] = False
    for k, v in opts.items():
        ob[k] = json.dumps(v) if isinstance(v, (list, tuple, dict)) else v
    return ob


def piece_local(pts, loc, yaw_deg, with_y=False):
    """Blender world points -> a kit piece's own [u, w] (u up/along the piece, w across), or [u, w, y] with
    with_y=True (a `walk`'s per-point height above the piece's origin). For path pieces (`wall`, `deck`, `walk`,
    outlines): kit('wall', 'M', loc, yaw, pts=piece_local(pts, loc, yaw), closed=True, face='in', floor=True)."""
    y = math.radians(yaw_deg); s, c = math.sin(y), math.cos(y)
    out = []
    for p in pts:
        gx, gz = p[0] - loc[0], -(p[1] - loc[1])
        q = [round(gx * s + gz * c, 3), round(gx * c - gz * s, 3)]
        if with_y: q.append(round(p[2] - loc[2], 3))
        out.append(q)
    return out


# ---------------------------------------------------------------- checks
PREFIX = ('deck_', 'ramp_', 'ground_', 'road_', 'bld_', 'solid_', 'prop_', 'rail_', 'lane_', 'zone_boost_',
          'zone_water_', 'marker_', 'fn_', 'guide_')


def check():
    """Lint the COLLISION collection for the faults that have cost rounds before. Prints a report; returns issue count."""
    bad = []
    c = bpy.data.collections.get(COL)
    if c is None: print('no COLLISION collection'); return 1
    for ob in c.all_objects:
        nm = ob.name
        if not nm.startswith(PREFIX): bad.append('%s: no known prefix, will be IGNORED' % nm)
        if any(s < 0 for s in ob.matrix_world.to_scale()) or ob.matrix_world.determinant() < 0:
            bad.append('%s: negative scale / mirrored -- floors will face down and vanish' % nm)
        if nm.startswith(('bld_', 'solid_', 'prop_')) and ob.type == 'MESH':
            r = ob.matrix_world.to_euler()
            if abs(r.x) > 1e-3 or abs(r.y) > 1e-3: bad.append('%s: tilted box -- only a turn about Z is kept' % nm)
            zs = [(ob.matrix_world @ v.co).z for v in ob.data.vertices]
            if zs and max(zs) - min(zs) > 2.5 and any(k in nm.lower() for k in ('deck', 'bridge', 'walk', 'ramp', 'stair')):
                bad.append('%s: a walkway/bridge exported as a BOX is a solid block -- make it deck_/ramp_ triangles' % nm)
        if nm.startswith(('deck_', 'ramp_', 'ground_', 'road_')) and ob.type == 'MESH':
            m3 = ob.matrix_world.to_3x3().inverted().transposed()
            down = sum(1 for p in ob.data.polygons if (m3 @ p.normal).z < -0.03)
            if down and down >= len(ob.data.polygons) * 0.5:
                bad.append('%s: %d of %d faces point DOWN -- those are not floors (flip normals)' % (nm, down, len(ob.data.polygons)))
        if nm.startswith('rail_'):
            try:
                if len(json.loads(ob.get('grind_path_gltf', '[]'))) < 2: bad.append('%s: rail with < 2 points' % nm)
            except Exception: bad.append('%s: grind_path_gltf is not JSON' % nm)
        if nm.startswith('marker_launcher_') and 'target_gltf' not in ob: bad.append('%s: launcher with no target' % nm)
    spawns = [o for o in c.all_objects if o.name.startswith('marker_spawn_')]
    if not spawns: bad.append('no marker_spawn_ -- she will start at the origin')
    v = bpy.data.collections.get(VIS)
    if v:
        mats = {m for o in v.all_objects if o.type == 'MESH' for m in o.data.materials if m}
        if len(mats) > 6: bad.append('VISUAL uses %d materials (= draw calls); target 2-6 per zone' % len(mats))
        for im in bpy.data.images:
            if im.size[0] > 2048 or im.size[1] > 2048: bad.append('image %s is %dx%d -- 2048 max on a phone' % (im.name, im.size[0], im.size[1]))
    print('\n'.join(bad) if bad else 'check: clean')
    return len(bad)


# ---------------------------------------------------------------- export
def _select(cname):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in bpy.data.collections[cname].all_objects:
        ob.hide_set(False); ob.select_set(True)


def export_zone(folder, zone):
    """Writes <folder>/zone_<zone>/zone_<zone>_visual.glb (draco + webp) and _collision.glb (plain, with extras)."""
    import os
    d = os.path.join(folder, 'zone_' + zone); os.makedirs(d, exist_ok=True)
    common = dict(export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_extras=True,
                  export_animations=False, export_cameras=False, export_lights=False, export_tangents=False)
    _select(COL)
    bpy.ops.export_scene.gltf(filepath=os.path.join(d, 'zone_%s_collision.glb' % zone), export_draco_mesh_compression_enable=False,
                              export_materials='EXPORT', **common)
    _select(VIS)
    bpy.ops.export_scene.gltf(filepath=os.path.join(d, 'zone_%s_visual.glb' % zone), export_draco_mesh_compression_enable=True,
                              export_image_format='WEBP', **common)
    print('exported', d)
