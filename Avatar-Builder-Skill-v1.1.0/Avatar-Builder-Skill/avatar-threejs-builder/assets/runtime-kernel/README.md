# Calibration kernel

These authored ES modules have no dependencies on a particular character,
renderer, DOM, Al-Amr, network or Three.js installation. Import them directly
into a web project or Node. They do not generate geometry or implement IK.

- `fitSoleContacts(input)` proposes bounded pitch/height correction from two
  measured support patches in a calibrated sagittal frame. Pass explicit limits,
  pivot, grounded/stance state and optional weight. No ankle/bone is written.
  It does not solve roll/terrain continuity or infer support/landmarks.
- `clampLimbReach(distance, upperLength, lowerLength)` supplies a finite,
  scale-dependent target range. An actual leg solver still needs a knee pole.
- `composeLocalOffset(freshBase, localDelta, weight)` composes a normalized
  local offset from the **fresh** base quaternion. Quaternions use x,y,z,w.
- `warpRelativeMorphs(basePoints, targetDeltas, F)` transforms neutral positions
  and relative morph endpoints together. Normals/skin/bind/attachments remain
  the adapter's responsibility. F must be a deterministic point transform.

Example calibrated flat-support proposal:

```js
import { fitSoleContacts } from './calibration.mjs';
const fit = fitSoleContacts({
  heel: { along: 0, height: 0.012, supportHeight: 0 },
  forefoot: { along: 0.24, height: 0.002, supportHeight: 0 },
  pivot: { along: 0.06, height: 0.08 },
  maxPitchRadians: 0.15, maxShiftMeters: 0.02,
  grounded: true, stance: true, weight: 1,
});
// Values above are synthetic test data, not anatomical defaults.
// Convert fit.pitchRadians through this shoe's calibrated anatomical frame,
// apply once after base pose, remeasure actual skinned patches, report residuals.
```

Read references08/09 before applying the functions. Run the synthetic suite
from the skill root with `node --test tests/calibration.test.mjs`. A pass is
not a test of a user-selected GLB, footwear, renderer or visual realism.
