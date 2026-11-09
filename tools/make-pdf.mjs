// Renders a docs/*.md file (with its screenshots) to a PDF via headless Chromium.
// Usage: node tools/make-pdf.mjs docs/CASE-SAFEPAY.md [docs/CASE-SAFEPAY.pdf]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { marked } from 'marked';
const { chromium } = createRequire(import.meta.url)('playwright');

const src = process.argv[2]; if (!src) { console.error('usage: node tools/make-pdf.mjs <file.md> [out.pdf]'); process.exit(1); }
const out = process.argv[3] || src.replace(/\.md$/, '.pdf');
const md = fs.readFileSync(src, 'utf8');
const dir = path.dirname(path.resolve(src));
marked.setOptions({ gfm: true });
let body = marked.parse(md);
body = body.replace(/<details>/g, '<details open>'); // print the collapsed check list too
// inline images so the PDF does not depend on file paths
body = body.replace(/<img src="([^"]+)"/g, (m, p) => {
  const f = path.resolve(dir, decodeURIComponent(p)); if (!fs.existsSync(f)) return m;
  const ext = path.extname(f).slice(1).toLowerCase(); const mime = ext === 'svg' ? 'image/svg+xml' : 'image/' + (ext === 'jpg' ? 'jpeg' : ext);
  return `<img src="data:${mime};base64,${fs.readFileSync(f).toString('base64')}"`;
});
const title = (md.match(/^# (.+)$/m) || [, path.basename(src)])[1];
const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: A4; margin: 14mm 14mm 16mm 14mm; }
  body { font: 10.5pt/1.45 "Archivo Narrow", "Helvetica Neue", Arial, sans-serif; color: #1b1a17; }
  h1 { font-size: 22pt; margin: 0 0 6pt; letter-spacing: .01em; border-bottom: 3px solid #ff2a3c; padding-bottom: 6pt; }
  h2 { font-size: 15pt; margin: 18pt 0 6pt; color: #1b1a17; border-bottom: 1px solid #c9c4b8; padding-bottom: 3pt; }
  h3 { font-size: 12.5pt; margin: 0 0 6pt; color: #b4222a; letter-spacing: .04em; text-transform: uppercase; }
  h3 { break-before: page; page-break-before: always; padding-top: 2pt; }
  h2 + h3, h1 + h3 { break-before: auto; page-break-before: auto; }
  img { max-width: 100%; height: auto; display: block; margin: 4pt 0 8pt; border: 1px solid #c9c4b8; }
  p { margin: 4pt 0 6pt; orphans: 3; widows: 3; }
  ol, ul { margin: 2pt 0 8pt 16pt; padding: 0; } li { margin: 1pt 0; }
  table { border-collapse: collapse; width: 100%; font-size: 9pt; margin: 6pt 0 10pt; }
  th, td { border: 1px solid #c9c4b8; padding: 3pt 5pt; vertical-align: top; text-align: left; }
  th { background: #f3f1ea; }
  code { font: 9pt "IBM Plex Mono", Menlo, monospace; background: #f3f1ea; padding: 0 2pt; }
  a { color: #1f4e8c; text-decoration: none; }
  details summary { font-weight: 700; margin: 4pt 0; }
  .meta { color: #8d877b; font-size: 9pt; margin-bottom: 14pt; }
  blockquote { margin: 6pt 0; padding: 4pt 10pt; border-left: 3px solid #ff2a3c; color: #4e4a40; }
</style></head><body>
<div class="meta">Generated ${new Date().toISOString().slice(0, 10)} from ${path.relative(process.cwd(), src)} · Cyber Investigation Board</div>
${body}
</body></html>`;
const tmp = path.join(dir, '.pdf-tmp.html'); fs.writeFileSync(tmp, html);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + tmp, { waitUntil: 'load' });
await page.emulateMedia({ media: 'print' });
await page.pdf({ path: out, format: 'A4', printBackground: true, displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `<div style="width:100%;font:8px Arial,sans-serif;color:#8d877b;padding:0 14mm;display:flex;justify-content:space-between"><span>${title.replace(/</g, '&lt;')}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  margin: { top: '14mm', bottom: '16mm', left: '14mm', right: '14mm' } });
await browser.close(); fs.unlinkSync(tmp);
console.log('wrote ' + out + ' (' + (fs.statSync(out).size / 1e6).toFixed(1) + ' MB)');
