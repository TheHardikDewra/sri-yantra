import * as Y from './yantra2d.js';
import { STATIC_HI, T_HI, ENCLOSURES_HI, AVARANA_HI, VERIFY_HI }
  from './i18n.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let doc, variant = 'huet', palette = 'ink', meru = null;
const data = () => doc.variants[variant];

// ---------------------------------------------------------------- language

let lang = 'en';
try { if (localStorage.getItem('lang') === 'hi') lang = 'hi'; } catch (e) {}

const T_EN = {
  notBegun: 'Not begun.', begin: 'Begin', resume: 'Resume', pause: 'Pause',
  building: 'building the mountain…',
  couldNotLoad3D: 'could not load the 3D view: ',
  couldNotStart: 'could not start: ',
  couldNotLoadGeom: 'could not load the geometry: ',
  netError: 'network error',
  caption: (i, u) => `${i + 1} of 16 · ${u.n} — ${u.e}`,
  stamp: v => `${v.conditions_checked} conditions · worst residual ` +
              `${v.worst_residual} · ${v.regions_in_yantra} triangles`,
  digits: ' digits',
};
const t = k => (lang === 'hi' ? T_HI : T_EN)[k];

// English lives in the HTML; it is cached here the first time Hindi replaces
// it, so the toggle can restore it exactly.
const enStore = new Map();
function applyStatic() {
  for (const [sel, hi, mode] of STATIC_HI) {
    const el = document.querySelector(sel);
    if (!el) continue;
    if (mode === 'text') {
      const node = el.lastChild;
      if (!node || node.nodeType !== Node.TEXT_NODE) continue;
      if (!enStore.has(sel)) enStore.set(sel, node.textContent);
      node.textContent = lang === 'hi' ? hi : enStore.get(sel);
    } else {
      if (!enStore.has(sel)) enStore.set(sel, el.innerHTML);
      el.innerHTML = lang === 'hi' ? hi : enStore.get(sel);
    }
  }
  document.documentElement.lang = lang;
  const lb = $('#lang');
  lb.textContent = lang === 'hi' ? 'EN' : 'हिं';
  lb.setAttribute('aria-label',
    lang === 'hi' ? 'Switch to English' : 'भाषा बदलें - हिन्दी');
}

// parts of the page that scripts rebuild re-register here
const langHooks = [];

$('#lang').addEventListener('click', () => {
  lang = lang === 'hi' ? 'en' : 'hi';
  try { localStorage.setItem('lang', lang); } catch (e) {}
  applyStatic();
  if (doc) fillTables();
  for (const f of langHooks) f();
});

// ------------------------------------------------------------------- theme

// Three states, only two of them stored: follow the system, or override it.
// Clicking always moves to the opposite of what is currently showing, so the
// button does what it looks like it will do whichever way the system is set.
const themeBtn = $('#theme');

function showing() {
  const set = document.documentElement.dataset.theme;
  if (set === 'light' || set === 'dark') return set;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function paintTheme() {
  const now = showing();
  const next = now === 'dark' ? 'light' : 'dark';
  themeBtn.querySelector('use')
    .setAttribute('href', now === 'dark' ? '#i-sun' : '#i-moon');
  themeBtn.setAttribute('aria-label', `Switch to ${next} theme`);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(document.documentElement)
    .getPropertyValue('--paper').trim();
  if (doc) paint();          // rebake the SVG download in the new colours
}

themeBtn.addEventListener('click', () => {
  document.documentElement.dataset.theme = showing() === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('theme', document.documentElement.dataset.theme); }
  catch (e) { /* private mode; the choice just will not persist */ }
  paintTheme();
});

// follow the system while no override is stored
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (!document.documentElement.dataset.theme) paintTheme();
});

// -------------------------------------------------------------------- flat

function options() {
  return {
    fill: $('#c-fill').checked,
    nine: $('#c-nine').checked,
    outer: $('#c-outer').checked,
    marma: $('#c-marma').checked,
    label: $('#c-label').checked,
    palette,
  };
}

function paint() {
  const o = options();
  $('#stage2d').replaceChildren(Y.draw(data(), o));
  $('#hero2d').replaceChildren(Y.draw(data(), {
    fill: true, nine: true, outer: true, marma: false, label: false, palette,
  }));
  const blob = new Blob([Y.serialise(data(), o)], { type: 'image/svg+xml' });
  if ($('#dl-svg').dataset.url) URL.revokeObjectURL($('#dl-svg').dataset.url);
  const url = URL.createObjectURL(blob);
  $('#dl-svg').href = url;
  $('#dl-svg').dataset.url = url;
}

