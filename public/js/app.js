import * as Y from './yantra2d.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let doc, variant = 'huet', palette = 'ink', meru = null;
const data = () => doc.variants[variant];

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

  $('#legend').replaceChildren(...Y.ENCLOSURES.map(([name, what, n], i) => {
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
    ['working precision', v.working_precision_digits + ' digits', true],
    ['regions in the figure', v.regions_total, true],
    ['regions in the yantra', v.regions_in_yantra, true],
  ];
  for (const [k, ok] of Object.entries(v.structure)) rows.push([k, ok, ok]);
  $('#verify tbody').replaceChildren(...rows.map(([k, val, ok]) => {
    const tr = document.createElement('tr');
    const shown = val === true ? 'pass' : val === false ? 'FAIL' : val;
    tr.innerHTML = `<td>${k}</td><td class="${ok ? 'ok' : 'no'}">${shown}</td>`;
    return tr;
  }));

  $('#tiers').replaceChildren(...d.avaranas.map(a => {
    const li = document.createElement('li');
    li.innerHTML = `<b>${a.name}</b><em>${a.what}</em>`;
    return li;
  }));

  $('#hero-res').textContent = v.worst_residual;
  $('#stamp').textContent =
    `${v.conditions_checked} conditions · worst residual ${v.worst_residual} ` +
    `· ${v.regions_in_yantra} triangles`;
}

// -------------------------------------------------------------------- meru

async function startMeru() {
  if (meru) return;
  meru = true;                                  // guard against re-entry
  try {
    const { mount } = await import('./meru3d.js');
    meru = mount($('#gl'), './data/maha-meru.glb');
    $('#gl').addEventListener('meru:ready', () => {
      $('#loading').classList.add('done');
      meru.setSpin($('#c-spin').checked);
      meru.setEdges($('#c-edge').checked);
    });
    $$('#material button').forEach(b => b.addEventListener('click', () => {
      $$('#material button').forEach(x => x.classList.toggle('on', x === b));
      meru.setMaterial(b.dataset.mat);
    }));
    $('#c-spin').addEventListener('change', e => meru.setSpin(e.target.checked));
    $('#c-wire').addEventListener('change', e => meru.setWireframe(e.target.checked));
    $('#c-edge').addEventListener('change', e => meru.setEdges(e.target.checked));
    $('#c-reset').addEventListener('click', () => meru.reset());
  } catch (err) {
    meru = null;
    $('#loading').textContent = 'could not load the 3D view: ' + err.message;
  }
}

// only build the mountain once it is about to be looked at
new IntersectionObserver((entries, obs) => {
  if (entries.some(e => e.isIntersecting)) {
    obs.disconnect();
    startMeru();
  }
}, { rootMargin: '300px' }).observe($('#stage3d'));

// -------------------------------------------------------------------- boot

fetch('./data/sri-yantra.json')
  .then(r => r.json())
  .then(j => { doc = j; fillTables(); paint(); })
  .catch(err => {
    $('#stage2d').textContent = 'could not load the geometry: ' + err.message;
  });
