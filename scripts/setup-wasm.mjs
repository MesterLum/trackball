import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
const manifest = JSON.parse(await readFile(new URL('./openscad.lock.json', import.meta.url), 'utf8'));
const update = process.argv.includes('--update-lock');
async function fetchOk(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response;
}
for (const target of ['web', 'node']) {
  const entry = manifest[target];
  if (update) {
    const checksum = await (await fetchOk(entry.url + '.sha256')).text();
    entry.sha256 = checksum.match(/\b[a-fA-F0-9]{64}\b/)?.[0]?.toLowerCase();
  }
  if (!entry.sha256)
    throw new Error('Missing pinned checksum. Maintainers: run yarn setup:wasm --update-lock.');
  const dest =
    target === 'web'
      ? new URL('../apps/web/public/openscad/', import.meta.url)
      : new URL('../.cache/openscad-node/', import.meta.url);
  await mkdir(dest, { recursive: true });
  if (target === 'node') await writeFile(new URL('package.json', dest), '{"type":"commonjs"}\n');
  const marker = new URL('runtime.sha256', dest);
  try {
    if ((await readFile(marker, 'utf8')).trim() === entry.sha256) {
      await access(new URL('openscad.js', dest));
      if (target === 'web') await access(new URL('openscad.wasm', dest));
      console.log(`OpenSCAD ${target}: cached`);
      continue;
    }
  } catch {
    // No cached runtime yet: download it below.
  }
  const archive = new Uint8Array(await (await fetchOk(entry.url)).arrayBuffer());
  const actual = createHash('sha256').update(archive).digest('hex');
  if (actual !== entry.sha256) throw new Error(`OpenSCAD ${target}: checksum mismatch`);
  const files = unzipSync(archive);
  for (const basename of ['openscad.js', 'openscad.wasm']) {
    const name = Object.keys(files).find((name) => name.split('/').at(-1) === basename);
    if (!name) {
      if (target === 'node' && basename === 'openscad.wasm') continue;
      throw new Error(`OpenSCAD archive missing ${basename}`);
    }
    await writeFile(new URL(basename, dest), files[name]);
  }
  await writeFile(marker, entry.sha256 + '\n');
  console.log(`OpenSCAD ${target}: verified ${actual}`);
}
if (update)
  await writeFile(new URL('./openscad.lock.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n');
