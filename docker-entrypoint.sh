#!/bin/sh
# One image, several jobs:
#   docker run -p 8321:5000 -v $PWD/out:/data trackball            # web configurator (default: serve)
#   docker run -v $PWD/out:/data trackball build --tilt 10 --stl    # CLI, same flags as build.py
#   docker run -v $PWD/out:/data trackball presets [keys...]        # prebuilt bundles + gallery
#   docker run -v $PWD/out:/data trackball demo                     # photo gallery of the presets
#   docker run trackball test                                       # pytest
set -e
cmd="${1:-serve}"
[ $# -gt 0 ] && shift
case "$cmd" in
  serve)   exec uv run --no-sync uvicorn web.main:app --host 0.0.0.0 --port 5000 "$@" ;;
  build)   exec uv run --no-sync python build.py "$@" ;;
  presets) exec uv run --no-sync python presets_bundle.py "$@" ;;
  demo)    exec uv run --no-sync python demo.py "$@" ;;
  test)    exec uv run --no-sync --group dev pytest -q "$@" ;;
  sh|bash) exec /bin/sh "$@" ;;
  *)       exec "$cmd" "$@" ;;
esac
