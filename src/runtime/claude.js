// window.claude.complete → the server's AI gateway (Anthropic model when configured, local engine otherwise).
import { api } from './api.js';
window.claude = window.claude || {};
window.claude.complete = async ({ system, messages, max_tokens } = {}) => {
  const r = await api('POST', '/api/ai/complete', { system, messages, max_tokens });
  return r.text;
};
window.claude.engine = () => (window.CIBAuth && window.CIBAuth.aiEngine && window.CIBAuth.aiEngine()) || 'local';
