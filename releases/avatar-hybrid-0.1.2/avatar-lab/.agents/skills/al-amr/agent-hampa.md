# Support Hampa

Read this when an App or web Environment should participate in همپایی: the
group owner leads consenting participants through compatible products. Use
the injected `window.alamr` and your product's own communication/storage tools.
No Al-Amr package, SDK or Plugin is needed, including on your backend.

Hampa is an optional experiment. A group archive or group invitation works
without it; see [persistent groups](agent-groups.md). Personal
companionship is separate from both group membership and participation here.

## Decide what your product shares

Main, the trusted desktop process, opens, closes and selects products. Your
product supplies the experience inside its own execution:

| Product example  | Persistent data                                | State shared in this activity                                           |
| ---------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| Presentation App | Documents indexed by `groupRef`                | Selected document, slide and pointer indexed by `activityRef`           |
| Conversation App | Archive governed by the product's group policy | Current meeting, media and per-person controls                          |
| 3D Environment   | Group-owned scene or saved work                | Room admission, current scene state, spawn positions and movement rules |

These are implementation examples, not platform-provided rooms or services.
Receiving the same activity reference does not synchronize a slide or open a
media connection. Use your own backend, peer protocol or chosen service for
that. A frontend-only product is supported, but local storage alone cannot
make different people's documents share live state. Never claim a private
room or verified remote identity merely because peers sent matching references.

First implement normal use. Then add a distinct shared mode that joins the
existing activity, restores its current state, reacts to lost authority and
recovers drafts. Keep group data independent of a temporary Hampa session.

## Declare compatibility on the actual revision

Inspect the installed contract using `alamr api describe --role app --json`
or `--role environment`. Refresh local standalone `alamr.d.ts` with
`alamr docs sync --local --json`. Runtime API compatibility and Hampa version
are different fields; keep the project's compatible Runtime range.

Merge these fragments into the existing manifest and run `alamr validate --json`.
Preserve all other capabilities and fields.

**App** (`al-amr.app.json`):

```json
{
  "runtimeApi": "^1.0.0",
  "hampa": { "version": 1 },
  "capabilities": {
    "required": [{ "id": "platform.hampa.context@1", "versionRange": "^1.0.0" }],
    "optional": []
  }
}
```

**Environment** (`al-amr.environment.json`, with a web `entry.kind: "bundle"`):

```json
{
  "runtimeApi": "^1.0.0",
  "hampa": { "version": 1 },
  "capabilities": ["platform.hampa.context@1"]
}
```

Hampa v1 admits managed web bundles. Native Environments are not admitted,
including native entries with a lifecycle bridge; `connection:none` cannot
receive this product context. The App context capability must be **required**,
not optional. A context-only product does not need `platform.groups.read@1`.
Add that grant only for group archives, group roles or the full member roster.

For a persistent App such as a call that should keep running when put away,
declare its normal `display.background: "persistent"` behavior and test it.
Compact/Workspace presentation is not a new activity. Compatibility is a promise
about the actual immutable revision's behavior, not just successful schema parsing.

