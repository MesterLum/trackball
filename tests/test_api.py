"""API tests. No OpenSCAD needed: rendering is only exercised when it is installed."""
from __future__ import annotations

import shutil
import time

import pytest
from fastapi.testclient import TestClient

from web.main import create_app


@pytest.fixture()
def client(tmp_path):
    app = create_app(out_dir=tmp_path)
    with TestClient(app) as c:
        yield c


def test_options_lists_groups_and_ranges(client):
    r = client.get("/api/options")
    assert r.status_code == 200
    groups = {g["name"]: g["options"] for g in r.json()["groups"]}
    assert set(groups) >= {"Ball & cup", "Buttons", "Electronics", "Body", "Deck"}
    ball = next(o for o in groups["Ball & cup"] if o["name"] == "ball")
    assert ball["min"] == 20 and ball["max"] == 60 and ball["unit"] == "mm"


def test_presets_all_fit(client):
    r = client.get("/api/presets")
    assert r.status_code == 200
    presets = r.json()
    assert 10 <= len(presets) <= 30
    for p in presets:
        d = client.post("/api/design", json=p["values"]).json()
        assert d["fits"], (p["key"], d["problems"])


def test_default_design_is_centred_and_summarised(client):
    d = client.post("/api/design", json={}).json()
    assert d["fits"] and d["problems"] == []
    assert d["footprint"] == [73.6, 110.6]
    assert "ball centred" in d["summary"]
    assert d["cmd"] == "uv run build.py"


def test_design_that_does_not_fit_returns_problems_not_an_error(client):
    d = client.post("/api/design", json={"switches": 0, "padding": 4})
    assert d.status_code == 200
    body = d.json()
    assert not body["fits"]
    assert "--padding" in body["problems"][0] or "--mcu-place under" in body["problems"][0]
    # nothing to render for it
    assert client.post(f"/api/design/{body['id']}/render").status_code == 404


@pytest.mark.parametrize("payload,field", [
    ({"ball": 5}, "ball"),
    ({"support": "wheels"}, "support"),
    ({"battery": "50x34"}, "battery"),
    ({"padding": "nine"}, "padding"),
    ({"not_an_option": 1}, "not_an_option"),
])
def test_bad_values_give_422_with_field_map(client, payload, field):
    r = client.post("/api/design", json=payload)
    assert r.status_code == 422
    assert field in r.json()["fields"]


def test_same_values_give_same_id_and_files(client):
    a = client.post("/api/design", json={"tilt": 8}).json()
    b = client.post("/api/design", json={"tilt": 8.0}).json()
    assert a["id"] == b["id"]
    scad = client.get(f"/api/design/{a['id']}/scad.zip")
    assert scad.status_code == 200 and scad.headers["content-type"] == "application/zip"


@pytest.mark.skipif(shutil.which("openscad") is None, reason="openscad not installed")
def test_render_queue_produces_cached_stls(client):
    d = client.post("/api/design", json={"switches": 0, "mcu": "rp2040-zero", "mcu_place": "under",
                                         "padding": 4, "fn": 24}).json()
    st = client.post(f"/api/design/{d['id']}/render").json()
    assert {p["name"] for p in st["parts"]} == {"cup", "carrier", "tray"}
    for _ in range(600):
        st = client.get(f"/api/design/{d['id']}/status").json()
        if st["done"]:
            break
        time.sleep(0.5)
    assert st["ok"], st
    stl = client.get(st["parts"][0]["url"])
    assert stl.status_code == 200 and stl.content[80:84] != b""
    # second submission of the same design hits the cache
    again = client.post(f"/api/design/{d['id']}/render").json()
    assert again["done"]


def test_quality_tiers_and_bom(client):
    p = client.post("/api/design?quality=preview", json={}).json()
    f = client.post("/api/design?quality=final", json={}).json()
    assert p["fn"] == 48 and f["fn"] == 96 and p["id"] != f["id"]
    assert any("heat-set" in b["item"] for b in p["bom"])
    assert client.get("/api/settings").json()["fn_preview"] == 48


def test_cancel_endpoint_is_idempotent(client):
    d = client.post("/api/design", json={}).json()
    assert client.delete(f"/api/design/{d['id']}/render").json() == {"cancelled": 0}


def test_autofit_raises_padding_instead_of_failing(client):
    plain = client.post("/api/design", json={"switches": 4}).json()
    assert not plain["fits"]
    fit = client.post("/api/design?autofit=true", json={"switches": 4}).json()
    assert fit["fits"] and fit["adjusted"] and fit["adjusted"][0]["option"] == "padding"
    assert fit["values"]["padding"] > 9
