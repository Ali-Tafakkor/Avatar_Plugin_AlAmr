import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { FileLoader } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { AvatarWebV2Props, AvatarV2Locomotion, Avatar03Clip } from '@al-amr-community/usr-20dfea67-47be-4f4a-b48c-02c5f210a079--avatar03';
import { createMotionTestRuntime } from '../experiments/v1-motion/runtime.mjs';

export interface MotionTestAvatarHandle {
  setLocomotion(value: AvatarV2Locomotion): void;
  previewClip(value: Avatar03Clip | null): void;
  seekClip(seconds: number): void;
  setPlayback(value: { paused?: boolean; timeScale?: number }): void;
  setEmotion(name: any): void; setManual(group: string, value: number): void;
  setIntensity(value: number): void; setFaceOptions(value: any): void; blink(): void;
  reset(): void; getStatus(): any; getRuntime(): any;
}
type Props = AvatarWebV2Props & { legacyModelUrl: string };
const idle: AvatarV2Locomotion = { state: 'idle', horizontalSpeed: 0, verticalSpeed: 0, grounded: true };

function Frames({ runtime, controller, locomotion, portrait, onError }: { runtime: any; controller: Props['controller']; locomotion: { current: AvatarV2Locomotion }; portrait: boolean; onError: (reason: Error) => void }) {
  const failed = useRef(false);
  useFrame(({ camera }, dt) => {
    if (failed.current) return;
    try { runtime.update(dt, { pose: controller.getPoseSnapshot(), locomotion: locomotion.current, camera, portrait }); }
    catch (reason) { failed.current = true; onError(reason instanceof Error ? reason : new Error(String(reason))); }
  });
  return null;
}
export const MotionTestAvatar = forwardRef<MotionTestAvatarHandle, Props>(function MotionTestAvatar({
  controller, navigation, modelUrl = '', motionsUrl = '', legacyModelUrl, height = 1.78, lighting = 'scene', portrait = false, rotationY = Math.PI, onReady, onError,
}, ref) {
  const gltf = useLoader(GLTFLoader, modelUrl), legacy = useLoader(GLTFLoader, legacyModelUrl);
  const motions = useLoader(FileLoader, motionsUrl, loader => loader.setResponseType('json'));
  const current = useRef<any>(null), [runtime, setRuntime] = useState<any>(null);
  const locomotion = useRef<AvatarV2Locomotion>(idle);
  const callbacks = useRef({ onReady, onError }); callbacks.current = { onReady, onError };
  useEffect(() => {
    let cancelled = false, owned: any = null;
    void createMotionTestRuntime(gltf, motions, legacy, { height, lighting,
      groundAt(x: number, z: number) { return navigation.sampleGround([x, 0, z])?.position[1] ?? 0; },
    }).then(created => {
      if (cancelled) { created.dispose(); return; }
      owned = created; current.current = created; setRuntime(created); callbacks.current.onReady?.(created.getStatus());
    }).catch(reason => { if (!cancelled) callbacks.current.onError?.(reason instanceof Error ? reason : new Error(String(reason))); });
    return () => { cancelled = true; if (current.current === owned) current.current = null; owned?.dispose(); };
  }, [gltf, motions, legacy, height, lighting, navigation]);
  useImperativeHandle(ref, () => ({
    setLocomotion(value) { locomotion.current = value; },
    previewClip(value) { current.current?.previewClip(value); }, seekClip(value) { current.current?.seekClip(value); },
    setPlayback(value) { current.current?.setPlayback(value); }, setEmotion(value) { current.current?.setEmotion(value); },
    setManual(name, value) { current.current?.setManual(name, value); }, setIntensity(value) { current.current?.setIntensity(value); },
    setFaceOptions(value) { current.current?.setFaceOptions(value); }, blink() { current.current?.blink(); },
    reset() { locomotion.current = idle; current.current?.reset(); },
    getStatus() { return current.current?.getStatus() ?? null; }, getRuntime() { return current.current; },
  }), []);
  return <group rotation-y={rotationY}>{runtime && <><primitive object={runtime.root} dispose={null} />
    <Frames runtime={runtime} controller={controller} locomotion={locomotion} portrait={portrait}
      onError={reason => callbacks.current.onError?.(reason)} /></>}</group>;
});
