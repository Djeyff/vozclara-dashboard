/* VozClara Dashboard — shared.js */
'use strict';

/* ── API helper ── */
async function api(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal, credentials: 'include' });
    clearTimeout(timer);
    if (r.status === 401) { window.location.href = '/app/login.html'; return null; }
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || r.statusText); }
    return r.json();
  } catch(e) { clearTimeout(timer); throw e; }
}

/* ── UI helpers ── */
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function show(el) { if (typeof el === 'string') el = $(el); if (el) el.classList.remove('hidden'); }
function hide(el) { if (typeof el === 'string') el = $(el); if (el) el.classList.add('hidden'); }

function showLoading(id) {
  const el = $(id);
  if (!el) return;
  el.innerHTML = `<div class="space-y-3">${Array(4).fill('<div class="h-16 bg-gray-800 rounded-xl animate-pulse"></div>').join('')}</div>`;
}
function showError(id, msg) {
  const el = $(id);
  if (!el) return;
  el.innerHTML = `<div class="flex flex-col items-center justify-center py-16 text-gray-400"><svg class="w-12 h-12 mb-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z"/></svg><p class="text-sm">${msg}</p></div>`;
}
function showEmpty(id, icon, title, sub) {
  const el = $(id);
  if (!el) return;
  el.innerHTML = `<div class="flex flex-col items-center justify-center py-16 text-gray-400"><span class="text-4xl mb-3">${icon}</span><p class="font-medium text-white">${title}</p><p class="text-sm mt-1">${sub || ''}</p></div>`;
}

/* ── Formatters ── */
function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  const now = new Date();
  const diff = now - dt;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  if (diff < 604800000) return dt.toLocaleDateString('en', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  return dt.toLocaleDateString('en', { month: 'short', day: 'numeric', year: dt.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}
function formatDuration(sec) {
  if (!sec) return '0s';
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return m > 0 ? `${m}:${String(s).padStart(2,'0')}` : `${s}s`;
}
function getFlag(lang) {
  const flags = {es:'🇪🇸',en:'🇬🇧',fr:'🇫🇷',pt:'🇧🇷',de:'🇩🇪',it:'🇮🇹',ar:'🇸🇦',zh:'🇨🇳',ja:'🇯🇵',ko:'🇰🇷',ru:'🇷🇺',hi:'🇮🇳',nl:'🇳🇱'};
  return flags[(lang||'').toLowerCase().slice(0,2)] || '🌐';
}
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function sourceBadge(src) {
  if (src === 'telegram') return '<span class="bg-blue-500/20 text-blue-400 text-xs px-1.5 py-0.5 rounded-full">TG</span>';
  if (src === 'whatsapp') return '<span class="bg-emerald-500/20 text-emerald-400 text-xs px-1.5 py-0.5 rounded-full">WA</span>';
  if (src === 'upload') return '<span class="bg-purple-500/20 text-purple-400 text-xs px-1.5 py-0.5 rounded-full">Upload</span>';
  if (src === 'chrome') return '<span class="bg-amber-500/20 text-amber-400 text-xs px-1.5 py-0.5 rounded-full">Chrome</span>';
  return '<span class="bg-gray-700 text-gray-400 text-xs px-1.5 py-0.5 rounded-full">Other</span>';
}

function usageMeter(label, used, total) {
  const pct = total > 0 ? Math.min(100, Math.round(used / total * 100)) : (total < 0 ? 5 : 0);
  const unlimited = total < 0;
  const color = unlimited ? 'bg-emerald-500' : pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor = unlimited ? 'text-emerald-400' : pct >= 90 ? 'text-red-400' : pct >= 70 ? 'text-amber-400' : 'text-emerald-400';
  return `<div class="mb-3"><div class="flex justify-between text-xs mb-1"><span class="text-gray-400">${label}</span><span class="${textColor}">${used}/${unlimited ? '∞' : total}</span></div><div class="w-full h-1.5 bg-gray-700 rounded-full"><div class="${color} h-1.5 rounded-full transition-all" style="width:${unlimited ? '5' : pct}%"></div></div></div>`;
}

/* ── Sidebar + Mobile Tabs ── */
const NAV_ITEMS = [
  { id: 'inbox',    icon: '📥', label: 'Inbox',       href: '/app/' },
  { id: 'search',   icon: '🔍', label: 'AI Search',   href: '/app/search.html' },
  { id: 'folders',  icon: '📁', label: 'Folders',     href: '/app/folders.html' },
  { id: 'starred',  icon: '⭐', label: 'Starred',     href: '/app/starred.html' },
  { id: 'reports',  icon: '📄', label: 'PDF Reports', href: '/app/reports.html' },
  { id: 'settings', icon: '⚙️', label: 'Settings',    href: '/app/settings.html' },
];
const MOBILE_TABS = ['inbox','search','starred','settings'];

function renderSidebar(active) {
  const el = $('#sidebar');
  if (!el) return;
  el.innerHTML = `
    <div class="flex items-center gap-2 px-4 pt-5 pb-4">
      <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#818cf8] flex items-center justify-center">
        <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a4 4 0 00-4 4v5a4 4 0 008 0V6a4 4 0 00-4-4zm6 9v2a6 6 0 01-12 0v-2H4v2a8 8 0 007 7.9V23h2v-2.1A8 8 0 0020 13v-2h-2z"/></svg>
      </div>
      <span class="text-white font-semibold text-lg">VozClara</span>
    </div>
    <nav class="flex-1 px-2 space-y-0.5 overflow-y-auto">
      ${NAV_ITEMS.map(n => {
        const isActive = n.id === active;
        return `<a href="${n.href}" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'text-white bg-gray-800 border-r-2 border-[#6366f1]' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}">${n.icon} ${n.label}</a>`;
      }).join('')}
    </nav>
    <div id="sidebar-usage" class="px-4 py-3 border-t border-gray-700"></div>
    <a href="https://retena.app" target="_blank" class="block px-4 py-3 text-xs text-gray-500 hover:text-gray-300 border-t border-gray-700">👥 Team use → Retena</a>
  `;
  loadSidebarUsage();
}

async function loadSidebarUsage() {
  try {
    const u = await api('/api/vc/usage');
    const el = $('#sidebar-usage');
    if (!el || !u) return;
    const tier = (u.tier || 'free').toUpperCase();
    const l = u.limits || {};
    el.innerHTML = `<div class="text-xs text-gray-500 mb-2 font-medium">${tier} PLAN</div>${usageMeter('Notes today', u.today?.notes_count || 0, l.notes_per_day || 5)}${usageMeter('Minutes/mo', Math.round(u.all_time?.minutes || 0), l.minutes_per_month || 30)}${usageMeter('Searches/mo', u.all_time?.searches || 0, l.searches_per_month || 10)}`;
  } catch(e) {}
}

function renderMobileTabs(active) {
  const el = $('#mobile-tabs');
  if (!el) return;
  el.innerHTML = MOBILE_TABS.map(id => {
    const n = NAV_ITEMS.find(x => x.id === id);
    const isActive = id === active;
    return `<a href="${n.href}" class="flex flex-col items-center justify-center gap-0.5 ${isActive ? 'text-[#6366f1]' : 'text-gray-500'} transition-colors"><span class="text-lg">${n.icon}</span><span class="text-[10px]">${n.label}</span></a>`;
  }).join('');
}
