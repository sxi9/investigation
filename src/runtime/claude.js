// window.claude.complete → the server's AI gateway (configured providers in order, built-in engine last).
import { api } from './api.js';
window.claude = window.claude || {};
let lastEngine = null;
window.claude.complete = async ({ system, messages, max_tokens, provider } = {}) => {
  const r = await api('POST', '/api/ai/complete', { system, messages, max_tokens, provider: provider || window.claude.preferred || undefined });
  if (r.engine !== lastEngine) {
    lastEngine = r.engine;
    const fell = r.tried && r.tried.length ? ' (after ' + r.tried.map(t => t.id).join(', ') + ' failed)' : '';
    if (window.CIBAuth && (fell || r.provider === 'local')) window.CIBAuth.toast(r.provider === 'local' ? 'Answered by the built-in rule engine' + fell + ' — configure a model key on the server for full analysis' : 'Answered by ' + r.engine + fell);
  }
  return r.text;
};
window.claude.engine = () => lastEngine || (window.CIBAuth && window.CIBAuth.aiEngine && window.CIBAuth.aiEngine()) || 'local';
window.claude.providers = () => api('GET', '/api/ai/providers');
window.claude.preferred = null; // set to a provider id (e.g. 'gemini') to pin one for this tab
