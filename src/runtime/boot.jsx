// Shared page bootstrap: load auth state and the server store, then render the page.
import React from 'react';
import { createRoot } from 'react-dom/client';
import './proxy.js';
import './claude.js';
import A from './auth.js';
import S from './store.js';
import '../../design/foley.js';

let prebooted = false;
// Load auth state first (so library merges can run before the page logic initialises), then the store in boot().
export async function preboot() { if (!prebooted) { await A.init(); prebooted = true; } return A.user(); }
export async function boot(Page, settings, { needsStore = true } = {}) {
  if (!prebooted) await A.init(); prebooted = true;
  if (needsStore && A.user()) { try { await S.pull(); S.listen(); } catch (e) { console.warn('store pull failed', e); } }
  if (A.user() && A.user().role === 'admin') A.refreshUsers();
  const root = createRoot(document.getElementById('root'));
  root.render(<Page {...settings} />);
  return root;
}
