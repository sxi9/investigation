// Converts the Claude Design export ("Investigation Board.dc.html") into
// src/App.jsx + src/pseudo.css + src/helmet.css.
//
// The design file uses a small template dialect on top of HTML:
//   {{ path }}            value lookup against the logic class's renderVals()
//   <sc-if value="…">     conditional block
//   <sc-for list="…" as=> loop (adds the loop var and $index to scope)
//   style-hover / style-focus  pseudo-class styles (compiled to !important rules)
//   camelCase attributes   (onClick, onPointerDown, tabIndex, …)
// This script reproduces those semantics as plain JSX so the page runs on
// stock React without the design runtime.
//
// Usage: node tools/convert-template.mjs "design/Investigation Board.dc.html"

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const src = process.argv[2];
if (!src) { console.error('usage: node tools/convert-template.mjs <file.dc.html>'); process.exit(1); }
const html = fs.readFileSync(src, 'utf8');
const open = html.indexOf('<x-dc>'), close = html.lastIndexOf('</x-dc>');
if (open < 0 || close < 0) throw new Error('no <x-dc> block');
const template = html.slice(open + 6, close);

const browser = await chromium.launch();
const page = await browser.newPage();
const out = await page.evaluate((template) => {
  // ---------- pre-encoding (mirrors the runtime) ----------
  const CAMEL = 'sc-camel-';
  const RAW_WRAP = { select: 'sc-raw-select', table: 'sc-raw-table', tbody: 'sc-raw-tbody', thead: 'sc-raw-thead', tfoot: 'sc-raw-tfoot', tr: 'sc-raw-tr', td: 'sc-raw-td', th: 'sc-raw-th', caption: 'sc-raw-caption' };
  const RAW_UNWRAP = Object.fromEntries(Object.entries(RAW_WRAP).map(([k, v]) => [v, k]));
  const EVENT_MAP = { onclick: 'onClick', onchange: 'onChange', oninput: 'onInput', onsubmit: 'onSubmit', onkeydown: 'onKeyDown', onkeyup: 'onKeyUp', onkeypress: 'onKeyPress', onmousedown: 'onMouseDown', onmouseup: 'onMouseUp', onmouseenter: 'onMouseEnter', onmouseleave: 'onMouseLeave', onfocus: 'onFocus', onblur: 'onBlur', ondoubleclick: 'onDoubleClick', oncontextmenu: 'onContextMenu', onmousemove: 'onMouseMove', onmouseover: 'onMouseOver', onmouseout: 'onMouseOut', onpointerdown: 'onPointerDown', onpointerup: 'onPointerUp', onpointermove: 'onPointerMove', onpointerenter: 'onPointerEnter', onpointerleave: 'onPointerLeave', onpointercancel: 'onPointerCancel', onpointerover: 'onPointerOver', onpointerout: 'onPointerOut', ongotpointercapture: 'onGotPointerCapture', onlostpointercapture: 'onLostPointerCapture', ontouchstart: 'onTouchStart', ontouchend: 'onTouchEnd', ontouchmove: 'onTouchMove', ontouchcancel: 'onTouchCancel', ondragstart: 'onDragStart', ondragend: 'onDragEnd', ondragenter: 'onDragEnter', ondragleave: 'onDragLeave', ondragover: 'onDragOver', onanimationstart: 'onAnimationStart', onanimationend: 'onAnimationEnd', onanimationiteration: 'onAnimationIteration', ontransitionend: 'onTransitionEnd' };
  const HTML_ATTR = { spellcheck: 'spellCheck', autocomplete: 'autoComplete', tabindex: 'tabIndex', readonly: 'readOnly', maxlength: 'maxLength', minlength: 'minLength', autofocus: 'autoFocus', crossorigin: 'crossOrigin', enctype: 'encType', contenteditable: 'contentEditable', srcset: 'srcSet', novalidate: 'noValidate', colspan: 'colSpan', rowspan: 'rowSpan', datetime: 'dateTime', accesskey: 'accessKey', 'accept-charset': 'acceptCharset', 'http-equiv': 'httpEquiv' };
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
  function stripComments(css) { return css.replace(/\/\*[\s\S]*?\*\//g, ''); }
  function importantify(css) {
    css = stripComments(css); const decls = []; let start = 0, depth = 0, quote = '';
    for (let i = 0; i < css.length; i++) {
      const c = css[i];
      if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; }
      else if (c === "'" || c === '"') quote = c;
      else if (c === '(') depth++;
      else if (c === ')') depth = Math.max(0, depth - 1);
      else if (c === ';' && depth === 0) { decls.push(css.slice(start, i)); start = i + 1; }
    }
    decls.push(css.slice(start));
    return decls.map(d => d.trim()).filter(Boolean).map(d => /!\s*important$/i.test(d) ? d : d + ' !important').join(';');
  }
  function pseudoClass(pseudo, css) {
    const k = pseudo + '|' + css; if (pseudoCache.has(k)) return pseudoCache.get(k);
    const cls = 'scp' + (pn++).toString(36);
    const pe = pseudo === 'before' || pseudo === 'after';
    pseudoRules.push('.' + cls + (pe ? '::' : ':') + pseudo + '{' + (pe ? css : importantify(css)) + '}');
    pseudoCache.set(k, cls); return cls;
  }

  // ---------- expressions ----------
  const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*/, NUMBER_RE = /^-?\d+(\.\d+)?$/;
  function parensWrapWhole(e) { let d = 0; for (let i = 0; i < e.length - 1; i++) { if (e[i] === '(') d++; else if (e[i] === ')') { d--; if (d === 0) return false; } } return true; }
  function findEq(e) {
    let d = 0;
    for (let i = 0; i < e.length; i++) {
      const c = e[i];
      if (c === '[' || c === '(') d++; else if (c === ']' || c === ')') d--;
      else if (d === 0 && (c === '=' || c === '!') && e[i + 1] === '=') {
        if (i > 0 && (e[i - 1] === '=' || e[i - 1] === '!')) continue;
        if (!e.slice(0, i).trim()) continue;
        return { index: i, op: e[i + 2] === '=' ? c + '==' : c + '=' };
      }
    }
    return null;
  }
  function compileExpr(srcExpr, scope) {
    const e = String(srcExpr).trim();
    if (!e) return 'undefined';
    if (e[0] === '(' && e[e.length - 1] === ')' && parensWrapWhole(e)) return compileExpr(e.slice(1, -1), scope);
    const eq = findEq(e);
    if (eq) return '(' + compileExpr(e.slice(0, eq.index), scope) + ' ' + eq.op + ' ' + compileExpr(e.slice(eq.index + eq.op.length), scope) + ')';
    if (e[0] === '!') return '!' + compileExpr(e.slice(1), scope);
    if (e === 'true' || e === 'false' || e === 'null' || e === 'undefined' || NUMBER_RE.test(e)) return e;
    if (e.length >= 2 && (e[0] === '"' || e[0] === "'") && e[e.length - 1] === e[0]) return JSON.stringify(e.slice(1, -1));
    return compilePath(e, scope);
  }
  function compilePath(e, scope) {
    const head = e.match(IDENT_RE); if (!head) return 'undefined';
    const name = head[0];
    let code = name === '$index' ? (scope.indexVar || 'undefined') : scope.vars.has(name) ? name : 'v.' + name;
    let i = name.length;
    while (i < e.length) {
      if (e[i] === '.') {
        const m = e.slice(i + 1).match(IDENT_RE) || e.slice(i + 1).match(/^\d+/); if (!m) return 'undefined';
        code += /^\d/.test(m[0]) ? '?.[' + m[0] + ']' : '?.' + m[0]; i += 1 + m[0].length;
      } else if (e[i] === '[') {
        let d = 1, j = i + 1;
        while (j < e.length && d > 0) { if (e[j] === '[') d++; else if (e[j] === ']') { d--; if (d === 0) break; } j++; }
        if (d !== 0) return 'undefined';
        code += '?.[' + compileExpr(e.slice(i + 1, j), scope) + ']'; i = j + 1;
      } else return 'undefined';
    }
    return code;
  }
  const tplEsc = s => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  // returns {kind:'static',value} | {kind:'expr',code} | {kind:'tpl',code}
  function compileAttr(raw, scope) {
    const whole = raw.match(/^\s*\{\{([\s\S]+?)\}\}\s*$/);
    if (whole) return { kind: 'expr', code: compileExpr(whole[1], scope) };
    if (raw.includes('{{')) {
      const parts = raw.split(/\{\{([\s\S]+?)\}\}/g);
      return { kind: 'tpl', code: '`' + parts.map((p, i) => i & 1 ? '${' + compileExpr(p, scope) + ' ?? ""}' : tplEsc(p)).join('') + '`' };
    }
    return { kind: 'static', value: raw };
  }

  // ---------- style ----------
  const propKey = p => p.startsWith('--') ? JSON.stringify(p) : (/^[A-Za-z_$][\w$]*$/.test(kebabToCamel(p)) ? kebabToCamel(p) : JSON.stringify(kebabToCamel(p)));
  function styleObjCode(raw, scope) {
    // Same naive split as the runtime's cssToObj: ";" then first ":".
    const entries = new Map();
    for (const decl of raw.split(';')) {
      const i = decl.indexOf(':'); if (i < 0) continue;
      const prop = decl.slice(0, i).trim(); const val = decl.slice(i + 1).trim();
      if (!prop) continue;
      let code;
      if (val.includes('{{')) {
        const parts = val.split(/\{\{([\s\S]+?)\}\}/g);
        code = '`' + parts.map((p, k) => k & 1 ? '${' + compileExpr(p, scope) + ' ?? ""}' : tplEsc(p)).join('') + '`';
      } else code = JSON.stringify(val);
      entries.delete(propKey(prop)); entries.set(propKey(prop), code);
    }
    return '{' + [...entries].map(([k, c]) => k + ': ' + c).join(', ') + '}';
  }

  // ---------- walker ----------
  const warnings = [];
  const ind = n => '  '.repeat(n);
  const jsxText = s => '{' + JSON.stringify(s) + '}';

  function walkText(node, scope, depth) {
    const txt = node.nodeValue ?? '';
    if (!txt.includes('{{')) {
      if (!txt.trim() && !txt.includes(' ')) return '';
      return ind(depth) + jsxText(txt) + '\n';
    }
    const parts = txt.split(/\{\{([\s\S]+?)\}\}/g);
    return ind(depth) + parts.map((p, i) => i & 1 ? '{' + compileExpr(p, scope) + '}' : (p ? jsxText(p) : '')).join('') + '\n';
  }
  function walkChildren(node, scope, depth) { return [...node.childNodes].map(c => walk(c, scope, depth)).join(''); }
  function walk(node, scope, depth) {
    if (node.nodeType === Node.TEXT_NODE) return walkText(node, scope, depth);
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    if (tag === 'sc-for') return walkFor(node, scope, depth);
    if (tag === 'sc-if') return walkIf(node, scope, depth);
    if (tag === 'sc-helmet') { helmet = node; return ''; }
    return walkElement(node, scope, depth);
  }
  let loopN = 0;
  function walkFor(el, scope, depth) {
    const list = compileAttr(el.getAttribute('list') || '', scope);
    const as = el.getAttribute('as') || 'item';
    const idx = 'i' + (loopN++);
    const sub = { vars: new Set([...scope.vars, as]), indexVar: idx };
    const listCode = list.kind === 'expr' ? list.code : list.kind === 'tpl' ? list.code : JSON.stringify(list.value);
    return ind(depth) + '{(Array.isArray(' + listCode + ') ? ' + listCode + ' : []).map((' + as + ', ' + idx + ') => (\n' +
      ind(depth + 1) + '<React.Fragment key={' + idx + '}>\n' + walkChildren(el, sub, depth + 2) + ind(depth + 1) + '</React.Fragment>\n' + ind(depth) + '))}\n';
  }
  function walkIf(el, scope, depth) {
    const val = compileAttr(el.getAttribute('value') || '', scope);
    const cond = val.kind === 'static' ? JSON.stringify(val.value) : val.code;
    return ind(depth) + '{' + cond + ' ? (\n' + ind(depth + 1) + '<>\n' + walkChildren(el, scope, depth + 2) + ind(depth + 1) + '</>\n' + ind(depth) + ') : null}\n';
  }
  function attrValueCode(key, a) {
    if (a.kind === 'static') return /^[^"\n\\{}]*$/.test(a.value) ? '"' + a.value + '"' : '{' + JSON.stringify(a.value) + '}';
    if (key === 'value') return '{' + a.code + ' ?? ""}';
    if (key === 'checked') return '{' + a.code + ' ?? false}';
    return '{' + a.code + '}';
  }
  function walkElement(el, scope, depth) {
    const tag = RAW_UNWRAP[el.localName] || el.localName;
    const props = []; const pseudo = [];
    for (const { name, value } of [...el.attributes]) {
      if (name === 'sc-name' || name === 'data-dc-tpl' || name === 'hint-size') continue;
      let key = name;
      if (key.startsWith(CAMEL)) key = kebabToCamel(key.slice(CAMEL.length));
      if (key.startsWith('style-')) { pseudo.push(pseudoClass(key.slice(6), value)); continue; }
      if (key === 'class') key = 'className';
      else if (key === 'for') key = 'htmlFor';
      else if (key.startsWith('on')) key = EVENT_MAP[key] || 'on' + key[2].toUpperCase() + key.slice(3);
      else if (HTML_ATTR[key]) key = HTML_ATTR[key];
      else if (key.includes('-') && !key.startsWith('data-') && !key.startsWith('aria-') && !key.startsWith('xmlns')) key = kebabToCamel(key);
      if (key === 'style') {
        const a = compileAttr(value, scope);
        props.push('style=' + (a.kind === 'expr' ? '{sx(' + a.code + ')}' : '{' + styleObjCode(value, scope) + '}'));
        continue;
      }
      props.push(key + '=' + attrValueCode(key, compileAttr(value, scope)));
    }
    if (pseudo.length) {
      const ci = props.findIndex(p => p.startsWith('className='));
      if (ci >= 0) { const m = props[ci].match(/^className="([^"]*)"$/); if (m) props[ci] = 'className="' + (m[1] + ' ' + pseudo.join(' ')).trim() + '"'; else { props[ci] = 'className={[' + props[ci].slice(10).replace(/^\{|\}$/g, '') + ', ' + JSON.stringify(pseudo.join(' ')) + '].filter(Boolean).join(" ")}'; } }
      else props.push('className="' + pseudo.join(' ') + '"');
    }
    const openTag = '<' + tag + (props.length ? ' ' + props.join(' ') : '');
    if (VOID.has(tag) || (!el.childNodes.length)) return ind(depth) + openTag + ' />\n';
    const kids = walkChildren(el, scope, depth + 1);
    if (!kids.trim()) return ind(depth) + openTag + ' />\n';
    return ind(depth) + openTag + '>\n' + kids + ind(depth) + '</' + tag + '>\n';
  }

  let helmet = null;
  const tpl = document.createElement('template');
  tpl.innerHTML = encodeCase(template);
  const jsx = walkChildren(tpl.content, { vars: new Set(), indexVar: null }, 3);
  let helmetHtml = '';
  if (helmet) helmetHtml = helmet.innerHTML;
  return { jsx, pseudoCss: pseudoRules.join('\n'), helmetHtml, warnings };
}, template);
await browser.close();

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const srcDir = path.join(root, 'src');
fs.mkdirSync(srcDir, { recursive: true });

// helmet: <link> tags go to index.html by hand; <style> content to helmet.css
const styleMatch = out.helmetHtml.match(/<style>([\s\S]*?)<\/style>/i);
const helmetCss = styleMatch ? styleMatch[1].trim() : '';
const links = [...out.helmetHtml.matchAll(/<link[^>]*>/gi)].map(m => m[0]);

const app = `// GENERATED by tools/convert-template.mjs from design/Investigation Board.dc.html.
// Edit the design file and re-run the converter rather than editing this file.
/* eslint-disable */
import React from 'react';
import { sx } from './dc.js';

export default function renderBoard(v) {
  return (
    <>
${out.jsx}    </>
  );
}
`;
fs.writeFileSync(path.join(srcDir, 'App.jsx'), app);
fs.writeFileSync(path.join(srcDir, 'pseudo.css'), '/* GENERATED: style-hover / style-focus rules from the design file. */\n' + out.pseudoCss + '\n');
fs.writeFileSync(path.join(srcDir, 'helmet.css'), '/* GENERATED: <helmet> styles from the design file. */\n' + helmetCss + '\n');
console.log('wrote src/App.jsx (' + app.length + ' chars), src/pseudo.css (' + out.pseudoCss.split('\n').length + ' rules), src/helmet.css');
console.log('helmet links (add to index.html):'); links.forEach(l => console.log('  ' + l));
if (out.warnings.length) console.log('warnings:', out.warnings);
