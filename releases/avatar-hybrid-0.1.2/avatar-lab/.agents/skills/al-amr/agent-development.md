# Verify a product in Desktop

Read this for code changes and debugging. For a read-only review, inspect the
relevant evidence without starting publication or rewriting project context.

## Use the project's tools and the installed client

Use the exact CLI launcher recorded in `AGENTS.md`; `alamr` below stands for
that launcher. Quote paths with spaces or Persian characters; PowerShell uses
`&` before a quoted executable. The CLI ships with Desktop, not npm. If no launcher
is recorded and `alamr` is absent from PATH, use the installed Desktop's documented
`--cli` entry. Do not install a similarly named package or assume a private
platform checkout exists.

Run the project's relevant tests and its declared build. `alamr build --json`
uses the project's build script, or reports that no build is required when
`dist/` is authored source. Preserve its package manager and lockfile. If a
dependency or tool is missing, use `alamr doctor --profile bootstrap --json`
and the project's setup instructions to diagnose it.

After the final build, for an App or web Environment:

```sh
alamr validate --json
alamr doctor --profile project --json
alamr dev --json
alamr preview inspect --json
alamr preview verify --json
```

Inspect the returned diagnostics and `nextActions`. Exercise the changed behavior
and capture the view when visual behavior matters. Plugins need an independent
consuming App or Environment; build and inspect that host with the exact adapter
installation. There is no standalone Plugin host to substitute for consumption.

## Select a usable inspection session

For account-free inspection, launch the installed desktop executable with
`--preview-only`. It prints `ALAMR_PREVIEW_CLIENT_STARTING` and a temporary
`profile`. Set `AL_AMR_AUTHORING_STATE_DIR` to that profile and
`AL_AMR_PRODUCTS_ROOT` to its `products` subdirectory for the CLI commands in
this session. This mode uses no account or Registry authority. Use the launcher
for that preview profile or the executable's `--cli` entry; a normal-profile
launcher can set its own profile defaults.

In a normal client, finish sign-in before inspecting an App: content can load
while the trusted sign-in screen still covers its frame. A capture refusal is
not a successful visual check. Local build and isolated preview do not require
the CLI's separate Registry login.

## Check behavior and the bytes that produced it

Rebuild and reopen after changes. Compare the preview's build digest and document
generation before attributing evidence to the new code. Desktop is not a build
watcher, and an old open view cannot prove the latest source works.

Use the installed `alamr api describe --json` and preview command help for
available scenarios. For connection handling, apply
`alamr preview scenario --scenario offline --json`, observe the unavailable state,
then exercise reconnection through the documented scenario. That offline state,
with identity still present, is also how a published App opens while its own
backend is down, so the product must still become ready in it. Also exercise denied
permissions or lost context when those affect the feature.

Browser tests may use a small typed fake for the operations they exercise. Keep
it in a test/development entry, never overwrite a real injected API and prove it
is absent from the released output. Desktop preview uses the real bridge with
isolated providers; it does not prove Registry membership, cross-account delivery
or backend authorization. Those require the compatible published revision and
real consenting accounts on a deployment with the feature enabled.

Report what was exercised, the exact output/revision and whether providers were
simulated or real. If a required check is blocked, name the missing evidence.
Use stable error codes and `retryable`, not English error text; do not turn an
unknown mutation result into a fresh duplicate operation.

## Keep publication separate

`alamr test` is a networked operation that uploads and binds an immutable
candidate. `alamr publish` sends it for review. Run them only as part of the
person's requested publication work; they are not substitutes for the tests above.
For release versions and retries, read [publishing](agent-publishing.md).
