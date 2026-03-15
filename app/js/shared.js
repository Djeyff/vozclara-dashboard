/* VozClara Dashboard — shared.js */

const VC_NAV = [
  { id: 'inbox', label: 'Transcripciones', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>', href: '/app/' },
  { id: 'search', label: 'Búsqueda IA', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>', href: '/app/search.html' },
  { id: 'folders', label: 'Carpetas', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>', href: '/app/folders.html' },
  { id: 'starred', label: 'Favoritos', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>', href: '/app/starred.html' },
  { id: 'reports', label: 'Reportes PDF', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>', href: '/app/reports.html' },
  { id: 'settings', label: 'Configuración', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>', href: '/app/settings.html' },
];

const VC_MOBILE_TABS = [
  { id: 'inbox', label: 'Inbox', icon: '🎙️', href: '/app/' },
  { id: 'search', label: 'Search', icon: '🔍', href: '/app/search.html' },
  { id: 'folders', label: 'Folders', icon: '📁', href: '/app/folders.html' },
  { id: 'settings', label: 'Settings', icon: '⚙️', href: '/app/settings.html' },
];

const VC_LOGO = '<svg viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="16" fill="#2A5C8F"/><path d="M16 8a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z" fill="white"/><path d="M12 15v1a4 4 0 0 0 8 0v-1" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/><line x1="16" y1="20" x2="16" y2="23" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>';

const PLAN_LIMITS = {
  free: { notes_day: 40, minutes_month: 10, searches: 5, label: 'Free' },
  basic: { notes_day: 200, minutes_month: 60, searches: 20, label: 'Basic' },
  pro: { notes_day: '∞', minutes_month: 500, searches: '∞', label: 'Pro' },
  business: { notes_day: '∞', minutes_month: '∞', searches: '∞', label: 'Business' },
};

function renderSidebar(activePage) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <div class="sidebar-brand-row">
        <div class="sidebar-logo vozclara">${VC_LOGO}</div>
        <span class="sidebar-brand-text">VozClara</span>
      </div>
      <div class="sidebar-workspace" style="padding-left:42px">free</div>
    </div>
    <nav class="sidebar-nav">
      ${VC_NAV.map(item => {
        const isActive = item.id === activePage;
        return `<a class="nav-item ${isActive ? 'active' : ''}" href="${item.href}">
          <span class="icon">${item.icon}</span>
          ${item.label}
        </a>`;
      }).join('')}
    </nav>
    <div class="sidebar-usage">
      ${usageMeter('Notas hoy', 7, 40)}
      ${usageMeter('Minutos', 3, 10)}
      ${usageMeter('Búsquedas IA', 2, 5)}
    </div>
    <div class="sidebar-footer">
      <a href="https://retena.app">👥 For teams → <strong>Retena</strong></a>
    </div>
  `;
}

function renderMobileTabs(activePage) {
  const tabs = document.getElementById('mobile-tabs');
  if (!tabs) return;
  tabs.innerHTML = VC_MOBILE_TABS.map(item => {
    const isActive = item.id === activePage;
    return `<a class="mobile-tab ${isActive ? 'active' : ''}" href="${item.href}">
      <span class="tab-icon">${item.icon}</span>
      <span>${item.label}</span>
    </a>`;
  }).join('');
}

function usageMeter(label, used, total) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const color = pct < 50 ? 'green' : pct < 80 ? 'amber' : 'red';
  return `<div class="usage-item">
    <div class="usage-label"><span>${label}</span><span>${used} / ${total}</span></div>
    <div class="usage-bar"><div class="usage-fill ${color}" style="width:${pct}%"></div></div>
  </div>`;
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

function formatDuration(sec) {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

async function api(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal, credentials: 'include', headers: { 'Content-Type': 'application/json', ...options.headers } });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('Request timed out');
    throw err;
  }
}
