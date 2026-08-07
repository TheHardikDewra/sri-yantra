# Context for Fable

Handoff from Opus. Hardik is continuing this with you. Read this before
touching anything — several of the things that look wrong are load-bearing,
and several of the things that look fine are traps I already fell into.

---

## What this is

A Śrī Yantra solved from its defining geometry rather than drawn by eye, and
rendered two ways: the flat figure and the nine-tiered Mahā Meru. On the Meru,
the **ṣoḍaśopacāra** — the sixteen services — can be performed as a guided
sequence.

- **Live:** https://sriyantra.vercel.app (also `sri-meru.vercel.app`,
  `sri-yantra-mu.vercel.app` — all three alias the same deployment)
- **Repo:** https://github.com/TheHardikDewra/sri-yantra
- **Local:** `~/Documents/sri-yantra`

`sri-yantra.vercel.app` is **not** ours — it belongs to someone else.

---

## Hard rules — do not break these

1. **No mantras anywhere.** The upacāra names and the acts are open knowledge
   and are given in full. The bīja syllables are not on this page and the
   sequence is written so nothing depends on them. This is Hardik's standing
   instruction, not a stylistic choice. Verify after any change:
   ```sh
   curl -sL https://sriyantra.vercel.app/js/puja.js | grep -ciE 'hr[iī][ṃm]|kl[iī][ṃm]|śr[iī][ṃm]|aiṃ|sauḥ'   # must be 0
   ```
2. **No gradients, no glows** in CSS/markup. Flat colour only. (Lighting a 3D
   surface is physics and is fine; a decorative CSS gradient is not.)
3. **The 3D view is clamped above the horizon.** An inverted Śrī Yantra is a
   different figure — the Śiva yantra of kāpālika practice. `maxPolarAngle`
   must stay below π/2. Straight down is fine and is offered as a preset.
4. **No `Co-Authored-By` trailer** in commits.
5. **Never move the repo** or rename its directory.

---

## Layout

```
solver/sri_yantra.py    the concurrency conditions, and the solve
solver/arrangement.py   the planar arrangement, and the 43 triangles
solver/build.py         geometry + canonical layout -> JSON and a standalone SVG
solver/meru.py          the Meru mesh, the GLB/STL export, the height profile
solver/run.sh           regenerates everything; works from any directory
public/index.html       the page (one file, no build step)
public/styles.css       flat tokens, light + dark, manual override
public/js/yantra2d.js   the flat figure, drawn from the solved coordinates
public/js/meru3d.js     the Meru viewer, camera, materials, lights
public/js/puja.js       the sixteen services
public/data/            generated — do not hand-edit
```

Regenerate and deploy:
```sh
./solver/run.sh                       # rebuilds data/, fails loudly if invariants break
vercel deploy --prod --yes
vercel alias set <deployment-host> sriyantra.vercel.app     # and the other two
```

---

## The maths — do not "simplify" this

The nine triangles are solved from the concurrency conditions of Chiodo (2021)
/ Huet (1990, 2002) at 60 digits. **Worst residual over 49 conditions:
`1.16682e-61`.**

Two findings you should know before editing the solver:

