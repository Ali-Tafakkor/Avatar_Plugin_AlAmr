# Prepare a publication

Finish the requested behavior, tests, build and preview before calling the result
ready. Use `alamr doctor --profile publish --json` to inspect requirements.
Write real descriptions and Plugin documentation; never submit starter placeholders.
Follow the person's publication authorization; a local development task does not
by itself authorize uploading a candidate or submitting it for review.

## Choose the next version once

The manifest is the product version authority: App and web Environment bundle
versions are `entry.version`; a Plugin uses its manifest `version` together with
`package.json`'s version. `alamr bump patch` (or `minor` / `major`) updates the
appropriate fields locally. It increments on **every invocation**; it is not an
idempotent "ensure next version" command. Rebuild after changing a bundle version.

For changed publishable work, inspect the current manifest and
`alamr status --json`. Its Registry-backed `spentVersions` records versions that
entered review, including later rejected, withdrawn, published, yanked or suspended
ones. A missing `spentVersions` means unknown, not an empty history. A local
submission ID or a failed check alone does not establish a spent version.

| Situation                                                                                 | Action                                                                                            |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| First publication; no version consumed and no frozen candidate conflicts                  | Keep the starter's intended version.                                                              |
| `1.2.0` is consumed and the current working version is still `1.2.0`                      | Select the appropriate unused version above consumed versions; ordinarily bump patch to `1.2.1`.  |
| Working version is already `1.2.1`, above consumed versions, with no frozen-byte conflict | Keep `1.2.1` through subsequent edits, tests and agent sessions.                                  |
| Same candidate, same bytes, retrying an operation                                         | Inspect that exact candidate's state and reuse the documented retry; a retry alone needs no bump. |
| Changing bytes already frozen for an Environment or Plugin version                        | Prepare a new version even if it has not entered review.                                          |
| Registry history is unavailable                                                           | Continue local work, report that version availability is unverified, and check before uploading.  |

Do not bump on every task, build, `dev`, failed test or upload retry. Use minor
for a compatible public feature and major for a breaking public contract where
the product's versioning policy requires it. A bump must produce a suitable
unused version; one patch increment is insufficient if newer versions are
already consumed. `alamr bump` operates on an exact numeric version in the
manifest; it refuses a prerelease or build-suffixed version.

An unspent version does **not** promise that uploaded bytes are replaceable.
App drafts can use a new revision for an unspent entry version; an existing
revision's bound artifact remains immutable. Environment and Plugin artifact
rules are stricter for changed bytes at the same version. Follow the precise
conflict and `nextActions`; never overwrite an existing release or delete history
to make the upload succeed. Inspect a rejected candidate before choosing a retry:
unchanged bytes and a content correction are different cases.

## Product versions are different from platform compatibility

`contractVersion` records the platform contract associated with a manifest.
Publication input is normalized by the CLI and the Registry stamps its contract
version. Do not increment it for product changes. `compat.contracts` declares
which platform contracts a product supports; `runtimeApi` compatibility declares
which injected Runtime API it supports. Change these only for an intentional,
verified compatibility change, never as a substitute for a product release bump.

## Upload, submit and observe the outcome

`alamr test` is a networked publication operation: it inventories, packs, creates
or reuses a candidate, uploads its immutable bytes and runs checks. It is not the
project's local test command. Run it only in the authorized publication workflow.
`alamr publish` submits that candidate for review. Only the administrator's
successful approval and publication makes it available in the catalogue.
`alamr status --json` reports the actual submission outcome: submitted is not
published. After a timeout, inspect status before repeating a mutation.

The Desktop submit button uses its own session and the existing build/packing
path. It needs no separate CLI login or manual npm pack. Independently invoked
remote CLI commands use documented CLI login or scoped service credentials;
local build and preview do not require that login.

Published bytes and documentation are immutable. A fix is a new snapshot and
review. Keep old releases reproducible; for Plugins, verify the new release can
be installed without changing consumers pinned to an old release.

For a Native Environment use its exported folder and `alamr native check`,
`upload`, `status --wait` and `submit`. A plain engine export uses
`connection: none`; no engine SDK is required to open it from the catalogue.
Do not apply the web bundle bump command to a native entry. Test on its actual
target and follow [native publication](https://agent.al-amr.com/docs/publish/native-publishing.md).

Reference: https://agent.al-amr.com/docs/reference/cli.md
