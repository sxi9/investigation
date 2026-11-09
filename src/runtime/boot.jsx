// Shared page bootstrap: load auth state and the server store, then render the page.
import React from 'react';
import { createRoot } from 'react-dom/client';
import './proxy.js';
import './claude.js';
import A from './auth.js';
import S from './store.js';
import '../../design/foley.js';

export async function boot(Page, settings, { needsStore = true } = {}) {
  await A.init();
  if (needsStore && A.user()) { try { await S.pull(); S.listen(); } catch (e) { console.warn('store pull failed', e); } }
  if (A.user() && A.user().role === 'admin') A.refreshUsers();
  const root = createRoot(document.getElementById('root'));
  root.render(<Page {...settings} />);
  return root;
}
