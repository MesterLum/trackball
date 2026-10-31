"""Palm attachment layout, export contract and public API coverage."""
import io
import zipfile

import pytest
from fastapi.testclient import TestClient

from build import build_parser
from trackball import options
from trackball.palmrest import palm_key, palmrest
from web.main import create_app
from web.services.designs import DesignService


@pytest.mark.parametrize('mode,extra', [('separate', {'palmrest'}), ('anchored', {'palmrest', 'palm_key'}), ('fused', set())])
def test_attachment_exports_the_printable_parts(tmp_path, mode, extra):
    svc = DesignService(tmp_path)
    res = svc.prepare({'palm': 40, 'palm_attachment': mode, 'tilt': 10, 'tent': 8})
    assert res.fits
    assert set(svc.part_names(res.id)) == {'cup', 'carrier', 'tray'} | extra
    assert (res.dir / 'tray.scad').stat().st_size > 0
    assert mode in res.design.summary()
    if mode != 'separate':
        assert options.to_argv(res.values)[-2:] == ['--palm-attachment', mode]


@pytest.mark.parametrize('mode', ['separate', 'anchored', 'fused'])
def test_no_palm_does_not_generate_joint_or_extra_parts(tmp_path, mode):
    svc = DesignService(tmp_path)
    res = svc.prepare({'palm_attachment': mode})
    assert set(svc.part_names(res.id)) == {'cup', 'carrier', 'tray'}
    assert palmrest(res.design) is None
    assert palm_key(res.design) is None


@pytest.mark.parametrize('mode,gap', [('separate', 0.5), ('anchored', 0.5), ('fused', 0)])
def test_attachment_follows_asymmetric_front_edge(mode, gap):
    d = options.make_design({'palm': 40, 'palm_attachment': mode, 'no_mirror': True,
                             'mcu': 'rp2040-zero', 'mcu_place': 'under'})
    y0, y1 = d.palm_y_range
    assert y1 == pytest.approx(-d.front_length - gap)
    assert y1 - y0 == pytest.approx(40)
    assert d.front_length != d.back_length


def test_autofit_provides_enough_material_for_anchor():
    values, changes = options.autofit({'palm': 10, 'palm_attachment': 'anchored', 'floor': 1.5})
    assert values['palm'] == 18
    assert values['floor'] == 2.5
    assert options.make_design(values).validate() == []
    assert {c['option'] for c in changes} >= {'palm', 'floor'}


def test_cli_and_api_accept_and_reproduce_attachment(tmp_path):
    args = build_parser().parse_args(['--palm', '40', '--palm-attachment', 'anchored'])
    assert args.palm_attachment == 'anchored'
    with TestClient(create_app(out_dir=tmp_path)) as client:
        for mode in ('separate', 'anchored', 'fused'):
            response = client.post('/api/design', json={'palm': 40, 'palm_attachment': mode})
            assert response.status_code == 200
            d = response.json()
            assert d['fits']
            archive = client.get(f"/api/design/{d['id']}/scad.zip")
            with zipfile.ZipFile(io.BytesIO(archive.content)) as z:
                names = {name.split('/')[-1] for name in z.namelist()}
            assert ('palmrest.scad' in names) == (mode != 'fused')
            assert ('palm_key.scad' in names) == (mode == 'anchored')
        page = client.get('/').text
        assert "o.name !== 'palm_attachment'" in page


@pytest.mark.parametrize('tilt,tent', [(0, 0), (12, 8)])
def test_fused_seam_has_straight_sides(tmp_path, tilt, tent):
    """Probe both sides of the seam, where the old bridge left corner notches."""
    import shutil
    import subprocess
    from solid2 import cube, scad_render_to_file, union
    from trackball.tray import tray

    openscad = shutil.which('openscad')
    if openscad is None:
        pytest.skip('OpenSCAD not installed')
    d = options.make_design({'palm': 40, 'palm_attachment': 'fused', 'tilt': tilt, 'tent': tent, 'fn': 24})
    probes = []
    for side in (-1, 1):
        for delta in (-0.5, 0.5, d.carrier.corner_r / 2):
            x, y = side * (d.half_width - 0.5), -d.front_length + delta
            zero = d.deck_to_world((x, y, 0))
            zd = (d.z_floor_bottom + 1 - zero[2]) / d.deck_to_world((0, 0, 1))[2]
            point = d.deck_to_world((x, y, zd))
            probes.append(cube([0.1, 0.1, 0.1], center=True).translate(point))
    path = tmp_path / 'seam.scad'
    scad_render_to_file(union()(*probes) - tray(d), str(path))
    result = subprocess.run([openscad, '-o', str(tmp_path / 'missing.stl'), str(path)], capture_output=True, text=True)
    assert 'Current top level object is empty' in result.stderr, result.stderr
