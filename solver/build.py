"""
Solve, verify, and emit the data the renderers consume.

Writes public/data/sri-yantra.json (exact geometry, 60 significant digits kept
alongside float64) and public/data/sri-yantra.svg (a standalone drawing).
"""

import json
import math
import os

from mpmath import mp

from sri_yantra import solve, residuals, worst, HUET, TRADITIONAL, IDX
from arrangement import cells, triangles, census, AVARANA_NAMES

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "public", "data")

# --------------------------------------------------------------------------
# The enclosures outside the nine triangles
# --------------------------------------------------------------------------
# The concurrency conditions say nothing past the circle E, so these come from
# the traditional canon set out in "Geometry of Srichakra" (Vagmi), which sizes
# everything against an inner-most circle of diameter 108 units:
#
#     108  the inner-most circle, holding the nine triangles
#     127  the eight-petalled lotus     (ashtadala)
#     144  the sixteen-petalled lotus   (shodashadala), and the inmost
#          circle of the trivalaya - the two lotus rings then have nearly
#          equal area
#     153  the outermost circle of the trivalaya, which is 108 x sqrt(2):
#          the diagonal of a square of side 108
#     224  the circle enclosing the bhupura
#
# Working in radii, with E = 1, every diameter above divides by 108.
UNIT = 1.0 / 108.0
R224 = 224 * UNIT                       # 2.074074, the bhupura's own circle
SQRT2 = 2 ** 0.5

# The bhupura is a square drawn with three parallel lines and a gate at the
# middle of each side.  Its twelve outermost corners lie on the 224 circle, on
# the lines at 30, 45 and 60 degrees: 45 gives the four corners of the square,
# 30 and 60 the eight outer corners of the gates.  Each gate is a T - a narrow
# neck rising off the square, then a wide cap - and the inner corners of the
# neck sit on the lines at 15 and 75 degrees.
S_OUTER = R224 * math.cos(math.radians(45))     # half-side, outer line
S_INNER = SQRT2                                 # tangent to the trivalaya
INSET = (S_OUTER - S_INNER) / 2                 # gap between parallel lines
GATE_CAP = R224 * math.cos(math.radians(60))    # half-width of the cap
GATE_REACH = R224 * math.sin(math.radians(60))  # how far the gate reaches out
GATE_NECK = S_OUTER * math.tan(math.radians(15))   # half-width of the neck
GATE_STEP = (S_OUTER + GATE_REACH) / 2          # where the neck meets the cap

LAYOUT = {
    "circle": 1.0,
    "lotus8": [1.0, 127 * UNIT],
    "lotus16": [127 * UNIT, 144 * UNIT],
    # inmost trivalaya circle doubles as the lotus boundary; the outermost is
    # sqrt(2), and the two between are evenly spaced
    "trivritta": [144 * UNIT + k * (SQRT2 - 144 * UNIT) / 3 for k in range(4)],
    "bhupura": [S_OUTER - k * INSET for k in range(3)],
    "bhupura_circle": R224,
    "gate": {
        "cap": GATE_CAP, "reach": GATE_REACH,
        "neck": GATE_NECK, "step": GATE_STEP, "inset": INSET,
    },
    "bindu": 0.020,
}

# The nine avaranas of the Sri Chakra, outermost first, as they are enumerated
# in worship - and, in the Meru, as the nine tiers from base to summit.
AVARANAS = [
    ("trailokyamohana", "bhupura, three lines and four gates"),
    ("sarvashaparipuraka", "sixteen-petalled lotus"),
    ("sarvasamkshobhana", "eight-petalled lotus"),
    ("sarvasaubhagyadayaka", "fourteen triangles"),
    ("sarvarthasadhaka", "outer ten triangles"),
    ("sarvarakshakara", "inner ten triangles"),
    ("sarvarogahara", "eight triangles"),
    ("sarvasiddhiprada", "the central triangle"),
    ("sarvanandamaya", "the bindu"),
]


def _f(x):
    return float(x)


def _points_up(pts):
    """True when a cell's odd vertex is above its horizontal edge."""
    ys = sorted(p[1] for p in pts)
    return (ys[2] - ys[1]) > (ys[1] - ys[0])


