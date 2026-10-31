import { it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import es from '../../packages/core/src/es.json';
import { OPTIONS, PRESETS, TRANSLATED_CHOICES } from '../../packages/core/src/index';

const catalog = es as Record<string, string>;
const PLACEHOLDER = /\{[^{}]*\}/g;

function files(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path, pattern) : pattern.test(entry.name) ? [path] : [];
  });
}

/** String literals passed to _() in core and to t() in the Svelte app. */
function sourceMessages(): Set<string> {
  const ids = new Set<string>();
  const sources = [
    ...files('packages/core/src', /\.ts$/).map((f) => [f, /\b_\(\s*'((?:[^'\\]|\\.)*)'\s*[,)]/g] as const),
    ...files('apps/web/src', /\.svelte$/).map((f) => [f, /\bt\(\s*'((?:[^'\\]|\\.)*)'\s*[,)]/g] as const),
  ];
  for (const [file, pattern] of sources)
    for (const match of readFileSync(file, 'utf8').matchAll(pattern)) ids.add(match[1].replace(/\\'/g, "'"));
  for (const o of OPTIONS) {
    ids.add(o.label || o.name.replaceAll('_', ' '));
    ids.add(o.help);
    ids.add(o.group);
  }
  for (const o of OPTIONS)
    if (TRANSLATED_CHOICES.has(o.name))
      for (const choice of o.choices) ids.add(o.choice_labels?.[choice] ?? choice);
  for (const p of PRESETS) {
    ids.add(p.title);
    ids.add(p.blurb);
  }
  return ids;
}

it('translates every user-facing message into Spanish', () => {
  const missing = [...sourceMessages()].filter((id) => !catalog[id]).sort();
  expect(missing).toEqual([]);
});

it('keeps placeholders identical in translations', () => {
  for (const [id, text] of Object.entries(catalog))
    expect(new Set(text.match(PLACEHOLDER)), id).toEqual(new Set(id.match(PLACEHOLDER)));
});
