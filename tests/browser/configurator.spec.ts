import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';

test('renders on a static host, edits hardware and exports printable parts', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'Ridekay Trackball' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Preview ready', { timeout: 120000 });
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Electronics' }).click();
  await page.getByLabel('controller', { exact: true }).selectOption('rp2040-zero');
  await page.getByLabel('USB connector', { exact: true }).selectOption('usb-c');
  await expect(page).toHaveURL(/mcu=rp2040-zero/);
  await page.getByRole('tab', { name: 'Deck' }).click();
  await page.getByRole('spinbutton', { name: 'palm rest length', exact: true }).fill('40');
  await page.getByLabel('palm-rest attachment', { exact: true }).selectOption('fused');
  await expect(page.getByRole('status')).not.toHaveText('Preview ready');
  await expect(page.getByRole('status')).toHaveText('Preview ready', { timeout: 120000 });
  const scadDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download SCAD', exact: true }).click();
  const scad = await scadDownload;
  const files = unzipSync(await readFile((await scad.path())!));
  expect(Object.keys(files)).toContain('tray.scad');
  expect(Object.keys(files)).not.toContain('palmrest.scad');
  expect(JSON.parse(strFromU8(files['design.json'])).usb_type).toBe('usb-c');
  const stlDownload = page.waitForEvent('download', { timeout: 120000 });
  await page.getByRole('button', { name: 'Download STLs', exact: true }).click();
  const stls = unzipSync(await readFile((await (await stlDownload).path())!));
  for (const name of ['cup', 'carrier', 'tray']) expect(stls[name + '.stl'].byteLength).toBeGreaterThan(84);
  expect(requests.some((url) => url.includes('/api/'))).toBe(false);
  expect(errors).toEqual([]);
  await expect(page.getByRole('status')).toHaveText('Download ready');
  await page.screenshot({ path: 'test-results/configurator.png', fullPage: true });
});

test('restores shared settings, reports invalid fit and supports Spanish', async ({ page }) => {
  await page.goto('./?mcu=xiao&usb_type=micro-usb&palm=40&palm_attachment=anchored&lang=es');
  await expect(page.getByText('Configura, previsualiza y descarga un trackball imprimible.')).toBeVisible();
  await page.getByLabel('Language', { exact: true }).selectOption('en');
  await page.getByLabel('Auto render', { exact: true }).uncheck();
  await page.getByLabel('Auto fit', { exact: true }).uncheck();
  await page.getByRole('tab', { name: 'Electronics' }).click();
  await expect(page.getByLabel('controller', { exact: true })).toHaveValue('xiao');
  await expect(page.getByLabel('USB connector', { exact: true })).toHaveValue('micro-usb');
  await page.getByRole('tab', { name: 'Body' }).click();
  await page.getByRole('spinbutton', { name: 'padding', exact: true }).fill('4');
  await expect(page.getByRole('alert')).toContainText('This configuration does not fit');
  await expect(page.getByRole('button', { name: 'Download STLs', exact: true })).toBeDisabled();
});

test('mobile layout keeps controls reachable without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await expect(page.getByRole('status')).toHaveText('Preview ready', { timeout: 120000 });
  await page.getByRole('tab', { name: 'Electronics' }).click();
  await page.getByLabel('controller', { exact: true }).selectOption('xiao');
  await expect(page).toHaveURL(/mcu=xiao/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});

test('renders only on request when auto render is off', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('status')).toHaveText('Preview ready', { timeout: 120000 });
  await expect(page.getByRole('button', { name: 'Render', exact: true })).toHaveCount(0);
  await page.getByLabel('Auto render', { exact: true }).uncheck();
  await page.getByRole('tab', { name: 'Body' }).click();
  await page.getByRole('spinbutton', { name: 'curve smoothness', exact: true }).fill('48');
  await expect(page.getByRole('status')).toHaveText('Changes not rendered yet');
  await page.getByRole('button', { name: 'Render', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Preview ready', { timeout: 120000 });
});

test('keeps valid shared settings when one value is invalid', async ({ page }) => {
  await page.goto('./?mcu=xiao&ball=3');
  await page.getByRole('tab', { name: 'Electronics' }).click();
  await expect(page.getByLabel('controller', { exact: true })).toHaveValue('xiao');
  await page.getByRole('tab', { name: 'Ball & cup' }).click();
  await expect(page.getByRole('spinbutton', { name: 'ball', exact: true })).toHaveValue('34');
});