def payload(params, name):
    tris = solve(params)
    tri43, counts, checks = census(tris)
    every = cells(tris)
    res = residuals(tris)

    return {
        "name": name,
        "parameters": {
            "note": ("base points of t3, t6, t7, t9 as a fraction of the "
                     "diameter OT, measured from the top of E"),
            "values": [float(p) for p in params],
        },
        "triangles": [
            {
                "i": i,
                "direction": "down" if tris[i].down else "up",
                "base_y": _f(tris[i].b),
                "half_width": _f(tris[i].w),
                "apex_y": _f(tris[i].a),
                "exact": {
                    "base_y": mp.nstr(tris[i].b, 40),
                    "half_width": mp.nstr(tris[i].w, 40),
                    "apex_y": mp.nstr(tris[i].a, 40),
                },
                "points": [[-_f(tris[i].w), _f(tris[i].b)],
                           [_f(tris[i].w), _f(tris[i].b)],
                           [0.0, _f(tris[i].a)]],
            }
            for i in IDX
        ],
        "cells": [
            {
                "points": [[round(x, 12), round(y, 12)] for x, y in c["pts"]],
                "depth": c["depth"],
                "sides": c["n"],
                "area": round(c["area"], 12),
                "in_yantra": c["depth"] % 2 == 1,
            }
            for c in every
        ],
        "yantra_triangles": [
            {
                "points": [[round(x, 12), round(y, 12)] for x, y in c["pts"]],
                "avarana": c["avarana"],
                "ring": c["ring"],
                "points_up": _points_up(c["pts"]),
                "depth": c["depth"],
                "area": round(c["area"], 12),
                "centroid": [round(c["centroid"][0], 12),
                             round(c["centroid"][1], 12)],
            }
            for c in tri43
        ],
        # The bindu sits at the centre of the central triangle, which is a
        # little above the centre of the circle - as it is in Chiodo's figures.
        "bindu": [round(tri43[0]["centroid"][0], 12),
                  round(tri43[0]["centroid"][1], 12)],
        "counts": dict(zip(AVARANA_NAMES, counts)),
        "layout": LAYOUT,
        "avaranas": [{"name": n, "what": w} for n, w in AVARANAS],
        "verification": {
            "conditions_checked": len(res),
            "worst_residual": mp.nstr(worst(tris), 6),
            "working_precision_digits": mp.dps,
            "structure": checks,
            "regions_total": len(every),
            "regions_in_yantra": len(tri43),
        },
    }


# --------------------------------------------------------------------------
# standalone SVG
# --------------------------------------------------------------------------

def _polar(r, a):
    return (r * math.cos(a), r * math.sin(a))


# Shape of one lotus petal, as two cubics from base corner to tip and back.
# The low handle sits at LOW_R of the way out and LOW_A of the way across,
# which gives the petal its shoulders; the high handle at HIGH_R / HIGH_A pulls
# the sides in so they arrive at the tip along different directions and meet in
# a cusp.  LOW_A above 1.0 makes neighbouring petals cross themselves, and a
# high handle beyond the tip radius rounds the point off.
LOW_R, LOW_A, HIGH_R, HIGH_A = 0.30, 1.02, 0.74, 0.40


def petal_ring(n, r0, r1):
    """A ring of n lotus petals between radii r0 and r1, as SVG path data.

    Neighbouring petals share their base point, so the ring reads as one
    scalloped band with no gap (kesara) between petals, as the canon insists.
    """
    half = math.pi / n
    span = r1 - r0
    out = []
    for k in range(n):
        am = 2 * math.pi * k / n
        p0, p1 = _polar(r0, am - half), _polar(r0, am + half)
        tip = _polar(r1, am)
        a = _polar(r0 + LOW_R * span, am - half * LOW_A)
        b = _polar(r0 + HIGH_R * span, am - half * HIGH_A)
        c = _polar(r0 + HIGH_R * span, am + half * HIGH_A)
        d = _polar(r0 + LOW_R * span, am + half * LOW_A)
        out.append(
            f"M{p0[0]:.6f},{-p0[1]:.6f}"
            f"C{a[0]:.6f},{-a[1]:.6f} {b[0]:.6f},{-b[1]:.6f} "
            f"{tip[0]:.6f},{-tip[1]:.6f}"
            f"C{c[0]:.6f},{-c[1]:.6f} {d[0]:.6f},{-d[1]:.6f} "
            f"{p1[0]:.6f},{-p1[1]:.6f}"
        )
    return " ".join(out)


