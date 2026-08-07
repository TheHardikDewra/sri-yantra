"""
The Maha Meru: the Sri Yantra raised into three dimensions.

The flat figure (bhu-prastara) has nine enclosures.  The Meru gives each one
its own terrace, so the diagram becomes a stepped mountain with the bindu at
the summit.  From the base up:

    1 bhupura, the gated square      6 antardasara, the inner ten triangles
    2 the sixteen-petalled lotus     7 ashtakona, the eight triangles
    3 the eight-petalled lotus       8 trikona, the central triangle
    4 chaturdasara, fourteen         9 the bindu
    5 bahirdasara, the outer ten

Every terrace outline is measured, not modelled.  Each enclosure of triangles
is the set of points covered by at least d of the nine triangles, for
d = 1, 3, 5, 7, 9, and its outline is found by shooting a ray out from the
centre of E and taking the last crossing at which the cover count is still d
or more.  That is exact - the crossings are intersections of the ray with the
27 drawn segments - and it needs no polygon arithmetic.

The seven mountain outlines (trivritta up to trikona) are star-shaped about
the centre, so each is stored as a radius r(theta) and swept round the axis
into clean quad strips.  The gated square is NOT star-shaped - a radial sweep
fills the T-portals' re-entrant corners and melts the gates into tabs - so
the three bhupura lines are built as what they are: exact polygon prisms,
with ear-clipped caps and parallel-offset terrace bands.  The plinth and the
mountain are two watertight shells, the mountain's base embedded a little
into the plinth's top so the pair unions cleanly when sliced or printed.
"""

import math
import struct

from sri_yantra import solve, HUET
from arrangement import segments, _inside
from build import (LAYOUT, _polar, bhupura_points,
                   LOW_R, LOW_A, HIGH_R, HIGH_A)


# How far either side of a corner bearing an extra ray is fired, and the
# closest two rays are ever allowed to be. CORNER_NUDGE must stay comfortably
# above MIN_GAP or the pair straddling a corner gets thinned back to one.
CORNER_NUDGE = 2e-4
MIN_GAP = 2e-5
MIN_WALL = 2e-4
MIN_RISE = 0.055      # shortest wall the eye should still read as a step
EMBED = 0.02          # how deep the mountain's base sits inside the plinth


def _tri_depth(tris, p):
    return sum(1 for i in tris if _inside(tris[i], p))


def ray_outline(tris, origin, angles, d):
    """r(theta) for the region covered by at least `d` of the nine triangles."""
    segs = segments(tris)
    out = []
    for th in angles:
        ux, uy = math.cos(th), math.sin(th)
        ts = [0.0]
        for (p1, p2, _, _) in segs:
            x1, y1 = p1
            x2, y2 = p2
            ex, ey = x2 - x1, y2 - y1
            den = ux * ey - uy * ex
            if abs(den) < 1e-14:
                continue
            wx, wy = x1 - origin[0], y1 - origin[1]
            t = (wx * ey - wy * ex) / den
            s = (wx * uy - wy * ux) / den
            if t > 0 and -1e-12 <= s <= 1 + 1e-12:
                ts.append(t)
        ts.sort()
        best, star = 0.0, True
        for a, b in zip(ts, ts[1:]):
            mid = (a + b) / 2
            p = (origin[0] + ux * mid, origin[1] + uy * mid)
            if _tri_depth(tris, p) >= d:
                if best and best < a - 1e-12:
                    star = False        # cover resumed after a gap
                best = b
        if not star:
            raise ValueError(f"region depth>={d} is not star-shaped about "
                             f"{origin} at bearing {th:.6f}")
        out.append(best)
    return out


_PETAL_TABLES = {}


