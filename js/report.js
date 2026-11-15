// Drawing code for each part of the report. Each dash.draw(name, fn) fills the elements marked data-draw="name".
// Centre the title emblems on the middle of the capital letters.
(function () {
  function align() {
    document.querySelectorAll('.tsr-title-row').forEach((row) => {
      const t = row.querySelector('.tsr-title-main'); if (!t) return;
      const cs = getComputedStyle(t);
      const ctx = document.createElement('canvas').getContext('2d'); if (!ctx) return;
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = ctx.measureText(t.textContent.toUpperCase());
      if (!m.fontBoundingBoxAscent) return;
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize);
      const base = (lh - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
      const mid = base - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
      const off = mid - lh / 2;
      row.querySelectorAll('.tsr-emblem').forEach((s) => { s.style.transform = `translateY(${off.toFixed(2)}px)`; });
    });
  }
  align();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(align);
  window.addEventListener('resize', align);
})();

window.tsr = {
  rows() { const d = dash.data('games'); return d.status === 'ok' ? d.data : []; },
  row() {
    const rows = this.rows(); if (!rows.length) return null;
    const want = dash.params().game;
    return rows.find((r) => String(r.id) === String(want)) || rows.reduce((a, b) => (String(b.id) > String(a.id) ? b : a));
  },
  span(cls, text, _f, _r, tag) { const s = document.createElement(tag || 'span'); if (cls) s.className = cls; s.textContent = text; return s; },
  fmtVP(v) { return v > 0 ? 'US +' + v : v < 0 ? 'USSR ' + (-v) : 'Even'; },
  sideName: { us: 'US', ussr: 'USSR' },
  icon: { us: '★', ussr: '☭' },
  tip(cell, text) {
    const tip = document.createElement('div'); tip.className = 'tsr-tip'; tip.hidden = true; tip.textContent = text;
    cell.appendChild(tip);
    cell.onmouseenter = () => { tip.hidden = false; }; cell.onmouseleave = () => { tip.hidden = true; };
    cell.ontouchstart = () => { tip.hidden = !tip.hidden; };
  }
};

dash.draw('gamepick', (sel) => {
  const rows = tsr.rows().slice().sort((a, b) => String(b.id).localeCompare(String(a.id)));
  const r = tsr.row();
  sel.replaceChildren(...rows.map((x) => new Option(`${x.id} · ${x.us_player} (US) vs ${x.ussr_player} (USSR)`, String(x.id))));
  if (r) sel.value = String(r.id);
  sel.onchange = () => dash.setParams({ game: sel.value });
});

dash.draw('pname', (el) => {
  const r = tsr.row(); const s = el.dataset.side;
  el.textContent = r ? r[s + '_player'] : '—';
});

dash.draw('ptags', (el) => {
  const r = tsr.row(); const s = el.dataset.side; if (!r) { el.replaceChildren(); return; }
  el.replaceChildren(...(r.winner === tsr.sideName[s] ? [tsr.span('tsr-tag win', tsr.icon[s] + ' Winner')] : []));
});

dash.draw('vp', (el) => {
  const r = tsr.row(); if (!r) { el.textContent = '—'; el.className = 'tsr-vp'; return; }
  el.className = 'tsr-vp ' + (r.final_vp > 0 ? 'us' : r.final_vp < 0 ? 'ussr' : '');
  el.textContent = tsr.fmtVP(r.final_vp);
});

