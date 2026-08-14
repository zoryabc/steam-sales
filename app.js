'use strict';

/* ============================================================
 * Steam 游戏折扣情报站 — 前端逻辑
 * 安全说明：所有来自 games.json（Steam API）的数据在插入
 * innerHTML 前都经过 esc() 转义，防止 XSS 注入。
 * ============================================================ */

const state = { keyword: '', minDiscount: 0, sort: 'discount' };
let DATA = null;

/* ---------- 安全转义 ---------- */
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------- 工具函数 ---------- */
function fmtPrice(p, cur) {
  if (p <= 0) return '免费';
  const n = p / 100;
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  const sym = cur === 'CNY' ? '¥' : cur === 'USD' ? '$' : cur + ' ';
  return sym + s;
}
function fmtCount(n) {
  if (!n) return '';
  if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + ' 亿';
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + ' 万';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}
function reviewColor(pct) {
  if (!pct) return '#8f98a0';
  if (pct >= 70) return '#66c0f4';
  if (pct >= 40) return '#c1b15c';
  return '#c34c4c';
}
function timeLeft(exp) {
  if (!exp) return '';
  const diff = exp * 1000 - Date.now();
  if (diff <= 0) return '折扣已结束';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `剩 ${d} 天`;
  if (h > 0) return `剩 ${h} 小时`;
  if (m > 0) return `剩 ${m} 分钟`;
  return '即将结束';
}
function fmtTime(iso) {
  const t = new Date(iso);
  const p = (x) => String(x).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`;
}

/* ---------- 渲染 ---------- */
function filtered() {
  let list = DATA.games.filter((g) => {
    if (g.discount < state.minDiscount) return false;
    if (state.keyword && !String(g.name).toLowerCase().includes(state.keyword)) return false;
    return true;
  });
  switch (state.sort) {
    case 'discount': list.sort((a, b) => b.discount - a.discount || a.finalPrice - b.finalPrice); break;
    case 'priceAsc': list.sort((a, b) => a.finalPrice - b.finalPrice || b.discount - a.discount); break;
    case 'priceDesc': list.sort((a, b) => b.finalPrice - a.finalPrice || b.discount - a.discount); break;
    case 'rating': list.sort((a, b) => (b.reviewPct || 0) - (a.reviewPct || 0) || b.discount - a.discount); break;
    case 'expiry': list.sort((a, b) => (a.expires || 1e12) - (b.expires || 1e12)); break;
  }
  return list;
}

function cardHTML(g) {
  const exp = timeLeft(g.expires);
  const urgent = g.expires && (g.expires * 1000 - Date.now()) < 86400000;
  const revTxt = g.reviewPct
    ? `${g.reviewDesc} ${g.reviewPct}%${g.reviewTotal ? ' · ' + fmtCount(g.reviewTotal) + ' 条' : ''}`
    : '暂无评价';
  const badge = g.free
    ? '<span class="free-badge">免费</span>'
    : `<span class="badge">-${Math.min(100, Math.max(0, Number(g.discount) || 0))}%</span>`;
  const imgSrc = g.headerImage || g.largeCapsule || '';
  const pct = Math.min(100, Math.max(0, Number(g.reviewPct) || 0));
  const col = reviewColor(pct);

  return `
  <a class="card" href="${esc(g.link)}" target="_blank" rel="noopener noreferrer">
    <div class="thumb">
      <img src="${esc(imgSrc)}" alt="${esc(g.name)}" loading="lazy" referrerpolicy="no-referrer">
      ${badge}
    </div>
    <div class="info">
      <div class="name">${esc(g.name)}</div>
      <div class="review">
        <span style="color:${col};font-weight:600;">${esc(revTxt)}</span>
        <span class="bar"><i style="width:${pct}%;background:${col};"></i></span>
      </div>
      <div class="price-row">
        ${g.free ? '' : `<span class="price-old">${esc(fmtPrice(g.originalPrice, g.currency))}</span>`}
        <span class="price-now ${g.free ? 'free' : ''}">${esc(fmtPrice(g.finalPrice, g.currency))}</span>
      </div>
      <div class="meta">
        <span class="exp ${urgent ? 'urgent' : ''}">${exp ? '⏳ ' + esc(exp) : ''}</span>
        <span class="release">${esc(g.releaseDate || '')}</span>
      </div>
    </div>
  </a>`;
}

function render() {
  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty');
  const list = filtered();
  grid.classList.remove('skeleton');
  grid.innerHTML = list.map(cardHTML).join('');
  empty.style.display = list.length ? 'none' : 'block';
}

function renderStats() {
  const gs = DATA.games;
  document.getElementById('statCount').textContent = gs.length;
  const max = Math.max(...gs.map((g) => g.discount));
  document.getElementById('statMax').textContent = '-' + max + '%';
  const avg = Math.round(gs.reduce((s, g) => s + g.discount, 0) / gs.length);
  document.getElementById('statAvg').textContent = '-' + avg + '%';
}

/* ---------- 事件 ---------- */
document.getElementById('searchInput').addEventListener('input', (e) => {
  state.keyword = e.target.value.trim().toLowerCase();
  render();
});
document.getElementById('chips').addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
  btn.classList.add('active');
  state.minDiscount = Number(btn.dataset.min);
  render();
});
document.getElementById('sortSelect').addEventListener('change', (e) => {
  state.sort = e.target.value;
  render();
});

/* ---------- 数据加载 ---------- */
(async function load() {
  try {
    const res = await fetch('data/games.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    DATA = await res.json();
    document.getElementById('updatedText').textContent = '数据更新于 ' + fmtTime(DATA.updatedAt) + ' · 每日自动更新';
    document.title = 'Steam 游戏折扣情报站 · 今日 ' + DATA.total + ' 款折扣';
    renderStats();
    render();
  } catch (err) {
    console.error(err);
    document.getElementById('grid').classList.remove('skeleton');
    document.getElementById('grid').innerHTML = '';
    const empty = document.getElementById('empty');
    empty.style.display = 'block';
    empty.innerHTML = `
      <div class="icon">⚠️</div>
      <h3>数据加载失败</h3>
      <p>无法读取 data/games.json（${esc(err.message)}）</p>
      <div class="hint">请稍后刷新重试</div>`;
    document.getElementById('updatedText').textContent = '数据加载失败';
  }
})();

// 页面可见时刷新剩余时间
setInterval(() => { if (DATA && document.visibilityState === 'visible') render(); }, 60000);
