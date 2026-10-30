"""Translations: negotiation, catalog completeness, translated API and page."""
from __future__ import annotations

import io
import re
from pathlib import Path

import pytest
from babel.messages.extract import extract_from_dir
from babel.messages.pofile import read_po
from fastapi.testclient import TestClient

from trackball import options
from trackball.i18n import LANGUAGES, LOCALE_DIR, negotiate, set_language, translations
from web.main import create_app

ROOT = Path(__file__).resolve().parent.parent
PLACEHOLDER = re.compile(r"\{[^{}]*\}")


@pytest.fixture()
def client(tmp_path):
    app = create_app(out_dir=tmp_path)
    with TestClient(app) as c:
        yield c


def test_negotiate_prefers_explicit_then_header():
    assert negotiate("es-MX,es;q=0.9,en;q=0.8") == "es"
    assert negotiate("fr-FR,fr;q=0.9") == "en"
    assert negotiate("fr,es;q=0.5,en;q=0.9") == "en"
    assert negotiate("fr,es;q=0.9,en;q=0.5") == "es"
    assert negotiate("en", "es") == "es"
    assert negotiate("es", None, "en") == "en"
    assert negotiate("es", "xx") == "es"


def _source_ids() -> set[str]:
    method_map = [("trackball/**.py", "python"), ("web/**.py", "python"), ("build.py", "python"),
                  ("web/templates/**.html", "jinja2")]
    options_map = {"web/templates/**.html": {"extensions": "jinja2.ext.i18n"}}
    ids = set()
    for _f, _l, msgid, _c, _ctx in extract_from_dir(str(ROOT), method_map, options_map, keywords={"_": None, "N_": None}):
        if isinstance(msgid, str):
            ids.add(msgid)
    return ids


@pytest.mark.parametrize("lang", [l for l in LANGUAGES if l != "en"])
def test_catalog_is_complete_and_placeholders_match(lang):
    po = LOCALE_DIR / lang / "LC_MESSAGES" / "trackball.po"
    with po.open("rb") as f:
        cat = read_po(f)
    translated = {m.id: m.string for m in cat if m.id}
    missing = sorted(i for i in _source_ids() if not translated.get(i))
    assert not missing, f"{lang}: untranslated strings: {missing[:10]}"
    for msgid, msgstr in translated.items():
        assert set(PLACEHOLDER.findall(msgid)) == set(PLACEHOLDER.findall(msgstr)), msgid


def test_design_messages_follow_the_active_language():
    d = options.make_design({"switches": 5, "buttons": "tiles"})
    token = set_language("es")
    try:
        assert "teclas" in d.validate()[0]
        assert "bola" in d.summary().splitlines()[0]
    finally:
        from trackball.i18n import reset_language
        reset_language(token)
    assert "tiles" in d.validate()[0]


def test_api_honours_accept_language_and_query(client):
    en = client.get("/api/options").json()["groups"][0]
    es = client.get("/api/options", headers={"Accept-Language": "es"}).json()["groups"][0]
    assert en["key"] == es["key"] == "Ball & cup" and es["name"] == "Bola y copa"
    assert client.get("/api/options?lang=es", headers={"Accept-Language": "en"}).json()["groups"][0]["name"] == "Bola y copa"
    r = client.get("/api/presets", headers={"Accept-Language": "es"})
    assert r.headers["content-language"] == "es"
    assert r.json()[0]["title"] == "Estilo EM06"


def test_page_sets_cookie_and_translates(client):
    r = client.get("/?lang=es")
    assert r.status_code == 200 and r.cookies.get("lang") == "es"
    assert '<html lang="es"' in r.text and "Diseños propuestos" in r.text
    assert "Diseños propuestos" in client.get("/").text          # the cookie sticks
    client.cookies.clear()
    assert "Proposed builds" in client.get("/").text
