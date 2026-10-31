// Render one thumbnail per preset with the built site's own viewer and OpenSCAD WASM.
// Images go to apps/web/public/presets (for the dev server) and dist/presets (the deployed site).
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, access, readdir, rm } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const root = new URL('../', import.meta.url);
const base = process.env.BASE_PATH || '/';
const port = 4174;
const origin = `http://127.0.0.1:${port}${base}`;
const presets = JSON.parse(await readFile(new URL('packages/core/src/config/presets.json', root), 'utf8'));
const targets = [new URL('apps/web/public/presets/', root), new URL('dist/presets/', root)];

await access(new URL('dist/index.html', root)).catch(() => {
  throw new Error('Build the site first (just build).');
});
for (const dir of targets) {
  await mkdir(dir, { recursive: true });
  // Drop thumbnails of presets that were renamed or removed.
  const keep = new Set(presets.map((p) => `${p.key}.webp`));
  for (const name of await readdir(dir))
    if (name.endsWith('.webp') && !keep.has(name)) await rm(new URL(name, dir));
}

const server = spawn(
  process.execPath,
  [
    new URL('node_modules/vite/bin/vite.js', root).pathname,
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ],
  { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] },
);
let exited = false;
server.on('exit', () => (exited = true));
const serving = () =>
  fetch(origin).then(
    (r) => r.ok,
    () => false,
  );
try {
  for (let attempt = 0; !(await serving()); attempt++) {
    if (exited) throw new Error('vite preview exited before serving the site');
    if (attempt > 100) throw new Error(`vite preview did not answer at ${origin}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const browser = await chromium.launch({
    args: process.env.CI ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  for (const preset of presets) {
    const query = new URLSearchParams({ thumbnail: '', ...preset.values });
    await page.goto(`${origin}?${query}`);
    try {
      await page.waitForSelector('html[data-framed]', { timeout: 120000 });
    } catch {
      throw new Error(`${preset.key}: the preset did not render (does it still fit?)`);
    }
    // Crop to the drawn pixels so every thumbnail frames its model the same way.
    const data = await page.evaluate(() => {
      const source = document.querySelector('canvas');
      const copy = Object.assign(document.createElement('canvas'), {
        width: source.width,
        height: source.height,
      });
      const context = copy.getContext('2d');
      context.drawImage(source, 0, 0);
      const { data: pixels, width, height } = context.getImageData(0, 0, copy.width, copy.height);
      let [x0, y0, x1, y1] = [width, height, 0, 0];
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
          if (pixels[(y * width + x) * 4 + 3] > 8) {
            x0 = Math.min(x0, x);
            y0 = Math.min(y0, y);
            x1 = Math.max(x1, x);
            y1 = Math.max(y1, y);
          }
      if (x1 <= x0) throw new Error('empty render');
      const out = Object.assign(document.createElement('canvas'), { width: 640, height: 400 });
      const scale = Math.min((640 * 0.88) / (x1 - x0), (400 * 0.88) / (y1 - y0));
      const [w, h] = [(x1 - x0) * scale, (y1 - y0) * scale];
      out.getContext('2d').drawImage(copy, x0, y0, x1 - x0, y1 - y0, (640 - w) / 2, (400 - h) / 2, w, h);
      return out.toDataURL('image/webp', 0.9);
    });
    const bytes = Buffer.from(data.split(',')[1], 'base64');
    for (const dir of targets) await writeFile(new URL(`${preset.key}.webp`, dir), bytes);
    console.log(`${preset.key}.webp ${Math.round(bytes.byteLength / 1024)} KiB`);
  }
  await browser.close();
} finally {
  server.kill();
}
