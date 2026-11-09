# Lane: edge (UI, CLIs, external integrations) — Dev-Edge

**Owns:** what users see and type, and calls to outside services.
Globs: `flaskapi/templates/**`, `flaskapi/*.html`, `marvel/**`, `challenges/**`, `graphing/**`, `netfacd/**`, `netfunc01/**`, `lab_input/**`, `iptaker01.py`, `mygame01.py`

## Web UI — `flaskapi/templates/`, `flaskapi/postmaker.html`
Jinja2 templates rendered by the core lane's apps: `index.html`, `hellobasic.html`, `hellobasic2.html`,
`log_in.html`, `readcookie.html`, `highscore.html`, `upload.html`. `postmaker.html` is a static form
that posts to `myflask03.py`'s `/login`. Field names must match the route's `request.form` keys
(check the core app before you rename anything).

## External API clients
- `marvel/charc.py`: Marvel API client (`requests`, md5 hash auth from public/private keys).
  Keys must come from files or env vars, never commits.
- `marvel/xmen/uncannyapi.py`, `uncannyapi01.py`: further Marvel API calls (args via `argparse`).
- `challenges/challenge_API.py`, `challenge_api02.py`: exercises against public REST APIs (`requests`).
- `challenges/mondayChallenge.py`, `thursday.py`, `challenge0730`: small interactive challenges.

Rules for clients: set timeouts, handle non-200 responses and missing keys, and don't print full payloads.

## CLIs and output
- `mygame01.py`: text adventure (room dict, `go`/`get` commands). Interactive `input()` loop.
- `netfacd/interface_reader.py`: lists interfaces, MAC and IPv4 addresses (`netifaces`).
- `netfunc01/main.py` + `ipcmd.txt`: simulated device command push (prints the commands; nothing is sent yet).
- `lab_input/iptaker01.py`, `iptaker01.py` (root): prompt for an IP and echo it.
- `graphing/graphmaker-bar.py`, `graphmaker-barupdated.py`: matplotlib bar charts (`graphmaker-barupdated.py` saves the figure; `2018summary.png` is a saved output).

## Conventions
- Build against the contract core defined in the spec. If it's missing or wrong, send `BLOCKED`.
- Interactive scripts: keep prompts short and validate input. Exit cleanly on Ctrl-C.