$('#variant').addEventListener('change', e => {
  variant = e.target.value;
  paint();
  fillTables();
});
['#c-fill', '#c-nine', '#c-outer', '#c-marma', '#c-label'].forEach(id =>
  $(id).addEventListener('change', paint));

$$('#palette button').forEach(b => b.addEventListener('click', () => {
  $$('#palette button').forEach(x => x.classList.toggle('on', x === b));
  palette = b.dataset.pal;
  paint();
}));

$('#dl-png').addEventListener('click', ev => {
  ev.preventDefault();
  const S = 2400;
  const svg = Y.serialise(data(), options());
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    cv.getContext('2d').drawImage(img, 0, 0, S, S);
    cv.toBlob(b => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `sri-yantra-${variant}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
});

// ------------------------------------------------------------------ tables

function fillTables() {
  const d = data();
  const enc = lang === 'hi' ? ENCLOSURES_HI : Y.ENCLOSURES;

  $('#legend').replaceChildren(...enc.map(([name, what, n], i) => {
    const li = document.createElement('li');
    li.innerHTML = `<i style="background:var(--e${i})"></i>` +
                   `<b>${name}</b> <em>${what}</em><span>${n}</span>`;
    return li;
  }));

  $('#coords tbody').replaceChildren(...d.triangles.map(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>t${t.i} ${t.direction === 'down' ? '▽' : '△'}</td>` +
      [t.base_y, t.half_width, t.apex_y]
        .map(v => `<td>${v.toFixed(9)}</td>`).join('');
    return tr;
  }));

  const v = d.verification;
  const rows = [
    ['conditions checked', v.conditions_checked, true],
    ['worst residual', v.worst_residual, true],
    ['working precision', v.working_precision_digits + t('digits'), true],
    ['regions in the figure', v.regions_total, true],
    ['regions in the yantra', v.regions_in_yantra, true],
  ];
  for (const [k, ok] of Object.entries(v.structure)) rows.push([k, ok, ok]);
  const label = k => (lang === 'hi' && VERIFY_HI[k]) || k;
  $('#verify tbody').replaceChildren(...rows.map(([k, val, ok]) => {
    const tr = document.createElement('tr');
    const shown = val === true ? (lang === 'hi' ? 'ठीक' : 'pass')
      : val === false ? (lang === 'hi' ? 'विफल' : 'FAIL') : val;
    tr.innerHTML =
      `<td>${label(k)}</td><td class="${ok ? 'ok' : 'no'}">${shown}</td>`;
    return tr;
  }));

  $('#tiers').replaceChildren(...d.avaranas.map(a => {
    const li = document.createElement('li');
    const hi = lang === 'hi' && AVARANA_HI[a.name];
    li.innerHTML = hi ? `<b>${hi[0]}</b><em>${hi[1]}</em>`
                      : `<b>${a.name}</b><em>${a.what}</em>`;
    return li;
  }));

  $('#hero-res').textContent = v.worst_residual;
  $('#stamp').textContent = t('stamp')(v);
}

// -------------------------------------------------------------------- meru

async function startMeru() {
  if (meru) return;
  meru = true;                                  // guard against re-entry
  try {
    const { mount } = await import('./meru3d.js');
    meru = mount($('#gl'), './data/maha-meru.glb');
    // mount() returns before the mesh arrives, so anything that needs the
    // geometry - the puja does, it sizes every offering to the mountain - has
    // to wait for this.
    $('#gl').addEventListener('meru:ready', () => {
      $('#loading').classList.add('done');
      meru.setSpin($('#c-spin').checked);
      meru.setEdges($('#c-edge').checked);
      startPuja().catch(err => {
        $('#puja-caption').textContent = t('couldNotStart') + err.message;
      });
    });
    // a failed mesh fetch fires no ready event; say so instead of spinning
    $('#gl').addEventListener('meru:error', e => {
      $('#loading').classList.remove('done');
      $('#loading').textContent =
        t('couldNotLoad3D') + (e.detail?.message || t('netError'));
    });
    $$('#material button').forEach(b => b.addEventListener('click', () => {
      $$('#material button').forEach(x => x.classList.toggle('on', x === b));
      meru.setMaterial(b.dataset.mat);
    }));
    $('#c-spin').addEventListener('change', e => meru.setSpin(e.target.checked));
    $('#c-wire').addEventListener('change', e => meru.setWireframe(e.target.checked));
    $('#c-edge').addEventListener('change', e => meru.setEdges(e.target.checked));
    $$('#viewpoint button').forEach(b => b.addEventListener('click', () => {
      $$('#viewpoint button').forEach(x => x.classList.toggle('on', x === b));
      meru.view(b.dataset.view);
    }));
  } catch (err) {
    meru = null;
    $('#loading').textContent = t('couldNotLoad3D') + err.message;
  }
}