dash.draw('track', (el) => {
  const r = tsr.row(); el.replaceChildren(); if (!r) return;
  const NS = 'http://www.w3.org/2000/svg';
  const W = Math.max(200, el.clientWidth || 300), H = 32, pad = 16, mid = W / 2, half = (W - 2 * pad) / 2;
  const x = (vp) => mid - Math.max(-20, Math.min(20, vp)) / 20 * half;
  const mk = (tag, attrs, style) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (style) n.setAttribute('style', style); return n; };
  const svg = mk('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `VP track, US 20 on the left to USSR 20 on the right; final VP ${tsr.fmtVP(r.final_vp)}` });
  svg.append(
    mk('rect', { x: pad, y: 14, width: half, height: 4 }, 'fill:var(--us-soft)'),
    mk('rect', { x: mid, y: 14, width: half, height: 4 }, 'fill:var(--ussr-soft)'),
    mk('line', { x1: mid, x2: mid, y1: 10, y2: 22 }, 'stroke:#9aa2b1;stroke-width:1'));
  const mx = x(r.final_vp);
  const col = r.final_vp > 0 ? 'var(--us)' : r.final_vp < 0 ? 'var(--ussr)' : '#9aa2b1';
  svg.append(mk('circle', { cx: mx, cy: 16, r: 11 }, `fill:${col};stroke:#fff;stroke-width:2`));
  const t = mk('text', { x: mx, y: 16, dy: '0.36em', 'text-anchor': 'middle' }, 'fill:#fff;font-size:13px');
  t.textContent = r.final_vp > 0 ? '★' : r.final_vp < 0 ? '☭' : '=';
  svg.append(t);
  el.append(svg);
});

dash.draw('ending', (el) => { const r = tsr.row(); el.textContent = r ? r.ending : '—'; });
dash.draw('turn', (el) => { const r = tsr.row(); el.textContent = r ? String(r.turn) : '—'; });
dash.draw('clock', (el) => { const r = tsr.row(); el.textContent = r && r.clock_min != null ? String(r.clock_min) : '—'; });

dash.draw('dice', (el) => {
  const r = tsr.row(); const s = el.dataset.side, k = el.dataset.k;
  if (!r) { el.replaceChildren(tsr.span('tsr-n', '—')); return; }
  const avg = r[`${s}_${k}_avg`], n = r[`${s}_${k}_n`];
  const bar = document.createElement('div'); bar.className = 'tsr-bar';
  const fill = document.createElement('div'); fill.className = 'tsr-fill'; fill.style.width = avg == null ? '0%' : (avg / 6 * 100) + '%';
  const ref = document.createElement('div'); ref.className = 'tsr-ref'; ref.style[s === 'us' ? 'right' : 'left'] = `${3.5 / 6 * 100}%`;
  bar.append(fill, ref);
  const val = avg == null ? tsr.span('tsr-val empty', '—') : tsr.span('tsr-val', avg.toFixed(2));
  const cnt = tsr.span('tsr-n tsr-cnt', `(${n})`);
  el.replaceChildren(val, bar, cnt);
  tsr.tip(el, avg == null ? `${r[s + '_player']}: no rolls` : `${r[s + '_player']}: ${avg.toFixed(2)} over ${n} roll${n === 1 ? '' : 's'} (fair 3.50)`);
});

dash.draw('ops', (el) => {
  const r = tsr.row(); const s = el.dataset.side, era = el.dataset.era;
  if (!r) { el.replaceChildren(tsr.span('tsr-n', '—')); return; }
  const T = r[`${s}_${era}_total`], C = r[`${s}_${era}_costly`];
  let max = era === 'game'
    ? Math.max(r.us_game_total, r.ussr_game_total)
    : Math.max(...['us', 'ussr'].flatMap((x) => ['early', 'mid', 'late'].map((e) => r[`${x}_${e}_total`])));
  max = Math.max(max, 1);
  const wrap = document.createElement('div'); wrap.className = 'tsr-ops ' + s;
  const bar = document.createElement('div'); bar.className = 'tsr-bar';
  const fp = document.createElement('div'); fp.className = 'tsr-fill'; fp.style.width = ((T - C) / max * 100) + '%';
  const fc = document.createElement('div'); fc.className = 'tsr-fill cost'; fc.style.width = (C / max * 100) + '%';
  fc.style[s === 'us' ? 'right' : 'left'] = ((T - C) / max * 100) + '%';
  bar.append(fp, fc);
  const nums = document.createElement('div'); nums.className = 'tsr-nums';
  const item = (label, v) => { const x = document.createElement('span'); x.append(label + ' ', tsr.span('', String(v), 0, 0, 'b')); return x; };
  nums.append(item('Total', T), item('Costly', C));
  const A = r[`${s}_${era}_avg_ops`];
  const avg = document.createElement('span'); avg.className = 'tsr-avg';
  if (A == null) avg.textContent = '—';
  else avg.append(tsr.span('', A.toFixed(1), 0, 0, 'b'), ' /card');
  const row = document.createElement('div'); row.className = 'tsr-oprow';
  row.append(bar, avg);
  wrap.append(row, nums);
  el.replaceChildren(wrap);
  tsr.tip(el, `${r[s + '_player']}: ${T} Ops played, ${C} of them costly${A == null ? '' : `, ${A.toFixed(1)} Ops per card`}`);
});

