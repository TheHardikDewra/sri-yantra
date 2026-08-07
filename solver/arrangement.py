"""
Planar arrangement of the nine triangles.

The whole point of the concurrency conditions is topological: get them right
and the twenty-seven segments cut the disc into exactly 43 triangular regions,
grouped into the five enclosures named in the Rudrayamala Tantra - 1, 8, 10,
10 and 14, from the bindu outwards.  Get them even slightly wrong and stray
slivers appear where three lines nearly, but not quite, meet.  So counting the
faces is the real test of the solve.

Topology is decided in float64.  Genuinely distinct vertices of the figure are
~1e-3 apart, while points that the conditions force to coincide agree to ~1e-60,
so a 1e-9 merge tolerance separates the two cases with a margin of thirty
orders of magnitude either way.
"""

import math
from collections import defaultdict

TOL = 1e-9

# names of the five enclosures, innermost first
AVARANA_NAMES = [
    "trikona",       # 1  - the central triangle holding the bindu
    "ashtakona",     # 8
    "antardasara",   # 10 - inner ten
    "bahirdasara",   # 10 - outer ten
    "chaturdasara",  # 14
]
AVARANA_SIZES = [1, 8, 10, 10, 14]


def segments(tris):
    """The 27 drawn segments: base, left leg and right leg of each triangle."""
    out = []
    for i in sorted(tris):
        t = tris[i]
        b, w, a = float(t.b), float(t.w), float(t.a)
        out.append(((-w, b), (w, b), i, "base"))
        out.append(((-w, b), (0.0, a), i, "leg_l"))
        out.append(((w, b), (0.0, a), i, "leg_r"))
    return out


def _key(p):
    return (round(p[0] / TOL), round(p[1] / TOL))


def _seg_intersect(p1, p2, p3, p4):
    """Intersection of two closed segments, or None. Collinear pairs ignored."""
    x1, y1 = p1; x2, y2 = p2; x3, y3 = p3; x4, y4 = p4
    d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3)
    if abs(d) < 1e-14:
        return None
    t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d
    u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d
    e = TOL
    if -e <= t <= 1 + e and -e <= u <= 1 + e:
        return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))
    return None


def build(tris):
    """Split every segment at every crossing and return (verts, edges)."""
    segs = segments(tris)
    cuts = [[s[0], s[1]] for s in segs]

    for i in range(len(segs)):
        for j in range(i + 1, len(segs)):
            p = _seg_intersect(segs[i][0], segs[i][1], segs[j][0], segs[j][1])
            if p is not None:
                cuts[i].append(p)
                cuts[j].append(p)

    verts, index = [], {}

    def vid(p):
        k = _key(p)
        if k not in index:
            index[k] = len(verts)
            verts.append(p)
        return index[k]

    edges = set()
    for (p1, p2, _, _), pts in zip(segs, cuts):
        dx, dy = p2[0] - p1[0], p2[1] - p1[1]
        span = dx * dx + dy * dy
        ordered = sorted(
            {vid(p) for p in pts},
            key=lambda v: ((verts[v][0] - p1[0]) * dx
                           + (verts[v][1] - p1[1]) * dy) / span,
        )
        for a, b in zip(ordered, ordered[1:]):
            if a != b:
                edges.add((min(a, b), max(a, b)))
    return verts, sorted(edges)


def faces(verts, edges):
    """Every bounded face of the arrangement, as a list of vertex indices."""
    nbr = defaultdict(list)
    for a, b in edges:
        nbr[a].append(b)
        nbr[b].append(a)

    ang = {}
    for v, ns in nbr.items():
        ns.sort(key=lambda w: math.atan2(verts[w][1] - verts[v][1],
                                         verts[w][0] - verts[v][0]))
        ang[v] = {w: k for k, w in enumerate(ns)}

    todo = {(a, b) for a, b in edges} | {(b, a) for a, b in edges}
    out = []
    while todo:
        start = next(iter(todo))
        loop, cur = [], start
        while cur in todo:
            todo.discard(cur)
            loop.append(cur[0])
            u, v = cur
            ring = nbr[v]
            cur = (v, ring[(ang[v][u] - 1) % len(ring)])
            if cur == start:
                break
        if len(loop) >= 3:
            out.append(loop)

    bounded = []
    for loop in out:
        s = 0.0
        for a, b in zip(loop, loop[1:] + loop[:1]):
            s += verts[a][0] * verts[b][1] - verts[b][0] * verts[a][1]
        if s > 0:                       # counter-clockwise => bounded face
            bounded.append((loop, s / 2))
    return bounded


