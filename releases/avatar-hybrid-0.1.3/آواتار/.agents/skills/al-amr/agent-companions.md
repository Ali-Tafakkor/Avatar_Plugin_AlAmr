# Companionship

Companionship is a person's consented social relationship. It is separate from
membership of a persistent [group](agent-groups.md), participation in
[Hampa](agent-hampa.md) and a room owned by your product. Choose the
relationship your feature needs; do not require companionship merely because
two people share a group.

Apps and web Environments use `companions.page` and `companions.reach` after
connection and consent to `platform.companions.list@1`. Request optional consent
on the relevant user action. Check operation results before using `data`.

Check both `runtime.info.operations` for `companions.page` and the presence of
`alamr.companions.page` before calling it. This operation is available from Runtime API 1.0;
operation discovery describes what this host actually implements. Call
`companions.page({ limit: 20 })`, then pass each non-null `nextCursor` as `cursor`
until it is null. A null continuation ends this read sequence, not a stable
snapshot or a global count under concurrent changes.

Cursors are opaque, expire after15 minutes and belong to the current person,
product and revision. Discard them and person-specific cached results when
identity or relevant authority changes. Never parse, log or store them as
identity or permission. On invalidation, begin a fresh read after checking
current authority. An unavailable read is not proof of an empty list.

Older hosts do not expose or advertise this method. A known but unavailable
operation returns `unavailable`; an unknown old-host method returns
`unsupported_operation`. Do not automatically retry or downgrade to an
allegedly exhaustive `companions.list` walk. That legacy operation retains its
limit20/offset256 window; `nextOffset:null` at the boundary cannot prove that
later companions do not exist. The legacy App list refuses overflow above256
with `companion_app_page_required`; it never returns a clipped success.

Subjects are opaque and scoped to the product (`aact_*` for an App, `act_*`
for an Environment). Keep them in that scope; never parse them into raw account
IDs or correlate them across products. The API does not expose relationship
history or cross-Environment whereabouts.

`companions.reach({ companionSubject })` provides short-lived positive reach
proof, currently valid for 60 seconds. Use its actual expiry; it is not lasting
authorization, a presence subscription or proof that a message was delivered.
Target refusals deliberately share the same unavailable status. Do not infer
whether someone is offline, blocking, absent or lacking consent from that status.

Use [live alerts](agent-notifications.md#expiring-live-alerts) for
reviewed expiring attention when appropriate. Companionship itself provides no
chat transport, call service or shared product-state synchronization. Build those
features in the product using independently verified backend authority.

Test denied consent, empty and multi-page lists, expiry, revoked relationships
and identity changes. Simulated local tests do not prove delivery or social
isolation; verify those with consenting accounts and the real Registry path.
