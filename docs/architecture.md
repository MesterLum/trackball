# Architecture

The configurator is a static site: everything, including the CAD kernel, runs in the
visitor's browser. There is no server.

## Packages

| Location | Responsibility |
| --- | --- |
| `packages/core/src/config/` | Option registry, defaults, coercion, auto fit and presets |
| `packages/core/src/calculations/` | Dimensions, board envelopes, positioning, validation, power switch and clamp placement, parts list |
| `packages/core/src/geometry/` | Parametric geometry for each part and assembly |
| `packages/core/src/scad/` | Immutable OpenSCAD syntax tree and serializer |
| `packages/renderer-browser/` | WASM worker, cancellation, progress and bounded STL cache |
| `apps/web/` | Svelte controls, Three.js viewer, sharing and downloads |
| `tests/unit/` | Calculation, geometry, i18n and coverage tests (Vitest) |
| `tests/browser/` | Production-site tests in Chromium (Playwright) |
| `tests/fixtures/` | Dimension and SCAD references from the Python checkpoint `1ed1441` |

## The core

`@trackball/core` builds as an independent ESM package with TypeScript declarations. It
imports no DOM, Svelte or browser renderer, so a future CLI can reuse its calculations and
SCAD output with its own rendering adapter:

```ts
import { autofit, createDesign, generateParts } from '@trackball/core';

const fitted = autofit({ ball: 44, mcu: 'xiao', usb_type: 'usb-c' });
const design = createDesign(fitted.values);
const problems = design.validate();
if (problems.length) throw new Error(problems.join('\n'));
for (const part of generateParts(design)) {
  console.log(part.name, part.scad);
}
```

Every option lives in one registry, `packages/core/src/config/options-data.json`; the form,
shared links, validation and auto fit all read it. Add new options there, with a Spanish
translation in `packages/core/src/es.json` (a unit test fails when one is missing).

Validation never enlarges the body silently: a fit problem states what is wrong and, where
it can, the smallest fix (usually padding). Auto fit applies those fixes and the UI lists
every change.

## Rendering

The browser renders with the official OpenSCAD WebAssembly build (Manifold backend) in a
dedicated worker. `scripts/setup-wasm.mjs` downloads the version pinned in
`scripts/openscad.lock.json` and verifies its SHA-256 checksum. The renderer cancels
superseded work, renders parts one at a time and keeps an STL cache of at most 48 MiB. The
preview and the STL download use the same curve smoothness, so a download reuses the
preview's parts.

Tests render with the official Node build of the same runtime; no system OpenSCAD is
needed.

## Outputs

- **STL download:** printable parts, plus `design.json`, a summary and the parts list.
- **SCAD download:** the same parts as OpenSCAD source, plus assembly, section and hardware
  placement views.
- Cup and lid export in their flat print frame; the base and palm rest export floor down.
  A fused rest is part of `tray.stl`; anchored mode adds `palm_key.stl`; controllers
  without mounting holes add `mcu_clamp.stl`.

## Preset thumbnails

Thumbnails are not committed. `just presets` renders each preset with the site's own viewer
(`?thumbnail` mode) into `apps/web/public/presets/` and `dist/presets/`, and CI regenerates
them on every build, so they always match the current geometry. A preset that no longer
fits fails the build.

## Regression fixtures

`tests/fixtures/` holds dimensions and SCAD from the Python checkpoint. The parity tests
run with `tests/unit/checkpoint.ts`, which sets options added since then to reproduce the
old behaviour. Rows marked `rebaselined` follow deliberate changes that have no such
setting; each says why.

## Translations

English and Spanish messages live in `packages/core/src/es.json`. The language selector
updates the controls and the calculated messages.
