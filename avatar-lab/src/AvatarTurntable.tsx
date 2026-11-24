import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Quaternion, Vector3, type Bone, type Group, type PerspectiveCamera } from 'three';
import type { AvatarHybridHandle } from '../../آواتار/dist/hybrid.js';

type SavedPose = { bone: Bone; rotation: Quaternion };

export function AvatarTurntable({ avatar, pivot, paused, ready }: {
  avatar: RefObject<AvatarHybridHandle | null>;
  pivot: RefObject<Group | null>;
  paused: boolean;
  ready: boolean;
}) {
  const { camera, size } = useThree();
  const angle = useRef(0);
  const saved = useRef<SavedPose[]>([]);
  const scratch = useMemo(() => ({
    origin: new Vector3(), end: new Vector3(), current: new Vector3(), aim: new Vector3(),
    center: new Vector3(), rootRotation: new Quaternion(), parentInverse: new Quaternion(), change: new Quaternion(),
  }), []);

  useEffect(() => {
    const perspective = camera as PerspectiveCamera;
    const aspect = size.width / Math.max(size.height, 1);
    const fit = Math.tan(MathUtils.degToRad(perspective.fov / 2));
    const distance = Math.max(1.19, .69 / aspect) / fit;
    camera.position.set(0, .96, distance);
    camera.lookAt(0, .96, 0);
    camera.updateMatrixWorld();
  }, [camera, size.width, size.height]);

  const restore = () => {
    for (const { bone, rotation } of saved.current) bone.quaternion.copy(rotation);
  };
  useEffect(() => {
    const group = pivot.current;
    return () => {
      restore();
      if (group) group.rotation.y = 0;
    };
  }, [pivot]);

  // The normal animation and its contact solvers see their normal pose.
  // Apply the display-only arm positions after the Hybrid frame and before render.
  useFrame(restore, -1);
  useFrame((_, dt) => {
    const runtime = avatar.current?.getRuntime();
    const group = pivot.current;
    if (!ready || !runtime || !group) return;
    if (!paused) angle.current = (angle.current + Math.min(dt, .08) * Math.PI / 10) % (2 * Math.PI);
    group.rotation.y = angle.current;
    runtime.root.updateWorldMatrix(true, true);

    const { origin, end, current, aim, center, rootRotation, parentInverse, change } = scratch;
    runtime.root.getWorldPosition(center);
    runtime.root.getWorldQuaternion(rootRotation);
    let index = 0;
    for (const side of ['left', 'right']) {
      const upper = runtime.body.bones.get(side + 'arm');
      const forearm = runtime.body.bones.get(side + 'forearm');
      const wrist = runtime.body.bones.get(side + 'hand');
      if (!upper || !forearm || !wrist) continue;
      const sign = Math.sign(upper.getWorldPosition(origin).sub(center).applyQuaternion(parentInverse.copy(rootRotation).invert()).x);
      for (const [bone, child, degrees] of [[upper, forearm, 36], [forearm, wrist, 31]] as const) {
        if (!bone.parent) continue;
        const cached = saved.current[index] ?? { bone, rotation: new Quaternion() };
        cached.bone = bone;
        cached.rotation.copy(bone.quaternion);
        saved.current[index++] = cached;

        child.getWorldPosition(end);
        bone.getWorldPosition(origin);
        bone.parent.getWorldQuaternion(parentInverse).invert();
        current.copy(end).sub(origin).applyQuaternion(parentInverse).normalize();
        const slope = MathUtils.degToRad(degrees);
        aim.set(sign * Math.sin(slope), -Math.cos(slope), 0).applyQuaternion(rootRotation).applyQuaternion(parentInverse);
        bone.quaternion.premultiply(change.setFromUnitVectors(current, aim));
        bone.updateWorldMatrix(false, true);
      }
    }
    saved.current.length = index;
  }, .75);
  return null;
}
