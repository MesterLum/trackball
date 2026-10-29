FROM python:3.13-slim

# OpenSCAD renders the STLs; xvfb + xauth + Mesa give it the display it needs for PNG previews.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openscad xvfb xauth libgl1-mesa-dri \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV UV_PYTHON_DOWNLOADS=never UV_LINK_MODE=copy PYTHONUNBUFFERED=1 \
    TRACKBALL_OUT=/data/web TRACKBALL_PRESETS=/data/presets \
    TRACKBALL_FN_PREVIEW=32 TRACKBALL_FN_FINAL=96 TRACKBALL_WORKERS=3 TRACKBALL_AUTO_RENDER=1
COPY pyproject.toml uv.lock ./
RUN pip install --no-cache-dir uv && uv sync --frozen

COPY trackball ./trackball
COPY web ./web
COPY tests ./tests
COPY build.py demo.py presets_bundle.py docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

VOLUME ["/data"]
EXPOSE 5000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["serve"]
