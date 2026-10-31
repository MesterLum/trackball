# Security policy

## Reporting a vulnerability

Please report security issues **privately** through GitHub:
[Report a vulnerability](https://github.com/MesterLum/trackball/security/advisories/new)
(the repository's **Security** tab → **Report a vulnerability**). Do not open a public issue.

Include what you found, how to reproduce it, and the impact you expect. You will get an
answer as soon as possible, and credit in the advisory if you want it.

## Scope

The configurator is a static website: it has no server, accounts or stored data, and models
are generated in the visitor's browser. Relevant reports include, for example:

- a way to run scripts on the site through a crafted share link (cross-site scripting);
- a compromised or substituted dependency or OpenSCAD runtime (the runtime is pinned and
  checked against SHA-256 checksums in `scripts/openscad.lock.json`);
- a weakness in the build and deployment workflows.

Only the latest version on `main` (deployed to <https://trackball.ridekay.com>) is
supported.
