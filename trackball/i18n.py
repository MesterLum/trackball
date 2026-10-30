"""Translations (GNU gettext, catalogs managed with Babel).

Source strings are English. Catalogs live in ``trackball/locale/<lang>/LC_MESSAGES/
trackball.po`` and are compiled in memory at first use, so no build step is
needed. The active language is a context variable: the web app sets it per
request, the CLI from the environment (LANGUAGE / LC_ALL / LC_MESSAGES / LANG).

    from trackball.i18n import _, N_
    _("ball diameter")                 # translate now
    N_("ball diameter")                # mark only (module-level constants), translate later with _()

Maintaining the catalogs (see README):

    uv run pybabel extract -F babel.cfg -k N_ -o trackball/locale/trackball.pot .
    uv run pybabel update -i trackball/locale/trackball.pot -d trackball/locale -D trackball
    # edit trackball/locale/es/LC_MESSAGES/trackball.po
"""
from __future__ import annotations

import contextvars
import gettext
import io
import os
import re
from pathlib import Path

LOCALE_DIR = Path(__file__).resolve().parent / "locale"
DOMAIN = "trackball"
DEFAULT_LANGUAGE = "en"
LANGUAGES: dict[str, str] = {"en": "English", "es": "Español"}   # code -> name in its own language

_current: contextvars.ContextVar[str] = contextvars.ContextVar("trackball_language", default=DEFAULT_LANGUAGE)
_catalogs: dict[str, gettext.NullTranslations] = {}


def available() -> list[str]:
    return list(LANGUAGES)


def normalize(code: str | None) -> str | None:
    """'es-MX' / 'es_MX.UTF-8' -> 'es' when that language is available, else None."""
    if not code:
        return None
    base = re.split(r"[-_.@]", code.strip().lower(), maxsplit=1)[0]
    return base if base in LANGUAGES else None


def negotiate(accept_language: str | None = None, *preferred: str | None) -> str:
    """Pick a language: explicit choices first (query / cookie), then the
    Accept-Language header (RFC 9110 quality values), else English."""
    for p in preferred:
        lang = normalize(p)
        if lang:
            return lang
    if accept_language:
        ranked = []
        for i, part in enumerate(accept_language.split(",")):
            bits = part.strip().split(";")
            q = 1.0
            for b in bits[1:]:
                if b.strip().startswith("q="):
                    try:
                        q = float(b.strip()[2:])
                    except ValueError:
                        q = 0.0
            ranked.append((-q, i, bits[0]))
        for _q, _i, tag in sorted(ranked):
            lang = normalize(tag)
            if lang and _q < 0:
                return lang
    return DEFAULT_LANGUAGE


def from_environment() -> str:
    for var in ("LANGUAGE", "LC_ALL", "LC_MESSAGES", "LANG"):
        val = os.environ.get(var)
        if val:
            for piece in val.split(":"):
                lang = normalize(piece)
                if lang:
                    return lang
    return DEFAULT_LANGUAGE


def translations(lang: str) -> gettext.NullTranslations:
    lang = normalize(lang) or DEFAULT_LANGUAGE
    cat = _catalogs.get(lang)
    if cat is None:
        po = LOCALE_DIR / lang / "LC_MESSAGES" / f"{DOMAIN}.po"
        if lang == DEFAULT_LANGUAGE or not po.exists():
            cat = gettext.NullTranslations()
        else:
            from babel.messages.mofile import write_mo
            from babel.messages.pofile import read_po
            with po.open("rb") as f:
                catalog = read_po(f, locale=lang, domain=DOMAIN)
            buf = io.BytesIO()
            write_mo(buf, catalog, use_fuzzy=False)
            buf.seek(0)
            cat = gettext.GNUTranslations(buf)
        _catalogs[lang] = cat
    return cat


def get_language() -> str:
    return _current.get()


def set_language(lang: str | None) -> contextvars.Token:
    """Activate a language for the current context; returns a token for reset_language()."""
    return _current.set(normalize(lang) or DEFAULT_LANGUAGE)


def reset_language(token: contextvars.Token) -> None:
    _current.reset(token)


def _(message: str) -> str:
    return translations(get_language()).gettext(message)


def ngettext(singular: str, plural: str, n: int) -> str:
    return translations(get_language()).ngettext(singular, plural, n)


def N_(message: str) -> str:
    """Mark a string for extraction without translating it."""
    return message