def _petal_table(n, r0, r1, samples=8192, bins=2048):
    """Silhouette radius of the petal ring over one fundamental domain.

    The ring is drawn as cubic beziers (petal_ring in build.py).  Sampling the
    actual drawn curve and keeping, per angle bin, the largest radius gives the
    silhouette exactly - including where LOW_A > 1 makes neighbouring petals
    cross near the cusps.  The figure repeats every 2*pi/n and mirrors about
    each petal centre, so one table over [cusp, centre] covers everything.
    """
    key = (n, round(r0, 12), round(r1, 12))
    if key not in _PETAL_TABLES:
        half = math.pi / n
        span = r1 - r0
        p = _polar(r0, -half)
        a = _polar(r0 + LOW_R * span, -half * LOW_A)
        b = _polar(r0 + HIGH_R * span, -half * HIGH_A)
        q = _polar(r1, 0.0)
        tbl = [0.0] * (bins + 1)
        for s in range(samples + 1):
            m = s / samples
            w = 1 - m
            x = w**3 * p[0] + 3 * w * w * m * a[0] + 3 * w * m * m * b[0] + m**3 * q[0]
            y = w**3 * p[1] + 3 * w * w * m * a[1] + 3 * w * m * m * b[1] + m**3 * q[1]
            # fold the sample's bearing into [-half, 0]: distance past the
            # nearest cusp, mirrored about the petal centre
            t = (math.atan2(y, x) + half) % (2 * half)
            u = min(t, 2 * half - t) - half
            j = min(bins, max(0, round((u + half) / half * bins)))
            r = math.hypot(x, y)
            if r > tbl[j]:
                tbl[j] = r
        for j in range(bins + 1):          # fill any bin the sampling skipped
            if tbl[j] == 0.0:
                lo = next(tbl[i] for i in range(j - 1, -1, -1) if tbl[i] > 0.0)
                hi = next((tbl[i] for i in range(j + 1, bins + 1)
                           if tbl[i] > 0.0), lo)
                tbl[j] = (lo + hi) / 2
        _PETAL_TABLES[key] = tbl
    return _PETAL_TABLES[key]


def _petal_r(n, r0, r1, th):
    """Radius of the petal ring at angle th - the curve the SVG draws."""
    half = math.pi / n
    bins = 2048
    tbl = _petal_table(n, r0, r1, bins=bins)
    t = (th + half) % (2 * half)
    u = min(t, 2 * half - t) - half
    f = (u + half) / half * bins
    j = min(bins - 1, max(0, int(f)))
    k = f - j
    return tbl[j] * (1 - k) + tbl[j + 1] * k


def _outline_r(pts, th):
    """Radius of a closed rectilinear outline at angle th, from the origin."""
    best = 0.0
    ux, uy = math.cos(th), math.sin(th)
    for a, b in zip(pts, pts[1:] + pts[:1]):
        ex, ey = b[0] - a[0], b[1] - a[1]
        den = ux * ey - uy * ex
        if abs(den) < 1e-14:
            continue
        t = (a[0] * ey - a[1] * ex) / den
        u = (a[0] * uy - a[1] * ux) / den
        if t > 0 and -1e-12 <= u <= 1 + 1e-12:
            best = max(best, t)
    return best


def tiers(tris, bindu, angles, L=LAYOUT):
    """The terrace outlines, outermost first, each as r(theta).

    The bhupura contributes three of them, not one. It is drawn in the plane as
    three parallel lines, and giving the solid a single extruded plate for the
    outermost of them throws that away - the gates flatten into plain tabs and
    the T-shaped portal stops reading. Three low steps, one per line, put the
    articulation back.
    """
    out = [(f"bhupura{k}", [_outline_r(bhupura_points(k, L), t) for t in angles])
           for k in range(len(L["bhupura"]))]
    out += [
        ("trivritta", [L["trivritta"][-1]] * len(angles)),
        ("lotus16", [_petal_r(16, *L["lotus16"], t) for t in angles]),
        ("lotus8", [_petal_r(8, *L["lotus8"], t) for t in angles]),
        ("circle", [L["circle"]] * len(angles)),
    ]
    for name, d in (("chaturdasara", 1), ("bahirdasara", 3),
                    ("antardasara", 5), ("ashtakona", 7), ("trikona", 9)):
        out.append((name, ray_outline(tris, bindu, angles, d)))
    return out


