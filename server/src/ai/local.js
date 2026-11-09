// Built-in analyst engine, used when no ANTHROPIC_API_KEY is configured.
// It answers the board's four prompts (assess, translate, stance, entities) with the exact JSON
// shapes the front end expects, from rules rather than a language model, and says so in its output.

const IOC = {
  ipv4: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\[\.\]|\.)){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
  domain: /\b(?:[a-z0-9-]{1,63}(?:\[\.\]|\.))+(?:[a-z]{2,24})\b/gi,
  url: /\bhxxps?:\/\/\S+|\bhttps?:\/\/\S+/gi,
  email: /\b[\w.+-]+(?:@|\[@\])[\w.-]+(?:\[\.\]|\.)[a-z]{2,}\b/gi,
  sha256: /\b[a-f0-9]{64}\b/gi, sha1: /\b[a-f0-9]{40}\b/gi, md5: /\b[a-f0-9]{32}\b/gi,
  cve: /\bCVE-\d{4}-\d{4,7}\b/gi,
  money: /(?:[$€£¥]\s?\d[\d,.]*(?:\s?(?:million|billion|thousand|bn|k|m)\b)?|\b\d[\d,.]*\s?(?:USD|EUR|GBP|BTC|ETH|USDT)\b)/gi,
  date: /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s\d{1,2},?\s\d{4})\b/g,
  phone: /(?:\+|00)\d[\d\s().-]{7,}\d/g,
  plate: /\b[A-Z]{1,3}[- ]?\d{1,4}[- ]?[A-Z]{0,3}\b/g,
};
const NEG = ['attack', 'breach', 'stolen', 'fraud', 'scam', 'malicious', 'ransom', 'threat', 'exploit', 'leak', 'hack', 'fake', 'lie', 'corrupt', 'kill', 'war', 'dead', 'victim', 'loss', 'fail', 'danger', 'illegal', 'bad', 'worst', 'hate', 'angry', 'terrible', 'crisis', 'collapse'];
const POS = ['secure', 'safe', 'recovered', 'restored', 'confirmed', 'success', 'good', 'great', 'support', 'trust', 'win', 'best', 'love', 'thank', 'improve', 'protect', 'resolved', 'growth', 'strong', 'help'];
const SUPPORT = ['support', 'agree', 'endorse', 'stand with', 'we back', 'in favour', 'in favor', 'defend', 'proud', 'join us', 'vote for', 'must', 'should'];
const OPPOSE = ['oppose', 'against', 'reject', 'condemn', 'boycott', 'stop', 'ban', 'never', 'refuse', 'shame', 'resign', 'corrupt', 'lies', 'hoax', 'fake'];
const ORG_HINT = /\b(?:Inc|Ltd|LLC|GmbH|AG|SA|Corp|Corporation|Company|Group|Bank|University|Ministry|Agency|Department|Police|Authority|Foundation|Institute|Labs?|Holdings|Partners|Exchange|Telecom|Airlines|Hospital|Council|Union|Party|Army)\b/;
const PLACE_HINT = new Set(['street', 'st', 'road', 'rd', 'avenue', 'ave', 'square', 'lane', 'bridge', 'station', 'airport', 'port', 'harbour', 'harbor', 'city', 'county', 'province', 'district', 'island', 'river', 'london', 'paris', 'berlin', 'moscow', 'beijing', 'new york', 'washington', 'tokyo', 'delhi', 'sydney', 'pyongyang', 'kyiv', 'tehran', 'dubai', 'singapore', 'amsterdam', 'vilnius', 'lithuania', 'germany', 'france', 'russia', 'china', 'ukraine', 'iran', 'usa', 'uk', 'india', 'australia', 'europe', 'africa', 'asia']);
const STOP = new Set(['The', 'This', 'That', 'These', 'Those', 'There', 'Then', 'When', 'Where', 'What', 'Which', 'Who', 'Why', 'How', 'And', 'But', 'For', 'From', 'With', 'Into', 'After', 'Before', 'Over', 'Under', 'About', 'Our', 'Your', 'Their', 'His', 'Her', 'Its', 'New', 'Also', 'Last', 'First', 'Next', 'Case', 'Note', 'Source', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'TLP', 'CVE', 'IP', 'DNS', 'URL', 'SHA', 'MD5', 'FBI', 'CISA', 'VPN', 'RDP', 'SMB', 'PDF', 'Plate', 'Registration', 'Subject', 'Re', 'Fw', 'Fwd', 'While', 'Although', 'Because', 'However', 'Meanwhile', 'Since', 'Until', 'Unless', 'Once', 'Instead', 'Later', 'Earlier', 'Today', 'Yesterday', 'Tomorrow', 'According', 'Despite', 'During', 'Among', 'Between', 'Through', 'Without', 'Within', 'Microsoft Windows', 'Windows']);

