// Server-sent events: one stream per browser tab; case changes fan out to everyone allowed to see them.
import { canSee } from './acl.js';
const clients = new Set();
export function subscribe(reply, user) {
  const c = { reply, user };
  clients.add(c);
  reply.raw.on('close', () => clients.delete(c));
  return c;
}
export function broadcast(evt, caseMeta, except) {
  const line = 'event: ' + evt.type + '\ndata: ' + JSON.stringify(evt) + '\n\n';
  for (const c of clients) {
    if (except && c.sessionKey === except) continue;
    if (caseMeta && !canSee(c.user, caseMeta)) continue;
    try { c.reply.raw.write(line); } catch (e) { clients.delete(c); }
  }
}
export function broadcastTo(filter, evt, except, clientFilter) {
  const line = 'event: ' + evt.type + '\ndata: ' + JSON.stringify(evt) + '\n\n';
  for (const c of clients) {
    if (except && c.sessionKey === except) continue;
    try { if (!filter(c)) continue; if (clientFilter && !clientFilter(c)) continue; c.reply.raw.write(line); } catch (e) { clients.delete(c); }
  }
}
export function setClientCase(sessionKey, caseId) { for (const c of clients) if (c.sessionKey === sessionKey) c.caseId = caseId; }
export function keepAlive() { setInterval(() => { for (const c of clients) { try { c.reply.raw.write(': ping\n\n'); } catch (e) { clients.delete(c); } } }, 25000).unref(); }
export const clientCount = () => clients.size;
