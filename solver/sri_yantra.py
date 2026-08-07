"""
Exact geometry of the Sri Yantra (nava-yoni cakra).

The nine primary triangles t1..t9 all share one vertical axis of symmetry and
have horizontal bases. They are numbered by the height of their base, from the
top down; t1..t5 point downward (Shakti), t6..t9 point upward (Shiva).

Triangle i is fully described by three numbers:

    b_i   y of its base line
    w_i   half-length of its base  (w_i > 0)
    a_i   y of its apex, which lies on the axis

The right leg is the segment (0, a_i) -> (w_i, b_i); the left leg is its mirror.
It is convenient to work with the leg's reciprocal slope

    r_i = w_i / (b_i - a_i)      so that     x_i(y) = r_i * (y - a_i)

gives the x of the right leg at height y.

A drawing counts as a *Sri Yantra* only when the following concurrency
conditions hold (Chiodo, "On the construction of the Sri Yantra", C. R. Math.
359 (2021) 377-397, conditions (i)-(iii); equivalent to Huet 1990/2002).

(i)   t3 and t7 share one circumscribed circle E.

(ii)  The apex of t' is the base point (base midpoint) of t'' for
      (t', t'') in (t1,t6), (t8,t1), (t6,t2), (t9,t3), (t5,t7), (t4,t8), (t2,t9).

      Chiodo lists the last six.  The pair (t1,t6) is the seventh and is used
      implicitly in his own construction: section 2.3.2 fixes the leg of t1 as
      "a ray r stemming from Q", and Q is defined in section 2.2.2 as the base
      point of t6.  With it, every apex except those of t3 and t7 (which sit on
      E) is the base point of another triangle, and the system becomes exactly
      determined by the four parameters below - which is the count Chiodo
      states.  Without it the solution set has one extra dimension.

(iii) On each side of the axis, the leg of the downward triangle t', the leg of
      the upward triangle t''', and the base of t'' meet in a single point, for
      (t', t'', t''') in
        (t1,t2,t7) (t2,t3,t7) (t1,t3,t8) (t1,t4,t6) (t1,t5,t9) (t4,t6,t9)
        (t2,t7,t9) (t3,t7,t8) (t3,t8,t9) (t4,t4,t8) (t5,t5,t6) (t2,t6,t6)

Up to similarity the solutions form a four-parameter family.  Fixing E as the
unit circle about the origin, the four parameters are the base heights of
t3, t6, t7, t9.  Everything else is then forced, and this module recovers it
by a single one-dimensional root find in b1, carried out in 60-digit
arithmetic with mpmath.
"""

from mpmath import mp, mpf, sqrt, findroot

mp.dps = 60

IDX = range(1, 10)
DOWNWARD = (1, 2, 3, 4, 5)
UPWARD = (6, 7, 8, 9)

# condition (ii): apex of key == base of value
APEX_IS_BASE_OF = {1: 6, 8: 1, 6: 2, 9: 3, 5: 7, 4: 8, 2: 9}

# condition (iii): (leg of down, base of, leg of up)
TRIPLES = [
    (1, 2, 7), (2, 3, 7), (1, 3, 8), (1, 4, 6), (1, 5, 9), (4, 6, 9),
    (2, 7, 9), (3, 7, 8), (3, 8, 9), (4, 4, 8), (5, 5, 6), (2, 6, 6),
]

# Huet's canonical figure. Chiodo p.388 n.20: the base points of t3, t6, t7, t9
# sit at 0.332, 0.537, 0.602, 0.835 along the diameter OT = [0, 1], where O is
# the apex of t7 (top of E) and T is the apex of t3 (bottom of E).
HUET = (mpf("0.332"), mpf("0.537"), mpf("0.602"), mpf("0.835"))

# Kaivalyasrama's traditional method A: the diameter is cut into 48 parts and
# the nine base lines are drawn at 6, 12, 17, 20, 23, 27, 30, 36, 42.  The four
# that are free here are 17, 27, 30, 42.
TRADITIONAL = tuple(mpf(n) / 48 for n in (17, 27, 30, 42))


