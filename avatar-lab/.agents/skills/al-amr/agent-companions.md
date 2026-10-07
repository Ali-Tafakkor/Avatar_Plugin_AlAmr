# Companionship

Companionship is a person's consented social relationship. It is separate from
membership of a persistent [group](agent-groups.md), participation in
[Hampa](agent-hampa.md) and a room owned by your product. Choose the
relationship your feature needs; do not require companionship merely because
two people share a group.

Apps and web Environments use `companions.list` and `companions.reach` after
connection and consent to `platform.companions.list@1`. Request optional consent
on the relevant user action. Check operation results before using `data`.

`companions.list({ limit: 20 })` returns a bounded page. Continue with its
`nextOffset` in the next request's `offset` until it is null; do not assume the
first page is the whole set. Discard person-specific cached results when the
current identity or relevant authority changes. An unavailable read is not
proof that the person has no companions.

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
