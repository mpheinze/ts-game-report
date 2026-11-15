// Tiny in-page engine: holds the parsed games, draws each [data-draw] element, and keeps games in this browser's localStorage.
{
// ---------- tiny in-page engine standing in for the dashboard runtime ----------
const KEY = 'tsr-games-v1';
const S = { rows: [], game: null };
const reg = {};
function load() { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(v)) S.rows = v; } catch (e) { S.rows = []; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S.rows)); return true; } catch (e) { return false; } }
window.dash = {
  data() { return { status: 'ok', data: S.rows, columns: [] }; },
  params() { return { game: S.game }; },
  setParams(p) { if ('game' in p) S.game = p.game; render(); },
  draw(name, fn) { if (fn) { reg[name] = fn; } else runDraw(name); }
};
function runDraw(name) { const fn = reg[name]; if (!fn) return; document.querySelectorAll(`[data-draw="${name}"]`).forEach((el) => { if (el.closest('[hidden]')) return; try { fn(el); } catch (e) { console.error(name, e); } }); }
function render() {
  const has = S.rows.length > 0;
  document.querySelectorAll('[data-when="games"]').forEach((n) => { n.hidden = !has; });
  document.querySelectorAll('[data-when="empty"]').forEach((n) => { n.hidden = has; });
  Object.keys(reg).forEach(runDraw);
}
window.tsrEngine = { S, load, save, render };
}