dash.draw('four', (el) => {
  const r = tsr.row(); const s = el.dataset.side;
  if (!r) { el.replaceChildren(tsr.span('tsr-n', '—')); return; }
  const F = r[`${s}_game_four`];
  const box = document.createElement('div'); box.className = 'tsr-four';
  box.append(tsr.span('', String(F), 0, 0, 'b'));
  el.replaceChildren(box);
  tsr.tip(el, `${r[s + '_player']}: ${F} card${F === 1 ? '' : 's'} played at 4 Ops`);
});

dash.draw('flips', (el) => {
  const r = tsr.row(); const s = el.dataset.side;
  if (!r) { el.replaceChildren(tsr.span('tsr-n', '—')); return; }
  const F = r[`${s}_bg_flips`], N = r[`${s}_coup_bg_n`];
  const box = document.createElement('div'); box.className = 'tsr-war';
  const icons = tsr.span('ic', tsr.icon[s].repeat(F)); icons.setAttribute('aria-hidden', 'true');
  const num = document.createElement('span'); num.style.whiteSpace = 'nowrap';
  num.append(tsr.span('', String(F), 0, 0, 'b'), ' ', tsr.span('tsr-n', `of ${N}`));
  box.append(num, icons);
  el.replaceChildren(box);
  tsr.tip(el, `${r[s + '_player']}: ${F} of ${N} battleground coup${N === 1 ? '' : 's'} took control from the opponent`);
});

dash.draw('wars', (el) => {
  const r = tsr.row(); const s = el.dataset.side;
  if (!r) { el.replaceChildren(tsr.span('tsr-n', '—')); return; }
  const W = r[`${s}_wars_won`];
  const box = document.createElement('div'); box.className = 'tsr-war';
  const icons = tsr.span('ic', tsr.icon[s].repeat(W)); icons.setAttribute('aria-hidden', 'true');
  box.append(tsr.span('', String(W), 0, 0, 'b'), icons);
  el.replaceChildren(box);
  tsr.tip(el, `${r[s + '_player']}: ${W} war${W === 1 ? '' : 's'} won`);
});

dash.draw('scor', (el) => {
  const r = tsr.row(); const s = el.dataset.side, era = el.dataset.era;
  if (!r) { el.replaceChildren(tsr.span('tsr-n', '—')); return; }
  const S = r[`${s}_${era}_scorings`];
  const box = document.createElement('div'); box.className = 'tsr-sc';
  const pips = document.createElement('div'); pips.className = 'tsr-pips'; pips.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < S; i++) { const p = document.createElement('span'); p.className = 'tsr-pip'; pips.append(p); }
  box.append(tsr.span('', String(S), 0, 0, 'b'), pips);
  el.replaceChildren(box);
  tsr.tip(el, `${r[s + '_player']}: ${S} scoring card${S === 1 ? '' : 's'}`);
});

