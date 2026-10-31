# Development environment

Use **Node.js 24 LTS**. The repository declares the supported major in
`package.json`, `.node-version`, and `.nvmrc`. The exact Node package and `just`
version are selected by stable Nixpkgs and pinned by `flake.lock`.

## Automatic activation

Install Nix and direnv. Add the hook for your shell once:

```sh
# zsh: add to ~/.zshrc
# eval "$(direnv hook zsh)"

# bash: add to ~/.bashrc
# eval "$(direnv hook bash)"
```

In the repository, run `direnv allow` once. The committed `.envrc` uses the
flake to load Node 24, Yarn, Git, and `just`. Entering or leaving the directory
then activates or restores your shell environment automatically.

No global Node version is replaced. No dependencies are downloaded on every
entry: Nix reuses its store, and Yarn dependencies remain in `node_modules`.
After an intentional `.envrc` change, direnv will ask you to allow it again.

Verify activation with:

```sh
node --version
just versions
```

Without direnv, use `nix develop`. With Nix features disabled globally, use:

```sh
nix --extra-experimental-features 'nix-command flakes' develop
```

## Shared commands

```sh
just setup    # install locked dependencies and the rendering runtime
just hooks    # install the git hooks (once per clone)
just install  # yarn install --immutable from yarn.lock
just wasm     # fetch and verify the pinned OpenSCAD runtime
just dev      # development server with automatic updates
just check    # TypeScript and Svelte checks
just lint     # ESLint (TypeScript, Svelte, scripts)
just test     # calculation and model regression tests
just coverage # the same tests with coverage/index.html (fails below 95%)
just build    # static production build
just browsers # install Chromium for browser tests
just presets  # render preset thumbnails into public/ and dist/
just e2e      # browser rendering and download tests
just format   # format source files
just format-check # check formatting without editing files
just ci       # setup, checks, coverage, build, browser setup, thumbnails and browser tests
```

CI runs the same recipes inside `nix develop --command just ci`. Update the
locked development packages deliberately with `nix flake update nixpkgs`, then
verify `just ci` before committing the updated lock file.

## Git hooks

Run `just hooks` once per clone. [Lefthook](https://lefthook.dev) (pinned in the
flake) then formats and lints the staged files on every commit, and runs the
type check and unit tests before every push. Hooks started outside the Nix shell,
for example from an editor, enter it through `scripts/dev-shell.sh`. CI runs the
same checks and remains the gate; `git commit --no-verify` skips the hooks.

The geometry core (`packages/core`) keeps the untyped style of its Python port,
so `no-explicit-any` and `prefer-const` are off there; tighten them file by file.

## Package manager

Use Yarn 4, pinned by the `packageManager` field in `package.json`. The Nix shell
provides Corepack and creates project-local Yarn shims in `.cache/corepack/bin`;
this does not change a global Yarn installation. Corepack fetches the pinned
Yarn release on its first invocation. Dependencies use the standard
`node_modules` layout (`nodeLinker: node-modules` in `.yarnrc.yml`).

After changing dependencies, run `yarn install` and commit `yarn.lock`.
For a clean checkout or CI, use `just install`, which rejects unexpected lock
file changes. Do not add a package-lock.json alongside yarn.lock.

## CI and deployment

Two GitHub Actions workflows share the `just` recipes and a setup action
(`.github/actions/setup`) for Nix, dependency caches and the site base path:

- **CI** (`.github/workflows/ci.yml`) runs on every pull request in two parallel
  jobs, both required to merge into `main`:
  - `checks`: formatting, lint, types, and unit and geometry tests with at least
    95% coverage (summary on the run page, HTML report as an artifact);
  - `e2e`: production build, preset thumbnails and browser tests (failure
    screenshots and traces as an artifact).
- **Deploy** (`.github/workflows/deploy.yml`) runs only on `main`: it repeats
  `just ci` on exactly what was merged, then publishes `dist/` to GitHub Pages.

`main` accepts changes only through pull requests with both checks green; force
pushes and deletion are blocked, and history stays linear (squash or rebase
merges).

The site is served at <https://trackball.ridekay.com>. The repository variable
`PAGES_BASE_PATH` is `/` for the custom domain; without it the base is
`/<repository>/` (or `/` for an `<owner>.github.io` repository). To check a
base locally:

```sh
BASE_PATH=/trackball/ just build
BASE_PATH=/trackball/ just e2e
BASE_PATH=/trackball/ just preview
```

Publish the whole `dist/` directory: it includes the WASM runtime, its GPL
notice (`openscad/`) and `THIRD_PARTY_LICENSES.txt`.
