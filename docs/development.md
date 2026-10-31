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
just install  # yarn install --immutable from yarn.lock
just wasm     # fetch and verify the pinned OpenSCAD runtime
just dev      # development server with automatic updates
just check    # TypeScript and Svelte checks
just test     # calculation and model regression tests
just build    # static production build
just browsers # install Chromium for browser tests
just presets  # render preset thumbnails into public/ and dist/
just e2e      # browser rendering and download tests
just format   # format source files
just format-check # check formatting without editing files
just ci       # setup, checks, tests, build, browser setup, thumbnails and browser tests
```

CI runs the same recipes inside `nix develop --command just ci`. Update the
locked development packages deliberately with `nix flake update nixpkgs`, then
verify `just ci` before committing the updated lock file.

## Package manager

Use Yarn 4, pinned by the `packageManager` field in `package.json`. The Nix shell
provides Corepack and creates project-local Yarn shims in `.cache/corepack/bin`;
this does not change a global Yarn installation. Corepack fetches the pinned
Yarn release on its first invocation. Dependencies use the standard
`node_modules` layout (`nodeLinker: node-modules` in `.yarnrc.yml`).

After changing dependencies, run `yarn install` and commit `yarn.lock`.
For a clean checkout or CI, use `just install`, which rejects unexpected lock
file changes. Do not add a package-lock.json alongside yarn.lock.
