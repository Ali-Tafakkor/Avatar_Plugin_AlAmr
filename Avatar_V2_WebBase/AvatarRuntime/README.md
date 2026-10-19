# Avatar Web V2 — local runtime

This private package extracts the complete body, skeletal animation and facial system from the preserved `../AvatarMotionLab` project. It is consumed by the editable Al-Amr test Environment at `../../avatar-lab`. It has not been submitted, published or recorded in Git. The owner's approval is required before any such action.

## Responsibilities

`createWebAvatarRuntime(gltf, motions, options)` returns an independently cloned actor, its root, face controls, `update`, `reset`, diagnostics and idempotent `dispose`. The host owns the renderer, scene, input, camera, world translation, rotation and navigation. Call `update(deltaSeconds, { pose, locomotion, camera, portrait })` after the host updates its pose. The runtime animates the local skeleton and facial morphs; it does not move the host a second time.

The Al-Amr adapter is `avatar-lab/src/AvatarWebV2.tsx`. It uses the exact installed Player Rig 1.0.0 contract. Player Rig yaw zero faces -Z; the adapter rotates this model's +Z forward by PI. The host uses one WebGPU renderer and one Player Rig camera. The locally exported runtime is a library, not a separately registered Al-Amr Plugin.

## Preserved data

The source GLB and motion JSON are copied byte for byte, with pinned SHA-256 checks in `scripts/prepare-assets.mjs`. The model retains 73 joints, ten meshes, 66 facial morphs, original skin weights and all five finger chains. Expressions, blink, eye gaze, six presets and six manual facial groups are retained. Face/motion source notices and license remain beside the assets.

`prepare-assets.mjs` also creates `avatar.gltf`, `avatar.bin` and fourteen external image files. The binary geometry/skin/morph data and embedded image bytes are copied without conversion. This representation avoids embedded-image Blob URLs in the Desktop bundle. The script writes a hash manifest and can copy these files to a host's public directory with `--destination=<directory>`.

## Local checks

```powershell
# In this folder, using the existing local Three dependency
npm test
node scripts/audit-corrections.mjs

# In ../../avatar-lab
npm test
npm run build
& 'C:\Users\alita\AppData\Roaming\al-amr\bin\alamr.cmd' validate --json
& 'C:\Users\alita\AppData\Roaming\al-amr\bin\alamr.cmd' doctor --profile project --json
```

Open the built Environment with the installed Desktop's `--preview-only` mode when using account-free local inspection. Use the temporary profile it prints for both `AL_AMR_AUTHORING_STATE_DIR` and `AL_AMR_PRODUCTS_ROOT` (the latter points to `<profile>/products`), then call the executable's `--cli dev --json` entry from `avatar-lab`. A normal-profile `.cmd` launcher overrides those environment variables. Rebuild and reopen after edits, and compare the returned build digest before using a screenshot as evidence.

The test Environment automatically checks standing soles, actual walk/run travel, jumping, all six expressions and both real eyelid morphs. The result appears in the panel and is logged as `AVATAR_V2_LOCAL_TEST`. Keyboard movement is W/A/S/D, Shift and Space; the panel also provides walk/run/stop, face view, facial controls and rerunning the checks.

Do not use `alamr test`, `publish`, `pack`, upload or bind as a local test: these belong to the separately authorized release workflow. Do not stage, commit or push this work before the owner's final approval. The protected original web project, V1 plugin/model and delivered Environment2 remain the recovery references.