def _y(t):
    """Diameter coordinate t in [0,1] (0 = top of E) -> y on the unit circle."""
    return 1 - 2 * mpf(t)


class Triangle:
    __slots__ = ("i", "b", "w", "a")

    def __init__(self, i, b, w, a):
        self.i, self.b, self.w, self.a = i, b, w, a

    @property
    def r(self):
        """Reciprocal slope of the right leg: x(y) = r * (y - a)."""
        return self.w / (self.b - self.a)

    def x(self, y):
        """x of the right leg at height y (extended to the whole line)."""
        return self.r * (y - self.a)

    @property
    def points(self):
        return ((-self.w, self.b), (self.w, self.b), (mpf(0), self.a))

    @property
    def down(self):
        return self.i in DOWNWARD


def _chain(b1, p):
    """Given the free parameters and a trial b1, propagate the whole figure.

    Every step below is one of the conditions above solved for one unknown, in
    the order in which Chiodo's straightedge construction resolves them.
    Returns the nine triangles plus the residual of the one condition that is
    left over, ((iii); t4, t6, t9), which closes the figure.
    """
    b3, b6, b7, b9 = p

    a3, a7 = mpf(-1), mpf(1)                       # (i) + unit-circle gauge
    w3 = sqrt(1 - b3 ** 2)
    w7 = sqrt(1 - b7 ** 2)
    r3 = w3 / (b3 - a3)
    r7 = w7 / (b7 - a7)

    a1, a2, a5, a9 = b6, b9, b7, b3                # (ii)
    a8 = b1                                        # (ii); t8, t1

    # (iii); t2, t3, t7  ->  leg of t2
    r2 = r7 * (b3 - a7) / (b3 - a2)
    # (iii); t2, t7, t9  ->  leg of t9
    r9 = r2 * (b7 - a2) / (b7 - a9)
    w9 = r9 * (b9 - a9)
    # (iii); t3, t8, t9  ->  base of t8
    b8 = -(r9 * b3 + r3) / (r3 - r9)
    a4 = b8                                        # (ii); t4, t8
    # (iii); t3, t7, t8  ->  leg of t8
    r8 = r3 * (b7 - a3) / (b7 - a8)
    w8 = r8 * (b8 - a8)
    # (iii); t1, t3, t8  ->  leg of t1
    r1 = r8 * (b3 - a8) / (b3 - a1)
    w1 = r1 * (b1 - a1)
    # (iii); t1, t2, t7  ->  base of t2
    b2 = (r1 * a1 - r7 * a7) / (r1 - r7)
    w2 = r2 * (b2 - a2)
    a6 = b2                                        # (ii); t6, t2
    # (iii); t2, t6, t6  ->  base half-width of t6
    w6 = r2 * (b6 - a2)
    r6 = w6 / (b6 - a6)
    # (iii); t1, t5, t9  ->  base of t5
    b5 = (r1 * a1 - r9 * a9) / (r1 - r9)
    # (iii); t5, t5, t6  ->  leg of t5
    r5 = r6 * (b5 - a6) / (b5 - a5)
    w5 = r5 * (b5 - a5)
    # (iii); t1, t4, t6  ->  base of t4
    b4 = (r1 * a1 - r6 * a6) / (r1 - r6)
    # (iii); t4, t4, t8  ->  leg of t4
    r4 = r8 * (b4 - a8) / (b4 - a4)
    w4 = r4 * (b4 - a4)

    tris = {
        1: Triangle(1, b1, w1, a1), 2: Triangle(2, b2, w2, a2),
        3: Triangle(3, b3, w3, a3), 4: Triangle(4, b4, w4, a4),
        5: Triangle(5, b5, w5, a5), 6: Triangle(6, b6, w6, a6),
        7: Triangle(7, b7, w7, a7), 8: Triangle(8, b8, w8, a8),
        9: Triangle(9, b9, w9, a9),
    }
    # (iii); t4, t6, t9 -- the condition the chain never consumed
    closing = tris[4].x(b6) - tris[9].x(b6)
    return tris, closing


