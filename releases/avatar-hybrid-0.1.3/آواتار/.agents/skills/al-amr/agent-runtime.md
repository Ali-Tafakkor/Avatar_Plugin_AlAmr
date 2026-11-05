# Runtime and product lifetime

Apps and web Environments receive `window.alamr` from the client. Import no SDK,
create no OAuth flow and implement no identity handshake. `alamr.d.ts` describes
the installed client contract. `alamr api describe --json --role app` (or
`environment`) lists operations, inputs, outputs and required capabilities.
Main owns connection, sessions and renewal. Native products have a separate
[publication and connection path](https://agent.al-amr.com/docs/publish/native-publishing.md).

## Connection is different from content readiness

`runtime.subscribe(listener)` immediately supplies a **plain status snapshot**
and supplies later changes in the same shape. Read `state.connection`,
`state.content` and `state.context` directly. There is no `ok/data` envelope on
this subscription. By contrast, `runtime.status()` and asynchronous operations
return `{ ok, data }` or `{ ok, error }`; subscriptions such as `groups.subscribe`
and `hampa.subscribe` also deliver result envelopes. Check each local signature.

This connection observer works both when admission is already complete and when
it completes later. It also reports loss of connection; it is not a one-time
permission grant. Call the returned cleanup when the consumer is disposed.

```js
function observeConnection(alamr, onChange) {
  return alamr.runtime.subscribe((state) => {
    onChange({
      connected: state.connection === "connected",
      connection: state.connection,
      context: state.context,
    });
  });
}
```

Gate protected reads on connection and handle every returned refusal. An injected
object alone does not mean admission succeeded. On `stale_context`, discard
context-bound data and reread the current context; do not reuse an old credential.
On offline/unavailable, show a recoverable state. Do not spin, invent consent or
recreate the client's handshake. See [local verification](agent-development.md).

For an Environment, a connected session can still be in `standby` while Main
activates its lease. Protected Environment services, including Plugin grants,
also require `environment.state().data.presence === "active"`. Observe
`environment.subscribe`, whose callback receives a result envelope:

```js
const stop = alamr.environment.subscribe((result) => {
  const active =
    result.ok && result.data.connection === "connected" && result.data.presence === "active";
  updateInstallationLifetime(active);
});
```

On a transition to active, create the installation client and read its initial
state. On standby, supersession or disconnection, dispose that client and its
pending work. A later transition to active starts a new lifetime. Do not start
again for every unchanged observation or automatically replay a failed mutation.
`presenceReady` describes roster readiness; it is not the active-lease condition.
Keep `runtime.ready()` independent of protected services so the client can reveal
usable content and activate the Environment. Call `stop()` when disposed.

A published App can run before its session exists. When the Registry launched
it but the App's own backend did not answer, status reads `connection: "offline"`
while `identity.get()` already returns the person the launch named, with a null
profile. Session-bound calls answer a retryable `offline`, and
`permissions.list()` shows `granted: false` because grants are unknown, not
refused. Show that person's local content and call `runtime.ready()`; do not gate
readiness on the backend or on `connected`. When status becomes `connected`, the
same document holds its session: sync then, and never reload. A document keeps
its identity through a session lapse, so only a null identity means nobody.

The content lifecycle tells Desktop when it can reveal usable content:

| Signal                        | Send it when                                                          |
| ----------------------------- | --------------------------------------------------------------------- |
| `runtime.progress({ ratio })` | Measured startup work advances; ratio is between 0 and 1.             |
| `runtime.painting()`          | The product has presented its first content frame.                    |
| `runtime.ready()`             | Critical content and controls are usable.                             |
| `runtime.fail({ code })`      | Startup cannot produce usable content; give a stable diagnostic code. |

Do not use a timeout, a successful network connection or an empty root as proof
of readiness. A useful offline, empty or permission-request screen can be ready
if it is the intended usable state. Do not wait for every optional asset or
background service. Later service failures belong in the product's recovery UI;
startup success does not prove permanent connectivity.

## App tabs in native windows

An App may opt into `display.windows: "satellites"` only with Workspace mode.
The Registry must support the key before publication. Feature-detect
`alamr.windows` for older clients; absent means keep all tabs in the main App.
Read `windows.current()` before loading the saved workspace: the root gets
`{ role: "main", seed: null }`, while a satellite gets its seed on every read.
Validate the App's seed schema, open only that tab and never read or overwrite
the root's saved tab list. Call `runtime.ready()` when that content is usable.

For live tear-off, require both `windows.beginDrag` and `windows.cancelDrag` in
`runtime.info().operations`. Capture the pointer on the tab and flush its state.
Subscribe before calling `windows.beginDrag({ seed })` as the held tab leaves
the strip threshold; the reply returns a `dragId` promptly. Main shows and moves
the native window while the pointer remains held, preserving source focus.
Observe the matching `windows.list.drag`: `dragging`, `opening`, then `opened`,
`cancelled` or `failed`. Retain an early result until the begin reply supplies
its ID. Remove the source only on `opened` (release plus readiness), keep it on
failure/cancellation, and cancel with `windows.cancelDrag({ dragId })` on Escape.
Unsubscribe on settlement/disposal; keep source state stable while transferring.
No polling, renderer coordinates, automatic retries or pointer history is needed.

Older clients keep release-only `windows.open({ seed, placement: "pointer" })`;
menu actions use `placement: "beside"`. These resolve after readiness, and only
`ok: true` removes the source. Keep seeds below 16 KiB encoded UTF-8. Disable
tear-off during Hampa and when Runtime/Registry connectivity cannot admit a new
window. Handle `offline`, `unavailable`, `conflict` and activation refusal
without retries or auto-open. Limits are 3 per App / 5 total, or 1 / 2 on
devices with at most 4 GiB memory.

A satellite hides its tab strip, library/new-tab navigation and root workspace
persistence. Set its native title with `windows.setTitle`, and offer a return
button using `windows.returnToMain({ seed })`. The root registers
`windows.onReceive` and answers `{ accepted: true }` only after validating and
adopting the tab; answer false at capacity. Main bounds this callback to one
second and keeps the satellite when it declines or times out. Closing the
satellite calls its exit handler with `window_close`; flush its own work.

Use `windows.subscribe` result envelopes to observe only this family's windows;
`windows.focus({ windowId })` needs a user action. F11, zoom and permitted
`device.*` affect the caller's window. Satellites cannot start trusted permission
questions or capture media. Their local data shares the root's origin and
partition: coordinate writers with per-document locks and shared-change events.
One document must never overwrite another window's workspace. See
[Apps](https://agent.al-amr.com/docs/product/apps.md) for lifecycle and limits.

## Identity and permissions

`runtime.info()` describes the admitted **product**, document and evidence mode.
Read the current product-scoped person from `identity.get()`, check `ok`, and
handle a null identity. Never send your own identity claim. Read grants from
`permissions.list()`; declarations and operation discovery are not authorization.
Request optional capabilities on the relevant user action. App and Environment
manifest capability shapes differ: use their generated schema and local types.

Keep credentials out of browser storage, URLs and reports. A product-owned
backend must verify the current authority independently; see
[backend integration](agent-backend.md). Scope cached person-specific
data to the current identity and clear it when that identity changes.

## Presentation, activation and closing

An App preserves its document across Compact/Workspace and Environment changes.
Environment-scoped authority can end while the App continues. Observe `app.state`
and its subscription; resize the existing UI and release context-bound resources
when their context ends. Do not reset a user's draft because presentation changed.
An Environment owns rendering and composition. Publish semantic locations through
its declared spatial provider; correlate cooperating Plugins only by scoped
`actorKey`, never raw account subjects.

Handle semantic activation from `data.activation` only after checking the result.
For notification or live-alert activation, open the exact requested subject, then
call `app.acknowledgeActivation({ sequence: activation.sequence })` for that
activation. This consumes the navigation request; it neither completes a domain
task nor acknowledges a notification. See [notifications](agent-notifications.md).

Report real audio changes with `app.setAudible({ audible })`. Stop timers, audio,
render loops and subscriptions when their owner is disposed. Backgrounding is
different from closing; keep only work the product actually needs while hidden.

`app.onBeforeExit` and `environment.onBeforeExit` provide a bounded opportunity
to report unsaved work, not a guarantee of persistence. Respect the callback's
deadline and documented `allow`/`confirm` result. Save drafts continuously; do
not depend on an asynchronous final save or try to veto shared-session closing.

Full current reference: https://agent.al-amr.com/docs/reference/api.md