// ---------- "?" help: what each measure means ----------
(function () {
  const HELP = {
    vp: ['<b>Final VP</b> is the score when the game ended. The track runs from US 20 on the left to USSR 20 on the right.',
      'The log never says how a game ended, so it is worked out by replaying the game: 20 VP, DEFCON 1, Final Scoring, Wargames, Europe Control, Cuban Missile Crisis, a scoring card held at the end of a turn, or a forfeit or timeout.'],
    wars: ['<b>Wars won</b> counts war events this player won.',
      'Korean War and Arab-Israeli War always count for the USSR, even when the US triggers them. Neutral wars (Indo-Pakistani War, Brush War, Iran-Iraq War) count for the player who played the card.'],
    four: ['<b>4 Ops cards</b> counts cards this player played at 4 Ops or more, after modifiers: Red Scare/Purge −1, Containment +1 (US), Brezhnev Doctrine +1 (USSR).',
      'Scoring cards are not counted.'],
    coups: ['The average <b>raw die roll</b> on this player\'s coups, before Ops and modifiers are added. Coups made through events count too.',
      'The thin line marks 3.5, the average of a fair die. The number in brackets is how many coup rolls there were.'],
    bg: ['<b>Battleground</b> coups target battleground countries, the countries that decide Domination and Control in region scoring and are worth 1 VP each when controlled. Taiwan counts once Formosan Resolution is in play and the US controls Taiwan.',
      '<b>Non-battleground</b> coups target every other country.'],
    flips: ['A <b>battleground flip</b> is a coup in a battleground country that the opponent controlled before the coup and this player controlled after it.',
      '"of 6" means 6 battleground coups in total.'],
    ops: ['<b>Total</b> is the Ops value of every non-scoring card this player played: for Ops, as an event or on the Space Race. Values include Red Scare/Purge, Containment and Brezhnev Doctrine. The China Card counts 5 when all its Ops went into Asia.',
      '<b>Costly</b> Ops come from opponent cards whose event fired, or that were sent to the Space Race to avoid the event. They are the light part of the bar.',
      '<b>/card</b> is the average Ops per card. Early War is turns 1–3, Mid War 4–7, Late War 8–10.'],
    scor: ['<b>Scoring cards</b> this player played, for the whole game and per era.']
  };
  const pop = document.createElement('div'); pop.className = 'tsr-pop'; pop.id = 'tsr-pop'; pop.setAttribute('role', 'tooltip'); pop.hidden = true;
  (document.getElementById('report') || document.body).appendChild(pop);
  let cur = null, pinned = false;
  function show(btn) {
    const k = btn.dataset.help; if (!HELP[k]) return;
    if (cur && cur !== btn) cur.setAttribute('aria-expanded', 'false');
    cur = btn; btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-describedby', 'tsr-pop');
    pop.innerHTML = HELP[k].map((s) => `<p>${s}</p>`).join('');
    pop.hidden = false;
    const r = btn.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight, m = 8;
    let x = r.left + r.width / 2 - pw / 2; x = Math.max(m, Math.min(x, window.innerWidth - pw - m));
    let y = r.bottom + 8; if (y + ph > window.innerHeight - m) y = Math.max(m, r.top - ph - 8);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  }
  function hide() { if (cur) { cur.setAttribute('aria-expanded', 'false'); cur.removeAttribute('aria-describedby'); } cur = null; pinned = false; pop.hidden = true; }
  document.querySelectorAll('.tsr-help').forEach((b) => {
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('mouseenter', () => { if (!pinned) show(b); });
    b.addEventListener('mouseleave', () => { if (!pinned) hide(); });
    b.addEventListener('focus', () => show(b));
    b.addEventListener('blur', () => hide());
    b.addEventListener('click', (e) => { e.stopPropagation(); if (pinned && cur === b) { hide(); } else { show(b); pinned = true; } });
  });
  document.addEventListener('click', () => { if (pinned) hide(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  window.addEventListener('scroll', () => { if (cur) hide(); }, { passive: true });
  window.addEventListener('resize', () => { if (cur) hide(); });
})();
