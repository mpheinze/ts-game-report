{
// ---------- uploads: parse in this browser, keep only on this device ----------
const { S, load, save, render } = window.tsrEngine;
window.tsrAdd = { msg: '', err: false };
const say = (msg, err) => { window.tsrAdd.msg = msg; window.tsrAdd.err = !!err; dash.draw('addstatus'); };
dash.draw('addstatus', (el) => { el.textContent = window.tsrAdd.msg; el.className = 'tsr-addmsg' + (window.tsrAdd.err ? ' err' : ''); });
const input = document.getElementById('add-file');
async function addFiles(list) {
  list = [...list].filter((f) => /\.txt$/i.test(f.name) || f.type === 'text/plain');
  if (!list.length) { say('Pick the game log .txt files.', true); return; }
  say(`Reading ${list.length} file${list.length === 1 ? '' : 's'}…`);
  try {
    const files = await Promise.all(list.map(async (f) => ({ name: f.name, text: await f.text() })));
    const { rows, skipped } = window.TSParse.parseLogs(files, '');
    const skipNote = skipped.length ? ` Skipped ${skipped.map((s) => `${s.name} (${s.reason})`).join(', ')}.` : '';
    if (!rows.length) { say('No games added.' + skipNote, true); return; }
    const byId = new Map(S.rows.map((r) => [String(r.id), r]));
    let added = 0, updated = 0;
    for (const r of rows) { if (byId.has(String(r.id))) updated++; else added++; byId.set(String(r.id), r); }
    S.rows = [...byId.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    S.game = rows.map((r) => String(r.id)).sort().pop();
    const kept = save();
    render();
    say(`${added} game${added === 1 ? '' : 's'} added${updated ? `, ${updated} updated` : ''}.` + skipNote + (kept ? '' : ' Your browser would not store them, so they will be gone when you close this page.'), !kept);
  } catch (e) { say('Could not read the files: ' + (e && e.message ? e.message : String(e)), true); }
}
document.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); input.click(); }));
const drop = document.getElementById('drop');
drop.addEventListener('click', (e) => { if (e.target.closest('a')) return; input.click(); });
drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
input.addEventListener('change', () => { addFiles(input.files || []); input.value = ''; });
let depth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); depth++; document.body.classList.add('dragging'); drop.classList.add('over'); });
window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; document.body.classList.remove('dragging'); drop.classList.remove('over'); } });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => { e.preventDefault(); depth = 0; document.body.classList.remove('dragging'); drop.classList.remove('over'); if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });
const clear = document.getElementById('clear-btn');
let armed = null;
clear.addEventListener('click', () => {
  if (!armed) { clear.textContent = 'Click again to remove all games'; armed = setTimeout(() => { armed = null; clear.textContent = 'Clear my games'; }, 4000); return; }
  clearTimeout(armed); armed = null; clear.textContent = 'Clear my games';
  S.rows = []; S.game = null; save(); render(); say('All games removed from this browser.');
});
let rt = null;
window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => dash.draw('track'), 120); });
load();
render();
}