def _corners(loop, verts):
    """Drop vertices that merely sit on a straight side (T-junctions)."""
    keep = []
    n = len(loop)
    for k in range(n):
        p, q, r = verts[loop[k - 1]], verts[loop[k]], verts[loop[(k + 1) % n]]
        cross = ((q[0] - p[0]) * (r[1] - q[1])
                 - (q[1] - p[1]) * (r[0] - q[0]))
        scale = (math.hypot(q[0] - p[0], q[1] - p[1])
                 * math.hypot(r[0] - q[0], r[1] - q[1]))
        if scale > 0 and abs(cross) / scale > 1e-7:
            keep.append(loop[k])
    return keep


def cells(tris):
    """Every region the 27 segments cut out of the figure, with its depth.

    *depth* is how many of the nine primary triangles cover the region.
    """
    verts, edges = build(tris)
    out = []
    for loop, area in faces(verts, edges):
        c = _corners(loop, verts)
        pts = [verts[v] for v in c]
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        out.append({
            "pts": pts, "area": area, "centroid": (cx, cy), "n": len(c),
            "depth": sum(1 for i in tris if _inside(tris[i], (cx, cy))),
        })
    return out


def triangles(tris):
    """The 43 triangles of the five enclosures.

    A region belongs to the yantra exactly when an odd number of the nine
    primary triangles covers it - the even-odd fill rule, which is why
    traditional drawings alternate filled and open cells.  Under it every
    surviving region is a triangle, there are exactly 43, and depth 9, 7, 5, 3,
    1 picks out the trikona, ashtakona, antardasara, bahirdasara and
    chaturdasara in turn.  Both facts are asserted in `census`.
    """
    keep = [c for c in cells(tris) if c["depth"] % 2 == 1]
    for f in keep:
        f["ring"] = (9 - f["depth"]) // 2
        f["avarana"] = AVARANA_NAMES[f["ring"]]
    keep.sort(key=lambda f: (f["ring"],
                             -math.atan2(f["centroid"][1], f["centroid"][0])))
    return keep


def _inside(t, p):
    x, y = p
    b, w, a = float(t.b), float(t.w), float(t.a)
    lo, hi = (a, b) if a < b else (b, a)
    if not (lo < y < hi):
        return False
    return abs(x) < abs(t.x(y))


def census(tris):
    """Structural report. Returns (triangles, per-enclosure counts, checks)."""
    every = cells(tris)
    tri = triangles(tris)
    counts = [sum(1 for f in tri if f["ring"] == k)
              for k in range(len(AVARANA_SIZES))]
    checks = {
        "43 triangles": len(tri) == 43,
        "enclosures 1/8/10/10/14": counts == AVARANA_SIZES,
        "every odd-depth region is a triangle":
            all(c["n"] == 3 for c in every if c["depth"] % 2 == 1),
        "every quadrilateral has even depth":
            all(c["depth"] % 2 == 0 for c in every if c["n"] == 4),
        "no region has more than 4 sides": all(c["n"] <= 4 for c in every),
        "figure is mirror-symmetric": _mirrored(every),
    }
    return tri, counts, checks


def _mirrored(every):
    got = sorted((round(c["centroid"][0], 9), round(c["centroid"][1], 9))
                 for c in every)
    flip = sorted((round(-c["centroid"][0], 9), round(c["centroid"][1], 9))
                  for c in every)
    return all(abs(a[0] - b[0]) < 1e-9 and abs(a[1] - b[1]) < 1e-9
               for a, b in zip(got, flip))


if __name__ == "__main__":
    from sri_yantra import solve, HUET, TRADITIONAL, worst, residuals
    from mpmath import mp

    for name, params in (("Huet", HUET), ("traditional 48-unit", TRADITIONAL)):
        t = solve(params)
        tri, counts, checks = census(t)
        print(f"\n=== {name} ===")
        print(f"worst residual over {len(residuals(t))} conditions : "
              f"{mp.nstr(worst(t), 6)}")
        for k, n in enumerate(counts):
            print(f"  {AVARANA_NAMES[k]:<14} {n:>3}  (expect "
                  f"{AVARANA_SIZES[k]})")
        for k, v in checks.items():
            print(f"  [{'ok' if v else 'FAIL'}] {k}")
        print("VERDICT :", "PASS" if all(checks.values()) else "FAIL")