- **Chiodo's condition (ii) is missing a pair.** His published list has six.
  The seventh is **(t₁,t₆)** — the apex of t₁ is the base point of t₆. Without
  it the system keeps a spare degree of freedom and is *not* determined by his
  own four parameters. His §2.3.2 already relies on it ("a ray *r* stemming
  from Q"; §2.2.2 defines Q as the base point of t₆).
- **"43 triangles" is not all the regions.** The nine triangles cut the figure
  into **74**. The 43 are the odd-cover ones under the even-odd fill rule; all
  31 leftovers have even cover and 21 are quadrilaterals — which are genuinely
  in the authentic figure too.

The enclosures outside the triangles (lotuses, trivalaya, bhūpura) are *not*
forced by the maths. They follow the 108-unit canon in C. S. Rao's *Geometry of
Srichakra*: 108 inner circle, 127 eight-petal, 144 sixteen-petal, 108√2
trivalaya, 224 bhūpura circle; twelve outer corners on the 30/45/60 lines; each
gate a **T** with its neck corners on the 15/75 lines.

`./solver/run.sh` and `python3 solver/arrangement.py` must both print
`VERDICT: PASS`. The STL check runs on the **written file**, not the in-memory
mesh, and exits non-zero on regression. Keep it that way — it caught a real
defect (see below).

---

## Traps I already hit — don't rediscover these

**Testing traps (these cost hours):**

- **`IntersectionObserver` silently never fires** in throttled or occluded
  tabs. It was the sole gate on loading the 3D and is *why* the Meru sometimes
  "never loaded". It now has rect checks on scroll/resize, a `visibilitychange`
  listener and a timer behind it (`whenNear` in `app.js`). Don't reduce that
  back to IO alone.
- **rAF is suspended while a CDP script blocks.** `await sleep()` inside an
  injected script freezes the render loop, so you read stale camera state and
  see scale values of `0.01` that are actually fine. Pump
  `requestAnimationFrame`, or wait with the harness's own wait action.
- **A hidden window suspends everything.** If `document.hidden` is true nothing
  will load, and that is correct behaviour, not a bug.

**Real defects already fixed — don't reintroduce:**

- Raycasting the mesh for surface height **froze the tab** (11,520 casts ×
  59,200 facets). The solver ships `data/meru-profile.json` instead; `ground()`
  and `radiusAt()` in `puja.js` read it. Never raycast the Meru per frame.
- The exported STL had degenerate facets and Euler = 6, because STL is float32
  and several tiers are **exactly tangent** (the chaturdaśāra reaches r = 1 at
  t₃/t₇'s base corners, which lie on E by condition (i); lotus petals return to
  their base circle at each cusp). Fixed by ray spacing + forcing each tier
  strictly inside the one below by 6e-5. `check_stl()` guards it.
- `glideTo` folds the azimuth onto the shortest path, which silently turned
  pradakṣiṇa's −2π into 0. It takes a `wrap` flag now; the circuit opts out.
- `EdgesGeometry` over 59,200 facets blocked first paint (~30 s). It is
  deferred two frames.

---

## State of the sixteen services

`public/js/puja.js`. Each act declares `view` (camera θ, φ, radius multiple),
`hold` (seconds) and `run()`. Geometry is built from bézier petal outlines,
lathes and instanced swarms — no textures, no sprites.

**Working well, verified on the live site:**

| | |
|---|---|
| 6 Snāna | stream falls on the summit and **runs down every terrace** via the profile |
| 7 Vastra | fitted cloth — a grid in angle and height, each vertex placed by `radiusAt` |
| 10 Puṣpa | real five-petal blossoms + loose petals, settling where the mesh actually is |
| 11 Dhūpa | smoke as faint spheres from a stick and ember (was flat quads = "blurry") |
| 12 Dīpa | lathed diya, wick, teardrop flame + core, key light dropped to 0.18 |
| 15 Pradakṣiṇa | twelve lamps on a floor ring give parallax; walked at eye level |

**Verified as constructing correctly but worth another eye:**
1 Āvāhana · 2 Āsana · 3 Pādya · 4 Arghya · 5 Ācamanīya · 8 Yajñopavīta ·
9 Gandha · 13 Naivedya · 14 Tāmbūla · 16 Namaskāra.

**Known-weak, the honest list:**

- **Naivedya / Tāmbūla / Āsana visibility.** All four bowls are provably in the
  scene at the right places on the bhūpura terrace (probed: `(±1.58, 0.31, 0)`
  and `(0, 0.31, ±1.58)`), but the key light sits at +x so only the lit one
  read against a terrace of the same tone. I added a soft overhead light per
  act as the last change — **this is the one thing I did not get to verify
  visually before handing over.** Check it first.
- **Vastra above the drum.** The fitted sheet reads beautifully on the
  trivṛtta drum; higher up, where the terraces step in sharply, it tucks into
  the step angles and is hard to see. Probably wants the hem raised or the
  standoff scaled with local step depth.
- **Gandha** is sandal marks on the tiers. It works but is the least
  interesting of the sixteen.

---

## Things Hardik has said, so you don't have to be told twice

- Flowers must look like flowers. Coloured squares are confetti and he will
  say so. ("why does it has confetti bro 😭")
- The Meru must **not** auto-rotate, and stopping must land it **dead square**
  on the mirror plane — the figure is mirror-symmetric about one plane only,
  so exactly two azimuths (0 and π) are true.
- Gold is the default metal.
- Grids must not strand a card. Nine tiers and six downloads are both 3-column
  for that reason.
- He is doing Śrī Vidyā sādhanā and has taken dīkṣā from Om Swami. Treat this
  material with care; it is not a tech demo to him. "people gotta use it and
  take benefit from it."

---

## Where I would go next

1. Verify the offering lights actually fixed Naivedya/Tāmbūla/Āsana.
2. Vastra above the drum.
3. Play the whole sequence start to finish at real speed and watch it as a
   viewer would — I only ever checked acts individually.
4. Consider sound-free pacing: `hold` values were tuned by feel, not tested
   as a continuous 16-step run.

Nothing in `solver/` needs work. The geometry is finished and proven; every
remaining task is in `public/js/puja.js` and is about how it *looks*.
