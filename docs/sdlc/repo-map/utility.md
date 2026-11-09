# Lane: utility (small tasks, standalone scripts) — Dev-Utility

**Owns:** `size:S` issues in any folder, plus these standalone learning scripts.
Globs: `strings/**`, `listmethods/**`, `dict01/**`, `mix-list/**`, `mix-list3/**`, `if-test/**`, `custif/**`, `fact/**`, `montypython/**`, `lrnimport/**`, `credmaker/**`, `5g_research/**`, `5g_research_backup/**`, `ceph_storage/**`, `mycode2/**`, `copycat01.py`, `moveplease01.py`, `ifixed.py`, `deleteme.py`, `p3_shebang.py`, `with_shebang.py`, `csv_users.txt`

| Folder / file | What it is |
|---|---|
| `strings/` | String method exercises |
| `listmethods/`, `mix-list/`, `mix-list3/` | List exercises (`mix-list3/challanges/` holds text challenges) |
| `dict01/` | Dictionary exercise |
| `if-test/`, `custif/` | Conditionals |
| `fact/` | Loop exercises (`looping02.py` reads `dnsservers.txt`) |
| `montypython/` | Loop/condition quiz |
| `lrnimport/` | `subprocess`/import exercises (ignore `__pycache__/`) |
| `credmaker/` | `openstackrc_maker.py`, `rclooper.py`: generate OpenStack `admin.rc*` files from `csv_users.txt` |
| `5g_research/`, `5g_research_backup/`, `ceph_storage/` | Text and data fixtures, not code |
| root `*.py` | Tiny demos: shebangs, file copy/move, `ifixed.py` |

**Sensitive:** `credmaker/admin.rc*` and `csv_users.txt` may hold credentials. Never paste their
contents into messages or PRs. Refer to them by path only.

## How to work
- Batches: you may get up to 10 related `size:S` issues. Read this map once, then do them one by one.
- Keep changes minimal: no refactors outside the issue, no new dependencies.
- If the task needs a design decision or touches a core or edge contract, stop and send `ESCALATE`.