Wait for `runtime.subscribe` to supply a plain status snapshot with
`state.connection === "connected"`. This subscription has no `ok/data` envelope;
see the [connection observer](agent-runtime.md#connection-is-different-from-content-readiness).
Apps receive required consent at launch. A shared execution is never opened
before its session: if the App's backend does not answer two quick retries, the
platform tells the group the App's service is not available and closes the
activity for everyone. An App that also opens on its own may be admitted offline
while its backend is down; `hampa.state()` then answers a retryable `offline`.
Such a document is not part of a shared activity, so treat it as an ordinary open
instead of waiting for Hampa context.
An Environment may already be connected while a Registry permission is missing:
inspect `permissions.list()` and offer a fresh-gesture
`permissions.request({capability:"platform.hampa.context@1"})` action. Main owns
the consent. Show a usable permission choice rather than blocking startup behind
an invisible prompt. Participation never inherits the leader's permissions.

## Read the execution context

`hampa.state()` reads once; `hampa.subscribe(listener)` supplies the initial
result and updates. Both return the same discriminated context:

```js
const stop = alamr.hampa.subscribe((result) => {
  if (!result.ok) {
    suspendSharedActions(result.error);
    return;
  }
  const context = result.data;
  if (context.mode === "normal") {
    showOrdinaryProduct();
    return;
  }
  reconcileOwnActivity(context);
});
// Call stop() when disposing this consumer.
```

The three named functions are your product's state handlers. They must not turn
a refusal into `normal`, reopen a stopped product, or create a room on every
callback. Suspend actions immediately on connection/authority loss; the last
successful callback is not continuing authorization.

| Field in `mode: "hampa"` | Exact meaning                                                     |
| ------------------------ | ----------------------------------------------------------------- |
| `version`                | `1`                                                               |
| `groupRef`               | Persistent group reference scoped to this product                 |
| `sessionRef`             | This Hampa session, scoped to this product                        |
| `activityRef`            | This shared execution of this product, common to its participants |
| `role`                   | `leader` or `follower`, not the person's group role               |
| `leaderSubject`          | The leader's identity scoped to this product                      |
| `status`                 | `active`, `paused` or `ending`                                    |
| `participantsVersion`    | Opaque marker for the currently authorized participant set        |

Ordinary use returns only `{mode:"normal"}`. An ordinary document remains
normal even if the same account participates elsewhere. Never look up an
account's live session yourself or inject `groupRef`, `sessionRef`, `activityRef`
or a role into the Runtime call to choose its execution.

For the current person's identity use `identity.get()` and its `actorId` when
available; do not invent `context.subject` or read `leaderSubject` as yourself.
Group roles require `groups.get({groupRef})` under the separate group-read grant.
A manager normally follows in Hampa v1. Product-specific roles such as editor
or moderator are another policy; none implies platform administration.

`hampa.participants({limit:30, cursor})` returns `participants`, `version` and
`nextCursor`. Each participant has `subject`, `displayName`, optional `avatarUrl`
and Hampa `role`. These are authorized participants of this execution, not all
group members, visible avatars, delivery recipients or proof that every product
is ready. Re-read when `participantsVersion` changes. Use the same version-bound
[pagination rules](agent-groups.md#read-and-observe-only-what-is-needed):
restart on `group_page_changed` and discard results from a former execution.
Participants are unavailable in ordinary mode; do not make that call there.

Main supplies change hints through its existing live link. Do not create your
own platform heartbeat, WebSocket or presence lease from the product. The
product receives no list of other open Apps, their content or navigation history.
References and subjects cannot be joined across products.

## Join once and recover current state

Scope the live room by `(registry, product, groupRef, sessionRef, activityRef)`.
Use an atomic create-or-get operation under that unique key if your product
creates rooms. Authenticate before creating or joining it. Generate no fresh
room ID per participant, document mount, callback or reconnect.

| Event                                          | Required product behavior                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| First authorized arrival                       | Join/create this activity; keep the persistent group archive separate                 |
| Another participant or a late arrival          | Join the same activity and obtain its latest state                                    |
| Repeated context callback                      | Update roles/status/participants without resetting domain state                       |
| Network reconnect or explicit retry            | Reauthorize; reconnect to the same activity if still valid                            |
| Leader closes and reopens the product          | Join the new `activityRef`; do not resurrect the closed room                          |
| New Hampa session for the same group           | New session/activity, same persistent group archive                                   |
| Local minimization or Compact/Workspace change | Preserve document and activity; adjust rendering only                                 |
| Environment changes while an App remains open  | Preserve the App's activity; separately discard authority tied to the old Environment |

For a presentation, the leader chooses a document from the group's archive;
followers wait for that choice, then receive the current slide. The late-arrival
path fetches a snapshot and attaches to updates without a gap. Use your own
domain sequence/revision to reject stale updates. `participantsVersion` is not a
slide revision. A first follower must not overwrite the room with default slide 1.

An Environment decides whether people move freely or follow the leader, where
they enter, and whether the room is private. Enforce any promised privacy in its
data/service access, not just by hiding other avatars. For Plugin composition,
keep cross-Plugin `actorKey` correlation within its documented scope; a product
subject is not a global account key.

Give every asynchronous join/load a local generation or cancellation signal.
Before applying its result, check that the same execution is still current.
On `paused`, suspend leader-dependent shared changes; existing work may continue
only under separately valid product authority. On `ending` or a refused context,
stop dependent actions, release live resources and retain permitted drafts.
Do not rely on seeing `ending`: the document may close or authority may be refused
first. Never downgrade a failed shared authorization into ordinary access to the
same private room.

## Authorize your backend

Declare the product's own backend. Obtain its short-lived credential through
`alamr.backend.credential({})` for an App, or declared `scopes`/`context` for an
Environment. Check `ok` before using `data.accessToken` and send it only to that
declared backend. Renew through the same API when necessary. Main owns App
exchange and renewal; the page implements no OAuth or private-key exchange.

The App backend's declared exchange endpoint implements its existing
`private_key_jwt` exchange with Registry. Its private key stays there. Environment
grants target the declared audience, endpoint and scopes. These are public
protocols; see [backend setup](agent-backend.md), the
[manifest reference](https://agent.al-amr.com/docs/reference/manifests.md) and Registry `/v1/openapi.json`.
Use standard HTTPS and your language's JWT verification facilities, with no
Al-Amr dependency.

For every protected shared action, perform fresh live introspection of the actual
credential. Both endpoints take JSON `{"token":"<credential>"}` with
`Content-Type: application/json`; they need no Project token or group connection
token in an Authorization header:

| Role        | Introspection endpoint                                   | Authority to validate                                                                                                                                        |
| ----------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App         | `POST /v1/apps/session/introspect`                       | `active`, exact `appId`/`appRevisionId`, `appAuthMethod: "private_key_jwt"`, `appActorSub`, expiry and returned `hampa`                                      |
| Environment | `POST /v1/runtime/environment-backend/grants/introspect` | Verified JWT issuer, audience, endpoint, token purpose, scopes, actor and product/revision; match returned Runtime session/lease/version, expiry and `hampa` |

The Environment introspection response does not repeat the entire JWT. Verify
the credential signature and expected claims against the trusted Registry JWKS,
then compare its `runtimeSessionId`, `runtimeLeaseId` and `runtimeLeaseVersion`
with introspection. Decoding without verification is not enough. The Registry
origin/JWKS endpoint must come from trusted backend configuration, never token
claims or a page-supplied URL. Reject redirects and malformed responses; bound
HTTP time and response size. Use schemas from `/v1/openapi.json` to validate JSON.

Registry seals a proof into the execution's credential and supplies current
product-scoped `hampa` on introspection. Do not decode, reconstruct or replace
that proof. If your protected endpoint needs Hampa, a valid ordinary credential
without `hampa.mode === "hampa"` is insufficient. A person who has not granted
`platform.hampa.context@1` still holds a credential while the shared execution is
live: introspection answers `active: true` with no `hampa`, which is ordinary
authority. An Environment that reads no Hampa context keeps its backend that way. Compare returned group,
session and activity against the product resource being accessed. Resolve the
actor from the verified credential/introspection, never request JSON.

This **backend policy example** runs after successful, schema-validated App
introspection. `expected` is the target resource's stored identity in your
backend, and `leaderOnly` is that endpoint's policy, not a request option.

```js
function requireSharedAppAction(current, expected, leaderOnly) {
  const h = current.hampa;
  if (
    current.active !== true ||
    current.appId !== expected.appId ||
    current.appRevisionId !== expected.appRevisionId ||
    current.appAuthMethod !== "private_key_jwt" ||
    !(Date.parse(current.expiresAt) > Date.now()) ||
    h?.mode !== "hampa" ||
    h.version !== 1 ||
    h.status !== "active" ||
    h.groupRef !== expected.groupRef ||
    h.sessionRef !== expected.sessionRef ||
    h.activityRef !== expected.activityRef ||
    (leaderOnly && (h.role !== "leader" || h.leaderSubject !== current.appActorSub))
  ) {
    throw new Error("Shared action is not currently authorized");
  }
  return { subject: current.appActorSub, hampa: h };
}
```

For a first join, derive the new resource key from fresh verified context before
atomic create-or-get. For later actions, load the target resource and compare
it as above. Validate your own operation and content permissions too; following
a Hampa leader does not make every action in the product leader-only.

Do not positively cache Hampa authorization, including in an App session cache.
Offline JWT verification alone cannot establish current participation. A group
background token is also insufficient: it may intentionally outlive this live
activity. A timeout, `503`, malformed/missing context or `active:false` must fail
closed for shared actions. Keep reconnecting UI and permitted drafts available.
For long-lived sockets/media, revalidate when reconnecting and before protected
work; a successful socket handshake must not grant indefinite authority. Define
how the product stops its own streams/resources after participation ends.

## Readiness, closing and personal control

Report `runtime.ready()` when your product has usable content or a meaningful
waiting/permission state. A follower waiting for the leader's file can be ready;
a failed join to the required product service cannot be presented as a successful
shared activity. Use `runtime.fail({code})` for a real startup failure. Loading
animation completion is not readiness. Handle later service loss in the product
instead of repeatedly reporting startup success.

Implement `app.onBeforeExit` or `environment.onBeforeExit`. The callback receives
`{reason, deadlineMs}`; the deadline is bounded to at most 1,000 ms. It returns
`{disposition:"allow"}` or `{disposition:"confirm", message?}`. It cannot veto
shared closing. Register it early and save recoverable drafts throughout editing;
a final callback may be cut short by a crash or forced close.

For an App, this example distinguishes ordinary unfinished work from a shared
close. `hasUnsavedWork` and `flushDraftWithin` are product-owned functions; the
latter must finish within its budget and must never claim a failed save succeeded.

```js
const stopExit = alamr.app.onBeforeExit(async ({ reason, deadlineMs }) => {
  if (reason === "shared_navigation") {
    await flushDraftWithin(deadlineMs);
    return { disposition: "allow" };
  }
  return hasUnsavedWork()
    ? { disposition: "confirm", message: "This document has unsaved changes." }
    : { disposition: "allow" };
});
```

For an Environment, use `alamr.environment.onBeforeExit` with the same callback
contract. `hampa_entry` is the check before leaving **ordinary** work to join;
Main lets both leader and followers review that work and cancel admission.
`shared_navigation` closes an already-shared execution with a bounded flush.
Recover drafts on a later authorized opening; the platform promises no archive
of prior windows or automatic reconstruction of the previous workspace.

Minimizing, restoring and resizing are local. They do not mean that a participant
left the activity. Explicit leader selection can restore attention; heartbeat
alone does not. Stop is different: a person's stopped execution stays stopped
until their explicit retry, even after accepting session recovery on restart.
Never build a timer that calls navigation/open APIs to undo Stop.

The product has no public `hampa.start`, `join`, `end`, navigation-command or
membership-management methods. Use the existing product navigation APIs when
appropriate; Main applies the current role policy and trusted confirmation for
collective changes. Followers cannot open independent destinations during Hampa.
Do not call account/device routes or imitate shell controls to bypass this.

Keep microphone, camera, screen sharing, recording and other sensitive choices
personal. Do not activate them because the context says `leader`, `follower` or
`active`. Preserve access to their local controls. Leaving/ending closes this
Hampa's executions and returns Home; it neither leaves the persistent group nor
deletes the product's archive. The shell retains control of exit during failures.

## Verify the actual product

Use local fakes to test each result branch and callback race, then the ordinary
`alamr validate`, build, `alamr dev` and preview loop. Preview is simulated for
Registry services; it cannot prove real Hampa admission or backend authority.
Verify the published compatible revision with real accounts on a deployment
where Hampa is enabled. Report the exact revision and whether providers were
simulated or real. Schema acceptance alone is not behavioral acceptance.

| Scenario                                   | Evidence to obtain                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Ordinary opening and Hampa disabled        | Normal product/group features work; no automatic join or fabricated context                      |
| Owner, manager and ordinary member join    | One leader and followers; media permission remains personal                                      |
| Concurrent first arrivals                  | One product room under the shared activity key                                                   |
| Late arrival after domain state changes    | Same current document/slide/room, not a reset or replay                                          |
| Destination changes during load            | Old load is cancelled/discarded; no late mount or stale write                                    |
| Reconnect and explicit retry               | Same valid activity and latest domain state, no duplicate room                                   |
| Minimize versus Stop                       | Minimize retains participation; Stop is not undone by heartbeat or session resume                |
| Second App opens; Environment changes      | The first healthy persistent App and its activity remain intact                                  |
| Leader closes/reopens the product          | New activity; old credentials cannot operate on it                                               |
| Membership/permission ends; member rejoins | Previously issued credential remains unusable; a fresh admission is required                     |
| Leader disconnects or experiment ends      | No leadership takeover; actions fail when authority is unavailable; exit remains usable          |
| Revision is withdrawn or replaced          | Old activity stops; new revision needs an explicit leader action, no individual silent migration |
| Shared close, crash and next opening       | Close meets the deadline; saved drafts recover under the product's data policy                   |

On the backend, attempt a protected operation with an ordinary token, a copied
page role, another group's/activity's reference, an expired/ended credential and
an unavailable introspection service. Each must fail without modifying shared
state. Then prove a current authorized request succeeds. Test a participant whose
group role changes without a member-count change when your policy uses that role.

Product behavior must come from the installed API and current Registry, not
assumptions about the rollout. Runtime errors are normalized; handle `error.code`
and `retryable`, not raw HTTP codes or message text. Treat failed context as
unavailable authority, never as empty participants or implicit ordinary mode.
For the complete wire contracts see the [API reference](https://agent.al-amr.com/docs/reference/api.md)
and the Registry's `/v1/openapi.json`.