# --------------------------------------------------------------------------
# exact polygon prisms for the bhupura
# --------------------------------------------------------------------------

def _clean_ring(pts):
    """Drop consecutive duplicates and the closing repeat; force CCW."""
    out = []
    for p in pts:
        if not out or math.dist(p, out[-1]) > 1e-9:
            out.append(tuple(p))
    if len(out) > 1 and math.dist(out[0], out[-1]) <= 1e-9:
        out.pop()
    area2 = sum(a[0] * b[1] - b[0] * a[1]
                for a, b in zip(out, out[1:] + out[:1]))
    return out if area2 > 0 else out[::-1]


def _ear_clip(pts):
    """Triangulate a simple CCW polygon; returns index triples, CCW wound.

    O(n^3) worst case, which is nothing at the forty-odd vertices the gated
    square has.  Interior edges come out shared by exactly two triangles in
    opposite directions, which is what the watertight check needs.
    """
    def cross(o, a, b):
        return ((a[0] - o[0]) * (b[1] - o[1])
                - (a[1] - o[1]) * (b[0] - o[0]))

    def inside(p, a, b, c):
        e = -1e-12
        return (cross(a, b, p) > e and cross(b, c, p) > e
                and cross(c, a, p) > e)

    idx = list(range(len(pts)))
    out = []
    while len(idx) > 3:
        for k in range(len(idx)):
            i0 = idx[k - 1]
            i1 = idx[k]
            i2 = idx[(k + 1) % len(idx)]
            a, b, c = pts[i0], pts[i1], pts[i2]
            if cross(a, b, c) <= 1e-12:
                continue                     # reflex corner, not an ear
            if any(inside(pts[j], a, b, c)
                   for j in idx if j not in (i0, i1, i2)):
                continue                     # another vertex sits inside
            out.append((i0, i1, i2))
            del idx[k]
            break
        else:
            raise ValueError("ear clipping found no ear; polygon not simple?")
    out.append(tuple(idx))
    return out


