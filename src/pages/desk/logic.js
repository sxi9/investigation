// Logic for the desk page, carried over from design/Case Files.dc.html with the runtime base
// class swapped for the shim in src/dc.js. Patches applied by the converter: desk/login/board routes; board route; desk re-reads the store when other people's changes arrive.
/* eslint-disable */
import React from 'react';
import { DCLogic } from '../../dc.js';

class Component extends DCLogic {
  static KEY = 'cyber-investigation-board.v1';
  static DESK = 'cyber-investigation-board.desk.v1';
  static TLP = [['', 'TLP: unset', '#8d877b', '#fff'], ['clear', 'TLP:CLEAR', '#f3f1ea', '#1b1a17'], ['green', 'TLP:GREEN', '#3fae63', '#fff'], ['amber', 'TLP:AMBER', '#e8a71c', '#1b1a17'], ['amber+strict', 'TLP:AMBER+STRICT', '#e8a71c', '#1b1a17'], ['red', 'TLP:RED', '#ff2a3c', '#fff']];
  static TYPES = { note: 'Note', link: 'Link', person: 'Person', indicator: 'Indicator', doc: 'Document', event: 'Event', location: 'Location', ttp: 'Technique', tx: 'Transfer', target: 'Target', photo: 'Photo' };
  static TYPE_COLOR = { person: '#ff2a3c', indicator: '#e8a71c', link: '#4ea1e8', location: '#4bbf6b', event: '#f1ede2', doc: '#b9b3a6', note: '#f3e58c', photo: '#8c8cf0', ttp: '#9b6bff', tx: '#2fc4b2', target: '#e07a2f' };
  static WIDTHS = { note: 180, link: 240, person: 210, indicator: 230, doc: 220, event: 200, location: 220, ttp: 210, tx: 240, target: 220, photo: 220 };
  static COLORS = ['', '#ff2a3c', '#e8a71c', '#3fae63', '#4ea1e8', '#9b6bff'];
  static MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  static DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  static uid() { return 'id' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  static THEMES = {
    noir: { label: 'Noir', desk: '#0b0b0c', lamp: '255,236,190', panel: 'rgba(14,14,16,.85)', panel2: '#111113', input: '#0c0c0e', btn: '#17171a', btnHover: '#222226', border: '#2c2c31', border2: '#232326', text: '#e8e4da', text2: '#d8d3c7', textStrong: '#f3f1ea', textMuted: '#8d877b', textFaint: '#5f5a52', accent: '#ff2a3c', accentInk: '#ffffff', folderA: '#d8bd83', folderB: '#b9995c', tab: '#c9ad74', paper: '#f3f1ea', ink: '#1b1a17', inkMuted: '#5a4a22', filter: 'none', boardBg: '#101012', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #1c1c20 0%, #101012 55%, #070708 100%)', bpaper: '', bnote: '', pin: ['#ff9ba1', '#ff2a3c', '#6b0a10'] },
    cold: { label: 'Cold case', desk: '#0e0d0b', lamp: '220,200,160', panel: 'rgba(18,16,13,.85)', panel2: '#131210', input: '#0d0c0a', btn: '#1a1814', btnHover: '#26231d', border: '#2e2a24', border2: '#262320', text: '#d9d2c2', text2: '#cbc3b1', textStrong: '#ece5d4', textMuted: '#857d6c', textFaint: '#5a5448', accent: '#b4222a', accentInk: '#ffffff', folderA: '#bfae8a', folderB: '#9f8f6c', tab: '#b3a27e', paper: '#e9e2d2', ink: '#2a2622', inkMuted: '#5f5440', filter: 'sepia(.35) contrast(.92)', boardBg: '#121110', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #1f1c17 0%, #121110 55%, #080706 100%)', bpaper: '#e7ddc3', bnote: '#e6d079', pin: ['#e0c9a0', '#a8853f', '#4a3410'] },
    midnight: { label: 'Midnight', desk: '#070b16', lamp: '170,200,255', panel: 'rgba(10,14,26,.85)', panel2: '#0d1324', input: '#080c18', btn: '#131a30', btnHover: '#1b2442', border: '#1f2740', border2: '#1a2136', text: '#dfe6f5', text2: '#c9d3ea', textStrong: '#f1f5ff', textMuted: '#7f8db0', textFaint: '#4f5a78', accent: '#ffb547', accentInk: '#1b1a17', folderA: '#8f9ec4', folderB: '#6273a0', tab: '#7f8fb8', paper: '#eef1f8', ink: '#141a2a', inkMuted: '#2d3a5c', filter: 'none', boardBg: '#0a0f1e', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #15203a 0%, #0a0f1e 55%, #04060d 100%)', bpaper: '#eef1f8', bnote: '#f3e58c', pin: ['#ffe2a0', '#ffb547', '#6b4a0e'] },
    warroom: { label: 'War room', desk: '#0a1410', lamp: '220,255,200', panel: 'rgba(10,18,14,.85)', panel2: '#0f1a15', input: '#091009', btn: '#15231c', btnHover: '#1e3127', border: '#22302a', border2: '#1c2822', text: '#e2e8dc', text2: '#cfd8cc', textStrong: '#f1f5ee', textMuted: '#7f9484', textFaint: '#4f6356', accent: '#ff2a3c', accentInk: '#ffffff', folderA: '#b7b58a', folderB: '#8f8e63', tab: '#a6a47a', paper: '#f1efe4', ink: '#1b1f16', inkMuted: '#4a5030', filter: 'none', boardBg: '#0c1611', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #17271e 0%, #0c1611 55%, #040a07 100%)', bpaper: '#f1efe4', bnote: '#efe2a0', pin: ['#ff9ba1', '#ff2a3c', '#6b0a10'] },
    redroom: { label: 'Red room', desk: '#160608', lamp: '255,200,200', panel: 'rgba(24,8,10,.85)', panel2: '#1c0a0d', input: '#120507', btn: '#2a1114', btnHover: '#3a181c', border: '#3a1a1e', border2: '#2e1518', text: '#f1e6e6', text2: '#e3d2d2', textStrong: '#fff5f5', textMuted: '#a07a7e', textFaint: '#6a4a4e', accent: '#f3f1ea', accentInk: '#1b1a17', folderA: '#a9a39e', folderB: '#7f7975', tab: '#9c9691', paper: '#f4f0ee', ink: '#1b1515', inkMuted: '#5a3a3a', filter: 'none', boardBg: '#1a0709', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #2c0d11 0%, #1a0709 55%, #0a0203 100%)', bpaper: '#f4f0ee', bnote: '#f3e58c', pin: ['#ffffff', '#cfc9b8', '#4e4a40'] },
    daylight: { label: 'Daylight', desk: '#d9d2c3', lamp: '255,255,255', panel: 'rgba(255,255,255,.55)', panel2: '#ece7dc', input: '#fbf9f4', btn: '#f3efe6', btnHover: '#ffffff', border: '#b9b0a0', border2: '#c9c1b2', text: '#1b1a17', text2: '#2e2b26', textStrong: '#000000', textMuted: '#5a564e', textFaint: '#8a857b', accent: '#c81e2c', accentInk: '#ffffff', folderA: '#e7cf96', folderB: '#cdb374', tab: '#dcc389', paper: '#ffffff', ink: '#1b1a17', inkMuted: '#6d5a2e', filter: 'none', boardBg: '#cfc7b6', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #e2dbcc 0%, #cfc7b6 55%, #b3aa98 100%)', bpaper: '#ffffff', bnote: '#fff3a3', pin: ['#ff9ba1', '#c81e2c', '#6b0a10'] },
    mono: { label: 'Mono', desk: '#000000', lamp: '255,255,255', panel: 'rgba(0,0,0,.85)', panel2: '#0a0a0a', input: '#050505', btn: '#161616', btnHover: '#242424', border: '#333333', border2: '#262626', text: '#ffffff', text2: '#dddddd', textStrong: '#ffffff', textMuted: '#999999', textFaint: '#666666', accent: '#ffffff', accentInk: '#000000', folderA: '#a6a6a6', folderB: '#7a7a7a', tab: '#969696', paper: '#ffffff', ink: '#000000', inkMuted: '#444444', filter: 'grayscale(1)', boardBg: '#000000', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #1a1a1a 0%, #000 55%, #000 100%)', bpaper: '#ffffff', bnote: '#e6e6e6', pin: ['#ffffff', '#bbbbbb', '#333333'] },
    terminal: { label: 'Terminal', desk: '#030604', lamp: '120,255,160', panel: 'rgba(3,8,5,.85)', panel2: '#07120b', input: '#040a06', btn: '#0b1a10', btnHover: '#12271a', border: '#143a22', border2: '#0f2a19', text: '#9dffbd', text2: '#7fe6a3', textStrong: '#c9ffdc', textMuted: '#3fae63', textFaint: '#246b3d', accent: '#39ff8a', accentInk: '#031a0c', folderA: '#7fae8c', folderB: '#5a8a68', tab: '#72a080', paper: '#dff7e6', ink: '#06130a', inkMuted: '#245a36', filter: 'none', boardBg: '#040806', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #0b1a10 0%, #040806 55%, #000 100%)', bpaper: '#dff7e6', bnote: '#cdf0d8', pin: ['#b8ffd0', '#39ff8a', '#0b5a2e'] },
    amber: { label: 'Amber CRT', desk: '#060402', lamp: '255,190,80', panel: 'rgba(8,5,2,.85)', panel2: '#120c04', input: '#0a0603', btn: '#1c1206', btnHover: '#2a1b09', border: '#3a2810', border2: '#2c1e0c', text: '#ffd28a', text2: '#f2c070', textStrong: '#ffe7b8', textMuted: '#a8803a', textFaint: '#6b5224', accent: '#ffb000', accentInk: '#1b1200', folderA: '#d9a95a', folderB: '#b0833c', tab: '#cc9d50', paper: '#fbe9c8', ink: '#2a1a05', inkMuted: '#7a5212', filter: 'none', boardBg: '#070401', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #1b1105 0%, #070401 55%, #000 100%)', bpaper: '#fbe9c8', bnote: '#f7dc9a', pin: ['#ffe0a0', '#ffb000', '#6b4600'] },
    blueprint: { label: 'Blueprint', desk: '#0b1d3a', lamp: '120,200,255', panel: 'rgba(8,22,46,.85)', panel2: '#0e2246', input: '#081a38', btn: '#132d58', btnHover: '#1b3a70', border: '#244a80', border2: '#1c3c6a', text: '#dceaff', text2: '#c4d8f6', textStrong: '#ffffff', textMuted: '#7fa6d8', textFaint: '#4f6f9c', accent: '#5ad1ff', accentInk: '#06203a', folderA: '#9db7d9', folderB: '#6f8fba', tab: '#8ea9cf', paper: '#f4f8ff', ink: '#0b1d3a', inkMuted: '#2b4f80', filter: 'none', boardBg: '#0b1d3a', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #163366 0%, #0b1d3a 55%, #050e1e 100%)', bpaper: '#f4f8ff', bnote: '#e2efff', pin: ['#c8f0ff', '#5ad1ff', '#0f5a80'] },
    bureau: { label: 'Bureau 1972', desk: '#2b2118', lamp: '255,220,160', panel: 'rgba(34,26,19,.85)', panel2: '#33281d', input: '#241b13', btn: '#3b2f23', btnHover: '#4a3b2c', border: '#5a4836', border2: '#4a3b2c', text: '#efe4cf', text2: '#dfd2ba', textStrong: '#fff8e8', textMuted: '#a8947a', textFaint: '#7a6a55', accent: '#c0392b', accentInk: '#ffffff', folderA: '#a9a677', folderB: '#7f7c52', tab: '#9b9869', paper: '#f1e9d2', ink: '#1e1a12', inkMuted: '#5c4e2a', filter: 'sepia(.15)', boardBg: '#2b2118', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #3d3024 0%, #2b2118 55%, #15100b 100%)', bpaper: '#f1e9d2', bnote: '#ecd98a', pin: ['#ffe9a3', '#c9962a', '#5a3d0a'] },
    arctic: { label: 'Arctic', desk: '#e8edf2', lamp: '255,255,255', panel: 'rgba(255,255,255,.6)', panel2: '#f4f7fa', input: '#ffffff', btn: '#f6f8fb', btnHover: '#ffffff', border: '#b8c4d0', border2: '#cbd5df', text: '#10202e', text2: '#243648', textStrong: '#000000', textMuted: '#5f7082', textFaint: '#8e9cab', accent: '#1f8fff', accentInk: '#ffffff', folderA: '#d4dde8', folderB: '#aebbca', tab: '#c6d1de', paper: '#ffffff', ink: '#10202e', inkMuted: '#3d556e', filter: 'none', boardBg: '#dfe6ee', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #f2f6fa 0%, #dfe6ee 55%, #c4cfdb 100%)', bpaper: '#ffffff', bnote: '#fff5b8', pin: ['#bfe0ff', '#1f8fff', '#0b3a66'] },
  };
  static THEME_IDS = ['noir', 'cold', 'midnight', 'warroom', 'redroom', 'daylight', 'mono', 'terminal', 'amber', 'blueprint', 'bureau', 'arctic'];
  T() { return Component.THEMES[this.props.theme && this.props.theme !== 'auto' ? this.props.theme : this.state.theme] || Component.THEMES.noir; }

  state = this.load();
  toastTimer = null; dragCase = null; lastTouch = 0;
  auth() { return window.CIBAuth || null; }
  me() { return this.user || null; }

  load() {
    let saved = null, locked = false, desk = {};
    try { const raw = localStorage.getItem(Component.KEY); if (raw) { const d = JSON.parse(raw); if (d && d.enc === 1) locked = true; else if (d && Array.isArray(d.cases)) saved = d; } } catch (e) {}
    try { desk = JSON.parse(localStorage.getItem(Component.DESK) || '{}') || {}; } catch (e) { desk = {}; }
    const cutoff = Date.now() - 30 * 864e5, trash = (desk.trash || []).filter(t => new Date(t.at).getTime() > cutoff);
    const S = saved || { cases: [], activeId: null, analyst: '' };
    return { saved: S, locked, visits: desk.visits || {}, trash, lamp: desk.lamp || 'noir', theme: Component.THEMES[desk.theme] ? desk.theme : 'noir', sort: desk.sort || 'activity', thumbs: desk.thumbs !== false, filter: '', tlpFilter: '', drawers: desk.drawers || { active: true, review: true, published: true, archived: false }, briefOpen: true, briefHidden: false, trashOpen: false, adminOpen: false, nu: { name: '', role: 'analyst', pass: '', error: '' }, hoverCase: null, flipped: {}, opening: null, classified: false, classifiedText: '', fade: 0, renameId: null, tagId: null, savedAt: '', toast: '', quick: '', fileUnder: S.activeId || (S.cases[0] && S.cases[0].id) || '', dropOpen: false, dropItems: [], dragOver: false, strings: [] };
  }
  componentDidMount() {
    if (window.CIBStore && window.CIBStore.onRemote) window.CIBStore.onRemote(() => this.setState({ saved: this.load() }));
    window.addEventListener('paste', this.onPaste); window.addEventListener('resize', this.measureStrings); window.addEventListener('pointerdown', this.onTouch); window.addEventListener('keydown', this.onTouch);
    const dm = String(location.hash || '').match(/drop=([^&]+)/); if (dm) { const txt = decodeURIComponent(dm[1]); history.replaceState(null, '', location.pathname + location.search); setTimeout(() => { const lines = txt.split('\n'), url = lines[0].trim(), title = (lines[1] || '').trim(); const d = this.detect(url); this.setState({ dropOpen: true, dropItems: [this.mkItem(d ? d[0] : 'link', { ...(d ? d[1] : { url }), title: title || (d && d[1].title) || '', source: 'Bookmarklet' })] }); }, 300); }
    const A = this.auth(); if (A) { const u = A.require("/"); this.user = u; if (u && !u.guest && (this.state.saved.analyst || '') !== u.name) this.upSaved(S => ({ ...S, analyst: u.name })); this.forceUpdate(); }
  }
  onTouch = () => { const now = Date.now(); if (now - this.lastTouch > 30000) { this.lastTouch = now; const A = this.auth(); if (A) { if (!A.user()) return A.require("/"); A.touch(); } } };
  componentWillUnmount() { window.removeEventListener('paste', this.onPaste); window.removeEventListener('resize', this.measureStrings); window.removeEventListener('pointerdown', this.onTouch); window.removeEventListener('keydown', this.onTouch); }
  componentDidUpdate() { const s = this.state, sig = s.hoverCase + '|' + Object.keys(s.drawers).map(k => k + (s.drawers[k] ? 1 : 0)).join(''); if (sig !== this.lastSig) { this.lastSig = sig; this.measureStrings(); } }
  save() { if (this.state.locked) return false; try { localStorage.setItem(Component.KEY, JSON.stringify(this.state.saved)); return true; } catch (e) { this.toast('Browser storage is full'); return false; } }
  saveDesk() { const s = this.state; try { localStorage.setItem(Component.DESK, JSON.stringify({ visits: s.visits, trash: s.trash, lamp: s.lamp, theme: s.theme, sort: s.sort, thumbs: s.thumbs, drawers: s.drawers })); } catch (e) {} }
  upSaved(fn) { this.hist = [...(this.hist || []).slice(-19), JSON.stringify(this.state.saved)]; this.setState(s => ({ saved: fn(s.saved) }), () => this.save()); }
  undo = () => { const hs = this.hist || []; if (!hs.length) return this.toast('Nothing to undo'); const prev = JSON.parse(hs.pop()); this.setState({ saved: prev }, () => this.save()); this.toast('Undone'); };
  upCase(id, fn) { this.upSaved(S => ({ ...S, cases: S.cases.map(c => c.id === id ? fn(c) : c) })); }
  logTo(id, m) { const by = (this.state.saved.analyst || '').trim(); this.upCase(id, c => ({ ...c, log: [...(c.log || []), { t: new Date().toISOString(), m: (by ? by + ' · ' : '') + m }].slice(-400) })); }
  sfx(k) { if (window.CIBFoley) window.CIBFoley.play(k); }
  toast(msg) { clearTimeout(this.toastTimer); this.setState({ toast: msg }); this.toastTimer = setTimeout(() => this.setState({ toast: '' }), 2400); }
  when(t) { const d = new Date(t), now = new Date(), hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); return d.toDateString() === now.toDateString() ? hm : d.getDate() + ' ' + Component.MONTHS[d.getMonth()] + ' ' + hm; }
  today() { return new Date().toISOString().slice(0, 10); }
  label(i) { if (i.type === 'tx') return i.title || [i.amount, i.chain].filter(Boolean).join(' · ') || 'Transfer'; if (i.type === 'ttp') return [i.value, i.title].filter(Boolean).join(' · ') || 'Technique'; return i.title || i.value || i.url || (i.body || '').slice(0, 40) || Component.TYPES[i.type] || 'Card'; }
  slug(c) { return (c.number + '-' + c.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  dl(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  nextNumber(cases) { return 'CASE ' + String(Math.max(416, ...cases.map(c => parseInt(String(c.number || '').replace(/\D/g, ''), 10) || 0)) + 1).padStart(4, '0'); }
  boardFile() { return this.props.boardFile || "/board.html"; }
  refang(v) { return String(v || '').replace(/\[\.\]|\(\.\)|\{\.\}/g, '.').replace(/\[@\]/g, '@').replace(/hxxp/gi, 'http'); }
  detect(raw) {
    const t = String(raw || '').trim(), v = this.refang(t); if (!t) return null;
    if (/^https?:\/\//i.test(v)) return ['link', { title: (() => { try { return new URL(v).hostname; } catch (e) { return v; } })(), url: v }];
    if (/^CVE-\d{4}-\d{4,7}$/i.test(v)) return ['indicator', { kind: 'cve', value: v.toUpperCase() }];
    if (/^[a-f0-9]{32}$|^[a-f0-9]{40}$|^[a-f0-9]{64}$/i.test(v)) return ['indicator', { kind: 'hash', value: v.toLowerCase() }];
    if (/^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(v)) return ['indicator', { kind: 'ip', value: v }];
    if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(v)) return ['indicator', { kind: 'email', value: v.toLowerCase() }];
    if (/^(0x[a-f0-9]{40}|bc1[a-z0-9]{25,59}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/i.test(v)) return ['indicator', { kind: 'wallet', value: v }];
    if (/^@[a-z0-9_.]{2,40}$/i.test(v)) return ['indicator', { kind: 'handle', value: v }];
    if (/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i.test(v)) return ['indicator', { kind: 'domain', value: v.toLowerCase() }];
    return ['note', { body: t }];
  }
  mkItem(type, f) { return { id: Component.uid(), type, title: '', body: '', url: '', value: '', kind: 'domain', date: '', tags: '', status: type === 'indicator' ? 'unverified' : '', chain: '', amount: '', txFrom: '', txTo: '', source: '', collected: this.today(), srcGrade: '', infoGrade: '', tlp: '', firstSeen: '', lastSeen: '', sector: '', region: '', impact: '', image: null, pinned: false, x: 0, y: 0, ...f }; }
  attention(c) {
    const today = this.today(), items = c.items || [], out = [];
    const overdue = items.reduce((n, i) => n + (i.todo || []).filter(t => !t.done && t.due && t.due < today).length, 0); if (overdue) out.push({ label: overdue + ' overdue', color: '#ff2a3c' });
    const stale = items.filter(i => i.type === 'indicator' && (i.lastSeen || i.collected || i.date) && (Date.now() - new Date(i.lastSeen || i.collected || i.date).getTime()) / 864e5 > 30).length; if (stale) out.push({ label: stale + ' stale', color: '#e8a71c' });
    const unst = items.filter(i => i.pinned && i.type === 'indicator' && !i.status).length; if (unst) out.push({ label: unst + ' unstamped', color: '#e8a71c' });
    if ((c.review || 'draft') === 'in review') out.push({ label: 'awaiting review', color: '#4ea1e8' });
    return out;
  }
  spark(c) { const days = 30, now = Date.now(), counts = new Array(days).fill(0); (c.log || []).forEach(l => { const d = Math.floor((now - new Date(l.t).getTime()) / 864e5); if (d >= 0 && d < days) counts[days - 1 - d]++; }); const max = Math.max(1, ...counts); return counts.map(n => ({ h: n ? Math.max(2, Math.round(n / max * 18)) : 1, bg: n ? '#9a2b2b' : 'rgba(0,0,0,.18)' })); }
  thumb(c) {
    const items = (c.items || []).filter(i => i.pinned); if (items.length < 2) return null;
    const H = 150, W = Component.WIDTHS; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    items.forEach(i => { x0 = Math.min(x0, i.x); y0 = Math.min(y0, i.y); x1 = Math.max(x1, i.x + (W[i.type] || 200)); y1 = Math.max(y1, i.y + H); });
    const byId = Object.fromEntries(items.map(i => [i.id, i]));
    return { vb: (x0 - 40) + ' ' + (y0 - 40) + ' ' + (x1 - x0 + 80) + ' ' + (y1 - y0 + 80), rects: items.map(i => ({ x: i.x, y: i.y, w: W[i.type] || 200, h: H, fill: Component.TYPE_COLOR[i.type] || '#b9b3a6' })), lines: (c.threads || []).filter(t => byId[t.from] && byId[t.to]).map(t => { const A = byId[t.from], B = byId[t.to]; return { x1: A.x + (W[A.type] || 200) / 2, y1: A.y + 10, x2: B.x + (W[B.type] || 200) / 2, y2: B.y + 10 }; }) };
  }
  related(cases) {
    const key = c => { const s = new Set(); (c.items || []).forEach(i => { if (i.type === 'indicator' && i.value) s.add('i:' + this.refang(i.value).toLowerCase()); if (i.type === 'person' && i.title && /actor/i.test(i.tags || '')) s.add('p:' + i.title.toLowerCase()); }); return s; };
    const sets = Object.fromEntries(cases.map(c => [c.id, key(c)])), rel = {};
    cases.forEach(a => { rel[a.id] = []; cases.forEach(b => { if (a.id === b.id) return; let n = 0; sets[a.id].forEach(k => { if (sets[b.id].has(k)) n++; }); if (n) rel[a.id].push({ id: b.id, n }); }); });
    return rel;
  }
  measureStrings = () => {
    const hov = this.state.hoverCase, desk = document.querySelector('[data-desk]');
    if (!hov || !desk) { if (this.state.strings.length) this.setState({ strings: [] }); return; }
    const rel = (this.related(this.state.saved.cases)[hov] || []), R = desk.getBoundingClientRect(), from = document.querySelector('[data-folder="' + hov + '"]');
    if (!from) { if (this.state.strings.length) this.setState({ strings: [] }); return; }
    const c = el => { const r = el.getBoundingClientRect(); return { x: r.left - R.left + r.width / 2, y: r.top - R.top + 28 }; };
    const a = c(from), strings = rel.map(r => document.querySelector('[data-folder="' + r.id + '"]')).filter(Boolean).map(el => { const b = c(el); return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }; });
    const same = strings.length === this.state.strings.length && strings.every((s, i) => { const o = this.state.strings[i]; return o && o.x1 === s.x1 && o.y1 === s.y1 && o.x2 === s.x2 && o.y2 === s.y2; });
    if (!same) this.setState({ strings });
  };

  openCase(id) {
    if (this.state.opening) return;
    const c = this.state.saved.cases.find(x => x.id === id); if (!c) return;
    const red = c.tlp === 'red' || c.tlp === 'amber+strict';
    this.sfx('open'); setTimeout(() => this.sfx('flip'), 260);
    this.setState(s => ({ opening: id, classified: red, classifiedText: (c.tlp === 'red' ? 'TLP:RED' : 'TLP:AMBER+STRICT') + ' · ' + c.number + ' · HANDLE ACCORDINGLY', visits: { ...s.visits, [id]: new Date().toISOString() } }), () => this.saveDesk());
    this.upSaved(S => ({ ...S, activeId: id }));
    setTimeout(() => this.setState({ fade: 1 }), red ? 700 : 250);
    setTimeout(() => { location.href = this.boardFile() + '#case=' + encodeURIComponent(id); }, red ? 1250 : 700);
  }
  newCase = () => { if (this.auth() && this.me() && !this.auth().canCreate(this.me())) return this.toast('Your role cannot open files'); this.sfx('paper'); const c = { id: Component.uid(), v: 3, number: this.nextNumber(this.state.saved.cases), title: 'Untitled case', notes: '', items: [], threads: [], groups: [], dismissed: [], review: 'draft', log: [{ t: new Date().toISOString(), m: 'Case opened' }] }; this.upSaved(S => ({ ...S, cases: [...S.cases, c] })); this.setState(s => ({ drawers: { ...s.drawers, active: true }, renameId: c.id })); this.toast('Opened ' + c.number); };
  dupCase(id) { const c = this.state.saved.cases.find(x => x.id === id); if (!c) return; if (this.auth() && this.me() && !this.auth().canCreate(this.me())) return this.toast('Your role cannot open files'); const copy = JSON.parse(JSON.stringify(c)); copy.id = Component.uid(); copy.number = this.nextNumber(this.state.saved.cases); copy.title = c.title + ' (copy)'; copy.review = 'draft'; copy.signoff = null; copy.archived = false; copy.desk = false; copy.log = [...(copy.log || []), { t: new Date().toISOString(), m: 'Duplicated from ' + c.number }]; this.upSaved(S => ({ ...S, cases: [...S.cases, copy] })); this.toast('Duplicated as ' + copy.number); }
  deleteCase(id) { const c = this.state.saved.cases.find(x => x.id === id); if (!c) return; if (this.auth() && this.me() && !this.auth().canEdit(this.me(), c)) return this.toast('Read-only on that file'); if (!window.confirm('Move ' + c.number + ' — ' + c.title + ' to the wastebasket? It can be restored for 30 days.')) return; this.sfx('crumple'); this.setState(s => ({ trash: [{ c, at: new Date().toISOString() }, ...s.trash] }), () => this.saveDesk()); this.upSaved(S => { const cases = S.cases.filter(x => x.id !== id); return { ...S, cases, activeId: cases.some(x => x.id === S.activeId) ? S.activeId : (cases[0] ? cases[0].id : null) }; }); this.toast(c.number + ' moved to the wastebasket'); }
  restore(id) { const t = this.state.trash.find(x => x.c.id === id); if (!t) return; this.setState(s => ({ trash: s.trash.filter(x => x.c.id !== id) }), () => this.saveDesk()); this.upSaved(S => ({ ...S, cases: [...S.cases, { ...t.c, log: [...(t.c.log || []), { t: new Date().toISOString(), m: 'Restored from the wastebasket' }] }] })); this.toast('Restored ' + t.c.number); }
  purge(id) { if (!window.confirm('Destroy this file permanently?')) return; this.setState(s => ({ trash: s.trash.filter(x => x.c.id !== id) }), () => this.saveDesk()); }
  setDrawer(id, drawer) {
    const A = this.auth(), me = this.me(), cs = this.state.saved.cases.find(c => c.id === id); if (A && me && cs && !A.canReview(me, cs)) return this.toast('Your role cannot move this file');
    const by = (this.state.saved.analyst || '').trim();
    this.upCase(id, c => drawer === 'archived' ? { ...c, archived: true } : drawer === 'published' ? { ...c, archived: false, review: 'published', signoff: c.signoff || (by ? { by, at: new Date().toISOString() } : null) } : drawer === 'review' ? { ...c, archived: false, review: 'in review' } : { ...c, archived: false, review: 'draft', signoff: null });
    this.logTo(id, 'Filed under ' + drawer); this.setState(s => ({ drawers: { ...s.drawers, [drawer]: true } }), () => this.saveDesk());
  }
  exportCase(id) { const c = this.state.saved.cases.find(x => x.id === id); if (!c) return; this.dl(new Blob([JSON.stringify({ format: 'cyber-investigation-board', version: 1, cases: [c] }, null, 2)], { type: 'application/json' }), this.slug(c) + '.json'); }
  exportAll = () => { const cs = this.state.saved.cases; this.dl(new Blob([JSON.stringify({ format: 'cyber-investigation-board', version: 1, cases: cs }, null, 2)], { type: 'application/json' }), 'case-files-' + this.today() + '.json'); this.toast(cs.length + (cs.length === 1 ? ' case exported' : ' cases exported')); };
  saveNow = () => { if (this.save()) { this.saveDesk(); this.setState({ savedAt: new Date().toISOString() }); this.toast('Saved to this browser'); } };
  pickImport = () => { const inp = document.querySelector('[data-file="import"]'); if (inp) { inp.value = ''; inp.click(); } };
  onImportFile = e => {
    const f = e.target.files && e.target.files[0]; if (!f) return; const fr = new FileReader();
    fr.onload = () => { try { const d = JSON.parse(String(fr.result || '')), list = Array.isArray(d.cases) ? d.cases : (d.items ? [d] : []); if (!list.length) throw new Error('no cases'); const have = this.state.saved.cases; const norm = list.map((c, i) => ({ ...c, id: Component.uid(), number: c.number || this.nextNumber([...have, ...list.slice(0, i)]), title: c.title || f.name.replace(/\.json$/i, ''), items: c.items || [], threads: c.threads || [], groups: c.groups || [], log: c.log || [], dismissed: c.dismissed || [] })); this.upSaved(S => ({ ...S, cases: [...S.cases, ...norm] })); this.toast('Imported ' + norm.length + (norm.length > 1 ? ' cases' : ' case')); } catch (err) { this.toast('That file is not a case export'); } };
    fr.readAsText(f);
  };
  quickAdd = () => { const d = this.detect(this.state.quick), id = this.state.fileUnder; if (!d || !id) return this.toast('Type something and pick a file'); const tc = this.state.saved.cases.find(c => c.id === id); if (this.auth() && this.me() && tc && !this.auth().canEdit(this.me(), tc)) return this.toast('Read-only on that file'); const it = this.mkItem(d[0], { ...d[1], source: 'Quick add from the desk' }); this.upCase(id, c => ({ ...c, items: [...(c.items || []), it] })); this.logTo(id, 'Added to inbox from the desk: ' + this.label(it)); this.setState({ quick: '' }); this.toast('Filed in the inbox of ' + (this.state.saved.cases.find(c => c.id === id) || {}).number); };
  osint = () => { const q = (this.state.quick || '').trim(); location.href = this.boardFile() + '#osint=' + encodeURIComponent(q); };
  allowDrop = e => { e.preventDefault(); if (!this.dragCase && !this.state.dragOver) this.setState({ dragOver: true }); };
  readImage(file) { return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(file); }); }
  deskDrop = async e => {
    e.preventDefault(); e.stopPropagation(); this.setState({ dragOver: false });
    if (this.dragCase) { this.dragCase = null; return; }
    const dt = e.dataTransfer, files = Array.from(dt.files || []), items = [];
    for (const f of files) { if (f.type.startsWith('image/')) items.push(this.mkItem('photo', { title: f.name.replace(/\.[^.]+$/, ''), image: await this.readImage(f), fileName: f.name, date: this.today() })); else items.push(this.mkItem('doc', { title: f.name, body: Math.max(1, Math.round(f.size / 1024)) + ' KB · ' + (f.type || 'file'), fileName: f.name, date: this.today() })); }
    if (!files.length) { const text = (dt.getData('text/uri-list') || dt.getData('text') || '').trim(); if (text) this.textItems(text).forEach(i => items.push(i)); }
    if (!items.length) return;
    this.setState({ dropOpen: true, dropItems: items });
  };
  textItems(text) { const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean); if (lines.length > 1 && lines.length <= 60 && lines.every(l => { const d = this.detect(l); return d && d[0] !== 'note'; })) return lines.map(l => { const d = this.detect(l); return this.mkItem(d[0], { ...d[1], source: 'Dropped on the desk' }); }); const d = this.detect(text); return [this.mkItem(d[0], { ...d[1], source: 'Dropped on the desk' })]; }
  onPaste = e => { const t = e.target, tag = t && t.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || this.state.dropOpen) return; const cd = e.clipboardData; if (!cd) return; const img = Array.from(cd.files || []).find(f => f.type.startsWith('image/')); if (img) { e.preventDefault(); this.readImage(img).then(src => this.setState({ dropOpen: true, dropItems: [this.mkItem('photo', { title: 'Pasted screenshot', image: src, date: this.today() })] })); return; } const text = (cd.getData('text') || '').trim(); if (!text) return; e.preventDefault(); this.setState({ dropOpen: true, dropItems: this.textItems(text) }); };
  dropAdd = () => { this.sfx('stamp'); const id = this.state.fileUnder, items = this.state.dropItems; if (!id) return this.toast('Pick a file first'); const tc = this.state.saved.cases.find(c => c.id === id); if (this.auth() && this.me() && tc && !this.auth().canEdit(this.me(), tc)) return this.toast('Read-only on that file'); this.upCase(id, c => ({ ...c, items: [...(c.items || []), ...items] })); this.logTo(id, items.length + ' item(s) dropped on the desk filed into the inbox'); this.setState({ dropOpen: false, dropItems: [] }); this.toast(items.length + ' filed'); };

  renderVals() {
    const A = this.auth(), me = this.me(), guard = (c) => !A || !me || A.canEdit(me, c), isAdmin = !!(A && me && A.isAdmin(me));
    const s = this.state, S = s.saved, allCases = S.cases || [], cases = allCases.filter(c => !A || !me || A.canSee(me, c)), K = Component, q = s.filter.trim().toLowerCase(), rel = this.related(cases), hovRel = new Set((rel[s.hoverCase] || []).map(r => r.id)), T = this.T(), light = T.desk > '#8';
    const now = new Date();
    const match = c => !q || [c.number, c.title, c.tags, c.notes, c.signoff && c.signoff.by, (c.judgement || {}).text].join(' ').toLowerCase().includes(q);
    const tlpOk = c => !s.tlpFilter || (c.tlp || '') === s.tlpFilter;
    const lastT = c => (c.log || []).length ? (c.log || [])[(c.log || []).length - 1].t : '';
    const sorters = { activity: (a, b) => (lastT(b) || '').localeCompare(lastT(a) || ''), number: (a, b) => String(a.number).localeCompare(String(b.number)), title: (a, b) => String(a.title).localeCompare(String(b.title)), tlp: (a, b) => K.TLP.findIndex(t => t[0] === (b.tlp || '')) - K.TLP.findIndex(t => t[0] === (a.tlp || '')), tasks: (a, b) => this.openTasks(b) - this.openTasks(a), attention: (a, b) => this.attention(b).length - this.attention(a).length };
    const visible = cases.filter(c => match(c) && tlpOk(c)).sort(sorters[s.sort] || sorters.activity);
    const folder = (c, idx) => {
      const hov = s.hoverCase === c.id, op = s.opening === c.id, tl = K.TLP.find(t => t[0] === (c.tlp || '')) || K.TLP[0], rv = c.review || 'draft', log = c.log || [], last = log.length ? log[log.length - 1] : null, th = s.thumbs ? this.thumb(c) : null, J = c.judgement || {};
      const sheets = (c.items || []).filter(i => i.pinned).sort((a, b) => (b.num || 0) - (a.num || 0)).slice(0, 3).reverse().map((i, k) => ({ type: K.TYPES[i.type] || i.type, label: this.label(i), x: 6 + k * 10, r: 26 - k * 10, y: 16 - k * 7, rot: (k - 1) * 1.5 }));
      const tasks = (c.items || []).flatMap(i => (i.todo || []).filter(t => !t.done).map(t => ({ text: t.text, due: t.due ? this.fmtDue(t.due) : '', color: t.due && t.due < this.today() ? '#b4222a' : '#5a4a22' }))).slice(0, 3);
      const flipped = !!s.flipped[c.id], isRel = hovRel.has(c.id);
      return {
        id: c.id, T, number: c.number, title: c.title, delay: Math.min(idx * 60, 500), sheets, canEdit: guard(c), isPublic: !!c.public, publicLabel: c.public ? 'Public' : 'Make public', hasThumb: !!th, thumb: th || { vb: '0 0 1 1', rects: [], lines: [] }, noThumb: !th,
        renaming: s.renameId === c.id, notRenaming: s.renameId !== c.id, tagging: s.tagId === c.id, tags: c.tags || '', hasTags: !!(c.tags || '').trim(), color: c.color || '', hasColor: !!c.color, flipped, notFlipped: !flipped,
        meta: [rv === 'published' && c.signoff ? 'signed ' + c.signoff.by : rv.toUpperCase(), J.confidence ? J.confidence + ' confidence' : ''].filter(Boolean).join(' · '),
        counts: (c.items || []).filter(i => i.pinned).length + ' exhibits · ' + (c.threads || []).length + ' threads · ' + (c.items || []).filter(i => !i.pinned).length + ' in inbox', last: last ? 'Last activity ' + this.when(last.t) : 'No activity yet',
        stamp: c.archived ? 'Archived' : rv === 'published' ? 'Published' : rv === 'in review' ? 'In review' : 'Draft', stampColor: c.archived ? '#5a5650' : rv === 'published' ? '#1f7a3d' : rv === 'in review' ? '#9a6b12' : '#5a5650',
        tlpColor: c.tlp ? tl[2] : 'transparent', tlpInk: tl[3], tlpLabel: c.tlp ? tl[1].replace('TLP:', '') : '', tlpH: c.tlp ? 34 : 0,
        judgement: J.text || 'No key judgement yet.', confidence: J.confidence ? J.confidence.toUpperCase() + ' CONFIDENCE' : 'CONFIDENCE UNSTATED', tasks, noTasks: tasks.length === 0, badges: this.attention(c), spark: this.spark(c),
        lift: op ? 'translateY(-18px) scale(1.08)' : hov ? 'translateY(-8px)' : isRel ? 'translateY(-4px)' : 'none', opacity: op ? 0 : (s.hoverCase && !hov && !isRel && hovRel.size) ? .55 : 1,
        cover: op ? 'rotateY(-70deg)' : flipped ? 'rotateY(180deg)' : hov ? 'rotateY(-34deg)' : 'rotateY(0deg)', back: flipped ? 'rotateY(0deg)' : 'rotateY(-180deg)', frontOp: flipped ? 0 : 1, backOp: flipped ? 1 : 0, origin: flipped ? '50% 50%' : 'left center', papers: op || hov ? 'translateY(-14px)' : 'translateY(0)',
        shadow: hov || op ? '0 26px 40px rgba(0,0,0,.75)' : isRel ? '0 0 0 2px #ff2a3c, 0 14px 24px rgba(0,0,0,.65)' : '0 10px 18px rgba(0,0,0,.6)', coverShadow: hov || op ? '14px 10px 30px rgba(0,0,0,.55)' : '2px 2px 6px rgba(0,0,0,.35)',
        deskLabel: c.desk ? 'Unpin' : 'Pin to desk', archLabel: c.archived ? 'Restore' : 'Archive', flipLabel: flipped ? 'Front' : 'Flip',
        colors: K.COLORS.map(col => ({ col: col || 'transparent', border: col ? col : '#8d877b', ring: (c.color || '') === col ? '0 0 0 2px #f3f1ea' : 'none', onPick: e => { e.stopPropagation(); this.upCase(c.id, x => ({ ...x, color: col })); } })),
        onEnter: () => { if (this.state.hoverCase !== c.id) this.sfx('hover'); this.setState({ hoverCase: c.id }); }, onLeave: () => { if (this.state.hoverCase === c.id) this.setState({ hoverCase: null }); },
        onOpen: e => { if (e && e.stopPropagation) e.stopPropagation(); this.openCase(c.id); }, onKey: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.openCase(c.id); } },
        onDrag: e => { this.dragCase = c.id; e.dataTransfer.setData('text/case-id', c.id); e.dataTransfer.effectAllowed = 'move'; }, onDragEnd: () => { this.dragCase = null; this.setState({ dragOver: false }); },
        onFlip: e => { e.stopPropagation(); this.sfx('flip'); this.setState(st => ({ flipped: { ...st.flipped, [c.id]: !st.flipped[c.id] } })); },
        onDesk: e => { e.stopPropagation(); this.upCase(c.id, x => ({ ...x, desk: !x.desk })); },
        onArchive: e => { e.stopPropagation(); this.setDrawer(c.id, c.archived ? 'active' : 'archived'); },
        onRename: e => { e.stopPropagation(); this.setState({ renameId: c.id }); }, onTitle: e => { const v = e.target.value; this.upCase(c.id, x => ({ ...x, title: v })); }, onTitleKey: e => { if (e.key === 'Enter' || e.key === 'Escape') this.setState({ renameId: null }); }, onTitleDone: () => this.setState({ renameId: null }),
        onTag: e => { e.stopPropagation(); this.setState({ tagId: c.id }); }, onTags: e => { const v = e.target.value; this.upCase(c.id, x => ({ ...x, tags: v })); }, onTagsKey: e => { if (e.key === 'Enter' || e.key === 'Escape') this.setState({ tagId: null }); }, onTagsDone: () => this.setState({ tagId: null }),
        onPublic: e => { e.stopPropagation(); if (!guard(c)) return; if (!c.public && !['', 'clear', 'green'].includes(c.tlp || '')) return this.toast('Only TLP:CLEAR or GREEN files can be public'); this.upCase(c.id, x => ({ ...x, public: !x.public })); this.logTo(c.id, c.public ? 'Public access removed' : 'Made public (guest read-only)'); },
        onDup: e => { e.stopPropagation(); this.dupCase(c.id); }, onExport: e => { e.stopPropagation(); this.exportCase(c.id); }, onDelete: e => { e.stopPropagation(); this.deleteCase(c.id); },
      };
    };
    const deskFolders = visible.filter(c => c.desk && !c.archived).map(folder);
    const drawerDefs = [['active', 'ACTIVE', c => !c.archived && (c.review || 'draft') === 'draft', 'draft files · drop a folder here to reopen it', 'Nothing in progress. Open a new file or restore one from the wastebasket.'], ['review', 'IN REVIEW', c => !c.archived && c.review === 'in review', 'drop a folder here to send it for review', 'No files waiting on a reviewer.'], ['published', 'PUBLISHED', c => !c.archived && c.review === 'published', 'drop a folder here to publish and sign it', 'Nothing published yet.'], ['archived', 'ARCHIVED', c => !!c.archived, 'drop a folder here to archive it', 'The archive is empty.']];
    const drawers = drawerDefs.map(([id, label, pred, hint, emptyText]) => { const fs = visible.filter(pred).map(folder), open = !!s.drawers[id], over = s.dragOver && !!this.dragCase; return { id, label, hint, count: String(cases.filter(pred).length), open, arrow: open ? '▾' : '▸', folders: fs, empty: fs.length === 0 && id !== 'active', emptyText, isActive: id === 'active', pad: open ? 10 : 0, border: over ? '#ff2a3c' : '#232326', bg: over ? 'rgba(255,42,60,.04)' : 'rgba(14,14,16,.6)', onToggle: () => { this.sfx(s.drawers[id] ? 'close' : 'drawer'); this.setState(st => ({ drawers: { ...st.drawers, [id]: !st.drawers[id] } }), () => this.saveDesk()); }, onKey: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.setState(st => ({ drawers: { ...st.drawers, [id]: !st.drawers[id] } }), () => this.saveDesk()); } }, onDrop: e => { const cid = e.dataTransfer.getData('text/case-id'); if (cid) { e.preventDefault(); e.stopPropagation(); this.dragCase = null; this.setState({ dragOver: false }); this.setDrawer(cid, id); } } }; });
    const brief = cases.filter(c => !c.archived).map(c => { const since = s.visits[c.id] || ''; const changes = (c.log || []).filter(l => l.t > since); return changes.length ? { number: c.number, title: c.title, summary: changes.length + (changes.length === 1 ? ' change' : ' changes') + (since ? ' since ' + this.when(since) : ' · never opened from the desk'), lines: changes.slice(-4).reverse().map(l => this.when(l.t) + ' ' + l.m), onOpen: () => this.openCase(c.id) } : null; }).filter(Boolean);
    const seen = {}; cases.forEach(c => (c.items || []).forEach(i => { if (i.type === 'indicator' && i.value) { const k = (i.kind || '') + '|' + this.refang(i.value).toLowerCase(); (seen[k] = seen[k] || new Set()).add(c.number); } }));
    const xioc = Object.entries(seen).filter(([, v]) => v.size > 1).slice(0, 24).map(([k, v]) => ({ kind: k.split('|')[0], value: k.split('|')[1], cases: Array.from(v).join(' · ') }));
    const d = now;
    return {
      userName: me ? me.name : 'Not signed in', userRole: me ? (A ? A.roleLabel(me.role) : me.role) : '', isAdmin, signOut: () => { if (A) A.logout(); location.replace("/"); },
      adminOpen: s.adminOpen, openAdmin: () => this.setState({ adminOpen: true }), closeAdmin: () => this.setState({ adminOpen: false }), roles: A ? A.ROLES.map(r => ({ id: r[0], label: r[1], blurb: r[2] })) : [],
      users: A ? A.load().users.map(u => ({ name: u.name, role: u.role, scope: u.cases === 'all' ? 'all' : 'some', someScope: u.cases !== 'all', meta: [u.lastLogin ? 'last sign-in ' + this.when(u.lastLogin) : 'never signed in', u.mustChange ? 'must change password' : ''].filter(Boolean).join(' · '), tlpLabel: u.tlpRed ? 'granted' : 'denied', tlpBorder: u.tlpRed ? '#ff2a3c' : T.border, tlpBg: u.tlpRed ? '#ff2a3c' : 'transparent', tlpColor: u.tlpRed ? '#fff' : T.textMuted,
        onRole: e => { const v = e.target.value; try { if (me && u.id === me.id && v !== 'admin') return this.toast('You cannot demote yourself'); A.update(u.id, { role: v }, me.name); this.forceUpdate(); } catch (err) { this.toast(String(err.message || err)); } }, onTlp: () => { A.update(u.id, { tlpRed: !u.tlpRed }, me.name); this.forceUpdate(); }, onScope: e => { A.update(u.id, { cases: e.target.value === 'all' ? 'all' : [] }, me.name); this.forceUpdate(); },
        caseChips: allCases.map(c => { const on = Array.isArray(u.cases) && u.cases.includes(c.id); return { label: c.number, border: on ? T.accent : T.border, bg: on ? T.accent : 'transparent', color: on ? T.accentInk : T.textMuted, onToggle: () => { const next = on ? u.cases.filter(x => x !== c.id) : [...(Array.isArray(u.cases) ? u.cases : []), c.id]; A.update(u.id, { cases: next }, me.name); this.forceUpdate(); } }; }),
        onReset: async () => { const p = window.prompt('Temporary password for ' + u.name + ' (8+ characters). They must change it at next sign-in.'); if (!p) return; try { await A.setPassword(u.id, p, true, me.name); this.toast('Password reset for ' + u.name); this.forceUpdate(); } catch (err) { this.toast(String(err.message || err)); } },
        onRemove: () => { if (!window.confirm('Remove ' + u.name + '?')) return; try { A.remove(u.id, me.name); this.forceUpdate(); } catch (err) { this.toast(String(err.message || err)); } } })) : [],
      nu: { name: s.nu.name, role: s.nu.role, pass: s.nu.pass, error: s.nu.error, onName: e => { const v = e.target.value; this.setState(st => ({ nu: { ...st.nu, name: v } })); }, onRole: e => { const v = e.target.value; this.setState(st => ({ nu: { ...st.nu, role: v } })); }, onPass: e => { const v = e.target.value; this.setState(st => ({ nu: { ...st.nu, pass: v } })); }, add: async () => { try { await A.createUser({ name: s.nu.name, role: s.nu.role, pass: s.nu.pass, mustChange: true, by: me.name }); this.setState({ nu: { name: '', role: 'analyst', pass: '', error: '' } }); this.toast('User added — they must change the password at first sign-in'); } catch (err) { this.setState(st => ({ nu: { ...st.nu, error: String(err.message || err) } })); } } },
      audit: A ? (A.load().audit || []).slice(-20).reverse().map(x => ({ when: this.when(x.t), who: x.who, what: x.what, color: /FAILED|expired/.test(x.what) ? T.accent : T.text2 })) : [],
      locked: s.locked, analyst: S.analyst || '', onAnalyst: e => { const v = e.target.value; this.upSaved(x => ({ ...x, analyst: v })); },
      stats: cases.length + (cases.length === 1 ? ' case file' : ' case files') + ' · ' + cases.reduce((n, c) => n + (c.items || []).length, 0) + ' exhibits · ' + cases.reduce((n, c) => n + (c.threads || []).length, 0) + ' threads' + (S.analyst ? ' · ' + S.analyst : ''),
      cal: { month: K.MONTHS[d.getMonth()] + ' ' + d.getFullYear(), day: String(d.getDate()), wd: K.DAYS[d.getDay()] },
      navBack: () => history.back(), navFwd: () => history.forward(), navReload: () => location.reload(), navBoard: () => { location.href = this.boardFile(); }, undo: this.undo,
      T, theme: s.theme, themes: Component.THEME_IDS.map(id => ({ id, label: Component.THEMES[id].label })), onTheme: e => this.setState({ theme: e.target.value }, () => this.saveDesk()),
      deskBg: T.desk, lampGrad: s.lamp === 'bright' ? 'radial-gradient(80% 60% at 50% -5%, rgba(' + T.lamp + ',.34) 0%, rgba(' + T.lamp + ',0) 65%), radial-gradient(130% 110% at 50% 60%, rgba(0,0,0,0) 55%, rgba(0,0,0,' + (light ? .12 : .5) + ') 100%)' : 'radial-gradient(70% 55% at 50% -5%, rgba(' + T.lamp + ',.17) 0%, rgba(' + T.lamp + ',0) 60%), radial-gradient(130% 110% at 50% 60%, rgba(0,0,0,0) 40%, rgba(0,0,0,' + (light ? .18 : .8) + ') 100%)',
      lampLabel: s.lamp === 'bright' ? 'Lamp on' : 'Lamp low', lampColor: s.lamp === 'bright' ? (light ? T.accent : 'rgb(' + T.lamp + ')') : T.textMuted, toggleLamp: () => this.setState(st => ({ lamp: st.lamp === 'bright' ? 'noir' : 'bright' }), () => this.saveDesk()),
      deskScale: s.opening ? 'scale(1.04)' : 'none', fade: s.fade, classified: s.classified, classifiedText: s.classifiedText,
      quick: s.quick, onQuick: e => this.setState({ quick: e.target.value }), onQuickKey: e => { if (e.key === 'Enter') { e.preventDefault(); this.quickAdd(); } }, quickAdd: this.quickAdd, osint: this.osint,
      fileUnder: s.fileUnder, onFileUnder: e => this.setState({ fileUnder: e.target.value }), caseOptions: cases.filter(c => !c.archived).map(c => ({ id: c.id, label: c.number + ' · ' + c.title })),
      saveLabel: s.savedAt ? 'Saved ' + this.when(s.savedAt) : 'Save now', saveNow: this.saveNow, pickImport: this.pickImport, onImportFile: this.onImportFile, exportAll: this.exportAll, newCase: this.newCase,
      hasBrief: brief.length > 0 && !s.briefHidden, brief, briefHead: brief.length + (brief.length === 1 ? ' file changed' : ' files changed') + ' since you last opened them', briefOpen: s.briefOpen, briefBtn: s.briefOpen ? 'Collapse' : 'Expand', briefToggle: () => this.setState(st => ({ briefOpen: !st.briefOpen })), briefRead: () => { const t = new Date().toISOString(); this.setState(st => ({ visits: Object.fromEntries(cases.map(c => [c.id, t])), briefHidden: true }), () => this.saveDesk()); },
      filter: s.filter, onFilter: e => this.setState({ filter: e.target.value }), sort: s.sort, onSort: e => this.setState({ sort: e.target.value }, () => this.saveDesk()),
      tlpChips: K.TLP.filter(t => t[0]).map(t => { const on = s.tlpFilter === t[0]; return { label: t[1].replace('TLP:', ''), border: on ? t[2] : T.border, bg: on ? t[2] : 'transparent', color: on ? t[3] : T.textMuted, onPick: () => this.setState(st => ({ tlpFilter: st.tlpFilter === t[0] ? '' : t[0] })) }; }),
      thumbsLabel: s.thumbs ? 'Showing board thumbnails' : 'Showing paper sheets', toggleThumbs: () => this.setState(st => ({ thumbs: !st.thumbs }), () => this.saveDesk()),
      hasDesk: deskFolders.length > 0, deskFolders, deskCount: String(deskFolders.length), drawers, allowDrop: this.allowDrop, deskDrop: this.deskDrop, dropBorder: s.dragOver && !this.dragCase ? '#ff2a3c' : '#3a3a40',
      hasXIoc: xioc.length > 0, xioc,
      trashOpen: s.trashOpen, trashToggle: () => this.setState(st => ({ trashOpen: !st.trashOpen })), trashArrow: s.trashOpen ? '▾' : '▸', trashCount: String(s.trash.length), trashEmpty: s.trash.length === 0, trash: s.trash.map(t => ({ number: t.c.number, title: t.c.title, when: 'deleted ' + this.when(t.at), onRestore: () => this.restore(t.c.id), onPurge: () => this.purge(t.c.id) })),
      dropOpen: s.dropOpen, dropClose: () => this.setState({ dropOpen: false, dropItems: [] }), dropAdd: this.dropAdd, dropItems: s.dropItems.map(i => ({ type: K.TYPES[i.type] || i.type, label: this.label(i) })), stop: e => e.stopPropagation(),
      strings: s.strings, boardFile: this.boardFile(), hasToast: !!s.toast, toast: s.toast,
    };
  }
  openTasks(c) { return (c.items || []).reduce((n, i) => n + (i.todo || []).filter(t => !t.done).length, 0); }
  fmtDue(d) { const p = d.split('-'); return p.length === 3 ? p[2] + ' ' + (Component.MONTHS[+p[1] - 1] || p[1]) : d; }
}

export default Component;
