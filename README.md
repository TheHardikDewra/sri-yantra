# Śrī Yantra, solved exactly

**Live: [sriyantra.vercel.app](https://sriyantra.vercel.app)**

The Śrī Yantra is nine isosceles triangles sharing one vertical axis. Drawing
nine triangles is easy. Drawing them so that every intersection lands where
tradition says it lands is not — it is a non-linear system with no
straightedge-and-compass shortcut, and almost every Śrī Yantra in circulation,
printed or cast, misses it.

This repository solves the figure from its defining conditions in 60-digit
arithmetic, checks every condition again from the answer, and renders the
result two ways: the flat figure (*bhū-prastāra*) and the nine-tiered mountain
(*Mahā Meru*).

**Worst residual over all 49 conditions: `1.16682e-61`.**

```
solver/sri_yantra.py    the conditions, and the solve
solver/arrangement.py   the planar arrangement, and the 43 triangles
solver/build.py         data + standalone SVG for the web page
solver/meru.py          the Meru mesh, and the GLB / STL export
public/                 the site (static, no build step)
```

## The conditions

Number the triangles t₁…t₉ by the height of their base, top down; t₁…t₅ point
down, t₆…t₉ point up. Each is fixed by three numbers: the height of its base,
the half-width of that base, and the height of its apex. Following Chiodo
(2021):

- **(i)** t₃ and t₇ share one circumscribed circle, E.
- **(ii)** The apex of one triangle is the midpoint of another's base, for
  seven pairs: (t₁,t₆) (t₈,t₁) (t₆,t₂) (t₉,t₃) (t₅,t₇) (t₄,t₈) (t₂,t₉).
- **(iii)** On each side of the axis, the leg of a downward triangle, the leg
  of an upward triangle and the base of a third meet at a single point —
  twelve times over.

That is 22 independent equations in 27 unknowns. Fixing E as the unit circle
spends two of the five remaining freedoms, leaving four real parameters: the
base heights of t₃, t₆, t₇ and t₉. Choose those and every other number is
forced.

### A seventh pair in condition (ii)

Chiodo's published list for (ii) has six pairs. With six, the system keeps one
degree of freedom too many and is *not* determined by his own four parameters.
The missing pair is **(t₁,t₆)**, and his construction already relies on it:
§2.3.2 fixes the leg of t₁ as "a ray *r* stemming from Q", and §2.2.2 defines Q
as the base point of t₆. Add it and the count comes out exactly as he states.
With it, every apex except those of t₃ and t₇ — which sit on E — is the base
point of another triangle.

### How it is solved

Rather than throw 27 unknowns at a solver, the conditions are applied in the
order Chiodo's straightedge construction resolves them. Each step pins one more
quantity, and the chain consumes every condition but one: ((iii); t₄,t₆,t₉).
That leftover becomes a single scalar equation in a single unknown — the height
of t₁'s base — closed by a one-dimensional root find at 60 digits.

### How it is checked

`residuals()` re-derives every condition **from the final coordinates alone**,
never from the chain that produced them: each triple of lines becomes a 3×3
determinant of normalised line equations, each circle condition a distance.
`census()` then rebuilds the planar arrangement and checks the structure.

```
$ python3 solver/arrangement.py

=== Huet ===
worst residual over 49 conditions : 1.16682e-61
  trikona          1  (expect 1)
  ashtakona        8  (expect 8)
  antardasara     10  (expect 10)
  bahirdasara     10  (expect 10)
  chaturdasara    14  (expect 14)
  [ok] 43 triangles
  [ok] enclosures 1/8/10/10/14
  [ok] every odd-depth region is a triangle
  [ok] every quadrilateral has even depth
  [ok] no region has more than 4 sides
  [ok] figure is mirror-symmetric
VERDICT : PASS
```

## Why 43 triangles, and what the other 31 regions are

Tradition counts 43 triangles in five enclosures — 1, 8, 10, 10, 14 — but the
nine triangles actually cut the figure into **74** regions. The 43 are picked
out by the **even-odd rule**: a region belongs to the yantra when an odd number
of the nine triangles covers it. Under that rule every survivor is a triangle,
there are exactly 43, and cover counts 9, 7, 5, 3, 1 give the trikoṇa,
aṣṭakoṇa, antardaśāra, bahirdaśāra and caturdaśāra in turn.

All 31 leftovers have an even cover count, and 21 of them are quadrilaterals —
which are genuinely present in the classical figure too, plainly visible at the
far left and right of Chiodo's own plate. This is why traditional Śrī Yantras
are painted with alternating filled and open cells.

## The enclosures outside the triangles

Nothing in the concurrency conditions constrains the lotuses, the three circles
or the bhūpura. Those follow the traditional canon in *Geometry of Srichakra*,
which sizes everything against an inner-most circle of diameter 108 units:

| element | diameter | radius, with E = 1 |
| --- | --- | --- |
| inner-most circle (the nine triangles) | 108 | 1 |
| eight-petalled lotus, *aṣṭadala* | 127 | 1.17593 |
| sixteen-petalled lotus, *ṣoḍaśadala* | 144 | 1.33333 |
| outer circle of the *trivalaya* | 108√2 | 1.41421 |
| circle enclosing the bhūpura | 224 | 2.07407 |

The bhūpura's twelve outermost corners lie on that last circle, on the lines at
30°, 45° and 60°: 45° gives the four corners of the square, 30° and 60° the
eight outer corners of the gates. Each gate is a T — a narrow neck rising off
the wall, then a wide cap — and the inner corners of the neck sit on the lines
at 15° and 75°.

## The Meru

Each of the nine enclosures gets its own terrace, so the diagram becomes a
stepped mountain with the bindu at the summit. Every terrace outline is
*measured*, not modelled: each enclosure of triangles is the set of points
covered by at least d of the nine triangles, for d = 1, 3, 5, 7, 9, and its
outline is found by shooting a ray out from the centre and taking the last
crossing at which the cover count is still d or more. That is exact and needs
no polygon arithmetic.

All ten outlines turn out to be star-shaped about the centre, so each is stored
as a radius r(θ) and the solid is a staircase profile swept round the axis.

Several tiers touch their neighbour exactly - the chaturdaśāra reaches r = 1 at
the base corners of t₃ and t₇, which lie on E by condition (i), and every lotus
petal returns to its base circle at each cusp. Those tangencies are correct in
the plane but give the solid a wall of zero width, which exports as a zero-area
facet and breaks the shell, so each tier is forced strictly inside the one below
it by 6e-5 of the model's width.

`check_stl()` then re-reads the written file and checks **the export, not the
mesh**: STL stores float32, so vertices differing in the twelfth decimal weld
together on write. The build fails if any of these regress:

```
the written STL, checked as a file:
  [ok] file size consistent
  [ok] no degenerate facets
  [ok] every edge shared by exactly two facets
  [ok] every directed edge traversed once
  [ok] every directed edge has an opposite
  [ok] Euler V-E+F == 2
  [ok] volume positive, so normals face out
VERDICT: PASS
```

The 3D view is clamped above the horizon. An inverted Śrī Yantra is a different
figure — the Śiva yantra of kāpālika practice — so the Meru is only ever shown
the way up it is meant to stand.

## Running it

```sh
pip install -r solver/requirements.txt
python3 solver/build.py    # geometry -> public/data/sri-yantra.{json,svg}
python3 solver/meru.py     # mesh     -> public/data/maha-meru.{glb,stl}
```

`public/` is a static site with no build step — serve it with anything.

```sh
cd public && python3 -m http.server 8765
```

## Sources

- A. Chiodo, *On the construction of the Śrī Yantra*, C. R. Math. Acad. Sci.
  Paris **359** (2021) 377–397. [doi:10.5802/crmath.163](https://doi.org/10.5802/crmath.163)
- G. Huet, *Śrī Yantra Geometry*, Theoretical Computer Science **281** (2002)
  609–628.
- N. J. Bolton & D. N. G. Macleod, *The geometry of the Śrī-Yantra*, Religion
  **7** (1977) 66–85.
- A. P. Kulaichev, *Śrīyantra and its mathematical properties*, Indian Journal
  of History of Science **19** (1984) 279–292.
- C. S. Rao, *Geometry of Srichakra* (Vagmi).

## Licence

MIT for the code. The figure itself is nobody's to license.