def bhupura_points(k=0, L=LAYOUT):
    """The k-th of the three parallel bhupura lines, as a closed point list.

    One side is laid out and then rotated a quarter turn three times.  Walking
    the top side from its left corner inwards, the outline runs along the
    square, turns out and up the near face of the neck, back out along the
    underside of the cap, up the cap's flank and across its top - the T-shaped
    portal of Fig. 1.2 in the Vagmi text.

    `k` counts inwards from the outer line, and each edge simply moves toward
    the interior by one gap, which is what "three parallel lines" means.
    """
    g = L["gate"]
    d = k * g["inset"]
    s = L["bhupura"][0] - d
    reach = g["reach"] - d
    step = g["step"] + d               # faces down, so it insets upward
    cap = g["cap"] - d
    neck = g["neck"] - d
    side = [(-s, s), (-neck, s), (-neck, step), (-cap, step), (-cap, reach),
            (cap, reach), (cap, step), (neck, step), (neck, s), (s, s)]
    pts = []
    for q in range(4):
        for x, y in side:
            for _ in range(q):            # rotate a quarter turn clockwise
                x, y = y, -x
            if not pts or math.dist((x, y), pts[-1]) > 1e-9:
                pts.append((x, y))
    return pts


def bhupura(k=0, L=LAYOUT):
    pts = bhupura_points(k, L)
    return "M" + " L".join(f"{x:.6f},{-y:.6f}" for x, y in pts) + " Z"


def to_svg(data, size=1000, ink="#1a1a1a", paper="#faf7f2", fill="#c9553d"):
    L = data["layout"]
    span = L["gate"]["reach"] + 0.04
    sc = size / (2 * span)
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" '
        f'height="{size}" viewBox="0 0 {size} {size}">',
        f'<rect width="{size}" height="{size}" fill="{paper}"/>',
        f'<g transform="translate({size/2},{size/2}) scale({sc})" '
        f'fill="none" stroke="{ink}" stroke-width="{2.0/sc:.6f}" '
        f'stroke-linejoin="round">',
    ]
    for k in range(len(L["bhupura"])):
        parts.append(f'<path d="{bhupura(k, L)}"/>')
    for r in L["trivritta"]:
        parts.append(f'<circle cx="0" cy="0" r="{r}"/>')
    for n, band in ((16, L["lotus16"]), (8, L["lotus8"])):
        parts.append(f'<path d="{petal_ring(n, *band)}"/>')
    parts.append(f'<circle cx="0" cy="0" r="{L["circle"]}"/>')

    for t in data["yantra_triangles"]:
        d = " ".join(f"{x:.9f},{-y:.9f}" for x, y in t["points"])
        parts.append(f'<polygon points="{d}" fill="{fill}" '
                     f'fill-opacity="0.10" stroke="none"/>')
    for t in data["triangles"]:
        d = " ".join(f"{x:.9f},{-y:.9f}" for x, y in t["points"])
        parts.append(f'<polygon points="{d}"/>')
    bx, by = data["bindu"]
    parts.append(f'<circle cx="{bx:.9f}" cy="{-by:.9f}" '
                 f'r="{L["bindu"]}" fill="{ink}" stroke="none"/>')
    parts.append("</g></svg>")
    return "".join(parts)


def main():
    os.makedirs(OUT, exist_ok=True)
    huet = payload(HUET, "huet")
    trad = payload(TRADITIONAL, "traditional")
    doc = {
        "about": ("Geometry of the Sri Yantra solved from the concurrency "
                  "conditions of Chiodo (2021) / Huet (1990, 2002). "
                  "Coordinates are in units of the radius of the circle that "
                  "circumscribes t3 and t7, centred on the origin, y upwards."),
        "variants": {"huet": huet, "traditional": trad},
    }
    with open(os.path.join(OUT, "sri-yantra.json"), "w") as fh:
        json.dump(doc, fh, separators=(",", ":"))
    with open(os.path.join(OUT, "sri-yantra.svg"), "w") as fh:
        fh.write(to_svg(huet))

    v = huet["verification"]
    print(f'wrote {os.path.join(OUT, "sri-yantra.json")}')
    print(f'wrote {os.path.join(OUT, "sri-yantra.svg")}')
    print(f'conditions checked : {v["conditions_checked"]}')
    print(f'worst residual     : {v["worst_residual"]}')
    print(f'regions            : {v["regions_total"]} total, '
          f'{v["regions_in_yantra"]} in the yantra')
    for key, ok in v["structure"].items():
        print(f'  [{"ok" if ok else "FAIL"}] {key}')


if __name__ == "__main__":
    main()
