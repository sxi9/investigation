// Converts the Claude Design pages (design/*.dc.html) into the React pages under src/pages/.
//
// The design files use a small template dialect on top of HTML:
//   {{ path }}                 value lookup against the logic class's renderVals()
//   <sc-if value="…">          conditional block
//   <sc-for list="…" as="x">   loop (adds the loop var and $index to scope)
//   <dc-import name="X" …>     nested component (another .dc.html page) with props
//   style-hover / style-focus  pseudo-class styles (compiled to !important rules)
//   <helmet>                   head content: fonts, scripts, global style (may contain {{ }})
//   camelCase attributes       (onClick, onPointerDown, tabIndex, …)
// This script reproduces those semantics as plain JSX so the pages run on stock React
// without the design runtime. Logic classes are carried over verbatim, with a few
// string patches (routes, proxy, media mirror) listed in PATCHES below.
//
// Usage: node tools/convert-template.mjs            (reads tools/pages.json)

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'pages.json'), 'utf8'));

// Logic patches: [description, find, replace, {all?:bool, pages?:[names]}]
const ROUTES = cfg.routes;
const PATCHES = [
  ['desk/login/board routes', /'Login\.dc\.html'/g, JSON.stringify(ROUTES['Login.dc.html']), {}],
  ['desk route', /'Case Files\.dc\.html'/g, JSON.stringify(ROUTES['Case Files.dc.html']), {}],
  ['board route', /'Investigation Board\.dc\.html'/g, JSON.stringify(ROUTES['Investigation Board.dc.html']), {}],
  ['desk route (bookmarklet string)', /\+ 'Case Files\.dc\.html#dr/g, "+ 'desk.html#dr", {}],
  ['login copy reflects the server-side accounts', "'Accounts, roles and sessions live in this browser for now; the production build authenticates against your identity provider.'", "'Accounts, roles and sessions are kept on the server. Passwords are hashed with scrypt and never stored in the browser.'", { pages: ['login'] }],
  ['login footer reflects scrypt + server sessions', "'Passwords are hashed (PBKDF2-SHA256, 150k rounds) before they touch storage. There is no recovery without another admin.'", "'Passwords are hashed with scrypt on the server and never stored in the browser. There is no recovery without another admin.'", { pages: ['login'] }],
  ['login footer: session policy', "'Sessions last 12 hours and lock after 15 minutes idle. Forgotten password: ask an administrator to reset it.'", "'Sessions last 12 hours and lock after 15 minutes idle; ten wrong passwords lock the account for 15 minutes. Forgotten password: ask an administrator to reset it.'", { pages: ['login'] }],
  ['server mode: an empty visible set does not re-seed the sample cases',
    "else if (d && Array.isArray(d.cases) && d.cases.length) saved = d; } } catch (e) {} }\n    if (lockedPayload)",
    "else if (d && Array.isArray(d.cases) && (d.cases.length || (Array.isArray(d.seeded) && d.seeded.includes('server')))) saved = d; } } catch (e) {} }\n    if (lockedPayload)", { pages: ['board'] }],
  ['server mode: start a blank case instead of the sample when the user has none',
    "let cases = this.migrate(saved ? saved.cases : [Component.sample()]);",
    "let cases = this.migrate(saved && saved.cases.length ? saved.cases : saved ? [{ id: Component.uid(), v: 3, number: 'CASE 0417', title: 'Untitled case', notes: '', items: [], threads: [], groups: [], dismissed: [], review: 'draft', log: [] }] : [Component.sample()]);", { pages: ['board'] }],
  ['board applies other people\'s changes arriving from the server',
    "  componentDidMount() {\n",
    "  applyRemote(ev) {\n    if (!ev) return;\n    if (ev.type === 'case-deleted') { this.setState(s => { const cases = s.cases.filter(c => c.id !== ev.id); return cases.length ? { cases, activeId: s.activeId === ev.id ? cases[0].id : s.activeId, sel: s.activeId === ev.id ? null : s.sel } : {}; }); return; }\n    const c = ev.case; if (!c || !c.id) return;\n    this.setState(s => ({ cases: s.cases.some(x => x.id === c.id) ? s.cases.map(x => x.id === c.id ? Component.numbered(c) : x) : [...s.cases, Component.numbered(c)] }));\n    if (this.state.activeId === c.id && c.updatedBy) this.toast('Updated by ' + c.updatedBy);\n  }\n  componentDidMount() {\n    if (window.CIBStore && window.CIBStore.onRemote) window.CIBStore.onRemote(ev => this.applyRemote(ev));\n", { pages: ['board'] }],
  ['desk re-reads the store when other people\'s changes arrive',
    "  componentDidMount() {\n",
    "  componentDidMount() {\n    if (window.CIBStore && window.CIBStore.onRemote) window.CIBStore.onRemote(() => this.setState({ saved: this.load() }));\n", { pages: ['desk'] }],
  ['enrichment on pin: indicators added to the board are looked up once',
    "    this.logEvt((pinned ? 'Pinned ' : 'Added to inbox: ') + K.TYPES[type].label.toLowerCase() + (this.itemLabel(it) ? ' — ' + this.itemLabel(it) : ''));\n    return id;",
    "    this.logEvt((pinned ? 'Pinned ' : 'Added to inbox: ') + K.TYPES[type].label.toLowerCase() + (this.itemLabel(it) ? ' — ' + this.itemLabel(it) : ''));\n    if (pinned && type === 'indicator' && it.value && window.CIBEnrich) window.CIBEnrich.schedule(id);\n    return id;", { pages: ['board'] }],
  ['enrichment when an inbox indicator is pinned',
    "    this.upItem(id, { pinned: true, ...pos });\n    this.setState({ sel: id, selThread: null, selGroup: null, tab: 'inspector' });\n    this.logEvt('Pinned to board: ' + this.itemLabel(it));",
    "    this.upItem(id, { pinned: true, ...pos });\n    this.setState({ sel: id, selThread: null, selGroup: null, tab: 'inspector' });\n    this.logEvt('Pinned to board: ' + this.itemLabel(it));\n    if (it.type === 'indicator' && it.value && window.CIBEnrich) window.CIBEnrich.schedule(id);", { pages: ['board'] }],
  ['CORS proxy goes through our own allow-listed server endpoint instead of allorigins.win',
    "proxy(u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); }",
    "proxy(u) { return '/api/proxy?url=' + encodeURIComponent(u); }", { pages: ['board'] }],
  ['jget routes CORS-blocked hosts through the proxy',
    "async jget(url, opts) { const r = await fetch(url, opts); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }",
    "async jget(url, opts) { const u = (window.CIBProxy && window.CIBProxy.needs(url)) ? this.proxy(url) : url; const r = await fetch(u, opts); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }", { pages: ['board'] }],
  ['media blobs are mirrored to the server file store',
    "putBlob(id, blob) { return this.idb().then(db => new Promise((res, rej) => { const tx = db.transaction('blobs', 'readwrite'); tx.objectStore('blobs').put(blob, id); tx.oncomplete = () => res();",
    "putBlob(id, blob) { if (window.CIBStore && window.CIBStore.putFile) window.CIBStore.putFile(id, blob).catch(() => {}); return this.idb().then(db => new Promise((res, rej) => { const tx = db.transaction('blobs', 'readwrite'); tx.objectStore('blobs').put(blob, id); tx.oncomplete = () => res();", { pages: ['board'] }],
  ['media blobs missing locally are fetched from the server',
    "getBlob(id) { return this.idb().then(db => new Promise((res, rej) => { const q = db.transaction('blobs').objectStore('blobs').get(id); q.onsuccess = () => res(q.result || null);",
    "getBlob(id) { return this.idb().then(db => new Promise((res, rej) => { const q = db.transaction('blobs').objectStore('blobs').get(id); q.onsuccess = () => { if (q.result) return res(q.result); if (window.CIBStore && window.CIBStore.getFile) window.CIBStore.getFile(id).then(b => { if (b) this.putBlob(id, b); res(b || null); }).catch(() => res(null)); else res(null); };",
    { pages: ['board'] }],
];

// Template text patches (applied before parsing): [description, find, replace, pages]
const TEMPLATE_PATCHES = [
  ['users panel caption reflects server accounts', 'browser-local accounts · the production build uses your identity provider', 'server accounts · scrypt-hashed passwords · every change audited', ['desk']],
];
function readDc(file, pageName) {
  let html = fs.readFileSync(file, 'utf8');
  for (const [, find, rep, pages] of TEMPLATE_PATCHES) if (!pages || pages.includes(pageName)) html = html.split(find).join(rep);
  const open = html.indexOf('<x-dc>'), close = html.lastIndexOf('</x-dc>');
  if (open < 0 || close < 0) throw new Error('no <x-dc> block in ' + file);
  const template = html.slice(open + 6, close);
  const m = html.match(/<script type="text\/x-dc" data-dc-script data-props="([^"]*)"\s*>([\s\S]*?)<\/script>\s*<\/body>/);
  const propsRaw = m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : '{}';
  let props = {}; try { props = JSON.parse(propsRaw); } catch (e) {}
  const script = m ? m[2] : '';
  return { template, props, script };
}

