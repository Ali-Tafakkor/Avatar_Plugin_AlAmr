# Product-owned backends

For persistent selected-group connections, follow [groups](agent-groups.md#connect-one-group-to-your-backend).
For credential-bound shared execution, follow [Hampa](agent-hampa.md#authorize-your-backend).
Both use public HTTPS with no Al-Amr package. Hampa introspection is a current
check; the product document's role or activity reference is never backend authority.
For occurrence identity, acknowledgement and connection consent, read
[notifications](agent-notifications.md); for scoped social identities,
read [companionship](agent-companions.md).

Keep backend code, deployment and secrets in the product's own project. Any
language can use the documented HTTPS APIs and JSON schemas. Al-Amr's private
backend helper is not a dependency an outside publisher can install.
Read https://agent.al-amr.com/docs/reference/api.md and the Registry's
`/v1/openapi.json` for exact requests and claim schemas.

An App backend implements the declared `sessionExchangeUrl` and the documented
`private_key_jwt` exchange with Registry. Main sends the launch code and PKCE
verifier to that endpoint and verifies the response; the App frontend never
implements this handshake. If the endpoint is unreachable, or answers 5xx or 429,
Main retries it and may open the App meanwhile for the person the launch names,
with no credential; only a refusal ends the App. Until the exchange succeeds,
`backend.credential` answers a retryable `offline`, so the frontend keeps its
writes locally and syncs on `connected`. Apps and Environments request `backend.credential`
for their own declared backend and check `ok` before reading `data.accessToken`.
Environment requests may carry declared scopes/context; App requests do not. A Plugin
receives an exact-installation grant through its host. Verify issuer, audience,
endpoint, token purpose, expiry, scopes and the exact product/installation;
perform the documented live introspection. Never trust an actor in request JSON.
Standard JWT libraries can verify Registry JWKS; verification is not merely
decoding a JWT. Keep token verification and domain authorization separate.

For background notifications, declare the event and capability, then call
`notifications.connect`. Hand the short-lived, one-use claim code over the
product's authenticated backend channel. The backend claims it using its own
Project token and stores the resulting send token, bound to the returned
product-scoped actor. The frontend never receives the send token.

The backend signals a reviewed occurrence using the same eventId on retries.
An accepted response does not prove delivery or reading. A disconnected or
revoked connection must stop queued work; a Project token alone never selects
a recipient. A Plugin executor is limited to its exact installation, component
and permitted event types. Closing a product does not disconnect an explicitly
authorized background connection.

Use two consenting test accounts to exercise delivery, revocation and isolation.
Companion references are scoped to the product, and reach proofs are short lived.
Do not implement retired companion-notify or platform call routes. Use only
operations present in the installed API description and current HTTPS reference.

For delegated live alerts, explicitly request `notifications.connect({liveAlerts:true})`
in addition to the normal connection consent. Send or end at
`/v1/workloads/alerts/send` and `/v1/workloads/alerts/end` with the Project bearer
and connection `sendToken`. The send body otherwise matches Runtime `alerts.send`.
Registry verifies the current companion relationship and independent receive
consent; acceptance reveals no delivery, presence or silence state. A Plugin
executor can use only its allowed events from the same current installation.

## Implement the App session exchange

The App's reviewed manifest registers the public signing key. There is no
separate secret registration step: generate an ES256 P-256 key pair on the
backend, keep the private key outside source control and the published bundle,
and put only its public JWK in `backend.keys`. Each key has exactly `kty: "EC"`,
`crv: "P-256"`, `alg: "ES256"`, `use: "sig"`, a unique `kid` (1–64 ASCII letters,
digits, dots, underscores or hyphens), and unpadded base64url `x` and `y`
coordinates of 43 characters. Never include `d`. Declare one to four keys,
`backend.sessionExchangeUrl`, and `backend.environments` (`"any"` or an explicit
nonempty Environment list). The normal `alamr test` and `alamr publish` workflow
reviews and freezes that declaration with the revision. Include the endpoint's
origin in the bundle network declaration below.

Configure the final linked `appId` and Registry issuer on the server. Main sends
this request to the declared session exchange URL, without cookies or a bearer
token, and refuses redirects:

```http
POST /your-session-exchange
Origin: alamr-app://app_YOUR_LINKED_ID
Content-Type: application/json

{"code":"<launch code>","codeVerifier":"<PKCE verifier>","bridgeNonce":"<nonce>"}
```

Validate the exact `AppBackendSessionExchangeRequest` schema from Registry
OpenAPI. The request deliberately has no `appId`; use your configured linked
identity. Require the exact `alamr-app://<appId>` Origin, without a trailing
slash, and preserve it on your server-to-Registry exchange. Do not derive this
value with `new URL(value).origin`: custom schemes can return `"null"`. Origin
checking does not authenticate the person; Registry validates the launch code,
PKCE and publisher assertion. A local preview alias is not the published App's
identity and must not be admitted by a broad wildcard.

Sign a fresh compact JWS with the private key corresponding to a reviewed `kid`:

| Part               | Value                                                                              |
| ------------------ | ---------------------------------------------------------------------------------- |
| Header             | `{"alg":"ES256","typ":"JWT","kid":"<reviewed kid>"}`                               |
| `iss`, `sub`       | The same configured linked `appId`                                                 |
| `aud`              | Exact Registry issuer + `/v1/apps/session/exchange`, not the bare issuer           |
| `jti`              | A new random identifier, 8–128 characters                                          |
| `iat`, `exp`       | Unix seconds, `exp > iat`, lifetime at most 120 seconds                            |
| `launchCodeDigest` | `sha256:` followed by lowercase SHA-256 hex of the exact launch code's UTF-8 bytes |
| Optional `nbf`     | Unix seconds; do not set it in the future                                          |

Use `AppClientAssertionClaims` for the exact claim shape. No extra claims are
accepted. Check the cross-field conditions above as well as JSON Schema;
Registry permits only five seconds of clock skew. `typ: "JWT"` is the recommended
client assertion type; `app-context+jwt` is reserved for Plugin context
attestations and is refused here. For example, with a standard JWT library:

```js
const now = Math.floor(Date.now() / 1000);
const assertion = await new SignJWT({
  launchCodeDigest: `sha256:${createHash("sha256").update(request.code, "utf8").digest("hex")}`,
})
  .setProtectedHeader({ alg: "ES256", typ: "JWT", kid })
  .setIssuer(appId)
  .setSubject(appId)
  .setAudience(`${registryIssuer}/v1/apps/session/exchange`)
  .setJti(randomUUID())
  .setIssuedAt(now)
  .setExpirationTime(now + 60)
  .sign(privateKey);
```

Here `SignJWT` is from `jose`; `createHash` and `randomUUID` are Node's standard
crypto functions. Other languages can sign the same bytes with their JWT library.
Send JSON to the configured Registry endpoint, with no Authorization header:

```json
{
  "grantType": "app_launch_code",
  "appId": "app_YOUR_LINKED_ID",
  "code": "<unchanged launch code>",
  "codeVerifier": "<unchanged verifier>",
  "bridgeNonce": "<unchanged nonce>",
  "clientAssertionType": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
  "clientAssertion": "<signed compact JWS>"
}
```

Set `Origin` to the exact checked App origin. Bound response size and time and
refuse redirects. On success, validate `AppSessionTokenResponse` and return that
response unchanged to Main; do not wrap it, mint a replacement access token, or
substitute a product session cookie. Main checks the Registry signature, actor,
revision, host generation and permission bindings. Launch codes are single use;
an invalid assertion can consume the code. Never replay an ambiguous exchange
as a new login or cache assertions for other launch codes. Main owns subsequent
launch/renewal attempts. Keep codes, verifiers, assertions and session tokens out
of logs. Preserve meaningful refusal versus temporary failure: Main treats
backend 401/403 as refusal and 429/5xx as unavailable authority.

For each protected product request, the frontend obtains its current
`backend.credential({})` and sends the access token to your backend. Verify the
Registry signature using its configured JWKS (RS256, `typ: "JWT"`, configured
issuer, audience equal to your App id, valid expiry and `AppSessionClaims`).
Require your App id and `appAuthMethod: "private_key_jwt"`. Then POST
`{"token":"<that original token>"}` to the configured Registry's
`/v1/apps/session/introspect`, with JSON content type and no Authorization or
browser Origin header. Validate `AppSessionIntrospectionResponse`, require
`active: true`, unexpired `expiresAt`, and matching App, revision, session,
scoped actor and host bindings. Use that actor as the owner of private data.
Current roles and Hampa authority come from introspection, not client JSON.
A timeout or malformed reply admits no protected work; it is not proof that
the person's session was revoked. Group proofs have their separate documented
expiry and revocation bounds.

## Declare browser network destinations

A valid credential does not by itself permit a browser connection. Desktop serves
App and Environment bundles with a Content Security Policy that admits their own
origin, the Registry, and the origins declared in the bundle's
`al-amr.product.json`. Include this file at the root of the built output whenever
the frontend or an installed Plugin fetches its backend:

```json
{
  "capabilities": [],
  "backends": ["https://pulse.example"]
}
```

Use the actual reviewed backend origins, including the origins required by your
installed Plugins. An origin has a scheme, host and optional port, with no path,
wildcard or trailing slash. For local development only, a loopback HTTP origin
such as `http://localhost:47520` can be declared. HTTP(S) origins also admit the
matching WS(S) origin. Keep this file in your build inputs so every build copies
it; publication freezes these bytes with the rest of the bundle.

The `capabilities` array uses the versioned capability catalogue. Preserve any
capabilities the product actually needs; this example requests none. This file
does not grant capabilities, replace consent, authorize a backend operation or
replace the App/Environment manifest. A Plugin's own `networkAccess` declaration
also does not add an origin to its consuming host's bundle automatically.

If grant acquisition succeeds but the backend sees no request, inspect the
browser's CSP diagnostic and this bundled file before changing authentication.
Do not weaken the client's policy or forward the request through an unrelated
origin. Backends must independently verify credentials and implement the required
CORS response for their supported browser callers.

## Attest a Plugin grant context

Use this when a Plugin backend must admit only a context your App backend
decided — a room assignment, for example — and not one the App document typed.
The document asks your backend; your backend authorizes the person from its own
`POST /v1/apps/session/introspect` of the document's credential and returns a
compact JWS; the document passes it unchanged:

```js
const granted = await alamr.plugins.grant({
  pluginId,
  releaseVersion,
  backendComponentId,
  scopes,
  context,
  contextAttestation,
});
if (!granted.ok) {
  // refused; read granted.error
}
```

Sign with the private half of one of the reviewed `backend.keys` of the App
revision the session is on — the same keys as `private_key_jwt`:

| Part         | Value                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------- |
| Header       | `{"alg":"ES256","typ":"app-context+jwt","kid":"<a declared kid>"}`                             |
| `iss`        | Your `appId`                                                                                   |
| `aud`        | The Registry issuer (the `iss` of the App session credential) + `/v1/apps/plugins/grants`      |
| `sub`        | The introspected `appActorSub` — never a Plugin grant's Plugin-keyed `actorSub`                |
| `ahs`        | The introspected `appHostSessionId`; App Plugin grants need a platform-hosted App              |
| `plg`        | The `pluginId` being granted                                                                   |
| `ctx`        | base64url, unpadded, of SHA-256 over the RFC 8785 canonical JSON of the exact `context` object |
| `iat`, `exp` | Seconds; `exp` after `iat` by at most 300. Optional `jti` of 16–128 characters                 |

Canonical JSON sorts object keys and has no whitespace, so key order in the
document's request does not matter; any changed value does. A client assertion
is never an attestation, or the reverse: their `typ` and `aud` differ.

Registry compares every claim with the session serving the request. Any
mismatch, expiry, future `iat` beyond a few seconds of skew, unknown `kid`, or an
App revision without `backend.keys` is refused with one code,
`403 context_attestation_invalid`. On success the grant carries
`contextAuthority: "app_backend"` and expires no later than the attestation; the
response `expiresAt` says when. Fetch a fresh attestation before the current one
ends, whenever `context` changes, and once after `context_attestation_invalid`.
Registry stores nothing about attestations, so nothing can be revoked: keep them
short.

A revision superseded by a newer publication keeps its live sessions, renewal
and Plugin grants for the life of its host session; a yanked, suspended or
blocked revision, or an App no longer served, ends them at once. Those sessions
are still verified against their own revision's keys, so when rotating
`backend.keys` keep the retiring private key until older sessions have ended.