// ---------------------------------------------------------- the sixteen

async function startPuja() {
  const { createPuja, UPACHARAS } = await import('./puja.js');
  // the exact staircase profile, so offerings can sit on and run down it
  meru.profile = await fetch('./data/meru-profile.json')
    .then(r => r.json()).catch(() => null);
  const puja = createPuja(meru);
  meru.puja = puja;                       // the render loop drives it

  const list = $('#upacharas');
  function buildList() {
    list.replaceChildren(...UPACHARAS.map((u, i) => {
      const li = document.createElement('li');
      li.innerHTML = lang === 'hi'
        ? `<span><b>${u.nh}</b><em>${u.eh}</em></span>`
        : `<span><b>${u.n}</b><em>${u.e}</em></span>`;
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      const pick = () => { puja.pause(); puja.go(i); sync(); };
      li.addEventListener('click', pick);
      li.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
      });
      return li;
    }));
  }
  buildList();

  const caption = $('#puja-caption');
  function sync() {
    const i = puja.step;
    [...list.children].forEach((li, k) => li.classList.toggle('on', k === i));
    caption.textContent = i < 0 ? t('notBegun')
      : t('caption')(i, UPACHARAS[i]);
    $('#puja-play').textContent =
      puja.playing ? t('pause') : (i < 0 ? t('begin') : t('resume'));
    if (i >= 0) list.children[i].scrollIntoView({ block: 'nearest' });
  }
  langHooks.push(() => { buildList(); sync(); });
  meru.onPujaStep = sync;
  meru.onPujaEnd = sync;

  $('#puja-play').addEventListener('click', () => {
    puja.playing ? puja.pause() : puja.play();
    sync();
  });
  $('#puja-next').addEventListener('click', () => { puja.pause(); puja.next(); sync(); });
  $('#puja-prev').addEventListener('click', () => { puja.pause(); puja.prev(); sync(); });
  $('#puja-stop').addEventListener('click', () => { puja.stop(); meru.view('front'); sync(); });
  sync();
}

// Build the mountain once it is about to be looked at - but never make that
// the only way it can happen. IntersectionObserver is an optimisation, not a
// guarantee: it goes quiet in throttled or occluded tabs, and when it does the
// 3D view simply never loads. So the rect is also checked directly, on scroll
// and resize, and there is a timer behind both.
function whenNear(el, fn, margin = 300) {
  let done = false;
  const fire = () => {
    if (done) return;
    done = true;
    removeEventListener('scroll', check);
    removeEventListener('resize', check);
    document.removeEventListener('visibilitychange', check);
    clearInterval(timer);
    io?.disconnect();
    fn();
  };
  const check = () => {
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight + margin && r.bottom > -margin) fire();
  };
  let io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) fire();
    }, { rootMargin: margin + 'px' });
    io.observe(el);
  }
  addEventListener('scroll', check, { passive: true });
  addEventListener('resize', check, { passive: true });
  // A hidden tab suspends timers and rAF, so a page opened in the background
  // rightly builds nothing. Catch the moment it is looked at rather than
  // waiting for the next poll.
  document.addEventListener('visibilitychange', check);
  const timer = setInterval(check, 400);
  check();
}

whenNear($('#stage3d'), startMeru);

// -------------------------------------------------------------------- boot

applyStatic();

fetch('./data/sri-yantra.json')
  .then(r => r.json())
  .then(j => { doc = j; fillTables(); paint(); paintTheme(); })
  .catch(err => {
    $('#stage2d').textContent = t('couldNotLoadGeom') + err.message;
  });