def build_mesh(tris, bindu, n_ang=1440, height=2.15, base_h=0.20,
               bindu_h=0.10):
    """Vertices, triangle indices, and per-tier heights for the Meru.

    The mountain outlines are swept about the origin - the centre of the
    circle E, which the lotuses are concentric with, and which sits inside
    the central triangle, so all seven are star-shaped about it.  The gated
    square is not star-shaped, so the three bhupura lines are built as exact
    polygon prisms instead.  The summit alone is placed at the bindu, a
    little above that centre.
    """
    base = [2 * math.pi * k / n_ang for k in range(n_ang)]
    # add the exact bearing of every corner of the figure, twice over, so the
    # ridges of the triangle terraces stay sharp instead of being sampled off
    extra = []
    for (p1, p2, _, _) in segments(tris):
        for p in (p1, p2):
            a = math.atan2(p[1], p[0]) % (2 * math.pi)
            extra += [a - CORNER_NUDGE, a + CORNER_NUDGE]

    # Thin out samples that sit closer together than MIN_GAP. Two rays a
    # microradian apart give two vertices a fraction of a micron apart, which
    # survive in float64 but collapse onto each other when the mesh is written
    # to a float32 STL - and a collapsed vertex means a zero-area facet and a
    # shell that no longer closes. Spacing the rays keeps the export manifold.
    angles = []
    for a in sorted(x % (2 * math.pi) for x in base + extra):
        if not angles or a - angles[-1] >= MIN_GAP:
            angles.append(a)
    if 2 * math.pi - angles[-1] + angles[0] < MIN_GAP:
        angles.pop()                       # the seam counts as a gap too

    ts = tiers(tris, (0.0, 0.0), angles)

    # Force every tier strictly inside the one below it. Several tiers touch
    # their neighbour exactly: the chaturdasara reaches r = 1 at the base
    # corners of t3 and t7, which lie on E by condition (i), and each lotus
    # petal returns to its base circle at every cusp. Those tangencies are
    # correct in the plane but give the solid a wall of zero width, which
    # exports as a zero-area facet and breaks the shell. MIN_WALL is 6e-5 of
    # the model's width - far below anything visible or printable, and far
    # above float32's resolution at this scale.
    for i in range(1, len(ts)):
        outer, inner = ts[i - 1][1], ts[i][1]
        ts[i] = (ts[i][0], [min(r, outer[j] - MIN_WALL)
                            for j, r in enumerate(inner)])

    # Terrace heights follow the samatala meruprastara: the NINE avaranas
    # rise in EQUAL steps. The navavarana literature recognises three
    # elevation types for a meru - first three avaranas taller, middle three
    # taller, or all equal - and only the last is specified exactly, so that
    # is the one built. Tiers that are not avaranas of their own sit within
    # their avarana's band: the bhupura's three lines split band one in
    # thirds, the trivalaya drum carries the sixteen-petal ring partway
    # through band two, and the circle E rims the chaturdasara at the base of
    # band four. The bindu cone is the ninth avarana and gets a full step.
    total = base_h + height + bindu_h          # summit height, kept as was
    NINTH = total / 9
    z = [k * NINTH for k in (
        1 / 3, 2 / 3, 1,        # bhupura0..2        (avarana 1)
        1.45, 2,                # trivritta, lotus16 (avarana 2)
        3,                      # lotus8             (avarana 3)
        3.45, 4,                # circle E, chaturdasara (avarana 4)
        5, 6, 7, 8,             # bahir, antar, ashtakona, trikona (5-8)
    )]
    z.append(total)             # the bindu           (avarana 9)

    build_mesh.last_angles = angles
    build_mesh.last_tiers = ts
    build_mesh.last_z = z

    V, F = [], []
    m = len(angles)

    def vid(x, y, zz):
        V.append((x, y, zz))
        return len(V) - 1

    # ---- the plinth: three exact prisms, one per bhupura line -------------
    # The gated square is not star-shaped about the centre, so it cannot be
    # swept without melting the T-portals.  Each line is extruded as the
    # polygon it is.  The three outlines are parallel offsets of one another,
    # so their vertices correspond one to one and each tread between two of
    # them is a clean band of quads.
    NB = len(LAYOUT["bhupura"])
    rings2d = [_clean_ring(bhupura_points(k)) for k in range(NB)]
    assert len({len(r) for r in rings2d}) == 1, "bhupura outlines must match"
    build_mesh.last_bhupura = rings2d
    nb = len(rings2d[0])

    def wall(lo, hi):
        for j in range(nb):
            k = (j + 1) % nb
            F.append((lo[j], lo[k], hi[k]))
            F.append((lo[j], hi[k], hi[j]))

    def band(outer, inner):
        for j in range(nb):
            k = (j + 1) % nb
            F.append((outer[j], outer[k], inner[k]))
            F.append((outer[j], inner[k], inner[j]))

    floor_ring = [vid(x, y, 0.0) for x, y in rings2d[0]]
    for a, b, c in _ear_clip(rings2d[0]):            # underside, facing down
        F.append((floor_ring[a], floor_ring[c], floor_ring[b]))
    prev = floor_ring
    for k in range(NB):
        top = [vid(x, y, z[k]) for x, y in rings2d[k]]
        wall(prev, top)                              # riser of line k
        if k < NB - 1:
            inner = [vid(x, y, z[k]) for x, y in rings2d[k + 1]]
            band(top, inner)                         # tread at z[k]
            prev = inner
        else:
            for a, b, c in _ear_clip(rings2d[k]):    # cap, facing up
                F.append((top[a], top[b], top[c]))

    # ---- the mountain: the star-shaped outlines, swept --------------------
    # Its base cap sits EMBED below the plinth's cap, inside the solid, so
    # the two shells overlap and union cleanly in any slicer or boolean.
    zB = z[NB - 1] - EMBED

    # ring of vertices for outline i at height zz
    def ring(rs, zz):
        return [vid(rs[j] * math.cos(angles[j]),
                    rs[j] * math.sin(angles[j]), zz)
                for j in range(m)]

    def strip(a, b):
        """Quad band from ring a to ring b, wound so the normal faces out.

        With (r, theta, z) right-handed, this same order serves both a wall
        (a below b, normal radial) and a terrace (a outside b at one height,
        normal up), so walls and terraces share edges in opposite directions
        and the shell closes.
        """
        for j in range(m):
            k = (j + 1) % m
            F.append((a[j], b[k], b[j]))
            F.append((a[j], a[k], b[k]))

    centre_bottom = vid(0.0, 0.0, zB)
    prev_top = None
    for i in range(NB, len(ts)):
        rs = ts[i][1]
        low = ring(rs, z[i - 1] if i > NB else zB)
        high = ring(rs, z[i])
        if i == NB:
            for j in range(m):                       # underside
                F.append((centre_bottom, low[(j + 1) % m], low[j]))
        else:
            strip(prev_top, low)                     # terrace
        strip(low, high)                             # wall
        prev_top = high

    apex = vid(bindu[0], bindu[1], z[-1])   # the summit sits on the bindu
    for j in range(m):                               # the bindu
        F.append((prev_top[j], prev_top[(j + 1) % m], apex))

    return V, F, [name for name, _ in ts], z