const uniq = (arr, key = x => x) => { const seen = new Set(); return arr.filter(x => { const k = key(x).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }); };
const refang = s => String(s || '').replace(/\[\.\]/g, '.').replace(/\[@\]/g, '@').replace(/hxxp/gi, 'http');

export function detectLanguage(text) {
  const t = String(text || '');
  if (/[Ѐ-ӿ]/.test(t)) return /[іїє]/i.test(t) ? 'Ukrainian' : 'Russian';
  if (/[一-鿿]/.test(t)) return 'Chinese';
  if (/[぀-ヿ]/.test(t)) return 'Japanese';
  if (/[가-힯]/.test(t)) return 'Korean';
  if (/[؀-ۿ]/.test(t)) return /[پچژگ]/.test(t) ? 'Persian' : 'Arabic';
  if (/[֐-׿]/.test(t)) return 'Hebrew';
  if (/[฀-๿]/.test(t)) return 'Thai';
  if (/[ऀ-ॿ]/.test(t)) return 'Hindi';
  const w = ' ' + t.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ') + ' ';
  const score = (words) => words.reduce((n, x) => n + (w.split(' ' + x + ' ').length - 1), 0);
  const cands = [['Spanish', ['el', 'la', 'de', 'que', 'los', 'las', 'una', 'por', 'con', 'para', 'es', 'del']], ['Portuguese', ['o', 'a', 'de', 'que', 'não', 'uma', 'com', 'para', 'os', 'as', 'é', 'em']], ['French', ['le', 'la', 'les', 'de', 'des', 'et', 'est', 'une', 'pour', 'que', 'dans', 'pas']], ['German', ['der', 'die', 'das', 'und', 'ist', 'nicht', 'ein', 'eine', 'mit', 'für', 'auf', 'den']], ['Italian', ['il', 'la', 'di', 'che', 'non', 'una', 'per', 'con', 'sono', 'gli', 'del', 'è']], ['Dutch', ['de', 'het', 'een', 'van', 'en', 'niet', 'is', 'dat', 'op', 'voor', 'met', 'zijn']], ['Turkish', ['ve', 'bir', 'bu', 'için', 'ile', 'da', 'de', 'çok', 'daha', 'olarak']], ['Indonesian', ['yang', 'dan', 'di', 'dengan', 'untuk', 'ini', 'tidak', 'dari', 'adalah']], ['English', ['the', 'and', 'of', 'to', 'is', 'in', 'that', 'for', 'with', 'was', 'are', 'this']]];
  let best = ['English', 0]; for (const [l, ws] of cands) { const s = score(ws); if (s > best[1]) best = [l, s]; }
  return best[1] ? best[0] : 'unknown';
}

export function extractEntities(text) {
  const t = String(text || ''); const out = [];
  const push = (type, name, note) => { if (name && name.length < 120) out.push({ type, name: name.trim(), note }); };
  (t.match(IOC.email) || []).forEach(x => push('email', x, 'address in text'));
  (t.match(IOC.phone) || []).forEach(x => push('phone', x.trim(), 'number in text'));
  (t.match(IOC.money) || []).forEach(x => push('money', x.trim(), 'amount mentioned'));
  (t.match(IOC.date) || []).forEach(x => push('date', x, 'date mentioned'));
  (t.match(IOC.cve) || []).forEach(x => push('object', x.toUpperCase(), 'vulnerability'));
  (t.match(IOC.ipv4) || []).forEach(x => push('object', x, 'IP address'));
  (t.match(IOC.sha256) || []).forEach(x => push('object', x, 'SHA-256'));
  // people and organisations: capitalised runs of 2–4 words
  const caps = t.match(/\b[A-Z][\p{L}'’-]+(?:\s(?:(?:of|de|van|von|der|al|bin|ibn|la|le|du|da)\s)?[A-Z][\p{L}'’-]+){1,3}/gu) || [];
  for (const c of caps) {
    const words = c.trim().split(/\s+/); if (STOP.has(words[0])) continue;
    const lc = c.toLowerCase();
    if (ORG_HINT.test(c)) push('org', c.trim(), 'organisation name pattern');
    else if (words.some(w => PLACE_HINT.has(w.toLowerCase().replace(/[.,]/g, '')))) push('place', c.trim(), 'place name pattern');
    else if (/^(?:Mr|Mrs|Ms|Dr|Prof|Sir|Det|Insp|Sgt|Gen|Col|Capt)\.?\s/.test(c) || (words.length === 2 && !/\d/.test(c))) push('person', c.replace(/^(?:Mr|Mrs|Ms|Dr|Prof|Sir|Det|Insp|Sgt|Gen|Col|Capt)\.?\s/, '').trim(), 'capitalised name pattern');
    else push('org', c.trim(), 'capitalised phrase');
  }
  // single capitalised place / country names
  for (const w of t.match(/\b[A-Z][a-z]{3,}\b/g) || []) if (PLACE_HINT.has(w.toLowerCase())) push('place', w, 'known place name');
  (t.match(/\b(?:Toyota|Ford|BMW|Audi|Mercedes|Volkswagen|VW|Honda|Nissan|Tesla|Peugeot|Renault|Skoda|Volvo|Kia|Hyundai)\b[^.,;\n]{0,30}/g) || []).forEach(x => push('vehicle', x.trim(), 'vehicle make mentioned'));
  (t.match(/\b(?:[A-Z]{2}\d{2}\s?[A-Z]{3}|[A-Z]{1,3}-\d{3,4}-[A-Z]{1,2}|\d{1,3}-[A-Z]{1,3}-\d{1,4})\b/g) || []).forEach(x => push('vehicle', x, 'registration plate pattern'));
  return uniq(out, x => x.type + ':' + x.name).slice(0, 25);
}

