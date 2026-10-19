# Notifications and live alerts

Use notifications for product events that deserve the person's attention.
Local loading progress belongs in the product UI and Runtime readiness signals.
Declare reviewed event types, their subject/effect/presentation policy and the
appropriate capabilities before publishing. Runtime calls cannot invent new
reviewed events. Read the current schemas with `alamr api describe --json`.

## Occurrences and retries

`notifications.signal(occurrence)` signals an event to the current person.
`notifications.signalGroup({ groupRef, occurrence })` has separate consent and
reviewed invitation rules; see [groups](agent-groups.md).
Neither operation creates a product room or starts Hampa.

Persist the complete occurrence before sending: its stable `eventId`, original
`occurredAt`, content and any subject revision. Retry those same bytes for the
same event. Do not regenerate IDs or timestamps in a retry loop. A genuinely
new occurrence gets a new event identity. An accepted result proves neither
delivery nor reading; no API exposes another person's inbox or receipt state.

| Subject policy                      | Meaning                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| `per_occurrence` / `event_identity` | Each occurrence is its own subject; only `raise` is supported.                                    |
| `keyed` / `source_monotonic`        | A stable `subjectKey` identifies a product resource and its source supplies increasing revisions. |

For keyed subjects, `raise` asks for new attention, `refresh` updates the current
subject and `resolve` ends its actionable condition. Use only effects declared
by the reviewed event. Derive revisions from authoritative product state;
independent clients must not each invent their own counter. Resolving a task is
different from acknowledging that somebody saw a particular revision.

After actually showing content, `notifications.acknowledge({ acknowledgements })`
may acknowledge `{ eventType, subjectKey, throughRevision }` through the revision
presented. Do not acknowledge a newer update that arrived while rendering an
older one. If Desktop activated the App, separately consume that navigation
request with `app.acknowledgeActivation` after opening its target; see
[Runtime activation](agent-runtime.md#presentation-activation-and-closing).

## Background delivery

Closing a product does not keep its browser JavaScript running. For authorized
background work, declare a supported backend/background model and explicitly
connect through `notifications.connect`. Apps and Environments have different
manifest models; use their schemas, not a copied capability block from the
other role. Consent to one audience does not authorize another.

Check `result.ok` before reading `result.data.claimCode`. The one-use claim code
expires after five minutes. Send it over your product's authenticated backend
channel; the backend claims it with its own Project token and stores the returned
`sendToken`. The frontend never receives that token. The token is bound to the
returned product-scoped person; a Project token alone does not choose a recipient.

Connection consent can outlive the product window; disconnect or revocation
ends sending, including queued backend work. Do not automatically replace a
connection after an ambiguous failure. Selected-group connections are a separate
authority described in [groups](agent-groups.md#connect-one-group-to-your-backend).
Backend request details are in [backend integration](agent-backend.md).

## Expiring live alerts

Use a live alert only for short-lived attention. Declare reviewed
`liveAlerts.eventTypes`; sending needs `platform.alerts.send.companion@1` and
`platform.companions.list@1`. Receiving independently requires consent to
`platform.alerts.receive@1`. Main owns the ring and local silence.

Use an `alertId` of `alt_` plus 32 lowercase hex digits, revision 1 and absolute
`expiresAt` within 30 seconds. Retain the full request, including `label` and
deadline, for retries: a retry that changes either is ignored, not applied.
An update does not restart sound or revive an ended alert. `alerts.end` uses a
greater revision and, from the sender, ends the alert on every recipient device.
Acceptance discloses no presence, delivery, reading or silence state.

### A call card

A ring for a call declares how Main draws it. Pair `presentation: "call"` with
`primaryAction: "answer"` for a ring addressed to the person, or `"join"` for a
room a group is called into; omit both for the generic card. Validation refuses
any other pairing. The card reads «{label} تماس می‌گیرد» for `answer`, or
«{label}» for `join`, under the product's localized name and the reviewed title,
so send a short `label` naming who or what is calling. The press opens your App
with source `live_alert`, exactly as the generic card does; there is no Decline.

```json
{
  "liveAlerts": {
    "eventTypes": [
      {
        "type": "call.incoming",
        "title": "تماس ورودی",
        "presentation": "call",
        "primaryAction": "answer"
      },
      {
        "type": "room.started",
        "title": "اتاق باز شد",
        "presentation": "call",
        "primaryAction": "join"
      }
    ]
  }
}
```

### Ringing a group

`alerts.sendGroup({ alertId, revision, groupRef, eventType, subjectKey, label, expiresAt })`
rings the current members of a group the person owns or manages. Declare
`platform.alerts.send.group@1` with `platform.groups.read@1` to send, and
`platform.alerts.receive.group@1` so members can agree to be rung; each member's
own grant decides whether they are. Registry leaves out the sender, suspended
accounts, blocks in either direction and members without that grant, and fixes
the recipients when the alert is created. Sending is refused when the person is
only a member, is not in the group at all, or the group has more than 300 other
members; a member invites with `notifications.signalGroup` instead. Acceptance
reveals no recipient or count.

The sender's `alerts.end` ends every copy. A recipient's `alerts.end`, after
answering or declining inside your product, ends only their own copy. A person
who leaves the group, loses consent or is blocked stops seeing the ring on the
next read. Publishing a new revision does not end a ring the previous one sent.
Do not re-ring on a timer: one send lasts the whole ring, and the repeat is Main's.

Handle App activation with source `live_alert` as navigation to the requested
subject. It does not create a media call or complete the product task. Audio,
video, collaboration and their backend remain product-owned. Backend delegation
requires explicit `notifications.connect({ liveAlerts: true })`; see the backend
reference. Never restore retired companion-notify or platform-call routes.

Verify consent denial, duplicate retries, a newer revision during display,
disconnect and revocation; for a group ring also a member sender, a recipient's own
end beside the sender's, and a member removed while it rings. Local simulated preview checks UI behavior; actual
delivery and isolation need published products and consenting test accounts.