const browser = await chromium.launch();
const page = await browser.newPage();

async function convert(pg) {
  const { template, props, script } = readDc(path.join(root, pg.file), pg.name);
  const out = await page.evaluate(({ template, imports, clsPrefix }) => {
    // ---------- pre-encoding (mirrors the runtime) ----------
    const CAMEL = 'sc-camel-';
    const RAW_WRAP = { select: 'sc-raw-select', table: 'sc-raw-table', tbody: 'sc-raw-tbody', thead: 'sc-raw-thead', tfoot: 'sc-raw-tfoot', tr: 'sc-raw-tr', td: 'sc-raw-td', th: 'sc-raw-th', caption: 'sc-raw-caption' };
    const RAW_UNWRAP = Object.fromEntries(Object.entries(RAW_WRAP).map(([k, v]) => [v, k]));
    const EVENT_MAP = { onclick: 'onClick', onchange: 'onChange', oninput: 'onInput', onsubmit: 'onSubmit', onkeydown: 'onKeyDown', onkeyup: 'onKeyUp', onkeypress: 'onKeyPress', onmousedown: 'onMouseDown', onmouseup: 'onMouseUp', onmouseenter: 'onMouseEnter', onmouseleave: 'onMouseLeave', onfocus: 'onFocus', onblur: 'onBlur', ondoubleclick: 'onDoubleClick', oncontextmenu: 'onContextMenu', onmousemove: 'onMouseMove', onmouseover: 'onMouseOver', onmouseout: 'onMouseOut', onpointerdown: 'onPointerDown', onpointerup: 'onPointerUp', onpointermove: 'onPointerMove', onpointerenter: 'onPointerEnter', onpointerleave: 'onPointerLeave', onpointercancel: 'onPointerCancel', onpointerover: 'onPointerOver', onpointerout: 'onPointerOut', ongotpointercapture: 'onGotPointerCapture', onlostpointercapture: 'onLostPointerCapture', ontouchstart: 'onTouchStart', ontouchend: 'onTouchEnd', ontouchmove: 'onTouchMove', ontouchcancel: 'onTouchCancel', ondragstart: 'onDragStart', ondragend: 'onDragEnd', ondragenter: 'onDragEnter', ondragleave: 'onDragLeave', ondragover: 'onDragOver', ondrop: 'onDrop', onscroll: 'onScroll', onwheel: 'onWheel', onload: 'onLoad', onerror: 'onError', onended: 'onEnded', onplay: 'onPlay', onpause: 'onPause', ontimeupdate: 'onTimeUpdate', onloadedmetadata: 'onLoadedMetadata', onanimationstart: 'onAnimationStart', onanimationend: 'onAnimationEnd', onanimationiteration: 'onAnimationIteration', ontransitionend: 'onTransitionEnd' };
    const HTML_ATTR = { spellcheck: 'spellCheck', autocomplete: 'autoComplete', tabindex: 'tabIndex', readonly: 'readOnly', maxlength: 'maxLength', minlength: 'minLength', autofocus: 'autoFocus', crossorigin: 'crossOrigin', enctype: 'encType', contenteditable: 'contentEditable', srcset: 'srcSet', novalidate: 'noValidate', colspan: 'colSpan', rowspan: 'rowSpan', datetime: 'dateTime', accesskey: 'accessKey', 'accept-charset': 'acceptCharset', 'http-equiv': 'httpEquiv', autoplay: 'autoPlay', playsinline: 'playsInline', allowfullscreen: 'allowFullScreen', frameborder: 'frameBorder', referrerpolicy: 'referrerPolicy', srcdoc: 'srcDoc' };
    const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    function encodeCase(h) {
      h = h.replace(/<helmet(\s|>)/gi, '<sc-helmet$1').replace(/<\/helmet\s*>/gi, '</sc-helmet>');
      h = h.replace(/(\s)([a-z]+[A-Z][A-Za-z0-9]*)(\s*=)/g, (_, sp, name, eq) => sp + CAMEL + name.replace(/[A-Z]/g, c => '-' + c.toLowerCase()) + eq);
      for (const [real, alias] of Object.entries(RAW_WRAP)) h = h.replace(new RegExp('(</?)' + real + '(?=[\\s>])', 'gi'), '$1' + alias);
      return h;
    }
    const kebabToCamel = s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    // ---------- pseudo classes ----------
    const pseudoRules = []; const pseudoCache = new Map(); let pn = 0;
    const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
    function importantify(css) {
      css = stripComments(css); const decls = []; let start = 0, depth = 0, quote = '';
      for (let i = 0; i < css.length; i++) { const c = css[i]; if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; } else if (c === "'" || c === '"') quote = c; else if (c === '(') depth++; else if (c === ')') depth = Math.max(0, depth - 1); else if (c === ';' && depth === 0) { decls.push(css.slice(start, i)); start = i + 1; } }
      decls.push(css.slice(start));
      return decls.map(d => d.trim()).filter(Boolean).map(d => /!\s*important$/i.test(d) ? d : d + ' !important').join(';');
    }
    function pseudoClass(pseudo, css) {
      const k = pseudo + '|' + css; if (pseudoCache.has(k)) return pseudoCache.get(k);
      const cls = clsPrefix + (pn++).toString(36); const pe = pseudo === 'before' || pseudo === 'after';
      // declarations with {{ }} holes cannot be static CSS; the browser dropped them as invalid in the original too
      const clean = css.split(';').filter(d => !d.includes('{{')).join(';');
      pseudoRules.push('.' + cls + (pe ? '::' : ':') + pseudo + '{' + (pe ? clean : importantify(clean)) + '}');
      pseudoCache.set(k, cls); return cls;
    }
    // ---------- expressions ----------
    const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*/, NUMBER_RE = /^-?\d+(\.\d+)?$/;
    function parensWrapWhole(e) { let d = 0; for (let i = 0; i < e.length - 1; i++) { if (e[i] === '(') d++; else if (e[i] === ')') { d--; if (d === 0) return false; } } return true; }
    function findEq(e) { let d = 0; for (let i = 0; i < e.length; i++) { const c = e[i]; if (c === '[' || c === '(') d++; else if (c === ']' || c === ')') d--; else if (d === 0 && (c === '=' || c === '!') && e[i + 1] === '=') { if (i > 0 && (e[i - 1] === '=' || e[i - 1] === '!')) continue; if (!e.slice(0, i).trim()) continue; return { index: i, op: e[i + 2] === '=' ? c + '==' : c + '=' }; } } return null; }
    function compileExpr(srcExpr, scope) {
      const e = String(srcExpr).trim(); if (!e) return 'undefined';
      if (e[0] === '(' && e[e.length - 1] === ')' && parensWrapWhole(e)) return compileExpr(e.slice(1, -1), scope);
      const eq = findEq(e); if (eq) return '(' + compileExpr(e.slice(0, eq.index), scope) + ' ' + eq.op + ' ' + compileExpr(e.slice(eq.index + eq.op.length), scope) + ')';
      if (e[0] === '!') return '!' + compileExpr(e.slice(1), scope);
      if (e === 'true' || e === 'false' || e === 'null' || e === 'undefined' || NUMBER_RE.test(e)) return e;
      if (e.length >= 2 && (e[0] === '"' || e[0] === "'") && e[e.length - 1] === e[0]) return JSON.stringify(e.slice(1, -1));
      return compilePath(e, scope);
    }
    function compilePath(e, scope) {
      const head = e.match(IDENT_RE); if (!head) return 'undefined'; const name = head[0];
      let code = name === '$index' ? (scope.indexVar || 'undefined') : scope.vars.has(name) ? name : 'v.' + name; let i = name.length;
      while (i < e.length) {
        if (e[i] === '.') { const m = e.slice(i + 1).match(IDENT_RE) || e.slice(i + 1).match(/^\d+/); if (!m) return 'undefined'; code += /^\d/.test(m[0]) ? '?.[' + m[0] + ']' : '?.' + m[0]; i += 1 + m[0].length; }
        else if (e[i] === '[') { let d = 1, j = i + 1; while (j < e.length && d > 0) { if (e[j] === '[') d++; else if (e[j] === ']') { d--; if (d === 0) break; } j++; } if (d !== 0) return 'undefined'; code += '?.[' + compileExpr(e.slice(i + 1, j), scope) + ']'; i = j + 1; }
        else return 'undefined';
      }
      return code;
    }
    const tplEsc = s => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    function compileAttr(raw, scope) {
      const whole = raw.match(/^\s*\{\{([\s\S]+?)\}\}\s*$/); if (whole) return { kind: 'expr', code: compileExpr(whole[1], scope) };
      if (raw.includes('{{')) { const parts = raw.split(/\{\{([\s\S]+?)\}\}/g); return { kind: 'tpl', code: '`' + parts.map((p, i) => i & 1 ? '${' + compileExpr(p, scope) + ' ?? ""}' : tplEsc(p)).join('') + '`' }; }
      return { kind: 'static', value: raw };
    }
    const propKey = p => p.startsWith('--') ? JSON.stringify(p) : (/^[A-Za-z_$][\w$]*$/.test(kebabToCamel(p)) ? kebabToCamel(p) : JSON.stringify(kebabToCamel(p)));
    function styleObjCode(raw, scope) {
      const entries = new Map();
      for (const decl of raw.split(';')) { const i = decl.indexOf(':'); if (i < 0) continue; const prop = decl.slice(0, i).trim(); const val = decl.slice(i + 1).trim(); if (!prop) continue; let code; if (val.includes('{{')) { const parts = val.split(/\{\{([\s\S]+?)\}\}/g); code = '`' + parts.map((p, k) => k & 1 ? '${' + compileExpr(p, scope) + ' ?? ""}' : tplEsc(p)).join('') + '`'; } else code = JSON.stringify(val); entries.delete(propKey(prop)); entries.set(propKey(prop), code); }
      return '{' + [...entries].map(([k, c]) => k + ': ' + c).join(', ') + '}';
    }
    // ---------- walker ----------
    const ind = n => '  '.repeat(n); const jsxText = s => '{' + JSON.stringify(s) + '}';
    let helmet = null; const usedImports = new Set();
    function walkText(node, scope, depth) {
      const txt = node.nodeValue ?? '';
      if (!txt.includes('{{')) { if (!txt.trim() && !txt.includes(' ')) return ''; return ind(depth) + jsxText(txt) + '\n'; }
      const parts = txt.split(/\{\{([\s\S]+?)\}\}/g);
      return ind(depth) + parts.map((p, i) => i & 1 ? '{' + compileExpr(p, scope) + '}' : (p ? jsxText(p) : '')).join('') + '\n';
    }
    const SKIP_WS_IN = new Set(['select', 'datalist', 'svg', 'g', 'table', 'tbody', 'thead', 'tr']);
    function walkChildren(node, scope, depth) {
      const tag = node.nodeType === Node.ELEMENT_NODE ? (RAW_UNWRAP[node.localName] || node.localName) : '';
      return [...node.childNodes].filter(c => !(SKIP_WS_IN.has(tag) && c.nodeType === Node.TEXT_NODE && !c.nodeValue.trim())).map(c => walk(c, scope, depth)).join('');
    }
    function walk(node, scope, depth) {
      if (node.nodeType === Node.TEXT_NODE) return walkText(node, scope, depth);
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const tag = node.tagName.toLowerCase();
      if (tag === 'sc-for') return walkFor(node, scope, depth);
      if (tag === 'sc-if') return walkIf(node, scope, depth);
      if (tag === 'sc-helmet') { helmet = node; return ''; }
      if (tag === 'dc-import') return walkImport(node, scope, depth);
      return walkElement(node, scope, depth);
    }
    let loopN = 0;
    function walkFor(el, scope, depth) {
      const list = compileAttr(el.getAttribute('list') || '', scope); const as = el.getAttribute('as') || 'item'; const idx = 'i' + (loopN++);
      const sub = { vars: new Set([...scope.vars, as]), indexVar: idx };
      const listCode = list.kind === 'static' ? JSON.stringify(list.value) : list.code;
      return ind(depth) + '{(Array.isArray(' + listCode + ') ? ' + listCode + ' : []).map((' + as + ', ' + idx + ') => (\n' + ind(depth + 1) + '<React.Fragment key={' + idx + '}>\n' + walkChildren(el, sub, depth + 2) + ind(depth + 1) + '</React.Fragment>\n' + ind(depth) + '))}\n';
    }
    function walkIf(el, scope, depth) {
      const val = compileAttr(el.getAttribute('value') || '', scope); const cond = val.kind === 'static' ? JSON.stringify(val.value) : val.code;
      return ind(depth) + '{' + cond + ' ? (\n' + ind(depth + 1) + '<>\n' + walkChildren(el, scope, depth + 2) + ind(depth + 1) + '</>\n' + ind(depth) + ') : null}\n';
    }
    function attrValueCode(key, a) {
      if (a.kind === 'static') return /^[^"\n\\{}]*$/.test(a.value) ? '"' + a.value + '"' : '{' + JSON.stringify(a.value) + '}';
      if (key === 'value') return '{' + a.code + ' ?? ""}'; if (key === 'checked') return '{' + a.code + ' ?? false}'; return '{' + a.code + '}';
    }
    function walkImport(el, scope, depth) {
      const name = el.getAttribute('name') || el.getAttribute('component') || ''; const comp = imports[name];
      if (!comp) return ind(depth) + '{/* dc-import ' + name + ' not configured */}\n';
      usedImports.add(name); const props = [];
      for (const { name: an, value } of [...el.attributes]) {
        if (an === 'name' || an === 'component' || an === 'hint-size' || an === 'data-dc-tpl') continue;
        let key = an; if (key.startsWith(CAMEL)) key = kebabToCamel(key.slice(CAMEL.length)); if (key.includes('-') && !key.startsWith('aria-') && !key.startsWith('data-')) key = kebabToCamel(key);
        props.push(key + '=' + attrValueCode(key, compileAttr(value, scope)));
      }
      const kids = el.childNodes.length ? walkChildren(el, scope, depth + 1) : '';
      return ind(depth) + '<' + name + (props.length ? ' ' + props.join(' ') : '') + (kids.trim() ? '>\n' + kids + ind(depth) + '</' + name + '>\n' : ' />\n');
    }
    function walkElement(el, scope, depth) {
      const tag = RAW_UNWRAP[el.localName] || el.localName; const props = []; const pseudo = [];
      for (const { name, value } of [...el.attributes]) {
        if (name === 'sc-name' || name === 'data-dc-tpl' || name === 'hint-size') continue;
        let key = name; if (key.startsWith(CAMEL)) key = kebabToCamel(key.slice(CAMEL.length));
        if (key.startsWith('style-')) { pseudo.push(pseudoClass(key.slice(6), value)); continue; }
        if (key === 'class') key = 'className'; else if (key === 'for') key = 'htmlFor';
        else if (key.startsWith('on')) key = EVENT_MAP[key] || 'on' + key[2].toUpperCase() + key.slice(3);
        else if (HTML_ATTR[key]) key = HTML_ATTR[key];
        else if (key.includes('-') && !key.startsWith('data-') && !key.startsWith('aria-') && !key.startsWith('xmlns')) key = kebabToCamel(key);
        if (key === 'style') { const a = compileAttr(value, scope); props.push('style=' + (a.kind === 'expr' ? '{sx(' + a.code + ')}' : '{' + styleObjCode(value, scope) + '}')); continue; }
        props.push(key + '=' + attrValueCode(key, compileAttr(value, scope)));
      }
      if (pseudo.length) { const ci = props.findIndex(p => p.startsWith('className=')); if (ci >= 0) { const m = props[ci].match(/^className="([^"]*)"$/); if (m) props[ci] = 'className="' + (m[1] + ' ' + pseudo.join(' ')).trim() + '"'; else props[ci] = 'className={[' + props[ci].slice(10).replace(/^\{|\}$/g, '') + ', ' + JSON.stringify(pseudo.join(' ')) + '].filter(Boolean).join(" ")}'; } else props.push('className="' + pseudo.join(' ') + '"'); }
      const openTag = '<' + tag + (props.length ? ' ' + props.join(' ') : '');
      if (VOID.has(tag) || !el.childNodes.length) return ind(depth) + openTag + ' />\n';
      if (tag === 'textarea' && props.some(p => p.startsWith('value='))) return ind(depth) + openTag + ' />\n';
      const kids = walkChildren(el, scope, depth + 1); if (!kids.trim()) return ind(depth) + openTag + ' />\n';
      return ind(depth) + openTag + '>\n' + kids + ind(depth) + '</' + tag + '>\n';
    }
    const tpl = document.createElement('template'); tpl.innerHTML = encodeCase(template);
    const jsx = walkChildren(tpl.content, { vars: new Set(), indexVar: null }, 3);
    let helmetStyle = '', helmetLinks = [], helmetScripts = [], helmetDynamic = false;
    if (helmet) {
      for (const c of [...helmet.children]) {
        const t = c.tagName.toLowerCase();
        if (t === 'style') helmetStyle += c.textContent + '\n';
        else if (t === 'link') helmetLinks.push(c.outerHTML);
        else if (t === 'script') helmetScripts.push(c.getAttribute('src') || '');
      }
      helmetDynamic = helmetStyle.includes('{{');
    }
    let helmetCode = null;
    if (helmetDynamic) helmetCode = '`' + helmetStyle.split(/\{\{([\s\S]+?)\}\}/g).map((p, i) => i & 1 ? '${' + compileExpr(p, { vars: new Set(), indexVar: null }) + ' ?? ""}' : tplEsc(p)).join('') + '`';
    return { jsx, pseudoCss: pseudoRules.join('\n'), helmetStyle, helmetLinks, helmetScripts, helmetDynamic, helmetCode, usedImports: [...usedImports] };
  }, { template, imports: pg.imports || {}, clsPrefix: 'sc' + pg.name[0] });

  const dir = path.join(root, 'src', 'pages', pg.name); fs.mkdirSync(dir, { recursive: true });
  const imports = (out.usedImports || []).map(n => `import ${n} from '../${pg.imports[n]}/index.jsx';`).join('\n');
  const helmetJsx = out.helmetDynamic ? `      <style dangerouslySetInnerHTML={{ __html: ${out.helmetCode} }} />\n` : '';
  fs.writeFileSync(path.join(dir, 'App.jsx'), `// GENERATED by tools/convert-template.mjs from ${pg.file}. Do not edit; edit the design file and re-run.
/* eslint-disable */
import React from 'react';
import { sx } from '../../dc.js';
${imports}

export default function render(v) {
  return (
    <>
${helmetJsx}${out.jsx}    </>
  );
}
`);
  fs.writeFileSync(path.join(dir, 'pseudo.css'), '/* GENERATED: style-hover / style-focus rules from ' + pg.file + ' */\n' + out.pseudoCss + '\n');
  if (!out.helmetDynamic && out.helmetStyle.trim()) fs.writeFileSync(path.join(dir, 'helmet.css'), '/* GENERATED: <helmet> styles from ' + pg.file + ' */\n' + out.helmetStyle.trim() + '\n');
  // logic
  let logic = script.trim();
  const applied = [];
  for (const [desc, find, rep, o] of PATCHES) {
    if (o.pages && !o.pages.includes(pg.name)) continue;
    const before = logic; logic = typeof find === 'string' ? logic.split(find).join(rep) : logic.replace(find, rep);
    if (logic !== before) applied.push(desc);
  }
  if (logic) fs.writeFileSync(path.join(dir, 'logic.js'), `// Logic for the ${pg.name} page, carried over from ${pg.file} with the runtime base
// class swapped for the shim in src/dc.js.${applied.length ? ' Patches applied by the converter: ' + applied.join('; ') + '.' : ''}
/* eslint-disable */
import React from 'react';
import { DCLogic } from '../../dc.js';

${logic}

export default Component;
`);
  // settings from data-props (defaults), with routes mapped
  const settings = {}; for (const [k, p] of Object.entries(props)) { if (k.startsWith('$')) continue; let d = p.default; if (typeof d === 'string' && ROUTES[d]) d = ROUTES[d]; settings[k] = d; }
  fs.writeFileSync(path.join(dir, 'settings.js'), `// Defaults from the design's property panel for ${pg.file}.\nexport const SETTINGS = ${JSON.stringify(settings, null, 2)};\n`);
  // index.jsx: the component (for dc-import) or the page root
  fs.writeFileSync(path.join(dir, 'index.jsx'), `import { createHost } from '../../dc.js';
import render from './App.jsx';
${logic ? "import Component from './logic.js';" : "import { DCLogic } from '../../dc.js';\nconst Component = DCLogic;"}
import './pseudo.css';
${!out.helmetDynamic && out.helmetStyle.trim() ? "import './helmet.css';" : ''}
export default createHost(Component, render);
`);
  console.log(`${pg.name}: App.jsx ${(fs.statSync(path.join(dir, 'App.jsx')).size / 1024).toFixed(0)} KB, logic ${(logic.length / 1024).toFixed(0)} KB, pseudo rules ${out.pseudoCss.split('\n').filter(Boolean).length}, helmet ${out.helmetDynamic ? 'dynamic' : 'static'}; links: ${out.helmetLinks.length}, scripts: ${out.helmetScripts.join(', ') || '-'}${applied.length ? '; patches: ' + applied.length : ''}`);
  return out;
}

// components first so pages can import them
const order = [...cfg.pages.filter(p => p.component), ...cfg.pages.filter(p => !p.component)];
for (const pg of order) await convert(pg);
await browser.close();
