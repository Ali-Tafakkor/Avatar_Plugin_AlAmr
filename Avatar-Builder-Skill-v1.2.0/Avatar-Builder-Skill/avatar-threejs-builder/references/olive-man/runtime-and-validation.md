# Olive Man case study — wrist stability and host checks

The right wrist visibly shook only in a close inspection view. At a paused `Stand` time the shoulder and wrist still moved from frame to frame. Fast motion and a wide camera hid the fault. Inspect the final pose after animation, the hand mount and finger updates, and the existing contact guard. [Contact and posture](../08-contact-and-posture.md)

## Reproduce on a fixed pose before tuning

1. Freeze the clip time and camera. Apply a fixed update step at two representative frame rates. Sample both wrists after the full update and record the largest distance between consecutive samples in millimeters. A mean can hide an alternating correction. Compare the hand mount against the wrist to distinguish motion in the joint from drift in its attached mesh.
2. As a diagnostic, compare the same pose with and without the hand contact correction. Log the joint offset and deepest contact sample before and after solving. Here, the timed release let the hand approach the thigh. When penetration crossed the solver threshold, the correction pushed the hand back out with a clearance margin. Repeating release and correction on an identical base pose produced the shake.
3. Verify that the proxy corresponds to the visible body region. Check the skinned palm, thumb and fingers against the nearby deformed garment with denser samples than the normal frame solver uses. A steady wrist and clearance are separate measurements.

## Keep the correction stable in rest and respect the moving pose

For Olive Man, the host already knew when the actor was in grounded `Stand` or `Sitting`. In those rest modes, clear the prior shoulder offset and solve once from the fresh animated pose with no time-based release. In the preview's directly sampled rest pose this can start immediately. In locomotion it begins after the existing 180 ms crossfade. The same fitted contact proxies, hand samples and bounded arm corrections still solve each frame. The moving and airborne paths use the original timed solver. Use the equivalent current-pose signal and blend duration in the target host. [Production frame order and clearance](../11-full-body-production.md)

Two tempting alternatives failed in this case. Clearing the cached correction during every animation frame caused larger wrist jumps in the sit/stand transitions as the deepest contact switched. Holding a cached correction indefinitely could leave the arm offset after returning to idle. Test both the held pose and the exit from a different pose before choosing the release behavior.

| Check on the actual rig | Observed outcome |
| --- | --- |
| Paused `Stand` at 120 Hz | Peak right-wrist step fell from 2.38 mm to below 0.01 mm |
| Paused `Stand` at 60 Hz and paused `Sitting` at 60 Hz | Both wrists remained below 0.01 mm peak step. Hand attachments and proxy clearance were checked |
| Playing `Stand` and `Sitting` at 60 Hz | Peak right-wrist steps were about 0.022 mm and 0.049 mm, including the existing idle motion |
| Raise hand, sit down, stand up, walk, run and fly | Wrist-step and penetration traces matched the original solver for the sampled previews |

Pick the tolerance for the real model scale, target camera and motion. For regression coverage, include fixed poses, a moving transition, return to idle after sitting, and cleanup of the variant's changes. The numbers above record this build.

## Let users inspect the real character in the host

- Keep one owner of input and world pose. Put per-character fitting, atlases and contact changes on the selected instance. When switching characters, release held input, clear temporary poses, and dispose the outgoing material and geometry it owns. Keep cached source resources available for the next mount.
- Use the normal selector to mount the new avatar, then switch away and back. Confirm the original character still loads with its own inventory and the new avatar comes back with its starting expression, hand pose and position. Give the user the face, profile, rear and individual-hand views that let them reproduce the issue. Inspect both expressiveness and contact with the actual visible asset.
- Match the test to its host and record the build identity. In this case, Chrome WebGPU exercised both characters, six expressions, motion, keyboard input, individual fingers and remounting. The local Al-Amr preview separately reported the same build ready. The owner accepted the hair and wrist revision before asking for these notes. [Validation and delivery](../06-validation-and-delivery.md)

## Where to inspect the working example

In the originating project, `avatar-olive-man/hand-contact.mjs` installs the scoped fix, `avatar-lab/tests/olive-hand-contact.test.mjs` measures the wrist regression, and `avatar-olive-man/tools/verify-in-lab.cjs` drives the browser review. `avatar-olive-man/evidence/hairline-contact/verification.json` records the checks, measured changes and build identity.
