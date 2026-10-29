FROM python:3.13-slim

# OpenSCAD renders the STLs; xvfb gives it the display it needs for PNG previews.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openscad xvfb xauth libgl1-mesa-dri \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV UV_PYTHON_DOWNLOADS=never UV_LINK_MODE=copy PYTHONUNBUFFERED=1 \
    TRACKBALL_OUT=/data/out
COPY pyproject.toml uv.lock ./
RUN pip install --no-cache-dir uv && uv sync --frozen --no-dev

COPY trackball ./trackball
COPY build.py demo.py ./
COPY web ./web

VOLUME ["/data"]
EXPOSE 5000
CMD ["uv", "run", "--no-sync", "uvicorn", "web.main:app", "--host", "0.0.0.0", "--port", "5000"]
