// Optional maintenance helper: download the UI fonts from Google Fonts once.
// The game itself serves only local assets and makes no external network requests.
import { mkdir, writeFile } from 'node:fs/promises';
const directory = new URL('../public/fonts/', import.meta.url);
await mkdir(directory, { recursive: true });
const url = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=DM+Sans:wght@400..700&family=IBM+Plex+Mono:wght@400;500;600&display=swap';
const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' } });
if (!response.ok) throw new Error(`Font CSS: ${response.status}`);
const css = await response.text();
const blocks = [...css.matchAll(/\/\* (latin(?:-ext)?) \*\/\s*(@font-face\s*\{[\s\S]*?\})/g)];
const downloaded = new Map();
let output = '/* Self-hosted Google Fonts: Barlow Condensed, DM Sans, IBM Plex Mono. */\n';
for (const [, subset, block] of blocks) {
  const remote = block.match(/url\((https:[^)]+)\)/)?.[1];
  if (!remote) continue;
  let filename = downloaded.get(remote);
  if (!filename) {
    filename = `orbital-${downloaded.size + 1}.woff2`;
    const font = await fetch(remote);
    if (!font.ok) throw new Error(`Font download: ${font.status}`);
    await writeFile(new URL(filename, directory), Buffer.from(await font.arrayBuffer()));
    downloaded.set(remote, filename);
  }
  output += `/* ${subset} */\n${block.replace(remote, `/fonts/${filename}`)}\n`;
}
if (!downloaded.size) throw new Error('No font files found');
await writeFile(new URL('fonts.css', directory), output);
console.log(`Self-hosted ${downloaded.size} font files.`);
for (const family of ['barlowcondensed', 'dmsans', 'ibmplexmono']) {
  const license = await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`);
  if (!license.ok) throw new Error(`Font license ${family}: ${license.status}`);
  await writeFile(new URL(`${family}-OFL.txt`, directory), await license.text());
}
