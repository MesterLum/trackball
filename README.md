# Ridekay Trackball

Customize a printable trackball around your ball, sensor PCB, controller and
switches. Preview the model, check its fit, and download SCAD or STL bundles.
MCU supports sit close to the USB wall; the opening follows the selected
Micro-USB or USB-C connector. Palm rests can be separate, anchored, or fused
into a tray with straight sides through the joint.

The application runs entirely in the browser: Svelte 5, TypeScript, Tailwind
CSS 4, daisyUI 5 and Three.js. OpenSCAD WebAssembly renders in a dedicated worker.
The production output is a static site suitable for GitHub Pages.

## Development

Use **Node.js 24 LTS** and **Yarn 4**. Nix pins the toolchain; direnv activates it
when you enter the directory:

```sh
direnv allow
just setup
just dev
```

Without direnv, enter `nix develop` first. If Nix is unavailable, install Node
24, enable the Yarn version declared in `package.json` using Corepack, and
install [just](https://just.systems/).

```sh
just          # list common commands
just setup    # install locked dependencies and verified OpenSCAD WASM
just dev      # Svelte development server with automatic updates
just check    # TypeScript and Svelte diagnostics
just test     # calculation and rendered-solid regression tests
just build    # produce dist/
just preview  # serve the production build locally
just browsers # install Chromium and Linux browser dependencies
just presets  # render the preset gallery thumbnails from the built site
just e2e      # test the production site in Chromium
just ci       # same setup and validation used by GitHub Actions
```

The first setup downloads the pinned runtime from official OpenSCAD archives
and verifies SHA-256 checksums. Subsequent runs reuse the local cache.
See [development environment details](docs/development.md).

## Shared calculations and geometry

| Location | Responsibility |
| --- | --- |
| `packages/core/src/config/` | Option registry, defaults, coercion, auto fit and presets |
| `packages/core/src/calculations/` | Dimensions, board envelopes, positioning, validation and BOM |
| `packages/core/src/geometry/` | Parametric geometry for each part and assembly |
| `packages/core/src/scad/` | Immutable OpenSCAD syntax tree and serializer |
| `packages/renderer-browser/` | WASM worker, cancellation, progress and bounded STL cache |
| `apps/web/` | Svelte controls, Three.js viewer, sharing and downloads |
| `tests/fixtures/` | Dimension and SCAD references from Python checkpoint `1ed1441`; rows marked `rebaselined` follow deliberate changes |

`@trackball/core` builds as an independent ESM package with TypeScript
declarations. It imports no DOM, Svelte or browser renderer. A future CLI can
reuse its calculations and SCAD output and choose its own rendering adapter:

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

The browser uses a separate WASM renderer. Tests use the official Node WASM
build to compare old and new solids; no system OpenSCAD installation is needed.
The previous Python application remains available in Git at `1ed1441`.

## Using the configurator

Options are grouped into ball/cup, buttons, electronics, body and deck.
Auto fit applies the smallest necessary adjustments and displays them.
Turn it off to inspect fit problems directly. Auto render can also be disabled.
Undo, redo, presets and shared URLs preserve the configuration.

The preview and the STL download use the same curve smoothness (`$fn`, under
Body), so the download reuses the rendered preview. STL exports include the
design, summary and BOM.
SCAD exports also include assembly, section and hardware placement views.
Cup and carrier export in their flat print frame; the tray and palm rest
export floor down. A fused rest is part of `tray.stl`; anchored mode includes
`palm_key.stl`. The viewer supports orbiting, part visibility, exploded views
and PNG snapshots.

Preset thumbnails are not committed: `just presets` renders them with the
site's own viewer into `apps/web/public/presets/` and `dist/presets/`, and CI
regenerates them on every build, so they always match the current geometry.
A preset that no longer fits fails the build.

English and Spanish messages live in `packages/core/src/es.json`. The language
selector updates both the controls and calculated messages. A unit test fails
when a user-facing string has no Spanish entry.

See [geometry, hardware and assembly notes](docs/geometry.md) for dimensional
assumptions, board references, printing tolerances and assembly instructions.

## GitHub Pages

In repository **Settings → Pages**, select **GitHub Actions** as the source.
The workflow runs `nix develop --command just ci`, builds and tests the site
under its repository path, and deploys successful main/master builds.
Pull requests and the migration branch validate without deploying.

The default URL base is `/<repository>/`, or `/` for a `<owner>.github.io`
repository. Set the repository variable `PAGES_BASE_PATH` to `/` when using a
custom domain, or to another explicit base when needed. To check locally:

```sh
BASE_PATH=/trackball/ just build
BASE_PATH=/trackball/ just e2e
BASE_PATH=/trackball/ just preview
```

Publish the entire `dist/` directory, including the WASM runtime and notices.
Rendering uses the visitor's CPU and memory. The app cancels superseded work,
renders parts sequentially in a worker and bounds its in-memory STL cache to
48 MiB. Large designs or high final detail can still take longer on mobile.

The pinned OpenSCAD runtime is GPL-2.0-or-later; upstream source and license
links are included with the distributed runtime in `openscad/NOTICE.md`.
