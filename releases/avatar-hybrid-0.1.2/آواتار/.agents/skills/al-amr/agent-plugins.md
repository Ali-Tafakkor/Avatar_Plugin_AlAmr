# Build and consume a Plugin

A Plugin exports its adapter from dist and declares the export, runtime,
hostKinds, required host capabilities and composition in its manifest. An adapter
without hostKinds is historically Environment-only. A Plugin's installation-scoped
ports come from its host; do not read the host's private code or another Plugin.
Browser Plugins are trusted libraries in the same JavaScript context, not a sandbox.

Activate against the host-provided surface and return cleanup for everything
that activation owns: DOM, listeners, subscriptions and backend resources.
Semantic surfaces and contributions must be declared public exports. The host
composes them; a Plugin does not mount itself inside another Plugin's component.

In an App or Environment, run `alamr add publisher/slug@exact-version --json`.
Read and execute its returned install command with the project's own package
manager. The manifest and package.json pin the Registry's immutable package.
Use `alamr update` or `alamr remove` for subsequent changes. The package manager's
lockfile records dependency resolution; there is no additional Al-Amr lockfile.

Read the installed release under `.al-amr/docs/plugins/`: README.md, integration.md,
manifest and declarations. The index links the installed adapter's entry under
`declarations/`; `types.json` records the complete reviewed graph and artifact
integrity. Keep relative declaration imports in that tree instead of treating
the legacy `types.d.ts` barrel as a self-contained signature. Follow that
release's actual adapter signature, then
build and open the consuming project. For a backend Plugin, include its required
origins in the host bundle's `al-amr.product.json` as described in
[backend network destinations](agent-backend.md#declare-browser-network-destinations).
A grant and the Plugin's own networkAccess declaration do not widen the host CSP.
A standalone Plugin host is not provided.
If an older release contains declaration filenames that cannot be represented
safely on every filesystem, CLI preserves the complete graph in `types.json`
and the entry in `types.d.ts`, omits `declarations/`, and reports
`ALAMR_DOCS_DECLARATION_TREE_UNAVAILABLE`. Read graph contents from that JSON;
do not reconstruct unsafe filenames or interpret the entry alone as the graph.
An Environment starts its installation client only after its
[active lease observation](agent-runtime.md#connection-is-different-from-content-readiness),
and disposes context-bound work when that lease ends. A connected session alone
can precede activation.

### Recover a missing tarball integrity entry

If pnpm reports `ERR_PNPM_MISSING_TARBALL_INTEGRITY` for a managed Plugin,
preserve the existing lockfile. Do not insert a checksum by hand or disable
integrity verification. With pnpm 11.7.0, a stale shared-store resolution can
reproduce this failure even with `--fix-lockfile` or `--force`.

Copy the project's package manifest and package-manager configuration into a
temporary directory, without its lockfile or `node_modules`. Generate a new lock
there using `pnpm install --store-dir <fresh-temporary-store>`, then perform the
intended dependency change with the same store. Compare the managed Plugin's
exact URL and generated SHA512 integrity with the public release's artifact
metadata. Review the full dependency diff: regenerating a lock can update other
versions within their declared ranges. Transfer only the reviewed, generated
manifest and lockfile back, then run `pnpm install --frozen-lockfile` in the
project. A repaired lock does not require a permanent private-store setting.

For a Plugin you author, README.md explains purpose, compatible hosts, installation,
a runnable consumption example, exports, configuration, permissions, errors,
activation and cleanup. Include backend setup and protocol when present. Keep
README, types, package exports and manifest consistent. Execute the example in
an independent consuming project before reporting readiness.

Registry generates published integration.md from the frozen release. The author's
README travels in the same archive and publication. `alamr docs sync` fetches
documentation for the installed version, never silently the newest version.

## Read the backend protocol

The catalogue's versioned `openapi.json` describes the Registry's Environment
**grant acquisition** endpoint. It does not describe the Plugin's own backend
operations. Apps and Environments request grants through their injected Runtime
ports; do not copy that HTTP endpoint into App code.

For the authored backend protocol, read `protocolArtifacts` in the exact installed
manifest and the verified package paths listed in `integration.md`. Open those
files in the installed package. For example, a `pulse-api` artifact at
`./openapi.json` is that package's file, not the catalogue's file with the same
name. Its manifest digest was checked against the immutable managed archive.
Keep README examples, protocol artifacts and declarations consistent.

## Verify a backend grant

A backend supporting both hosts verifies two distinct signed claim shapes. The
Registry's `GET /v1/openapi.json` exposes them under
`components.schemas.PluginGrantClaims` (Environment) and
`components.schemas.AppPluginGrantClaims` (App). The generated JSON Schemas have
the same names. Read those schemas for exact types, required fields and bounds;
both reject unknown claims. An App grant must never be accepted as an Environment
grant by filling in missing Environment fields.

| Claims                                                                                                                                                             | Meaning                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Both: `iss`, `sub`, `aud`, `pluginId`, `releaseId`, `releaseVersion`, `backendComponentId`, `actorSub`, `scope`, `context`, `contractVersion`, `iat`, `exp`, `jti` | Registry issuer, host product, deployment audience, exact Plugin release/component, scoped actor, granted scopes/context, contract version, issue/expiry times in Unix seconds, and grant identity. `exp` must exceed `iat`; scopes are nonempty and unique. |
| Environment required: `environmentId`, `runtimeSessionId`, `runtimeLeaseId`, `runtimeLeaseVersion`, `anonymous`, `origin`, `environmentConfig`                     | `sub` is the Environment id. Authority is fenced by the Runtime session and lease. There is no `host` claim.                                                                                                                                                 |
| Environment optional: `actorKey`, `environmentRoles`, `profile`, `environmentBackend`                                                                              | Scoped cross-Plugin correlation, Registry-derived roles (default `[]`), declared profile access and the reviewed Environment backend boundary.                                                                                                               |
| App required: `host: "app"`, `appId`, `appRevisionId`, `appHostSessionId`                                                                                          | `sub` is the App id. Authority is fenced by the App's own session, without an Environment, Runtime lease, origin or Environment roles.                                                                                                                       |
| App optional: `contextAuthority: "app_backend"`                                                                                                                    | The App backend attested the signed context as described below.                                                                                                                                                                                              |

App `actorSub` is Plugin-keyed, not the App's own `appActorSub`. Treat either
host's actor subject as opaque and scoped; never correlate raw account identities
or assume App and Environment actor subjects identify the same person.

For each protected backend request:

1. Configure the Registry issuer origin and your reviewed backend component's
   `deployment.audience` on the server. Fetch keys from exactly
   `${REGISTRY_ORIGIN}/.well-known/jwks.json`. Use HTTPS (HTTP is for loopback
   development only), bounded time/response size and no redirects. Never derive
   a key URL from an unverified token's `iss`, `jku` or `x5u`.
2. Verify the JWT signature against that JWKS, selecting its `kid`; pin allowed
   algorithms (the Registry currently signs `RS256`). Require the configured
   issuer, exact deployment audience and valid expiry. Then validate the entire
   payload against the appropriate host schema, including `exp > iat` and unique
   scopes; JSON Schema alone does not express these cross-field checks.
3. Bind `pluginId`, `releaseId`, `releaseVersion` and `backendComponentId` to
   your deployed component, require the operation's scopes, and validate the
   signed `context` against its reviewed schema and your own domain policy.
   Never replace signed actor, host or context fields with request JSON. For a
   browser Environment grant, check its product origin. A desktop Environment's
   `https://<32 lowercase hex>.native.invalid` origin is a synthetic session
   marker, not the `alamr-env://` transport origin; its live lease is the fence.
4. Send the original token from your server to exactly
   `${REGISTRY_ORIGIN}/v1/runtime/grants/introspect` with
   `Content-Type: application/json` and body `{"token":"<JWT>"}`. Send neither
   `Authorization` nor browser `Origin`. Bound the request and response and
   refuse redirects. Validate `PluginGrantIntrospectionResponse`, require
   `active: true` and match the host-specific fence to the verified JWT:
   Environment `runtimeSessionId`, `runtimeLeaseId`, `runtimeLeaseVersion`; App
   `host: "app"`, `appHostSessionId`. Respect both JWT expiry and the returned
   `expiresAt`.

An inactive grant is refused. A timeout, malformed response, `429` or `503` is
unavailable authority: do not admit a new request and do not report it as a
revoked identity. Existing connections follow the bounded retry policy below;
no grant remains usable past expiry. An App session token is not a Plugin grant,
and `/v1/apps/session/introspect` is not the Plugin grant introspection route.

## Admit only a backend-decided context

A Plugin grant's `context` is, by default, whatever the host document requested
within the component's `contextSchema`. When an App's own backend attested it
([recipe](agent-backend.md#attest-a-plugin-grant-context)), the App
grant carries `contextAuthority: "app_backend"`. A Plugin backend that must admit
only backend-decided context, such as a media room:

1. Verify the grant JWT with the Registry JWKS: issuer, `aud` equal to your
   deployment, `host: "app"`, exact `pluginId`, `releaseId`,
   `backendComponentId`, scopes and expiry.
2. Refuse unless `contextAuthority === "app_backend"`. Its absence means the
   document chose the context; an Environment grant never carries it.
3. Admit exactly the signed `context`, bound to the grant's `appHostSessionId`
   and Plugin-keyed `actorSub`.
4. End the admission at `exp`: an attested grant expires with its attestation.
   Tell consuming Apps in README.md that they must send `contextAttestation`.

## Re-check many live connections

`POST /v1/runtime/grants/introspect-batch` takes `{"tokens": [...]}` with 1–100
grant tokens, no credential and no browser `Origin`. It answers
`{"results": [...]}` in request order. Each element is exactly what
`POST /v1/runtime/grants/introspect` answers for that token, and a repeated token
gets the same answer in each position. Poll every connection with one request
per interval.

Close a connection only on its own `active: false`. A `429` with `Retry-After`,
or a `503`, refuses the whole batch and says nothing about any grant: retry
later and never disconnect because of it. Each token still spends its
single-route limits — 120 checks a minute per grant, and 20,000 a minute per
deployment for Environment grants. One caller address gets 600 batches a minute,
each body at most 1 MiB. An App grant whose revision a newer publication
superseded stays active while its session lives; a yanked, suspended or blocked
revision answers `revoked`.