export function stance(text) {
  const t = String(text || '').toLowerCase();
  const count = (list) => list.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);
  const neg = count(NEG), pos = count(POS), sup = count(SUPPORT), opp = count(OPPOSE);
  const sentiment = neg && pos ? 'mixed' : neg > pos ? 'negative' : pos > neg ? 'positive' : 'neutral';
  const st = sup > opp + 1 ? 'support' : opp > sup ? 'oppose' : (sup || opp) ? 'unclear' : 'neutral';
  // narrative: most frequent capitalised phrase or first clause
  const caps = (String(text).match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+){0,3}/g) || []).filter(x => !STOP.has(x.split(' ')[0]));
  const freq = {}; caps.forEach(c => freq[c] = (freq[c] || 0) + 1);
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
  const narrative = (top ? 'About ' + top[0] : String(text).split(/[.!?\n]/)[0].trim().split(/\s+/).slice(0, 8).join(' ')) .slice(0, 60);
  return { sentiment, stance: st, narrative, note: `Rule-based reading (no language model configured): ${neg} negative and ${pos} positive cue words, ${sup} supporting and ${opp} opposing phrases.` };
}

function parseAssessPrompt(prompt) {
  const card = (() => { const m = prompt.match(/CARD UNDER REVIEW:\n(\{[\s\S]*?\})\n\nOTHER CARDS/); try { return m ? JSON.parse(m[1]) : {}; } catch (e) { return {}; } })();
  const others = (prompt.match(/OTHER CARDS ON THE BOARD:\n([\s\S]*?)\n\nEXISTING THREADS/) || [, ''])[1].split('\n').filter(l => /^E\d+/.test(l)).map(l => { const m = l.match(/^E(\d+) \[([^\]]+)\] (.*)$/); return m ? { num: 'E' + m[1], type: m[2], text: m[3] } : null; }).filter(Boolean);
  const threads = (prompt.match(/EXISTING THREADS:\n([\s\S]*?)\n\nReturn JSON/) || [, ''])[1].split('\n').filter(Boolean);
  const notes = (prompt.match(/CASE NOTES:\n([\s\S]*?)\n\nCARD UNDER REVIEW/) || [, ''])[1];
  return { card, others, threads, notes };
}
const tokens = (s) => new Set(refang(String(s || '')).toLowerCase().match(/[a-z0-9][a-z0-9.@_-]{3,}/g) || []);

