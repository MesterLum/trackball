# OpenSCAD WebAssembly

This directory is populated by `just wasm` from the official OpenSCAD
WebAssembly distribution. Its version, download URLs, and SHA-256 checksums
are pinned in `scripts/openscad.lock.json`.

OpenSCAD is distributed under the GNU General Public License, version 2 or
later. A verbatim copy of the upstream license, including its CGAL linking
exception, is included in [COPYING](./COPYING). Upstream source and build information:

- https://github.com/openscad/openscad
- https://github.com/openscad/openscad/blob/master/COPYING
- https://github.com/openscad/openscad-wasm
- https://files.openscad.org/playground/

The runtime contains third-party geometry libraries; retain their upstream
license notices when redistributing a rebuilt runtime.
