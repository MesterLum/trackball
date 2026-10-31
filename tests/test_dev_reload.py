"""Development updates reach the browser and invalidate stale geometry."""
from dataclasses import replace

from fastapi.testclient import TestClient

from web.dev_reload import source_revision
from web.main import create_app
from web.settings import Settings
from web.services import designs


def test_development_refresh_is_opt_in(tmp_path, monkeypatch):
    monkeypatch.delenv('TRACKBALL_DEV_RELOAD', raising=False)
    with TestClient(create_app(out_dir=tmp_path)) as client:
        assert '/static/dev-reload.js' not in client.get('/').text
        assert client.get('/__dev__/revision').status_code == 404
    settings = replace(Settings(), out=tmp_path, dev_reload=True)
    with TestClient(create_app(settings=settings)) as client:
        page = client.get('/')
        assert '/static/dev-reload.js' in page.text
        assert page.headers['cache-control'] == 'no-store'
        assert client.get('/static/app.js').headers['cache-control'] == 'no-store'
        initial = client.get('/__dev__/revision').json()['revision']
        assert client.get('/__dev__/revision').json()['revision'] == initial
        monkeypatch.setattr('web.dev_reload.source_revision', lambda root: 'changed-source')
        assert client.get('/__dev__/revision').json()['revision'] != initial


def test_source_revision_tracks_code_and_templates_but_not_generated_files(tmp_path):
    (tmp_path / 'web').mkdir()
    (tmp_path / 'web' / 'index.html').write_text('before')
    before = source_revision(tmp_path)
    (tmp_path / 'web' / 'index.html').write_text('after edit')
    after = source_revision(tmp_path)
    assert after != before
    (tmp_path / 'out').mkdir()
    (tmp_path / 'out' / 'tray.stl').write_text('generated')
    assert source_revision(tmp_path) == after


def test_cad_changes_create_new_designs_and_preserve_old_downloads(tmp_path, monkeypatch):
    svc = designs.DesignService(tmp_path)
    monkeypatch.setattr(designs, 'geometry_revision', lambda: 'old')
    old = svc.prepare({})
    old_scad = (old.dir / 'tray.scad').read_text()
    monkeypatch.setattr(designs, 'geometry_revision', lambda: 'new')
    new = svc.prepare({})
    assert new.id != old.id
    assert new.dir != old.dir
    loaded = svc.load(old.id)
    assert loaded.id == old.id
    assert loaded.dir == old.dir
    assert (loaded.dir / 'tray.scad').read_text() == old_scad