export function assess(prompt) {
  const { card, others, threads, notes } = parseAssessPrompt(prompt);
  const label = card.title || card.value || card.url || '(untitled)';
  const type = (card.type || 'card').toLowerCase(); const kind = card.kind || '';
  const mine = tokens([card.title, card.value, card.url, card.body, card.tags].join(' '));
  const linked = new Set(threads.flatMap(l => l.match(/E\d+/g) || []));
  const related = others.map(o => { const t = tokens(o.text); let n = 0; for (const x of t) if (mine.has(x)) n++; return { ...o, score: n }; }).filter(o => o.score > 0 && !(card.number && linked.has(o.num) && linked.has(card.number))).sort((a, b) => b.score - a.score).slice(0, 3);
  const relFor = (o) => { const ot = o.type.toLowerCase(); if (type === 'indicator' && ot === 'location') return 'located'; if ((type === 'person' && ot === 'indicator') || (type === 'indicator' && ot === 'person')) return 'controls'; if (type === 'indicator' && ot === 'indicator' && (kind === 'domain' || kind === 'ip')) return 'resolves'; if (ot === 'person' || type === 'person') return 'suspected'; return 'linked'; };
  const sugg = related.map(o => ({ to: o.num, rel: relFor(o), why: 'shares ' + o.score + ' token' + (o.score > 1 ? 's' : '') + ' with this card' }));
  const stamp = card.status === 'confirmed' ? 'confirmed' : card.status === 'false' ? 'false' : (card.source || card.url) ? 'unverified' : null;
  const next = [];
  if (type === 'indicator') {
    if (kind === 'domain') next.push('WHOIS and passive DNS on the domain', 'Check certificate history (crt.sh)', 'Search proxy logs for connections');
    else if (kind === 'ip') next.push('RDAP owner and ASN; shared hosting?', 'Reputation on AbuseIPDB, GreyNoise, VirusTotal', 'Search firewall and VPN logs');
    else if (kind === 'hash') next.push('Look the hash up on VirusTotal and MalwareBazaar', 'Hunt for the file on endpoints', 'Record the sample\'s source and chain of custody');
    else if (kind === 'cve') next.push('Check NVD, EPSS and CISA KEV status', 'Inventory exposed systems with this CVE', 'Confirm patch level on edge devices');
    else if (kind === 'email') next.push('Pull original headers (SPF, DKIM, path)', 'Search mail gateway for the sender', 'Check breach data and EmailRep');
    else if (kind === 'wallet') next.push('Trace first three hops on the explorer', 'Request freeze from issuers or exchanges', 'Check sanctions and chain-analytics labels');
    else next.push('Verify the indicator against a second source', 'Record first and last seen dates');
  } else if (type === 'person') next.push('List handles and accounts under this persona', 'Check activity timezone and language', 'Tie each claim to a source card');
  else if (type === 'event') next.push('Confirm the timestamp from a primary log', 'Link the event to the technique it shows');
  else if (type === 'technique') next.push('Attach the evidence that shows this technique', 'Map detections for it in the SIEM');
  else if (type === 'transfer') next.push('Record tx hash and both addresses', 'Follow the funds to the next hop');
  else next.push('Name the source and grade it', 'Link the card to what it proves');
  if (!card.source) next.unshift('Record where this card came from (source)');
  const inNotes = notes && mine.size && [...mine].some(x => x.length > 5 && notes.toLowerCase().includes(x));
  const summary = `${card.type || 'Card'} "${String(label).slice(0, 60)}"${card.number ? ' (' + card.number + ')' : ''}: ${card.status ? 'stamped ' + card.status : 'not yet stamped'}${card.source ? ', sourced from ' + String(card.source).slice(0, 40) : ', no source recorded'}. ${related.length ? 'Shares identifiers with ' + related.map(r => r.num).join(', ') + '.' : 'No other card shares its identifiers yet.'}${inNotes ? ' It is referenced in the case notes.' : ''} (Rule-based assessment: no language model configured.)`;
  return { summary: summary.slice(0, 600), assessment: stamp, threads: sugg, next_steps: next.slice(0, 4) };
}

export function translate(text) {
  const lang = detectLanguage(text);
  return { lang, translation: lang === 'English' ? String(text) : '[No translation model is configured. Detected language: ' + lang + '. Original text kept.]\n\n' + String(text) };
}

// Entry point: look at the system/user prompt and answer in the right shape.
export function localComplete({ system = '', messages = [] }) {
  const prompt = String((messages.find(m => m.role === 'user') || {}).content || '');
  const sys = String(system);
  let out;
  if (/CARD UNDER REVIEW/.test(prompt) || /threat-intelligence analyst/i.test(sys)) out = assess(prompt);
  else if (/translate/i.test(sys) || /translate it to English/i.test(prompt)) out = translate((prompt.split(/TEXT:\n/)[1] || prompt));
  else if (/stance/i.test(sys) || /"stance"/.test(prompt)) out = stance(prompt.split(/TEXT:\n/)[1] || prompt);
  else if (/entities/i.test(sys) || /"entities"/.test(prompt)) out = { entities: extractEntities(prompt.split(/TEXT:\n/)[1] || prompt) };
  else out = { summary: 'No language model is configured on this server. Set ANTHROPIC_API_KEY to enable free-form analysis.', entities: extractEntities(prompt) };
  return JSON.stringify(out);
}
