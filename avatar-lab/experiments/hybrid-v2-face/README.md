# Local hybrid experiment

The owner authorized a new face using V1 as a visual reference after rejecting
the direct deformation transfer onto V1's sealed eye/mouth surface. The active
path is `body-runtime.mjs` → `head-mount.mjs` / `sculpted-face.mjs` → `runtime.mjs`.
It uses V1's actual body/outfit and eight native clips, the V2 jump donor, and a
sculpted native-topology face retaining the V2 facial vocabulary and controller.

From `avatar-lab`:

```powershell
node experiments/hybrid-v2-face/test-local.mjs
node experiments/hybrid-v2-face/build-local.mjs
```

This builds only `dist-hybrid-test`. `--inspection` builds `dist-hybrid-review`;
`review-local.ps1 -Case 23 -Label example-neutral` opens and captures a held
inspection case through the official local Desktop CLI. Cases37/38 inspect the
seated neck/collar, and39 inspects the running neck/collar. Receipts and real
captures are in `evidence`.

The accepted `dist`, original assets, Plugin and Phase1 outputs stay unchanged.
No Git writes, Registry candidate, publication package, upload or version bump
is authorized. `validation-host` only points the local validator at this output;
it does not create or register a product.

`face-transfer.mjs`, `eye-rig.mjs` and their tests are the abandoned first path.
Their text snapshots are under `evidence/abandoned-direct-transfer`; do not use
passing geometric tests or old captures as proof of active face quality.

The authoritative Persian handoff is `AVATAR_HYBRID_PHASE2_FA.md` at project root.
