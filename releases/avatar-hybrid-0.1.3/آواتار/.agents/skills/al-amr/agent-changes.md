# Agent guide changes

Newest first. Each entry says what changed for an agent building on Al-Amr and
what to do differently. Every guide change that alters an agent's work adds an entry.

## 2026-10-23 — A Plugin may declare WebAssembly

A Plugin package can now carry `.wasm` modules, but only declared ones: write each
as `{ path, byteLength, digest }` under `webAssembly` in `al-amr.plugin.json`.
Undeclared WebAssembly is still refused as `native_binary`, and the reviewer sees the
declared list. Read [Declare WebAssembly](agent-plugins.md#declare-webassembly)
before packing a module; run `alamr validate` to get the exact size and digest.

## 2026-10-22 — The guide follows the installed client

Al-Amr keeps the guide in an initialized non-native project current with its
installed client. Project commands reconcile changed editions locally, and
Desktop reconciles its known projects once after an update. Retired, unedited
guide files are removed; local edits are preserved and reported as warnings.

When a command reports `ALAMR_GUIDE_UPDATED`, re-read
[the project skill](SKILL.md) and this change log before
continuing. Desktop leaves that notice pending for the agent's next command.
`ALAMR_GUIDE_CONFLICT` asks you to reconcile local edits with
`alamr docs sync --local --json`; it does not block publication.

If publication reports `ALAMR_CLIENT_UPDATE_REQUIRED`, ask the person to update
Al-Amr Desktop and run the same command again. Do not run `docs sync` to resolve
it: an older client can only copy its own older guide. Development and local
testing remain available.
