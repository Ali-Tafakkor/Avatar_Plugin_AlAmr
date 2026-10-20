# Use persistent groups

Read this when building an App or web Environment that uses جمع: a shared
archive, discussion space, class or another product feature based on existing
group membership. Groups work in ordinary use with Hampa disabled. For live
leader/follower execution, also read [Hampa](agent-hampa.md).

## Start without a package

Use the injected `window.alamr`; install no Al-Amr package, SDK or Plugin.
The product owns its UI, domain data and optional backend. A backend uses the
HTTPS operations below in any language; it needs no private platform library.

In an existing project, read its `AGENTS.md` for the exact `alamr` launcher.
Use `alamr docs sync --local --json` to refresh the shipped guide and local
declarations. Inspect the installed contract with `alamr api describe --role app --json`
or `--role environment`. `alamr api types --role app` (or environment)
writes standalone declarations. Do not import types from `@al-amr/contracts`.

### Declare only the features you use

| Feature                                                   | Capability                               | Additional requirement                                                                                                 |
| --------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| List groups, read a group or its members, observe changes | `platform.groups.read@1`                 | The person's grant                                                                                                     |
| Prove the person's own membership to your backend         | `platform.groups.read@1`                 | A backend that verifies the proof; see below                                                                           |
| Follow one group while the product is closed              | `platform.groups.connect.background@1`   | Read capability, declared backend and explicit approval of that product/group connection                               |
| Send invitations to a group's members                     | `platform.notifications.publish.group@1` | Read and `platform.notifications.publish.self@1`, plus a reviewed invitation event                                     |
| Receive group invitations from this product               | `platform.notifications.receive.group@1` | Recipient's own grant and `platform.notifications.publish.self@1`                                                      |
| Ring a group you own or manage, for example for a call    | `platform.alerts.send.group@1`           | Read capability and a reviewed live-alert event; see [live alerts](agent-notifications.md#ringing-a-group) |
| Be rung by a group from this product                      | `platform.alerts.receive.group@1`        | Recipient's own grant                                                                                                  |

Manifest fragments below are additions to the project's existing manifest, not
complete manifests. Preserve unrelated capabilities and fields.

**App:** use `required` when the product cannot work without groups; put the
same capability object in `optional` when group use is optional.

```json
{
  "capabilities": {
    "required": [{ "id": "platform.groups.read@1", "versionRange": "^1.0.0" }],
    "optional": []
  }
}
```

**Environment:** capabilities are strings, not the App object shape.

```json
{
  "capabilities": ["platform.groups.read@1"]
}
```

Run `alamr validate --json` after editing. A declaration does not grant consent.
Wait for `runtime.subscribe` to supply a plain status snapshot whose
`state.connection === "connected"` before protected reads. This subscription has
no `ok/data` envelope; see the [connection observer](agent-runtime.md#connection-is-different-from-content-readiness).
An injected bridge
can exist before its session is ready. Check `permissions.list()` and its
`data.capabilities` entries (`id`, `available`, `granted`).

For a missing optional App permission, or an Environment permission, show a
feature-specific action. From that action's fresh user gesture call
`permissions.request({capability: "platform.groups.read@1"})`; Main presents
the real consent. Continue only on `ok && data.granted`. Request prerequisites
individually when needed. Required App capabilities go through launch consent;
do not try to request them as optional capabilities later.

An App admitted before its session reads as `offline` here: keep group features
unavailable and ready the rest of the product.
A useful Environment permission screen may call `runtime.ready()` while clearly
leaving group features unavailable. Do not deadlock startup waiting for a grant
the person has no way to request. Preserve denied, cancelled, connecting and
offline states. Never request permission repeatedly from a timer.

## Choose the correct identity and data lifetime

| Value                                  | Meaning and use                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `groupRef`                             | Stable for this product and shared by its members; use it to find the product's persistent group record |
| `role` in a group summary or member    | `owner`, `manager` or `member`; current group role, not platform administration or Hampa leadership     |
| Member `subject`                       | Identity scoped to this product; an App gets `aact_…`, an Environment gets `act_…`                      |
| `metadataVersion`, `membershipVersion` | Opaque change markers; compare equality to decide what to refresh                                       |
| List `version`, `nextCursor`           | One collection snapshot and the opaque continuation of its pages                                        |

Two members of your product see the same `groupRef`; another product sees a
different reference for that group. Scope storage by Registry and product as well
if your backend serves several of them. A rename, new invitation code or new
Hampa session does not create a new archive. Two same-name groups stay separate.

Create or find product content when the person chooses to use a group. Use a
unique product-owned key such as `(registry, product, groupRef)` and an atomic
create-or-get operation, so simultaneous first visits cannot create duplicate
rooms. Merely listing groups should not provision a room for every group.

Platform membership and your product's content policy are separate. Ending a
membership removes fresh membership-based authority; it does not automatically
delete product archives, downloaded files or recoverable drafts. Do not make a
group owner an administrator of the entire product.

## Read and observe only what is needed

All Runtime calls return `{ok:true,data}` or `{ok:false,error}`. `groups.list`
returns `groups`, `version`, `nextCursor`. `groups.get({groupRef})` returns one
summary with `name`, `description`, `role`, `memberCount` and both change markers.
`groups.members({groupRef,…})` returns `members`, `version`, `nextCursor`.
Members contain `subject`, `displayName`, `role`, and an optional `avatarUrl`;
do not require a picture to render a person.

Read the first group page, let the person select a group, then read that group's
members only if the feature needs them. Default page size is 30; allowed sizes
are 1–100. A page limit is not a membership capacity.

This reusable example collects a single consistent page set. The caller chooses
when to restart after `group_page_changed`; this helper never loops forever on
a changing group or turns a refused page into an empty list.

```js
async function readGroupPages(readPage, field, signal) {
  const items = [];
  let cursor;
  let version;
  do {
    signal.throwIfAborted();
    const result = await readPage({ limit: 30, ...(cursor ? { cursor } : {}) });
    signal.throwIfAborted();
    if (!result.ok) return result; // Discard partial pages on any refusal.
    const page = result.data;
    if (version !== undefined && page.version !== version) {
      throw new Error("Page versions differ; restart the listing");
    }
    version = page.version;
    items.push(...page[field]);
    cursor = page.nextCursor;
  } while (cursor !== null);
  return { ok: true, data: { items, version } };
}
```

For groups, pass `(page) => alamr.groups.list(page)` and `"groups"`.
For members, pass `(page) => alamr.groups.members({groupRef, ...page})` and
`"members"`. Cancel the caller's `AbortController` on selection change or disposal;
it prevents a late result from being used even though Runtime owns its transport.
For large lists, keep the same rules while rendering incremental pages.

Observe both levels when the UI consumes them:

```js
const stopCollection = alamr.groups.subscribe((result) => {
  // kind: "collection", version: the person's entire group collection.
  // On a changed version, reload the list from page one, including new groups.
  onCollectionResult(result);
});
const stopSelected = alamr.groups.subscribe({ groupRef }, (result) => {
  // kind: "group", groupRef, metadataVersion, membershipVersion, role.
  // Refresh summary or roster only when the corresponding marker changes.
  onSelectedGroupResult(result);
});
// On selection change/disposal: stopSelected(); stopCollection();
```

`onCollectionResult` and `onSelectedGroupResult` are your UI/cache reducers.
Keep loading generations per selection; invalidate pending work before clearing
inaccessible content. Do not start an overlapping full roster fetch on every hint.
`groups.state()` reads the collection marker once; `groups.state({groupRef})`
reads one group's markers and current caller role once.

Subscriptions deliver an initial read, reread after hints and reconnect, and
repair missed group hints at most every 30 seconds while consumed. Unsubscribe
when no longer needed; Main owns the repair timer. Versions are opaque equality
keys, not clocks, event history or authorization. Same member count does not mean
same membership or roles.

The read grant covers the roster without a second consent ceremony for each
member page. The shell's compact view for an ordinary member is a UI choice;
it is not a promise to conceal the roster from a consented product.

## Prove membership to your backend

Use this when your backend must decide, at the moment a person acts, whether they
may enter something that belongs to a group — joining a group's voice room, for
example — and nothing needs to run while the product is closed. It needs only
`platform.groups.read@1`, no background connection and no approval flow.

Ask for a fresh proof immediately before each protected request and send it to
your backend with that request, over your authenticated product channel:

```js
const proof = await alamr.groups.attest({ groupRef });
if (!proof.ok) return showGroupUnavailable(proof.error); // Not a member, or no grant.
await fetch("/api/rooms/join", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: productCredential },
  body: JSON.stringify({ groupRef, membershipProof: proof.data.token }),
});
```

`data` is `{token, role, expiresAt}`. `role` is for the page's own display; your
backend reads the role from the verified token, never from the page. A person who
is not in the group, and a `groupRef` from another product, are refused exactly as
`groups.get` refuses them. The proof is valid for sixty seconds and is not a
roster: it says nothing about any other member.

The token is a JWT signed by the Registry with the same key as its other proofs.
Verify it offline, in any language, with an RS256 verifier and the Registry's
`/.well-known/jwks.json`:

1. Fetch and cache the JWKS from your configured, trusted Registry origin; select
   the key by the header `kid`, refetch once for an unknown `kid`, and accept only
   `alg: "RS256"`.
2. `iss` equals that Registry origin exactly.
3. `aud` equals your own App or Environment id.
4. `tokenUse` is `app_group_membership` for an App, or
   `environment_group_membership` for an Environment.
5. `sub` equals the actor your backend authenticated for this same request — for
   an App, the `appActorSub` from `POST /v1/apps/session/introspect` of the
   document's credential; for an Environment, the Runtime session's `act_` actor.
   A proof for anybody else is refused, however valid its signature.
6. `groupRef` equals the group the request names.
7. `exp` is `iat + 60`, `iat` is not in the future beyond a few seconds of clock
   skew, and `exp` has not passed.
8. Authorize from `role` (`owner`, `manager` or `member`) under your own product rules.
9. Compare `memberEpoch` with the one you stored when this person last entered.
   It stays the same while they remain a member and changes when they leave and
   rejoin, so a different value means a new membership: discard room state, bans
   or seats you kept for the old one. It is an opaque equality key, not comparable
   between products.

```js
import { createRemoteJWKSet, jwtVerify } from "jose";

const jwks = createRemoteJWKSet(new URL("/.well-known/jwks.json", REGISTRY_ORIGIN));

export async function verifyMembership(token, { appId, actorSub, groupRef }) {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: REGISTRY_ORIGIN,
    audience: appId,
    algorithms: ["RS256"],
    clockTolerance: 5,
  });
  if (
    payload.tokenUse !== "app_group_membership" ||
    payload.sub !== actorSub ||
    payload.groupRef !== groupRef ||
    payload.exp !== payload.iat + 60 ||
    !["owner", "manager", "member"].includes(payload.role) ||
    !/^gme_[A-Za-z0-9_-]{22}$/.test(payload.memberEpoch)
  )
    throw new Error("membership_proof_invalid");
  return { role: payload.role, memberEpoch: payload.memberEpoch };
}
```

`jose` is one ordinary JWT library, not a platform dependency; the published
`AppGroupMembershipClaims` and `EnvironmentGroupMembershipClaims` schemas in the
Registry's `/v1/openapi.json` state the exact claim set, and a token with any other
claim is not one of these. Replay within the minute is the proof's own bound:
tie it to the request it arrived with, and use `jti` to refuse a second use if your
action must not repeat. Removal from the group stops new proofs at once; an issued
proof expires within sixty seconds, so re-check membership for anything that lasts
longer — ask the page for a new proof, or connect the group below.

## Connect one group to your backend

Add the background capability and its read prerequisite to the manifest using
the shape for your role. Declare the product backend using the
[manifest reference](https://agent.al-amr.com/docs/reference/manifests.md). An App backend declares
`sessionExchangeUrl`, public `keys` and `environments`; an Environment backend
declares its own `audience`, `endpointUrl` and `grantScopes`. Keep secrets on that
backend. See [backend authority](agent-backend.md).

The product calls `groups.connect({groupRef})` after the person chooses to connect.
Main confirms the named product and selected group. On success, `data` has
`connectionId`, `claimCode`, `claimExpiresAt`. Forward that one-use code only to
your declared backend, over your authenticated product channel. Cancelling the
confirmation does not replace a prior connection. Calling `connect` on every
render or reconnect would create needless approval flows and connections.

The backend redeems the code before `claimExpiresAt` (currently five minutes):

```http
POST /v1/workloads/groups/connections/claim
Authorization: Bearer <this-product-project-token-with-groups:read>
Content-Type: application/json

{"claimCode":"<the-approved-code>"}
```

A `201` body has `connectionId`, `accessToken`, `groupRef`, `subject`.
Authenticate the request actor independently, and compare that actor's
product-scoped subject and selected group with the returned values before
associating the connection with their account in your backend. A page cannot
choose those values. Store the connection credential in protected backend storage;
return an application receipt to the page, never the `accessToken` or Project token.

Claiming is one-use, including under concurrent requests. Persist a successful
response before acknowledging your frontend. A lost claim response is not proof
of failure and a blind retry cannot recover an already-issued credential. If no
credential was retained, have the person revoke the unusable connection and
explicitly reconnect. Do not pretend the connection succeeded.

### Read through the approved connection

| Request                                   | Inputs beyond the two credentials                           |
| ----------------------------------------- | ----------------------------------------------------------- |
| `GET /v1/workloads/groups/get`            | None; returns the connected person's group summary and role |
| `GET /v1/workloads/groups/state`          | None; returns that group's change markers and role          |
| `GET /v1/workloads/groups/members`        | Optional `cursor` and `limit` query parameters              |
| `DELETE /v1/workloads/groups/connections` | None; revokes this connection                               |

Every request sends `Authorization: Bearer <Project token>` **and**
`X-Al-Amr-Group-Token: <accessToken>`. The credential selects exactly one group;
do not supply a replacement `groupRef` or use account/device routes. A Project
token alone does not authorize group reading. A connection authenticates the
connecting member; it does not authenticate every caller of your backend.
Authorize another caller using their own verified product identity and fresh
membership evidence, never a browser-supplied roster or role.

For reads, retain `ETag` and send it unchanged as `If-None-Match` for the same
connection, endpoint and page. This dependency-free backend example performs one
conditional summary read; pass a configured, trusted Registry origin.

```js
async function readConnectedGroup({
  registryOrigin,
  projectToken,
  accessToken,
  etag,
  fetcher = fetch,
}) {
  const response = await fetcher(new URL("/v1/workloads/groups/get", registryOrigin), {
    headers: {
      authorization: `Bearer ${projectToken}`,
      "x-al-amr-group-token": accessToken,
      ...(etag ? { "if-none-match": etag } : {}),
      accept: "application/json",
    },
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(3000),
  });
  if (response.status === 304) {
    if (!etag || response.headers.get("etag") !== etag) {
      throw new Error("Invalid conditional response");
    }
    return { kind: "unchanged", etag };
  }
  const body = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error("Group read failed"), {
      status: response.status,
      code: body.code,
    });
  }
  return { kind: "changed", data: body, etag: response.headers.get("etag") };
}
```

Validate successful JSON against the corresponding OpenAPI schema before storage
or authorization, and enforce bounded response sizes in your backend HTTP layer.
Preserve a validator's `W/` prefix. A fresh encrypted cursor alone does not mean
the members changed. `304` means this request passed current authority checks;
an old ETag or a failed request does not. Keep cached display data separate from
permission to read new content or perform actions.

Poll `state` normally every 30 seconds, with backoff on failures; fetch metadata
and members when their markers change. No platform WebSocket or SDK is required.
Use the same consistent pagination rules and discard a page set on
`group_page_changed`.

On `403 group_connection_inactive`, stop synchronization and require a new
explicit connection. `401 workload_credential_invalid` or
`403 workload_scope_denied` needs backend credential/configuration repair;
it is not the person's refusal. `429`, network loss and server errors warrant
bounded retry/backoff without authorizing new work from stale data.

Closing the product does not revoke an approved background connection. Removal
and rejoining, consent revocation and regrant, withdrawal or publisher authority
change do not revive an invalidated connection. The person can revoke it through
the shell or `groups.disconnect({connectionId})`; the backend can use the DELETE
above. Disconnection deletes no product content and ends no group.

## Invite a group to your own activity

This needs no product backend and does not start Hampa. Add the sender/recipient
capabilities from the table only where needed. Add this reviewed event to
`notifications.eventTypes`; preserve the remaining notification configuration:

```json
{
  "type": "reading.invited",
  "label": "Reading invitation",
  "policy": {
    "family": "invitation",
    "subject": { "mode": "keyed", "revision": "source_monotonic" },
    "effects": ["raise", "resolve"],
    "preferenceKey": "reading-invitations",
    "pulse": "none",
    "presentation": { "kind": "source" }
  }
}
```

Construct the occurrence once for the person's invitation action, retain it and
retry the exact same body and time if the result is unknown:

```js
const invitation = {
  groupRef,
  occurrence: {
    eventId: crypto.randomUUID(),
    eventType: "reading.invited",
    effect: "raise",
    occurredAt: new Date().toISOString(),
    subjectKey: "reading:42",
    revision: 1,
    content: {
      kind: "source",
      title: "Join our reading",
      action: { kind: "open_app" },
    },
  },
};
const result = await alamr.notifications.signalGroup(invitation);
// Inspect result.ok; accepted:true means queued, not delivered or read.
```

For an Environment, use `{kind:"enter_environment", environmentId: yourEnvironmentId}`.
Only the sender product's own destination is accepted. The action opens the
product; keep the choice of a particular document/activity in your product's
authorized state. There is no arbitrary group or activity payload in this action.
For another occurrence on the same keyed subject, allocate a greater revision in
your product's state; do not reset revision to 1 for each member or retry.

Registry rechecks current membership, publication, sender permission, bilateral
blocks and each recipient's independent receive consent when delivering.
Acceptance discloses no recipient, count, reading status or private refusal.
Source-authored invitations cannot request a platform pulse. Sending an invitation
does not open products, change workspaces or grant media consent. Group reading,
background connection and notification permission remain separate.

## Refusals and verification

At the Runtime boundary, handle `error.code` and `retryable` using the installed
API declaration. `group_page_changed` means restart that listing, not retry its
old cursor. On permission loss, stale context/document or unavailable authority,
stop using old results. Runtime errors are normalized; do not assume the HTTP
problem codes above are passed verbatim through `window.alamr`, or infer private
membership/refusal reasons from a generic error. A failed read is not an empty group.

Before reporting the feature ready, exercise:

- Two accounts select the same group: one product record; a rename finds it again.
- Another product and a same-name second group do not collide with that record.
- A new group appears through the collection subscription; role change with
  unchanged count refreshes the appropriate UI and backend policy.
- Membership changes during pagination: partial pages are discarded; a late
  response after selection change cannot replace the current view.
- Consent or membership ends with the UI open and with it closed: new reads and
  sensitive actions fail; regrant/rejoin does not revive the old connection.
- Invitation retries do not duplicate news; a recipient without receive consent
  gets no invitation and the sender learns no private reason.
- A membership proof is refused by the backend for any actor but the one it
  authenticated, after sixty seconds, and for another product; leaving and
  rejoining gives the backend a new `memberEpoch`.
- A group ring reaches only consenting members, never a plain member's send, and
  disappears for a member removed while it rings.
- All ordinary group features still work with Hampa disabled.

Use typed local fakes for UI states, then verify Registry behavior with published
products and real accounts. `alamr dev`/preview providers are not evidence of
live membership or delivery. The exact HTTPS schemas are in the Registry's
`/v1/openapi.json`; the [API reference](https://agent.al-amr.com/docs/reference/api.md) supplies context.