# --------------------------------------------------------------------------
# export
# --------------------------------------------------------------------------

def write_stl(path, V, F):
    with open(path, "wb") as fh:
        fh.write(b"\0" * 80)
        fh.write(struct.pack("<I", len(F)))
        for a, b, c in F:
            p, q, r = V[a], V[b], V[c]
            u = (q[0] - p[0], q[1] - p[1], q[2] - p[2])
            v = (r[0] - p[0], r[1] - p[1], r[2] - p[2])
            nx = u[1] * v[2] - u[2] * v[1]
            ny = u[2] * v[0] - u[0] * v[2]
            nz = u[0] * v[1] - u[1] * v[0]
            ln = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
            fh.write(struct.pack("<3f", nx / ln, ny / ln, nz / ln))
            for w in (p, q, r):
                fh.write(struct.pack("<3f", *w))
            fh.write(b"\0\0")


def write_glb(path, V, F, colour=(0.72, 0.55, 0.26, 1.0)):
    """Minimal glTF 2.0 binary: one mesh, smooth-shaded, one PBR material."""
    import json

    nrm = [[0.0, 0.0, 0.0] for _ in V]
    for a, b, c in F:
        p, q, r = V[a], V[b], V[c]
        u = (q[0] - p[0], q[1] - p[1], q[2] - p[2])
        v = (r[0] - p[0], r[1] - p[1], r[2] - p[2])
        n = (u[1] * v[2] - u[2] * v[1],
             u[2] * v[0] - u[0] * v[2],
             u[0] * v[1] - u[1] * v[0])
        for i in (a, b, c):
            nrm[i][0] += n[0]
            nrm[i][1] += n[1]
            nrm[i][2] += n[2]
    for k in nrm:
        ln = math.sqrt(k[0] ** 2 + k[1] ** 2 + k[2] ** 2) or 1.0
        k[0] /= ln
        k[1] /= ln
        k[2] /= ln

    # glTF is y-up; the model is built z-up
    pos = b"".join(struct.pack("<3f", x, zz, -y) for x, y, zz in V)
    nor = b"".join(struct.pack("<3f", a, c, -b) for a, b, c in nrm)
    idx = b"".join(struct.pack("<3I", *f) for f in F)
    while len(pos) % 4:
        pos += b"\0"
    while len(nor) % 4:
        nor += b"\0"
    while len(idx) % 4:
        idx += b"\0"
    blob = pos + nor + idx

    xs = [v[0] for v in V]
    ys = [v[1] for v in V]
    zs = [v[2] for v in V]
    doc = {
        "asset": {"version": "2.0", "generator": "sri-yantra/meru.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "maha-meru"}],
        "meshes": [{"name": "maha-meru", "primitives": [
            {"attributes": {"POSITION": 0, "NORMAL": 1},
             "indices": 2, "material": 0}]}],
        "materials": [{
            "name": "meru",
            "pbrMetallicRoughness": {
                "baseColorFactor": list(colour),
                "metallicFactor": 0.85, "roughnessFactor": 0.35},
            "doubleSided": False,
        }],
        "buffers": [{"byteLength": len(blob)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0,
             "byteLength": len(pos), "target": 34962},
            {"buffer": 0, "byteOffset": len(pos),
             "byteLength": len(nor), "target": 34962},
            {"buffer": 0, "byteOffset": len(pos) + len(nor),
             "byteLength": len(idx), "target": 34963},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(V),
             "type": "VEC3",
             "min": [min(xs), min(zs), -max(ys)],
             "max": [max(xs), max(zs), -min(ys)]},
            {"bufferView": 1, "componentType": 5126, "count": len(V),
             "type": "VEC3"},
            {"bufferView": 2, "componentType": 5125, "count": len(F) * 3,
             "type": "SCALAR"},
        ],
    }
    js = json.dumps(doc, separators=(",", ":")).encode()
    while len(js) % 4:
        js += b" "

    with open(path, "wb") as fh:
        fh.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js)
                             + 8 + len(blob)))
        fh.write(struct.pack("<II", len(js), 0x4E4F534A))
        fh.write(js)
        fh.write(struct.pack("<II", len(blob), 0x004E4942))
        fh.write(blob)


