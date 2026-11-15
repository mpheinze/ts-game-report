/* Twilight Struggle (Playdek) log parser: JavaScript port of parser/parse_games.py + make_rows.py.
   Produces the same per-game rows as the Python version. Endings follow reference/victory_conditions.md. */
(function (root) {
  const REF = root.TS_REFERENCE;
  if (!REF) throw new Error("tsparse.js needs js/reference.js loaded first");
  const CARDS = {}; for (const [n, v] of Object.entries(REF.cards)) CARDS[+n] = { name: v[0], ops: v[1], side: v[2], scoring: !!v[3] };
  const ALIAS = REF.alias;
  const COUNTRY = {}; for (const [c, v] of Object.entries(REF.countries)) COUNTRY[c] = { region: v[0], sub: v[1], stab: v[2], bg: !!v[3], adj: v[4], us0: v[5], ussr0: v[6] };
  const REG = REF.regions;
  const OPP = { US: 'USSR', USSR: 'US' };
  const SPACE_VP = { 1: [2, 1], 3: [2, 0], 5: [3, 1], 7: [4, 2], 8: [2, 0] };
  const ASIA = new Set(Object.keys(COUNTRY).filter((c) => COUNTRY[c].region === 'Asia'));
  const ERA = (t) => (t <= 3 ? 'Early' : t <= 7 ? 'Mid' : 'Late');
  const QUOTES = '"“”';
  function stripChars(s, chars) { let a = 0, b = s.length; while (a < b && chars.includes(s[a])) a++; while (b > a && chars.includes(s[b - 1])) b--; return s.slice(a, b); }
  function rstripChars(s, chars) { let b = s.length; while (b > 0 && chars.includes(s[b - 1])) b--; return s.slice(0, b); }
  const key = (s) => stripChars(rstripChars(stripChars(s.trim(), QUOTES), '*'), QUOTES).replace(/’/g, "'").toLowerCase();
  const cardNo = (name) => (Object.prototype.hasOwnProperty.call(ALIAS, key(name)) ? ALIAS[key(name)] : null);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sgn = (d) => (d >= 0 ? '+' + d : String(d));
  // Python round(x, f) (round-half-even on the exact double value)
  function pyRound(x, f) {
    const ex = Math.abs(x).toFixed(f + 30);            // exact decimal expansion of the double
    const tail = ex.slice(ex.indexOf('.') + 1 + f);
    if (/^50*$/.test(tail)) {                             // exact tie: round half to even like Python
      const head = ex.slice(0, ex.indexOf('.') + 1 + f).replace('.', '');
      const n = BigInt(head) + (BigInt(head.slice(-1)) % 2n === 0n ? 0n : 1n);
      return Math.sign(x) * Number(n) / Math.pow(10, f);
    }
    return parseFloat(x.toFixed(f));
  }
  function parseScore(line) {
    const m = /Score is (US|USSR) (\d+)/.exec(line);
    if (m) return parseInt(m[2], 10) * (m[1] === 'US' ? 1 : -1);
    if (line.includes('Score is even')) return 0;
    return null;
  }
  // Where each VP change in one phase came from. lines: the header text after the phase label, then the body.
  // Returns [[signedDelta, source], ...]; positive deltas are US gains.
  function vpSources(lines, vpBefore, ctx) {
    const out = []; let score = vpBefore, ev = null, evIdx = -1, sp = null, spIdx = -1, opsShort = {};
    lines.forEach((l, i) => {
      let m = /(?:^|: )Event: (.+?)$/.exec(l); if (m) { ev = m[1].replace(/\*$/, ''); evIdx = i; }
      m = /(US|USSR) advances to (\d+) in the Space Race/.exec(l); if (m) { sp = m[2]; spIdx = i; }
      m = /^(US|USSR) Military Ops to (\d+)/.exec(l); if (m) opsShort[m[1]] = parseInt(m[2], 10);
      const s = parseScore(l); if (s === null) return;
      const d = s - score; score = s;
      let src;
      if (/No VP awarded/.test(l)) src = ev ? `${ev}: no VP awarded` : 'No VP awarded';
      else if (spIdx > evIdx || (spIdx >= 0 && ctx.mode === 'space' && spIdx >= evIdx)) src = (ctx.mode === 'space' && evIdx < 0 ? 'Space Race' : `${ev || 'Space Race'} (Space Race)`) + `, box ${sp}`;
      else if (ev) src = ev;
      else if (ctx.kind === 'cleanup') src = `Military Ops shortfall (${d > 0 ? 'USSR' : 'US'} below DEFCON requirement)`;
      else if (ctx.kind === 'headline') src = `Headline: ${ctx.headlines}`;
      else if (ctx.card) src = ctx.card.replace(/\*$/, '');
      else src = 'Not stated in the log';
      const prevGap = out.length && out[out.length - 1][2] && i > 0 && parseScore(lines[i - 1]) !== null;
      const gap = prevGap || (i > 0 ? lines[i - 1].trim() === '' : (ctx.kind === 'ar' && !ctx.card));
      out.push([d, src, gap]);
    });
    return out;
  }
  class Board {
    constructor() { this.inf = {}; for (const [c, v] of Object.entries(COUNTRY)) this.inf[c] = [v.us0, v.ussr0]; }
    has(c) { return Object.prototype.hasOwnProperty.call(this.inf, c); }
    ctrl(c) { const [us, su] = this.inf[c]; const s = COUNTRY[c].stab; if (us >= s && us - su >= s) return 'US'; if (su >= s && su - us >= s) return 'USSR'; return null; }
  }
  function scoreRegion(board, region, formosan, shuttle) {
    if (region === 'Southeast Asia') {
      let vp = 0;
      for (const [c, v] of Object.entries(COUNTRY)) if (v.sub.includes('Southeast Asia')) { const w = board.ctrl(c); const pts = c === 'Thailand' ? 2 : 1; vp += w === 'US' ? pts : w === 'USSR' ? -pts : 0; }
      return [vp, null];
    }
    const [pres, dom, ctl] = REG[region];
    const countries = Object.keys(COUNTRY).filter((c) => COUNTRY[c].region === region);
    let bgs = new Set(countries.filter((c) => COUNTRY[c].bg));
    if (formosan && region === 'Asia' && board.ctrl('Taiwan') === 'US') bgs.add('Taiwan');
    const tot = {};
    for (const side of ['US', 'USSR']) {
      const mine = countries.filter((c) => board.ctrl(c) === side);
      let nb = mine.filter((c) => bgs.has(c)).length, n = mine.length;
      if (side === 'USSR' && shuttle && (region === 'Asia' || region === 'Middle East') && nb) { nb -= 1; n -= 1; }
      const adj = mine.filter((c) => COUNTRY[c].adj === OPP[side]).length;
      tot[side] = { n, nb, adj, nonbg: n - nb };
    }
    const vps = {}; let europeWin = null;
    for (const side of ['US', 'USSR']) {
      const me = tot[side], op = tot[OPP[side]];
      let level = 0;
      if (me.n > 0) level = 1;
      if (me.n > op.n && me.nb > op.nb && me.nb >= 1 && me.nonbg >= 1) level = 2;
      if (me.n > op.n && me.nb === bgs.size) level = 3;
      let base = [0, pres, dom, ctl][level];
      if (region === 'Europe' && level === 3) { europeWin = side; base = 0; }
      vps[side] = (base || 0) + me.nb + me.adj;
    }
    return [vps.US - vps.USSR, europeWin];
  }

  function parseGame(gid, text) {
    const L = text.split('\n').map((l) => l.replace(/\s+$/, '')); if (L.length && L[L.length - 1] === '' && /\n$/.test(text)) L.pop();
    const players = {};
    for (const l of L.slice(0, 3)) { const m = /^(?:SETUP: )?(.+) will play as (USA|USSR)\./.exec(l); if (m) players[m[2] === 'USA' ? 'US' : 'USSR'] = m[1]; }
    let clock = null; for (const l of L.slice(0, 8)) if (l.startsWith('Time per Player')) { clock = /(\d+)/.exec(l)[1]; break; }

    const board = new Board(); let defcon = 5, vp = 0, turn = 0;
    const inplay = new Set(); let china = 'USSR'; const redScared = new Set(), boosted = new Set(); let modTurn = 0;
    const space = { US: 0, USSR: 0 };
    const dice = { US: {}, USSR: {} };
    const push = (s, k, v) => { (dice[s][k] = dice[s][k] || []).push(v); };
    const wars = { US: { fought: 0, won: 0 }, USSR: { fought: 0, won: 0 } };
    const bgflip = { US: 0, USSR: 0 };
    const ops = {}; for (const s of ['US', 'USSR']) { ops[s] = {}; for (const e of ['Early', 'Mid', 'Late']) ops[s][e] = { playable: 0, costly: 0, scorings: 0, total: 0, cards: 0, four: 0 }; }
    const plays = [];
    const hdr = []; L.forEach((l, k) => { if (/^Turn \d+, /.test(l)) hdr.push(k); });
    const blocks = hdr.map((k, bi) => [k, bi + 1 < hdr.length ? hdr[bi + 1] : L.length]);
    const first = hdr.length ? hdr[0] : L.length;

    function applyLine(l, ctx) {
      let m = /^(US|USSR) ([+-]\d+) in (.+?) \[(\d+)\]\[(\d+)\]/.exec(l);
      if (m && board.has(m[3])) board.inf[m[3]] = [parseInt(m[4], 10), parseInt(m[5], 10)];
      m = /DEFCON (?:degrades|improves) to (\d)/.exec(l); if (m) defcon = parseInt(m[1], 10);
      const s = parseScore(l); if (s !== null) vp = s;
      m = /^(US|USSR) advances to (\d+) in the Space Race/.exec(l); if (m) space[m[1]] = parseInt(m[2], 10);
      m = /^Event: (.+)$/.exec(l);
      if (m) { const ek = key(m[1]); if (ek === 'red scare/purge' && ctx) redScared.add(OPP[ctx]); else if (ek === 'containment') boosted.add('US'); else if (ek === 'brezhnev doctrine') boosted.add('USSR'); }
      m = /^(.+?) is now in play\./.exec(l); if (m) inplay.add(key(m[1]));
      m = /(?:^|: )(.+?) is no longer in play\./.exec(l); if (m) inplay.delete(key(m[1]));
    }
    for (const l of L.slice(0, first)) applyLine(l, null);

    function rollBlock(lines, ctxActor, ctxCard) {
      let cur = ctxActor, target = null, eventCard = ctxCard; const out = [];
      lines.forEach((l, j) => {
        let m = /^(US|USSR) plays (.+)$/.exec(l); if (m) cur = m[1];
        m = /^Event: (.+)$/.exec(l); if (m) eventCard = m[1];
        m = /^Target: (.+)$/.exec(l); if (m) target = m[1];
        m = /^(SUCCESS|FAILURE): (\d) \[ \+ (\d+)(?: \(([+-]?\d+)\))?\s+- 2x(\d) = (-?\d+) \]/.exec(l);
        if (m && target) {
          const die = parseInt(m[2], 10); let who = null;
          for (const l2 of lines.slice(j + 1, j + 6)) { if (l2.startsWith('Turn ') || l2.startsWith('Target:')) break; const mm = /^(US|USSR) Military Ops to/.exec(l2); if (mm) { who = mm[1]; break; } }
          if (who === null) for (const l2 of lines.slice(j + 1, j + 4)) { const mm = new RegExp('^(US|USSR) ([+-])\\d+ in ' + esc(target)).exec(l2); if (mm) { who = mm[2] === '+' ? mm[1] : OPP[mm[1]]; break; } }
          if (who === null) { const ec = eventCard ? cardNo(eventCard) : null; who = ec && (CARDS[ec].side === 'US' || CARDS[ec].side === 'USSR') ? CARDS[ec].side : cur; }
          const bg = (COUNTRY[target] ? COUNTRY[target].bg : false) || (target === 'Taiwan' && inplay.has('formosan resolution') && board.ctrl('Taiwan') === 'US');
          out.push([who, bg ? 'coup_bg' : 'coup_nonbg', die, target, j]);
        }
        m = /^(US|USSR) rolls (\d)/.exec(l); if (m && target) out.push([m[1], 'realign', parseInt(m[2], 10), target, j]);
        m = /^War in (.+)$/.exec(l); if (m) target = null;
        m = /^(VICTORY|DEFEAT): (\d)/.exec(l);
        if (m) { const cn = eventCard ? cardNo(eventCard || '') : null; const side = cn ? CARDS[cn].side : null; const who = side === 'US' || side === 'USSR' ? side : cur; out.push([who, 'war', parseInt(m[2], 10), [m[1], eventCard], j]); }
        m = /^Die roll: (\d) -- /.exec(l); if (m) out.push([cur, 'space', parseInt(m[1], 10), null, j]);
      });
      return out;
    }
    function applySeq(lines, actor) {
      const out = []; let tgt = null, before = null, pending = null;
      const close = () => { if (pending) { out.push([pending[0], pending[1], board.has(pending[0]) ? board.ctrl(pending[0]) : null]); pending = null; } };
      for (const l of lines) {
        if (pending && !/^(?:(US|USSR) ([+-]\d+ in |Military Ops to)|DEFCON )/.test(l)) close();
        const m = /^Target: (.+)$/.exec(l); if (m) { tgt = m[1]; before = board.has(tgt) ? board.ctrl(tgt) : null; }
        if (/^(SUCCESS|FAILURE): \d \[/.test(l) && tgt) pending = [tgt, before];
        applyLine(l, actor);
      }
      close(); return out;
    }

    let last = null; const timeline = []; let gameTurn = 0;
    for (const [k, end] of blocks) {
      const h = L[k], body = L.slice(k + 1, end);
      turn = parseInt(/^Turn (\d+), /.exec(h)[1], 10);
      if (turn !== modTurn || /^Turn \d+, Cleanup/.test(h)) { redScared.clear(); boosted.clear(); modTurn = turn; }
      const MOD = (sd) => (boosted.has(sd) ? 1 : 0) - (redScared.has(sd) ? 1 : 0);
      const info = { turn, header: h, kind: null, side: null, card: null, action: null, lines: body, ar: null };
      const vpBefore = vp;
      const mh = /^Turn \d+, Headline Phase: (.+?) & (.+?)(?:: (.*))?$/.exec(h);
      const mc = /^Turn \d+, Cleanup(?:: (.*))?$/.exec(h);
      const ma = /^Turn \d+, (US|USSR) AR(\d+)(?:: (.+?))?(?:: (.*))?$/.exec(h);
      let diceLines = [], flips = [];
      if (mh) {
        info.kind = 'headline';
        if (mh[3]) applyLine(mh[3], null);
        const hl = {};
        for (const l of body) { const m = /^(US|USSR) Headlines (.+)$/.exec(l); if (m) hl[m[2]] = m[1]; }
        for (const [nm, side] of Object.entries(hl)) { const cn = cardNo(nm); if (cn) plays.push({ side, turn, card: cn, mode: 'headline', lines: body, fired: true, mod: MOD(side) }); }
        let evActor = null, evCard = null, seg = []; const segs = [];
        for (const l of body) {
          const m = /^Event: (.+)$/.exec(l);
          if (m) {
            if (seg.length) segs.push([evActor, evCard, seg]);
            evCard = m[1];
            let found = Object.prototype.hasOwnProperty.call(hl, evCard) ? hl[evCard] : null;
            if (!found) { for (const [n, s] of Object.entries(hl)) if (key(n) === key(evCard)) { found = s; break; } }
            evActor = found || evActor; seg = [l];
          } else seg.push(l);
        }
        if (seg.length) segs.push([evActor, evCard, seg]);
        info.headlineSides = hl; info.segments = segs;
        for (const [a, c, sg] of segs) { diceLines = diceLines.concat(rollBlock(sg, a, c)); flips = flips.concat(applySeq(sg, a)); }
      } else if (mc) {
        info.kind = 'cleanup';
        if (mc[1]) applyLine(mc[1], null);
        for (const l of body) applyLine(l, null);
      } else if (ma) {
        const side = ma[1], arn = parseInt(ma[2], 10), cardname = ma[3] || null, action = ma[4] || null;
        Object.assign(info, { kind: 'ar', side, ar: arn, card: cardname ? cardNo(cardname) : null, cardname, action });
        const modNow = MOD(side);
        if (action) applyLine(action, side);
        if (info.card) {
          const cn = info.card;
          const fired = (action || '').startsWith('Event') || body.some((l) => { const m = /^Event: (.+)$/.exec(l); return m && key(m[1]) === key(CARDS[cn].name); });
          const a = action || '';
          const mode = a.startsWith('Space Race') ? 'space' : a.startsWith('Event') ? 'event' : a.startsWith(side + ' discards') ? 'discard' : 'ops';
          plays.push({ side, turn, card: cn, mode, lines: body, fired, action, mod: modNow });
          for (const l of body) {
            const m = new RegExp('^' + side + ' plays (.+)$').exec(l);
            if (m && key(CARDS[cn].name) === 'un intervention') { const pc = cardNo(m[1]); if (pc) plays.push({ side, turn, card: pc, mode: 'ops', lines: body, fired: false, action: 'via UN Intervention', mod: modNow }); }
          }
          if (cn === 6) china = OPP[side];
        }
        diceLines = diceLines.concat(rollBlock(body, side, cardname));
        if (body.some((l) => /^Event: Nixon Plays The China Card/i.test(l)) && china === 'USSR') china = 'US';
        flips = flips.concat(applySeq(body, side));
      }
      const coupRolls = diceLines.filter((d) => d[1].startsWith('coup'));
      for (let i = 0; i < Math.min(coupRolls.length, flips.length); i++) {
        const [who, kind] = coupRolls[i], [, cb, ca] = flips[i];
        if (who && kind === 'coup_bg' && cb === OPP[who] && ca === who) bgflip[who] += 1;
      }
      for (const [who, kind, die, target] of diceLines) {
        if (who === null || who === undefined) continue;
        push(who, kind, die);
        if (kind === 'war') { wars[who].fought += 1; if (target[0] === 'VICTORY') wars[who].won += 1; }
      }
      info.defconAfter = defcon; info.vpAfter = vp; info.dice = diceLines;
      // VP after every phase: [turn, phase, actionRound, cardNo, vp]; phase is 'H' headline, 'US'/'USSR' action round, 'C' cleanup
      // Playdek numbers Cleanup headers by action-round count, not by game turn, so cleanup keeps the turn it follows
      if (info.kind !== 'cleanup') gameTurn = turn;
      const headTail = (mh && mh[3]) || (mc && mc[1]) || (ma && ma[4]) || null;
      const srcs = vpSources((headTail ? [headTail] : []).concat(body), vpBefore,
        { kind: info.kind, mode: info.action && info.action.startsWith('Space Race') ? 'space' : null, card: info.cardname || null, headlines: mh ? `${mh[1].replace(/\*$/, '')} / ${mh[2].replace(/\*$/, '')}` : '' });
      timeline.push([gameTurn, info.kind === 'headline' ? 'H' : info.kind === 'cleanup' ? 'C' : info.kind === 'ar' ? info.side : 'X', info.ar, info.card, vp, srcs]);
      last = info;
    }

    const scorSeq = { US: [], USSR: [] };
    for (const p of plays) {
      const c = CARDS[p.card], side = p.side, era = ERA(p.turn);
      if (c.scoring) { ops[side][era].scorings += 1; scorSeq[side].push([p.card, p.turn]); continue; }
      let o = c.ops;
      if (p.mod) o = Math.min(4, Math.max(1, o + p.mod));
      if (o >= 4) ops[side][era].four += 1;
      if (p.card === 6) {
        const targets = new Set();
        for (const l of p.lines) { const m = new RegExp('^' + side + ' \\+\\d+ in (.+?) \\[').exec(l) || /^Target: (.+)$/.exec(l); if (m) targets.add(m[1]); }
        if (targets.size && [...targets].every((t) => ASIA.has(t)) && p.mode === 'ops') o = 5;
      }
      const costly = c.side === OPP[side] && (p.fired || p.mode === 'space');
      ops[side][era][costly ? 'costly' : 'playable'] += o;
      ops[side][era].total += o; ops[side][era].cards += 1;
    }

    // --- ending inference
    let ending = null, winner = null, note = '', finalVp = vp;
    const body = last.lines, nonblank = body.filter((l) => l.trim());
    const formosan = inplay.has('formosan resolution'), shuttle = inplay.has('shuttle diplomacy');
    const hasScore = body.some((l) => parseScore(l) !== null || l.includes('No VP awarded'));
    const W = (v) => (v > 0 ? 'US' : v < 0 ? 'USSR' : null);
    if (last.kind === 'ar' && last.card === 100 && (last.action || '').startsWith('Event')) {
      ending = 'V6'; winner = W(vp) || OPP[last.side]; note = `${last.side} played Wargames; ${OPP[last.side]} received 6 VP`;
    }
    if (!ending) {
      const coups = last.dice.filter((r) => r[1].startsWith('coup'));
      if (coups.length) {
        const [who, kind, , target] = coups[coups.length - 1];
        const seg = last.kind === 'headline' ? last.segments[last.segments.length - 1][2] : body;
        let idx = -1; seg.forEach((l, k) => { if (l === 'Target: ' + target) idx = k; });
        const after = seg.slice(idx + 1);
        const endsHere = !after.some((l) => /^(Target:|Event:|Place Influence|Coup \(|Realignment)/.test(l));
        const degradedTo2 = after.some((l) => l.includes('DEFCON degrades to 2'));
        const phas = last.side || (last.kind === 'headline' ? last.segments[last.segments.length - 1][0] : null) || who;
        if (endsHere && kind === 'coup_bg' && last.defconAfter === 2 && !degradedTo2 && !(inplay.has('nuclear subs') && who === 'US')) {
          ending = 'V2'; winner = OPP[phas]; note = `${who} coup in ${target} (battleground) at DEFCON 2 drops DEFCON to 1; ${phas} was the phasing player`;
        } else if (endsHere && inplay.has('cuban missile crisis')) {
          ending = 'V3'; winner = OPP[who]; note = `${who} attempted a coup while Cuban Missile Crisis was in play`;
        }
      }
    }
    if (!ending && last.turn === 10 && last.kind === 'ar' && last.ar >= 7 && !(last.card && CARDS[last.card].scoring) && (nonblank.length || hasScore)) {
      const lastNb = nonblank.length ? nonblank[nonblank.length - 1] : null;
      if (lastNb !== null && (parseScore(lastNb) !== null || lastNb.includes('No VP awarded'))) note = 'Final Scoring as logged';
      else {
        let fs = 0, ew = null;
        for (const reg of ['Europe', 'Asia', 'Middle East', 'Africa', 'Central America', 'South America']) { const [d, e] = scoreRegion(board, reg, formosan, false); fs += d; ew = ew || e; }
        fs += china === 'US' ? 1 : -1;
        finalVp = vp + fs; note = `Final Scoring not logged; computed from the final board (${sgn(fs)} VP incl. China Card)`;
        if (ew) { ending = 'V4'; winner = ew; }
      }
      if (!ending) { ending = finalVp ? 'V7' : 'V10'; winner = W(finalVp); }
    }
    if (!ending && Math.abs(vp) >= 20) { ending = 'V1'; winner = W(vp); note = 'VP reached 20'; }
    if (!ending && last.kind === 'ar' && last.card && CARDS[last.card].scoring && !hasScore) {
      const reg = CARDS[last.card].name.replace(' Scoring', '');
      const [d, ew] = scoreRegion(board, reg, formosan, shuttle);
      if (ew) { ending = 'V4'; winner = ew; note = 'Europe Control at Europe Scoring (computed from board)'; }
      else if (Math.abs(vp + d) >= 20) { finalVp = vp + d; ending = 'V1'; winner = W(finalVp); note = `${reg} Scoring result not logged; board replay gives ${sgn(d)} VP, reaching 20`; }
      else note = `Log stops at ${reg} Scoring (board replay gives ${sgn(d)} VP, below 20). `;
    }
    if (!ending && last.kind === 'headline' && Object.keys(last.headlineSides).some((n) => key(n) === 'opec') && !hasScore) {
      const d = -['Egypt', 'Iran', 'Libya', 'Saudi Arabia', 'Iraq', 'Gulf States', 'Venezuela'].filter((c) => board.ctrl(c) === 'USSR').length;
      if (vp + d <= -20) { finalVp = vp + d; ending = 'V1'; winner = 'USSR'; note = `OPEC headline result not logged; board replay gives ${sgn(d)} VP, reaching 20`; }
    }
    if (!ending && last.kind === 'ar' && last.side === 'US' && inplay.has('we will bury you') && last.card !== 32 && !nonblank.length) {
      if (vp - 3 <= -20) { finalVp = vp - 3; ending = 'V1'; winner = 'USSR'; note = "We Will Bury You: the US did not answer with UN Intervention, so the USSR's 3 VP reach 20"; }
    }
    if (!ending && last.kind === 'ar' && (last.action || '').startsWith('Space Race') && !nonblank.length) {
      const sd = last.side, nxt = space[sd] + 1;
      const gain = (SPACE_VP[nxt] || [0, 0])[space[OPP[sd]] < nxt ? 0 : 1];
      const sv = vp + (sd === 'US' ? gain : -gain);
      if (Math.abs(sv) >= 20) { finalVp = sv; ending = 'V1'; winner = sd; note = `Space Race roll not logged; reaching box ${nxt} gives ${sd} ${gain} VP and 20 VP (inferred)`; }
    }
    if (!ending) {
      let pend = null;
      if (last.kind === 'ar') pend = (!nonblank.length || (last.card && CARDS[last.card].scoring)) ? last.side : OPP[last.side];
      ending = 'V8/V9'; winner = pend ? OPP[pend] : W(vp); finalVp = vp;
      note += (pend ? `Log stops with the ${pend} player to act` : 'Log stops in the Headline Phase') + ': forfeit or timeout';
    }
    const ENDING_NAME = { V1: '20 VP', V2: 'DEFCON 1 (nuclear war)', V3: 'Cuban Missile Crisis', V4: 'Europe Control', V5: 'Held scoring card', V6: 'Wargames', V7: 'Final Scoring', 'V8/V9': 'Forfeit or timeout', V10: 'Draw' };
    const avg = (x) => (x.length ? pyRound(x.reduce((a, b) => a + b, 0) / x.length, 2) : null);
    const dstats = {};
    for (const s of ['US', 'USSR']) {
      const d = dice[s], g = (k) => d[k] || [], coups = g('coup_bg').concat(g('coup_nonbg'));
      const sets = { coup_all: coups, coup_bg: g('coup_bg'), coup_nonbg: g('coup_nonbg'), realign: g('realign'), war: g('war'), space: g('space'), all: coups.concat(g('realign'), g('war'), g('space')) };
      dstats[s] = {}; for (const [k, v] of Object.entries(sets)) dstats[s][k] = { avg: avg(v), n: v.length };
    }
    // Final Scoring lines are printed after the last action round, set apart by a blank line
    if (ending === 'V7' && timeline.length) for (const s of timeline[timeline.length - 1][5]) if (s[2]) s[1] = 'Final Scoring';
    for (const e of timeline) for (const s of e[5]) s.length = 2;
    if (finalVp !== vp) timeline.push([gameTurn, 'E', null, null, finalVp, [[finalVp - vp, note || ENDING_NAME[ending] || 'Game end']]]);
    return { id: gid, players, clock, turn: last.turn, final_vp: finalVp, ending, ending_name: ENDING_NAME[ending], winner, note, wars, bgflip, dice: dstats, ops, scorSeq, timeline };
  }

  // make_rows.py
  function toRow(g, me_name) {
    const me = g.players.US === me_name ? 'US' : 'USSR', opp = me === 'US' ? 'USSR' : 'US';
    const r = { id: g.id, us_player: g.players.US, ussr_player: g.players.USSR, my_side: me, opponent: g.players[opp], turn: g.turn,
      clock_min: g.clock ? parseInt(g.clock, 10) : null, final_vp: g.final_vp, ending_code: g.ending, ending: g.ending_name,
      vp_timeline: g.timeline, winner: g.winner || 'Draw', result: g.winner === me ? 'Win' : (!g.winner ? 'Draw' : 'Loss'), ending_note: g.note };
    for (const s of ['US', 'USSR']) {
      const p = s.toLowerCase();
      for (const [k, v] of Object.entries(g.dice[s])) { r[`${p}_${k}_avg`] = v.avg; r[`${p}_${k}_n`] = v.n; }
      r[`${p}_scoring_seq`] = g.scorSeq[s];
      r[`${p}_bg_flips`] = g.bgflip[s]; r[`${p}_wars_won`] = g.wars[s].won; r[`${p}_wars_fought`] = g.wars[s].fought;
      const tot = { playable: 0, costly: 0, scorings: 0, total: 0, cards: 0, four: 0 };
      for (const era of ['Early', 'Mid', 'Late']) for (const k of Object.keys(tot)) { r[`${p}_${era.toLowerCase()}_${k}`] = g.ops[s][era][k]; tot[k] += g.ops[s][era][k]; }
      for (const [k, v] of Object.entries(tot)) r[`${p}_game_${k}`] = v;
      for (const era of ['early', 'mid', 'late', 'game']) { const n = r[`${p}_${era}_cards`]; r[`${p}_${era}_avg_ops`] = n ? pyRound(r[`${p}_${era}_total`] / n, 1) : null; }
    }
    return r;
  }

  root.TSParse = {
    /** files: [{name, text}] -> {rows, skipped: [{name, reason}]} */
    parseLogs(files, meName) {
      const rows = [], skipped = [];
      for (const f of files) {
        const gid = f.name.replace(/\.txt$/i, '');
        if (!/will play as (USA|USSR)/.test(f.text.slice(0, 400))) { skipped.push({ name: f.name, reason: 'not a Twilight Struggle game log' }); continue; }
        try { rows.push(toRow(parseGame(gid, f.text), meName || 'wirus_')); }
        catch (e) { skipped.push({ name: f.name, reason: 'could not be parsed (' + e.message + ')' }); }
      }
      return { rows, skipped };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
