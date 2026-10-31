# Contributing to Ridekay Trackball

Thanks for helping! You don't need to write code to make a difference.

## Ways to help

- **Measure real parts.** Several dimensions come from datasheets, not calipers (see
  [Numbers to verify](docs/geometry.md#numbers-to-verify-before-trusting-a-print)). A
  measurement of a real BTU, switch, controller or sensor lens, ideally with a photo of the
  calipers, is one of the most valuable contributions. Open a
  [print or fit report](https://github.com/MesterLum/trackball/issues/new/choose).
- **Report a print.** Built one? Tell us what fit, what didn't, your printer and material,
  and include the **Share link** so we can open your exact design.
- **Report a bug** in the configurator, with the share link and steps to reproduce.
- **Suggest a feature**, such as a new controller, sensor board or support type. Please
  open an issue before starting large changes, so we can agree on the approach first.
- **Translate.** Messages live in `packages/core/src/es.json`; a new language follows the
  same pattern.

## Working on the code

The setup is described in [docs/development.md](docs/development.md) and the code layout in
[docs/architecture.md](docs/architecture.md). In short:

```sh
direnv allow   # or: nix develop
just setup     # dependencies and the pinned OpenSCAD runtime
just hooks     # format + lint on commit, types + unit tests on push
just dev       # http://127.0.0.1:5173
```

1. Fork the repository and create a branch from `main`.
2. Make your change, with tests:
   - geometry or calculation changes need a unit test in `tests/unit/`;
   - a dimension that is not measured gets a note in
     [docs/geometry.md](docs/geometry.md#numbers-to-verify-before-trusting-a-print);
   - every user-facing string needs a Spanish entry in `packages/core/src/es.json`;
   - new options go into `packages/core/src/config/options-data.json` only.
3. Run `just ci`. It runs the same checks as GitHub: format, lint, types, tests with at
   least 95% coverage, build, preset thumbnails and browser tests.
4. Open a pull request and fill in the template. Both CI checks (`checks` and `e2e`) must
   pass before merging.

If a change alters existing geometry on purpose, say so in the pull request. Parity fixtures
that it changes are re-baselined and marked `rebaselined` with the reason (see
[docs/architecture.md](docs/architecture.md#regression-fixtures)).

## Licensing of contributions

The project is licensed under the [GNU GPL, version 3 or later](LICENSE). By submitting a
contribution you agree that it is licensed under the same terms.

## Conduct

Everyone taking part is expected to follow the [code of conduct](CODE_OF_CONDUCT.md).
