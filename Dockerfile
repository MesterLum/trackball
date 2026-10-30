# OpenSCAD with the Manifold geometry backend (10-100x faster than the 2021.01 CGAL
# engine); multi-arch (amd64 / arm64). Pinned: bump the tag deliberately.
FROM openscad/openscad:trixie.2026-10-26

# Python 3.13 from Debian trixie; xvfb + xauth + Mesa give OpenSCAD a display for PNG previews.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv python3-pip xvfb xauth libgl1-mesa-dri \
 && rm -rf /var/lib/apt/lists/* \
 && pip install --no-cache-dir --break-system-packages uv

WORKDIR /app
ENV UV_PYTHON_DOWNLOADS=never UV_LINK_MODE=copy PYTHONUNBUFFERED=1 \
    TRACKBALL_OUT=/data/web TRACKBALL_PRESETS=/data/presets \
    TRACKBALL_FN_PREVIEW=96 TRACKBALL_FN_FINAL=128 TRACKBALL_WORKERS=3 TRACKBALL_AUTO_RENDER=1
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

COPY trackball ./trackball
COPY web ./web
COPY tests ./tests
COPY build.py demo.py presets_bundle.py docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

VOLUME ["/data"]
EXPOSE 5000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["serve"]
