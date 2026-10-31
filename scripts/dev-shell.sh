#!/usr/bin/env bash
# Run a command with the project toolchain. Git hooks may start outside the Nix shell (an editor,
# a GUI client); then enter it, otherwise run directly.
set -euo pipefail
if command -v yarn >/dev/null 2>&1 && [[ "$(node --version 2>/dev/null)" == v24.* ]]; then
  exec "$@"
fi
exec nix develop --command "$@"
