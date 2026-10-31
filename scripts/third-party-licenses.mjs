// Collect the licenses of everything bundled into the static site, so the deployed copy carries
// the notices MIT and the SIL Open Font License require. OpenSCAD's GPL notice ships separately
// in openscad/ (see apps/web/public/openscad/NOTICE.md).
import { readFile, readdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const BUNDLED = ['svelte', 'three', 'fflate', '@fontsource-variable/archivo', 'daisyui', 'tailwindcss'];

const sections = [];
for (const name of BUNDLED) {
  const dir = new URL(`node_modules/${name}/`, root);
  const pkg = JSON.parse(await readFile(new URL('package.json', dir), 'utf8'));
  const file = (await readdir(dir)).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
  if (!file) throw new Error(`${name}: no license file found`);
  const text = (await readFile(new URL(file, dir), 'utf8')).trim();
  sections.push(`${name} ${pkg.version} (${pkg.license})\n${'-'.repeat(60)}\n${text}`);
}
const header = `Ridekay Trackball is free software under the GNU General Public License,
version 3 or later (see LICENSE in the source repository).

The site bundles the following third-party components. The OpenSCAD
WebAssembly runtime is GPL-2.0-or-later; see openscad/COPYING and
openscad/NOTICE.md.
`;
await writeFile(
  new URL('apps/web/public/THIRD_PARTY_LICENSES.txt', root),
  `${header}\n${'='.repeat(60)}\n\n${sections.join(`\n\n${'='.repeat(60)}\n\n`)}\n`,
);
console.log(`Third-party licenses: ${BUNDLED.length} components`);
