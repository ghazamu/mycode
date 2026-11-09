# Lane: core (backend, data, config) — Dev-Core

**Owns:** server-side logic, data storage and parsing, config handling.
Globs: `flaskapi/*.py`, `sqlite_test.py`, `test.db`, `jsonintro/**`, `yamlintro/**`, `cfgreed/**`, `attemptlogin/**`

## Flask apps — `flaskapi/`
Independent single-file Flask apps. Each runs with `python3 flaskapi/<file>.py` and listens on **port 5006**,
so only one runs at a time. Templates live in `flaskapi/templates/`, which belongs to the **edge** lane.

| File | Routes | What it shows |
|---|---|---|
| `myflask01.py` | `/`, `/ali`, `/hello/<name>` | Basic routing |
| `myflask02.py` | `/admin`, `/guest/<guest>`, `/user/<name>` | `redirect` / `url_for` |
| `myflask03.py` | `/success/<name>`, `/login` (GET/POST) | Form handling |
| `redirectorr.py` | `/`, `/login`, `/success` | Redirect after login |
| `jinja2temp.py` | `/`, `/<username>` | Jinja2 templates |
| `jinja2temp02.py` | `/<int:score>` | Template logic (highscore) |
| `milkncookies.py` | `/`, `/index`, `/setcookie`, `/getcookie` | Cookies |
| `flasksessions-01.py` | `/`, `/login`, `/logout` (defined twice in the file) | Sessions; needs `secret_key` |
| `flaskuploader.py` | `/upload`, `/uploader` | File upload |

Known issues worth a ticket: `flasksessions-01.py` holds two copies of the app; secrets are hard-coded;
no input validation on login and upload routes.

## Data and config
- `sqlite_test.py` + `test.db`: sqlite3 create/insert/select demo against `test.db` in the repo root.
- `jsonintro/makejson03.py` → `datacenter.json`: build and dump JSON.
- `yamlintro/makeyaml101.py` → `galaxyguide.yaml`: build and dump YAML.
- `cfgreed/cfg01.py`, `cfg02.py`: read `clanconfig.cfg` line by line.
- `attemptlogin/keystone_counter.py`: counts failed and successful logins in the OpenStack log `keystone.common.wsgi`.
  Its log path is hard-coded to `/home/student/...`, so it only runs on the original lab machine.

## Conventions
- Keep each app runnable on its own. Don't introduce a package layout without a design spec.
- New routes: validate input, never echo secrets, and use the `templates/` names the edge lane owns.
- Cross-lane features: you define the route and data contract in the spec first; edge builds the UI against it.
