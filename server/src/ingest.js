// Ingest a document (.eml, .pdf, .txt/.md/.csv/.json/.html) into research-style proposals: cards + threads the panel can import.
import crypto from 'node:crypto';
import { localExtract, extract } from './research.js';
import { listProviders } from './ai/index.js';
const err = (m, status = 400) => Object.assign(new Error(m), { status });
const IP = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
const PRIVATE = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.)/;
export function stripHtml(h) { return String(h || '').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim(); }
const qp = (s) => Buffer.from(String(s).replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8');
const decodeWord = (s) => String(s || '').replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (m, cs, enc, txt) => { try { return enc.toUpperCase() === 'B' ? Buffer.from(txt, 'base64').toString('utf8') : qp(txt.replace(/_/g, ' ')); } catch (e) { return txt; } });
function parseHeaders(block) { const h = {}; const lines = block.split(/\r?\n/); let cur = null; for (const l of lines) { if (/^\s/.test(l) && cur) { h[cur] += ' ' + l.trim(); continue; } const m = l.match(/^([\w-]+):\s*(.*)$/); if (m) { cur = m[1].toLowerCase(); h[cur] = h[cur] ? h[cur] + '\n' + m[2] : m[2]; } } return h; }
function decodeBody(headers, body) { const te = (headers['content-transfer-encoding'] || '').toLowerCase(); if (te.includes('base64')) return Buffer.from(body.replace(/\s+/g, ''), 'base64'); if (te.includes('quoted-printable')) return Buffer.from(qp(body), 'utf8'); return Buffer.from(body, 'utf8'); }
function parts(raw) {
  const sep = raw.indexOf('\r\n\r\n') >= 0 ? '\r\n\r\n' : '\n\n'; const i = raw.indexOf(sep); const headers = parseHeaders(i < 0 ? raw : raw.slice(0, i)); const body = i < 0 ? '' : raw.slice(i + sep.length);
  const ct = headers['content-type'] || 'text/plain'; const m = ct.match(/boundary="?([^";\s]+)"?/i);
  if (/^multipart\//i.test(ct) && m) { const segs = body.split(new RegExp('(?:^|\\r?\\n)--' + m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:--)?(?:\\r?\\n|$)')).filter(s => s.trim()); return [{ headers, body: '', multipart: true }, ...segs.flatMap(s => parts(s.replace(/^\r?\n/, '')))]; }
  return [{ headers, body, ct }];
}
export function parseEml(raw) {
  raw = String(raw); const all = parts(raw); const top = all[0].headers; const out = { subject: decodeWord(top.subject || ''), from: decodeWord(top.from || ''), to: decodeWord(top.to || ''), replyTo: decodeWord(top['reply-to'] || ''), date: top.date || '', messageId: top['message-id'] || '', received: [], text: '', urls: [], attachments: [], auth: top['authentication-results'] || '' };
  for (const r of String(top.received || '').split('\n')) for (const ip of r.match(IP) || []) if (!PRIVATE.test(ip) && !out.received.includes(ip)) out.received.push(ip);
  let html = '';
  for (const p of all.slice(all[0].multipart ? 1 : 0)) {
    const ct = (p.headers['content-type'] || p.ct || 'text/plain').toLowerCase(); const cd = p.headers['content-disposition'] || '';
    const fn = decodeWord((cd.match(/filename\*?="?([^";]+)"?/i) || ct.match(/name="?([^";]+)"?/i) || [])[1] || '');
    if (/attachment/i.test(cd) || (fn && !/^text\//.test(ct))) { const buf = decodeBody(p.headers, p.body); out.attachments.push({ name: fn || 'attachment', size: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), md5: crypto.createHash('md5').update(buf).digest('hex'), type: ct.split(';')[0] }); continue; }
    if (/^text\/plain/.test(ct)) out.text += decodeBody(p.headers, p.body).toString('utf8') + '\n'; else if (/^text\/html/.test(ct)) html += decodeBody(p.headers, p.body).toString('utf8');
  }
  if (!out.text.trim() && html) out.text = stripHtml(html);
  const src = out.text + '\n' + html;
  for (const u of src.match(/https?:\/\/[^\s"'<>)\]]+/gi) || []) { const c = u.replace(/[.,;:]+$/, ''); if (!out.urls.includes(c)) out.urls.push(c); }
  return out;
}
const emailAddr = (s) => (String(s).match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/) || [''])[0].toLowerCase();
const isoDate = (d) => { const t = Date.parse(d); return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : ''; };
const isoTime = (d) => { const t = Date.parse(d); return Number.isFinite(t) ? new Date(t).toISOString().slice(11, 16) : ''; };
export function emlToProposals(e, name) {
  const cards = [], threads = []; const src = { provider: 'upload', title: name, url: 'upload://' + encodeURIComponent(name), grade: 'B', date: isoDate(e.date) };
  const srcLabel = 'upload · ' + name;
  const ev = cards.push({ type: 'event', title: 'Email received: ' + (e.subject || '(no subject)'), body: ['From: ' + e.from, 'To: ' + e.to, e.replyTo ? 'Reply-To: ' + e.replyTo : '', e.messageId ? 'Message-ID: ' + e.messageId : '', e.auth ? 'Auth: ' + e.auth.slice(0, 200) : '', '', e.text.trim().slice(0, 700)].filter(Boolean).join('\n'), date: isoDate(e.date), time: isoTime(e.date), tags: 'email, ingested', confidence: 'high', source: srcLabel, srcGrade: 'B', infoGrade: '2' }) - 1;
  const fromAddr = emailAddr(e.from); if (fromAddr) { const i = cards.push({ type: 'indicator', kind: 'email', value: fromAddr, title: 'Sender', body: 'From header of "' + e.subject + '"', tags: 'sender', confidence: 'high', source: srcLabel, srcGrade: 'B', infoGrade: '2' }) - 1; threads.push({ from: i, to: ev, rel: 'linked', why: 'sender of the message' }); }
  const rt = emailAddr(e.replyTo); if (rt && rt !== fromAddr) { const i = cards.push({ type: 'indicator', kind: 'email', value: rt, title: 'Reply-To differs from sender', body: 'Replies go to this address, not the From address: a common phishing tell.', tags: 'reply-to, suspicious', confidence: 'high', source: srcLabel, srcGrade: 'B', infoGrade: '2' }) - 1; threads.push({ from: i, to: ev, rel: 'suspected', why: 'reply-to mismatch' }); }
  for (const ip of e.received.slice(0, 3)) { const i = cards.push({ type: 'indicator', kind: 'ip', value: ip, title: 'Sending relay', body: 'From the Received: chain (first external hop is the most telling).', tags: 'relay, received', confidence: 'medium', source: srcLabel, srcGrade: 'B', infoGrade: '3' }) - 1; threads.push({ from: i, to: ev, rel: 'linked', why: 'relay in Received headers' }); }
  for (const u of e.urls.slice(0, 12)) { let host = ''; try { host = new URL(u).hostname; } catch (e2) {} if (/^(www\.)?(w3\.org|schema\.org|google\.com|microsoft\.com|apple\.com)$/i.test(host)) continue; const i = cards.push({ type: 'indicator', kind: 'url', value: u, title: host ? 'Link to ' + host : 'Link in message', body: 'URL found in the message body.', tags: 'lure, link', confidence: 'medium', source: srcLabel, srcGrade: 'B', infoGrade: '3' }) - 1; threads.push({ from: ev, to: i, rel: 'linked', why: 'linked from the message' }); }
  for (const a of e.attachments.slice(0, 8)) { const i = cards.push({ type: 'indicator', kind: 'hash', value: a.sha256, title: 'Attachment ' + a.name, body: a.type + ' · ' + a.size + ' bytes · MD5 ' + a.md5, tags: 'attachment, sha256', confidence: 'high', source: srcLabel, srcGrade: 'B', infoGrade: '2' }) - 1; threads.push({ from: ev, to: i, rel: 'linked', why: 'attached to the message' }); const f = cards.push({ type: 'indicator', kind: 'filename', value: a.name, title: 'Attachment name', body: 'As attached to "' + e.subject + '"', tags: 'attachment', confidence: 'high', source: srcLabel, srcGrade: 'B', infoGrade: '2' }) - 1; threads.push({ from: f, to: i, rel: 'alias', why: 'name of the file with this hash' }); }
  return { summary: 'Email "' + e.subject + '" from ' + (e.from || '?') + (e.date ? ' on ' + isoDate(e.date) : '') + ': ' + (e.urls.length) + ' link(s), ' + e.attachments.length + ' attachment(s), ' + e.received.length + ' external relay(s).', cards, threads, sources: [src], engine: 'eml-parser' };
}
export async function pdfText(buf) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, disableFontFace: true, isEvalSupported: false }).promise;
  let t = ''; const n = Math.min(doc.numPages, 60); for (let i = 1; i <= n; i++) { const p = await doc.getPage(i); const c = await p.getTextContent(); t += c.items.map(x => x.str).join(' ') + '\n\n'; }
  return { text: t.replace(/[ \t]+/g, ' ').trim(), pages: doc.numPages };
}
export async function ingest({ name, mime, data, existing = [], context = '', useModel = true }) {
  name = String(name || 'upload').slice(0, 200); const lower = name.toLowerCase();
  if (!data || !data.length) throw err('Empty file');
  if (lower.endsWith('.eml') || /message\/rfc822/.test(mime || '')) return { ...emlToProposals(parseEml(data.toString('utf8')), name), kind: 'eml' };
  let text = '', pages = 0;
  if (lower.endsWith('.pdf') || /application\/pdf/.test(mime || '')) { const r = await pdfText(data); text = r.text; pages = r.pages; if (!text) throw err('No text layer in that PDF (scanned? run OCR first)'); }
  else if (lower.endsWith('.html') || lower.endsWith('.htm') || /text\/html/.test(mime || '')) text = stripHtml(data.toString('utf8'));
  else text = data.toString('utf8');
  if (!text.trim()) throw err('Nothing readable in that file');
  const sources = [{ provider: 'upload', title: name, url: 'upload://' + encodeURIComponent(name), grade: 'B', date: new Date().toISOString().slice(0, 10), text: text.slice(0, 20000) }];
  const query = name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ');
  const hasModel = useModel && listProviders().some(p => p.id !== 'local' && p.configured && !p.disabled);
  const r = hasModel ? await extract({ query, sources, existing, context }) : localExtract({ query, sources, existing });
  return { ...r, sources: r.sources || sources.map(({ text: _t, ...s }) => s), kind: pages ? 'pdf' : 'text', pages, chars: text.length, query };
}