def check_stl(path):
    """Re-read the written STL and check the file itself, not the mesh.

    The in-memory mesh can be perfect while the export is not: STL stores
    float32, so vertices that differ in the twelfth decimal weld together on
    write and leave zero-area facets behind. This validates what actually ships.
    """
    from collections import Counter
    d = open(path, "rb").read()
    n = struct.unpack("<I", d[80:84])[0]
    verts, faces = {}, []
    for i in range(n):
        o = 84 + i * 50
        tri = []
        for k in range(3):
            p = struct.unpack("<3f", d[o + 12 + k * 12: o + 24 + k * 12])
            verts.setdefault(p, len(verts))
            tri.append(verts[p])
        faces.append(tuple(tri))
    und, dirc, vol = Counter(), Counter(), 0.0
    for a, b, c in faces:
        for u, v in ((a, b), (b, c), (c, a)):
            und[(min(u, v), max(u, v))] += 1
            dirc[(u, v)] += 1
    for i in range(n):
        o = 84 + i * 50
        p = [struct.unpack("<3f", d[o + 12 + k * 12: o + 24 + k * 12])
             for k in range(3)]
        vol += (p[0][0] * (p[1][1] * p[2][2] - p[2][1] * p[1][2])
                - p[0][1] * (p[1][0] * p[2][2] - p[2][0] * p[1][2])
                + p[0][2] * (p[1][0] * p[2][1] - p[2][0] * p[1][1])) / 6.0
    # the plinth and the mountain are separate closed shells; Euler's formula
    # holds per connected component, so count the components first
    parent = list(range(len(verts)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for a, b, c in faces:
        for u, v2 in ((a, b), (b, c)):
            ra, rb = find(u), find(v2)
            if ra != rb:
                parent[ra] = rb
    shells = len({find(v2) for v2 in range(len(verts))})

    V, E, F = len(verts), len(und), len(faces)
    return {
        "file size consistent": len(d) == 84 + n * 50,
        "no degenerate facets":
            all(len(set(f)) == 3 for f in faces),
        "every edge shared by exactly two facets":
            all(v == 2 for v in und.values()),
        "every directed edge traversed once":
            all(v == 1 for v in dirc.values()),
        "every directed edge has an opposite":
            all((b, a) in dirc for a, b in dirc),
        f"Euler V-E+F == 2 per shell ({shells} shells)":
            V - E + F == 2 * shells,
        "volume positive, so normals face out": vol > 0,
    }


def check_watertight(V, F):
    """Every edge must be shared by exactly two triangles, once each way."""
    from collections import Counter
    c = Counter()
    for a, b, d in F:
        for u, v in ((a, b), (b, d), (d, a)):
            c[(u, v)] += 1
    bad_dir = [e for e, k in c.items() if k != 1]
    unpaired = [e for e in c if (e[1], e[0]) not in c]
    return len(bad_dir), len(unpaired)


if __name__ == "__main__":
    import json
    import os

    HERE = os.path.dirname(os.path.abspath(__file__))
    OUT = os.path.join(HERE, "..", "public", "data")

    tris = solve(HUET)
    doc = json.load(open(os.path.join(OUT, "sri-yantra.json")))
    bindu = tuple(doc["variants"]["huet"]["bindu"])

    V, F, names, z = build_mesh(tris, bindu)
    print(f"{len(V)} vertices, {len(F)} triangles")
    for nm, zz in zip(names, z):
        print(f"  {nm:<14} top at z = {zz:.4f}")
    print(f"  {'bindu':<14} top at z = {z[-1]:.4f}")
    bad, unp = check_watertight(V, F)
    print(f"watertight: {bad} mis-wound edges, {unp} unpaired edges "
          f"-> {'PASS' if bad == 0 and unp == 0 else 'FAIL'}")

    # The web page needs to know the height of the mountain under any point,
    # to run water down it and settle flowers on it. Raycasting a 59,200-facet
    # mesh in the browser is hopeless, and it is unnecessary: the staircase is
    # exactly these outlines at exactly these heights. Ship the profile.
    # Downsampled: the mesh carries thousands of rays so its ridges stay
    # sharp, but a height lookup only needs enough angles that a drop never
    # visibly steps sideways. 720 is a quarter of a degree.
    src_a = build_mesh.last_angles
    step = max(1, len(src_a) // 720)
    keep = list(range(0, len(src_a), step))
    NB = len(build_mesh.last_bhupura)
    profile = {
        "format": 2,
        "note": ("mountain tiers as r(theta) at the angles listed - they are "
                 "NOT uniformly spaced, search them; the bhupura as its three "
                 "outline polygons with their top heights. Plan coordinates "
                 "(x, y); the GLB maps a plan point to world (x, -y) in xz"),
        "angles": [round(src_a[i], 5) for i in keep],
        "tiers": [{"name": nm, "z": round(zz, 5),
                   "r": [round(rs[i], 5) for i in keep]}
                  for (nm, rs), zz in zip(build_mesh.last_tiers[NB:], z[NB:])],
        "bhupura": {
            "z": [round(zz, 5) for zz in z[:NB]],
            "outlines": [[[round(x, 5), round(y, 5)] for x, y in ring]
                         for ring in build_mesh.last_bhupura],
        },
    }
    with open(os.path.join(OUT, "meru-profile.json"), "w") as fh:
        json.dump(profile, fh, separators=(",", ":"))
    print(f"wrote meru-profile.json  "
          f"{os.path.getsize(os.path.join(OUT, 'meru-profile.json'))/1e3:.0f} kB")

    write_glb(os.path.join(OUT, "maha-meru.glb"), V, F)
    write_stl(os.path.join(OUT, "maha-meru.stl"), V, F)
    for f in ("maha-meru.glb", "maha-meru.stl"):
        p = os.path.join(OUT, f)
        print(f"wrote {f}  {os.path.getsize(p)/1e6:.2f} MB")

    print("\nthe written STL, checked as a file:")
    res = check_stl(os.path.join(OUT, "maha-meru.stl"))
    for k, v in res.items():
        print(f"  [{'ok' if v else 'FAIL'}] {k}")
    print("VERDICT:", "PASS" if all(res.values()) else "FAIL")
    if not all(res.values()):
        raise SystemExit(1)
