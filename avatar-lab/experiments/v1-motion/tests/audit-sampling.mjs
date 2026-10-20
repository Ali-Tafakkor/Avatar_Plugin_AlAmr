import {
  NON_JUMP_V1_CLIPS, capturePose, compareSegmentDirections, comparePalmNormals,
  compareSegmentStretch, compareRootRelativeHipMotion, finitePose,
} from './pose-metrics.mjs';

/** Independent renderer-free measurements against live source pose samples.
 * This reports numerical fidelity, not skin/face appearance or visual acceptance.
 * No tolerance is silently widened: callers set any acceptance thresholds.
 */
export async function auditRetargetSamples({ retargeted, target, legacyGltf, samplesPerClip = 40 }) {
  const originals = new Map(legacyGltf.animations.map(clip => [clip.name, clip]));
  retargeted.sample('Stand', 0);
  const sourceReference = capturePose(retargeted.source), targetReference = capturePose(target);
  const reports = [];
  for (const name of NON_JUMP_V1_CLIPS) {
    const original = originals.get(name), mapped = retargeted.clips.get(name);
    if (!original || !mapped) throw new Error('Missing required V1 non-jump clip: ' + name);
    const frames = [], missing = new Set();
    for (let frame = 0; frame <= samplesPerClip; frame++) {
      const time = original.duration * frame / samplesPerClip;
      const sampled = await retargeted.sample(name, time);
      const source = capturePose(retargeted.source), current = capturePose(target);
      const directions = compareSegmentDirections(source, current);
      for (const segment of directions.missing) missing.add(segment);
      frames.push({
        time, sampledTime: sampled?.time ?? null,
        finite: finitePose(source) && finitePose(current),
        directions, palms: comparePalmNormals(source, current),
        stretch: compareSegmentStretch(source, current, sourceReference, targetReference),
        hip: compareRootRelativeHipMotion(source, current, sourceReference, targetReference, retargeted.rootScale),
        soles: target.measureFeet ? target.measureFeet() : null,
      });
    }
    const errors = frames.flatMap(frame => frame.directions.segments.map(segment => ({
      time: frame.time, name: segment.name, degrees: segment.degrees,
    }))).sort((a, b) => b.degrees - a.degrees);
    const bodyErrors = errors.filter(value => !/hand.*(?:index|thumb)|toeend/.test(value.name));
    const palmErrors = frames.flatMap(frame => frame.palms.map(value => value.degrees)).filter(value => value !== null);
    reports.push({
      name, sourceDuration: original.duration, targetDuration: mapped.duration,
      durationError: Math.abs(original.duration - mapped.duration), samples: frames.length,
      finite: frames.every(frame => frame.finite), missing: [...missing],
      maxDegrees: errors[0]?.degrees ?? null,
      maxBodyDegrees: bodyErrors[0]?.degrees ?? null,
      maxPalmDegrees: palmErrors.length ? Math.max(...palmErrors) : null,
      maxHipError: Math.max(...frames.map(frame => frame.hip.error)),
      maxSegmentStretchError: Math.max(...frames.map(frame => frame.stretch.maxRatioError)),
      maxSampleTimeError: Math.max(...frames.map(frame => frame.sampledTime === null ? Infinity : Math.abs(frame.time - frame.sampledTime))),
      endpointSample: { requested: original.duration, actual: frames.at(-1).sampledTime },
      minimumSoleY: Math.min(...frames.flatMap(frame => frame.soles
        ? [frame.soles.left.soleMinY, frame.soles.right.soleMinY] : [])),
      worstSegments: errors.slice(0, 8),
      worstBodySegments: bodyErrors.slice(0, 8),
      frames,
    });
  }
  return {
    method: 'Independent joint-endpoint directions, palm planes, relative segment stretch and root-relative hip displacement',
    samplesPerClip: samplesPerClip + 1,
    commonBones: [...sourceReference.keys()].filter(name => targetReference.has(name)),
    sourceBoneCount: sourceReference.size, targetBoneCount: targetReference.size,
    includesLegacyJump: retargeted.clips.has('Jump'),
    clips: reports,
  };
}

export function compactAudit(report) {
  return { ...report, clips: report.clips.map(({ frames, ...clip }) => clip) };
}
