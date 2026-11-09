# Lane repo maps

A short map per dev lane, so a session can find its way around without exploring the
codebase (lean-mode rule 7). Read your lane's map first; open files only when the task needs them.

| Lane | Map | Session |
|---|---|---|
| core | [core.md](core.md) | Dev-Core (Sonnet) |
| edge | [edge.md](edge.md) | Dev-Edge (Sonnet) |
| utility | [utility.md](utility.md) | Dev-Utility (Haiku) |

Shared facts for this repo (`ghazamu/mycode`):
- Python 3 training repo, no package layout: each script runs on its own (`python3 path/to/script.py`).
- No dependency manifest, test suite or CI yet. Third-party imports in use: `flask`, `requests`,
  `netifaces`, `yaml` (PyYAML), `matplotlib`. Add a test next to the code you change (`test_<name>.py`)
  and run it with `python3 -m pytest <path>` if pytest is available, else `python3 <test file>`.
- The folder globs in `docs/sdlc/sdlc.config.json` → `devbus.lanePaths` must match these maps.
  The DevBus mod warns when a dev edits outside its lane. Update both together.
- Keep each map under ~60 lines. When you add or move code, update the map in the same PR.
