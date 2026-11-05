# Use a subject family

Read this only when two or more of your own products share one backend and one
controller of the person's data (for example an App and an Environment of one
team), and you want your backend to recognise one person across them without a
manual link code. Every other product keeps today's behavior: each App and
Environment sees a different pairwise subject for the same person, and that stays
the default.

A subject family is an administrator-approved group of Apps and Environments.
Each approved member's own server can receive the same opaque `fsub_` subject for
the same person. It is a join key only: it grants no data and no role.

The feature ships default-off behind `AL_AMR_SUBJECT_FAMILIES` (ADR-0183). While
the flag is off, every introspection answer is byte-identical to before.

## How a product joins

1. **Be eligible.** The product declares `backend.keys` in its active revision.
   Apps already do. An Environment may now declare the optional `backend.keys`
   with the same strict schema (one to four public ES256 JWKs). A product with no
   keys cannot join. A Plugin or a linked shared backend cannot join.
2. **Ask.** The project owner (not a developer, a project token or an
   administrator acting for someone else) requests membership of a family:

   ```
   alamr project family request --family fam_...
   alamr project family show
   alamr project family leave
   ```

   The HTTPS equivalents are `POST /v1/projects/{projectId}/subject-family/request`
   with `{ "familyId": "fam_..." }`, `GET .../subject-family` and
   `POST .../subject-family/leave`. A product belongs to at most one family; a
   suspended family takes no requests.

3. **Be approved.** A platform administrator creates families and decides
   requests (`alamr admin families list|requests|create|show|update|approve|revoke`).
   Approval is the judgement that the members share one data controller, so it
   names the family as well as the product (`--family fam_...`): if you leave and
   ask to join another family while a request is in the queue, the administrator's
   approval of the old one is refused rather than applied to the new one. A request
   belongs to the owner who made it: after an ownership transfer the new owner
   requests again.
4. **Stay bound.** Approval records a digest of your active revision's backend
   (App: session exchange origin and key thumbprints; Environment: audience,
   endpoint origin and key thumbprints) and the project owner at that moment. If a
   later revision changes the backend origin or keys, or the project changes
   owner, the subject is withheld until an administrator approves again. Nothing
   tells your backend; it simply stops receiving the field.

Families are created and approved by people. The request is never implied by
your manifest.

## Ask for the subject: the signed assertion

The subject is never in a session or grant token and never reaches a browser. Your
backend gets it only in an introspection answer, and only when the introspection
request proves that your own server is asking.

Make the normal introspection call, with one addition: an `Authorization: Bearer`
header holding a short-lived JWT signed with the private half of a key in your
active revision's `backend.keys`.

| Introspection                            | URL                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------- |
| App session                              | `<registry issuer>/v1/apps/session/introspect`                       |
| Environment backend grant (own audience) | `<registry issuer>/v1/runtime/environment-backend/grants/introspect` |

The body is unchanged: `{ "token": "<the token you are introspecting>" }`.

| Part          | Value                                                                     |
| ------------- | ------------------------------------------------------------------------- |
| Header        | `{"alg":"ES256","typ":"al-amr-introspection+jwt","kid":"<declared kid>"}` |
| `iss`, `sub`  | Your product id (`app_...` or `env_...`), identical                       |
| `aud`         | The exact absolute URL you are calling, from the table above              |
| `iat`, `exp`  | Seconds; `exp - iat` is at most 120                                       |
| `jti`         | 8 to 128 characters, unique per assertion                                 |
| `tokenDigest` | `"sha256:"` + lowercase hex of SHA-256 over the exact token string        |

The `typ` is its own: an exchange assertion or a context attestation cannot be
used here, and this assertion cannot be used there. The assertion is bound to one
token, so a copy is useless for any other session. Claims are exact; no extra
claim is accepted.

