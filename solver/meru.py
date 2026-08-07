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
bindu and taking the last crossing at which the cover count is still d or more.
That is exact - the crossings are intersections of the ray with the 27 drawn
segments - and it needs no polygon arithmetic.

All ten outlines turn out to be star-shaped about the bindu, so each is stored
as a radius r(theta).  The solid is then a staircase profile swept round the
axis, which meshes into clean quad strips and closes watertight.
"""

import math
import struct

from sri_yantra import solve, HUET
from arrangement import segments, _inside
from build import LAYOUT, _polar, bhupura_points


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


def _petal_r(n, r0, r1, th, belly=0.55, spread=1.0):
    """Radius of the petal ring at angle th - same curve the SVG draws."""
    half = math.pi / n
    k = round(th / (2 * half))
    am = 2 * half * k
    u = th - am
    # solve the quadratic Bezier for the parameter whose angle matches
    side = 1 if u >= 0 else -1
    p = _polar(r0, am + side * half)
    c = _polar(r0 + belly * (r1 - r0), am + side * half * spread)
    q = _polar(r1, am)
    # the curve runs from angle am + side*half at m = 0 to am at m = 1, so the
    # offset from am shrinks monotonically; bisect on its magnitude
    lo, hi = 0.0, 1.0
    for _ in range(60):
        m = (lo + hi) / 2
        x = (1 - m) ** 2 * p[0] + 2 * (1 - m) * m * c[0] + m * m * q[0]
        y = (1 - m) ** 2 * p[1] + 2 * (1 - m) * m * c[1] + m * m * q[1]
        a = (math.atan2(y, x) - am + math.pi) % (2 * math.pi) - math.pi
        if abs(a) > abs(u):
            lo = m
        else:
            hi = m
    m = (lo + hi) / 2
    x = (1 - m) ** 2 * p[0] + 2 * (1 - m) * m * c[0] + m * m * q[0]
    y = (1 - m) ** 2 * p[1] + 2 * (1 - m) * m * c[1] + m * m * q[1]
    return math.hypot(x, y)


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
    """The ten terrace outlines, outermost first, each as r(theta)."""
    wall = bhupura_points(0, L)
    out = [
        ("bhupura", [_outline_r(wall, t) for t in angles]),
        ("trivritta", [L["trivritta"][-1]] * len(angles)),
        ("lotus16", [_petal_r(16, *L["lotus16"], t) for t in angles]),
        ("lotus8", [_petal_r(8, *L["lotus8"], t) for t in angles]),
        ("circle", [L["circle"]] * len(angles)),
    ]
    for name, d in (("chaturdasara", 1), ("bahirdasara", 3),
                    ("antardasara", 5), ("ashtakona", 7), ("trikona", 9)):
        out.append((name, ray_outline(tris, bindu, angles, d)))
    return out


def build_mesh(tris, bindu, n_ang=1440, height=2.15, base_h=0.20,
               bindu_h=0.10):
    """Vertices, triangle indices, and per-tier heights for the Meru.

    Every outline is swept about the origin - the centre of the circle E,
    which the lotuses and the bhupura are concentric with, and which sits
    inside the central triangle, so all ten outlines are star-shaped about it.
    The summit alone is placed at the bindu, a little above that centre.
    """
    base = [2 * math.pi * k / n_ang for k in range(n_ang)]
    # add the exact bearing of every corner of the figure, twice over, so the
    # ridges of the triangle terraces stay sharp instead of being sampled off
    extra = []
    for (p1, p2, _, _) in segments(tris):
        for p in (p1, p2):
            a = math.atan2(p[1], p[0]) % (2 * math.pi)
            extra += [a - 2e-5, a + 2e-5]
    angles = sorted(set(round(a % (2 * math.pi), 9) for a in base + extra))

    ts = tiers(tris, (0.0, 0.0), angles)
    # terrace heights: a straight-sided pyramid reads best, so step by how far
    # each outline has shrunk rather than in equal slices
    mean = [sum(rs) / len(rs) for _, rs in ts]
    z = [base_h + height * (1 - m / mean[0]) for m in mean]
    z.append(z[-1] + bindu_h)

    V, F = [], []
    m = len(angles)

    def vid(x, y, zz):
        V.append((x, y, zz))
        return len(V) - 1

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

    centre_bottom = vid(0.0, 0.0, 0.0)
    prev_top = None
    for i, (_, rs) in enumerate(ts):
        low = ring(rs, z[i - 1] if i else 0.0)
        high = ring(rs, z[i])
        if i == 0:
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

    write_glb(os.path.join(OUT, "maha-meru.glb"), V, F)
    write_stl(os.path.join(OUT, "maha-meru.stl"), V, F)
    for f in ("maha-meru.glb", "maha-meru.stl"):
        p = os.path.join(OUT, f)
        print(f"wrote {f}  {os.path.getsize(p)/1e6:.2f} MB")
