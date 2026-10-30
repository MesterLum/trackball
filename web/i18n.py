"""Per-request language selection for the web app.

Order of precedence: ``?lang=`` query, ``lang`` cookie, ``Accept-Language``
header, English. The chosen language is activated as a context variable for
the rest of the request (sync endpoints run in a thread pool with the context
copied), so every ``_()`` call in the design model and the serializers
produces text in that language. Responses carry ``Content-Language``.
"""
from __future__ import annotations

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from trackball.i18n import negotiate, reset_language, set_language

COOKIE = "lang"


def language_for(scope: Scope) -> str:
    headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
    query = scope.get("query_string", b"").decode()
    from urllib.parse import parse_qs
    q = parse_qs(query).get(COOKIE, [None])[0]
    cookie = None
    for part in headers.get("cookie", "").split(";"):
        name, _sep, value = part.strip().partition("=")
        if name == COOKIE:
            cookie = value
    return negotiate(headers.get("accept-language"), q, cookie)


class LanguageMiddleware:
    """Pure ASGI middleware: sets the language context for the whole request."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        lang = language_for(scope)
        token = set_language(lang)

        async def send_with_language(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"content-language", lang.encode()))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_with_language)
        finally:
            reset_language(token)