def solve(params=HUET, b1_guess=mpf("0.75")):
    """Solve for the unique Sri Yantra with the given four base heights."""
    p = tuple(_y(t) for t in params)

    def f(b1):
        return _chain(b1, p)[1]

    b1 = findroot(f, b1_guess, tol=mpf(10) ** (-2 * mp.dps // 3))
    tris, _ = _chain(b1, p)
    return tris


# --------------------------------------------------------------------------
# verification
# --------------------------------------------------------------------------

def residuals(tris):
    """Every defining condition, restated from scratch and measured.

    Nothing here reuses the solving chain: each condition is recomputed from
    the final coordinates alone, so a small residual is real evidence.
    """
    out = {}

    # (i) t3 and t7 are inscribed in the same circle; gauge fixes it to |z| = 1
    for i in (3, 7):
        t = tris[i]
        out[f"(i) t{i} base corner on E"] = t.w ** 2 + t.b ** 2 - 1
        out[f"(i) t{i} apex on E"] = abs(t.a) - 1

    # (ii) apex of t' is the base midpoint of t''
    for i, j in APEX_IS_BASE_OF.items():
        out[f"(ii) apex t{i} = base t{j}"] = tris[i].a - tris[j].b

    # (iii) three lines through one point.  Recomputed as a determinant of the
    # three lines rather than by the substitution used while solving.
    for d, m, u in TRIPLES:
        lines = [_leg_line(tris[d]), _base_line(tris[m]), _leg_line(tris[u])]
        out[f"(iii) t{d},t{m},t{u}"] = _det3(lines)

    # structural sanity: bases ordered top to bottom, positive widths,
    # apexes on the correct side of their base
    for i in IDX:
        t = tris[i]
        out[f"[width] t{i} > 0"] = min(t.w, mpf(0))
        sign = 1 if t.down else -1
        out[f"[sense] t{i}"] = min(sign * (t.b - t.a), mpf(0))
    for i in range(1, 9):
        out[f"[order] b{i} > b{i+1}"] = min(tris[i].b - tris[i + 1].b, mpf(0))
    return out


def _leg_line(t):
    """Right leg as (A, B, C) with A x + B y + C = 0, through (0,a),(w,b)."""
    x1, y1 = mpf(0), t.a
    x2, y2 = t.w, t.b
    return (y1 - y2, x2 - x1, x1 * y2 - x2 * y1)


def _base_line(t):
    return (mpf(0), mpf(1), -t.b)


def _det3(rows):
    (a1, b1, c1), (a2, b2, c2), (a3, b3, c3) = rows
    # normalise each line so the determinant is scale-free and comparable
    def n(a, b, c):
        s = sqrt(a * a + b * b)
        return a / s, b / s, c / s
    a1, b1, c1 = n(a1, b1, c1)
    a2, b2, c2 = n(a2, b2, c2)
    a3, b3, c3 = n(a3, b3, c3)
    return (a1 * (b2 * c3 - b3 * c2)
            - b1 * (a2 * c3 - a3 * c2)
            + c1 * (a2 * b3 - a3 * b2))


def worst(tris):
    return max(abs(v) for v in residuals(tris).values())


if __name__ == "__main__":
    for name, params in (("Huet", HUET), ("traditional 48-unit", TRADITIONAL)):
        tris = solve(params)
        print(f"\n=== {name} ===")
        print(f"{'i':>2} {'base y':>22} {'half-width':>22} {'apex y':>22}")
        for i in IDX:
            t = tris[i]
            print(f"{i:>2} {mp.nstr(t.b, 18):>22} {mp.nstr(t.w, 18):>22} "
                  f"{mp.nstr(t.a, 18):>22}")
        w = worst(tris)
        print(f"worst residual over all {len(residuals(tris))} checks: "
              f"{mp.nstr(w, 6)}")
