set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

default:
    @just --list

# Check that local development and CI use the supported Node LTS major.
versions:
    @node scripts/check-node.mjs
    @yarn --version

# Install exactly the dependencies in yarn.lock.
install: versions
    yarn install --immutable

# Download and verify the pinned OpenSCAD WebAssembly runtime.
wasm: versions
    yarn setup:wasm

# Prepare a fresh checkout for development.
setup: install wasm

# Maintainers only: refresh archive checksums when changing the pinned runtime.
wasm-update: versions
    yarn setup:wasm --update-lock

# Format the TypeScript, Svelte and configuration sources.
format: versions
    yarn format

# Check source formatting without rewriting files.
format-check: versions
    yarn format:check

# Lint TypeScript, Svelte and scripts with ESLint.
lint: versions
    yarn lint

# Install the git hooks (format + lint on commit, types + unit tests on push).
hooks:
    lefthook install

# Start the Svelte development server with automatic reload.
dev: wasm
    yarn dev

# Type-check TypeScript and Svelte components.
check: versions
    yarn check

# Run dimension, fit, and model regression tests.
test: wasm
    yarn test

# Run the same tests with a coverage report (coverage/index.html); fails below 95%.
coverage: wasm
    yarn test:coverage

# Build the static site for GitHub Pages (or another static host).
build: wasm
    yarn build

# Inspect the production build locally.
preview: build
    yarn preview

# Install Chromium for browser integration tests.
browsers: versions
    yarn playwright install --with-deps chromium

# Render the preset gallery thumbnails from the built site (CI regenerates them on every build).
presets: build browsers
    yarn presets

# Verify the browser rendering and download flow.
e2e: build browsers
    yarn test:e2e

# The same validation sequence is used in CI and locally.
ci: setup format-check lint check coverage build browsers presets e2e
