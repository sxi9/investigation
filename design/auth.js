// Cyber Investigation Board — browser-side accounts, roles and sessions.
// Prototype only: credentials are PBKDF2-SHA256 hashes in localStorage. The real build swaps this for OIDC (see BACKEND-SPEC.txt §4).
(function () {
  const KEY = 'cyber-investigation-board.users.v1', IDLE = 15 * 60e3, LIFE = 12 * 3600e3;
  const A = {
    ROLES: [['admin', 'Admin', 'Everything, plus users and settings'], ['analyst', 'Analyst', 'Edits the cases assigned to them'], ['reviewer', 'Reviewer', 'Reads, comments, moves files through review'], ['viewer', 'Viewer', 'Read-only']],
    load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || { users: [], session: null, audit: [] }; } catch (e) { return { users: [], session: null, audit: [] }; } },
    save(d) { localStorage.setItem(KEY, JSON.stringify(d)); },
    uid() { return 'u' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); },
    hex(buf) { return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''); },
    async hash(pass, saltHex) {
      const salt = saltHex ? Uint8Array.from(saltHex.match(/../g).map(x => parseInt(x, 16))) : crypto.getRandomValues(new Uint8Array(16));
      const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, km, 256);
      return { salt: A.hex(salt), hash: A.hex(bits) };
    },
    audit(d, who, what) { d.audit = [...(d.audit || []), { t: new Date().toISOString(), who, what }].slice(-300); },
    hasUsers() { return A.load().users.length > 0; },
    async createUser(o) {
      const d = A.load(), name = String(o.name || '').trim(); if (!name) throw new Error('A name is required'); if (String(o.pass || '').length < 8) throw new Error('Password: at least 8 characters');
      if (d.users.some(u => u.name.toLowerCase() === name.toLowerCase())) throw new Error('That name is taken');
      const h = await A.hash(o.pass), u = { id: A.uid(), name, role: d.users.length ? (o.role || 'analyst') : 'admin', salt: h.salt, hash: h.hash, tlpRed: !!o.tlpRed, cases: o.cases || 'all', mustChange: !!o.mustChange, createdAt: new Date().toISOString(), lastLogin: null };
      d.users.push(u); A.audit(d, o.by || name, 'created user ' + name + ' (' + u.role + ')'); A.save(d); return u;
    },
    async setPassword(id, pass, mustChange, by) { if (String(pass || '').length < 8) throw new Error('Password: at least 8 characters'); const d = A.load(), u = d.users.find(x => x.id === id); if (!u) throw new Error('No such user'); const h = await A.hash(pass); u.salt = h.salt; u.hash = h.hash; u.mustChange = !!mustChange; A.audit(d, by || u.name, 'password ' + (mustChange ? 'reset for ' : 'changed for ') + u.name); A.save(d); },
    update(id, patch, by) { const d = A.load(); const u = d.users.find(x => x.id === id); if (!u) return; Object.assign(u, patch); A.audit(d, by || u.name, 'updated ' + u.name + ': ' + Object.keys(patch).join(', ')); A.save(d); },
    remove(id, by) { const d = A.load(), u = d.users.find(x => x.id === id); if (!u) return; if (u.role === 'admin' && d.users.filter(x => x.role === 'admin').length === 1) throw new Error('Keep at least one admin'); d.users = d.users.filter(x => x.id !== id); if (d.session && d.session.userId === id) d.session = null; A.audit(d, by, 'removed user ' + u.name); A.save(d); },
    async login(name, pass) {
      const d = A.load(), u = d.users.find(x => x.name.toLowerCase() === String(name || '').trim().toLowerCase());
      const ok = !!u && (await A.hash(pass || '', u.salt)).hash === u.hash;
      A.audit(d, String(name || '').trim() || '(blank)', ok ? 'signed in' : 'FAILED sign-in');
      if (!ok) { A.save(d); throw new Error('Wrong name or password'); }
      u.lastLogin = new Date().toISOString(); d.session = { userId: u.id, at: Date.now(), exp: Date.now() + LIFE, seen: Date.now() }; A.save(d); return u;
    },
    logout() { const d = A.load(), u = A.user(d); if (u) A.audit(d, u.name, 'signed out'); d.session = null; A.save(d); },
    user(d) { d = d || A.load(); const s = d.session; if (!s) return null; if (Date.now() > s.exp || Date.now() - s.seen > IDLE) { A.audit(d, '(session)', 'expired'); d.session = null; A.save(d); return null; } if (s.userId === 'guest') return { id: 'guest', name: 'Guest', role: 'viewer', guest: true, cases: 'public', tlpRed: false }; return d.users.find(u => u.id === s.userId) || null; },
    touch() { const d = A.load(); if (d.session) { d.session.seen = Date.now(); A.save(d); } },
    require(loginFile) { const u = A.user(); if (!u) { const here = location.pathname.split('/').pop() + location.hash; location.replace((loginFile || 'Login.dc.html') + '#next=' + encodeURIComponent(here)); return null; } return u; },
    canSee(u, c) { if (!u || !c) return false; if (u.guest) return !!c.public && ['', 'clear', 'green'].includes(c.tlp || ''); if (u.role === 'admin') return true; if ((c.tlp === 'red' || c.tlp === 'amber+strict') && !u.tlpRed) return false; return u.cases === 'all' || (Array.isArray(u.cases) && u.cases.includes(c.id)); },
    canEdit(u, c) { return !!u && (u.role === 'admin' || u.role === 'analyst') && A.canSee(u, c); },
    canReview(u, c) { return !!u && (u.role === 'admin' || u.role === 'reviewer' || u.role === 'analyst') && A.canSee(u, c); },
    canCreate(u) { return !!u && (u.role === 'admin' || u.role === 'analyst'); },
    isAdmin(u) { return !!u && u.role === 'admin'; },
    hasPublic() { try { const d = JSON.parse(localStorage.getItem('cyber-investigation-board.v1') || 'null'); return !!(d && Array.isArray(d.cases) && d.cases.some(c => c.public)); } catch (e) { return false; } },
    guest() { const d = A.load(); d.session = { userId: 'guest', at: Date.now(), exp: Date.now() + LIFE, seen: Date.now() }; A.audit(d, 'guest', 'public access'); A.save(d); return A.user(d); },
    roleLabel(r) { const x = A.ROLES.find(y => y[0] === r); return x ? x[1] : r; },
  };
  window.CIBAuth = A;
})();
