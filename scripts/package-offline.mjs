import { readFile, writeFile } from 'node:fs/promises';
import { Script } from 'node:vm';
const root = new URL('../dist/', import.meta.url);
let html = await readFile(new URL('index.html', root), 'utf8');
const script = html.match(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/);
const styles = [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g)];
if (!script || !styles.length) throw new Error('Build assets were not found. Run vite build first.');
for (const match of styles) {
  let css = await readFile(new URL(match[1].replace(/^\//, ''), root), 'utf8');
  const urls = [...new Set([...css.matchAll(/url\(\s*['"]?(\/fonts\/[^)'"\s]+)['"]?\s*\)/g)].map(m => m[1]))];
  for (const url of urls) {
    const font = await readFile(new URL(url.replace(/^\//, ''), root));
    css = css.replaceAll(url, `data:font/woff2;base64,${font.toString('base64')}`);
  }
  html = html.replace(match[0], () => `<style>${css}</style>`);
}
const js = await readFile(new URL(script[1].replace(/^\//, ''), root), 'utf8');
// Inline module scripts work on file:// as long as there are no external imports.
if (/\bimport\s*\(/.test(js) || /\bfrom\s*["']\./.test(js)) throw new Error('Unexpected external JavaScript import in offline bundle');
html = html.replace(script[0], '');
html = html.replace('</body>', () => `<script type="module">${js.replaceAll('</script', '<\\/script')}</script>\n</body>`);
const favicon = await readFile(new URL('favicon.svg', root), 'utf8');
html = html.replace('href="/favicon.svg"', `href="data:image/svg+xml;base64,${Buffer.from(favicon).toString('base64')}"`);
const inline = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
if (inline !== js.replaceAll('</script', '<\\/script')) throw new Error('Offline JavaScript was changed while packaging');
new Script(inline, { filename: 'OrbitalConflict.html' });
if (/<(?:script|link)\b[^>]*(?:src|href)="(?:\/|https?:)/.test(html)) throw new Error('Offline build references an external asset');
await writeFile(new URL('OrbitalConflict.html', root), html);
console.log(`Offline game: dist/OrbitalConflict.html (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`);