```js
import { createHash, createPrivateKey, randomUUID, sign } from "node:crypto";

const b64 = (value) => Buffer.from(value).toString("base64url");

export function introspectionAssertion({ productId, kid, privateKeyPem, url, token }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", typ: "al-amr-introspection+jwt", kid };
  const claims = {
    iss: productId,
    sub: productId,
    aud: url,
    iat: now,
    exp: now + 60,
    jti: randomUUID(),
    tokenDigest: `sha256:${createHash("sha256").update(token).digest("hex")}`,
  };
  const input = `${b64(JSON.stringify(header))}.${b64(JSON.stringify(claims))}`;
  // ES256 needs the raw 64-byte r||s signature, not DER.
  const signature = sign("sha256", Buffer.from(input), {
    key: createPrivateKey(privateKeyPem),
    dsaEncoding: "ieee-p1363",
  });
  return `${input}.${signature.toString("base64url")}`;
}

export async function introspectWithFamily({ issuer, path, productId, kid, privateKeyPem, token }) {
  const url = `${issuer}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${introspectionAssertion({ productId, kid, privateKeyPem, url, token })}`,
    },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) throw new Error(`introspection unavailable: ${response.status}`);
  return response.json();
}
```

Keep the private key out of source control and the published bundle, exactly as
for the App session exchange. When you rotate `backend.keys`, keep the retiring
key until the new revision is active.

## Read the answer

When every condition holds, the active answer gains one optional field:

```json
{ "active": true, "subjectFamily": { "id": "fam_...", "subject": "fsub_<64 hex>" } }
```

Validate the rest of the answer as you do today and ignore unknown fields. The
field is present only when all of these are true: the flag is on, the request
carried a valid assertion, the person is a signed-in account (not a guest), your
membership is approved and the family active, your live revision still matches the
approved binding and the project owner is unchanged, and the person has not opted
out. Otherwise the answer is exactly what you received before. A refused or
malformed assertion never produces an error and never changes the answer; the
cause is not reported. If the field is missing, find out why from your own side
(`alamr project family show`, your key, your clock), not from the answer.

Keep any cache of an introspection answer that carries `subjectFamily` short, at
most 10 seconds, and never longer than the token it describes. Revocation,
suspension, a backend change, an ownership transfer and an opt-out take effect on
the Registry's next answer; a longer cache keeps delivering a subject the Registry
has already stopped.

## Product obligations

- Key your own data on your per-product subject. Store the family subject beside
  it as a join hint, never as your primary key.
- Absence means unknown. Never treat a missing `subjectFamily` as "a different
  person", and never delete or merge records because it vanished.
- Stop matching on a stored family subject once your membership ends (leave,
  revocation, suspension, a backend change not yet re-approved, or a transfer).
  Delivery stops on the next introspection; stored values must stop being used.
- Never send an `fsub_` value to a browser, a log, an analytics sink, or another
  product outside the family. It is for server-to-server matching only.
- Derive no role, permission or entitlement from it. Roles come from the
  introspected claims as today.
- There is no listing, lookup or export of family subjects, and no way to turn an
  `fsub_` back into an account. Do not build features that assume one.

## The person can opt out

Catalog entries of approved members name the family and its member products, so
Desktop can tell the person that these products recognise them as the same
person. The person may opt out of a family from their own device
(`GET /v1/account/subject-families/opt-outs`,
`PUT|DELETE /v1/account/subject-families/{familyId}/opt-out`). While opted out, no
member receives that person's family subject; the answer looks exactly like any
other withheld case. Opting back in restores the same subject. Do not try to
detect or work around an opt-out.

## Test checklist

1. Flag off: a plain introspection answer and one with the header are identical.
2. Valid assertion for an approved member, signed in: `subjectFamily` is present
   and equal across two members for one person; it differs from your per-product
   subject.
3. Two different people receive different subjects; one person in two families
   receives different subjects.
4. Wrong `typ`, wrong `aud`, `exp - iat` over 120, unknown `kid`, a different
   token's digest: no field and an otherwise identical answer.
5. After `alamr admin families revoke`, after the family is suspended, after a
   revision that changes `backend.keys` or the backend origin, and after an
   ownership transfer: no field on the next introspection.
6. Guest session: no field. Opted-out account: no field.
7. Your backend treats every missing field as unknown, keeps working, and does not
   log or return the `fsub_` value to a browser.
