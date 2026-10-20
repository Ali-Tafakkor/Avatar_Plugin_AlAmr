import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { FileLoader, type Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { AvatarWebV2Props, AvatarV2Locomotion, Avatar03Clip } from '@al-amr-community/usr-20dfea67-47be-4f4a-b48c-02c5f210a079--avatar03';
import { createHybridRuntime } from '../experiments/hybrid-v2-face/runtime.mjs';

export interface HybridTestAvatarHandle {
  setLocomotion(value: AvatarV2Locomotion): void;
  previewClip(value: Avatar03Clip | null): void;
  seekClip(seconds: number): void;
  setPlayback(value: { paused?: boolean; timeScale?: number }): void;
  setEmotion(name: any): void; setManual(group: string, value: number): void;
  setIntensity(value: number): void; setFaceOptions(value: any): void; blink(): void;
  reset(): void; getStatus(): any; getRuntime(): any; getRoot(): Group | null;
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
export const HybridTestAvatar = forwardRef<HybridTestAvatarHandle, Props>(function HybridTestAvatar({
  controller, navigation, modelUrl = '', motionsUrl = '', legacyModelUrl, height = 1.78, lighting = 'scene', portrait = false, rotationY = Math.PI, onReady, onError,
}, ref) {
  const gltf = useLoader(GLTFLoader, modelUrl), legacy = useLoader(GLTFLoader, legacyModelUrl);
  const motions = useLoader(FileLoader, motionsUrl, loader => loader.setResponseType('json'));
  const current = useRef<any>(null), [runtime, setRuntime] = useState<any>(null);
  const locomotion = useRef<AvatarV2Locomotion>(idle);
  const settings = useRef({ emotion: 'neutral', intensity: 0.88, manual: new Map<string, number>(), options: {} as Record<string, unknown>, blink: false });
  const callbacks = useRef({ onReady, onError }); callbacks.current = { onReady, onError };
  useEffect(() => {
    let cancelled = false, owned: any = null;
    void createHybridRuntime(legacy, gltf, motions, { height, lighting,
      groundAt(x: number, z: number) { return navigation.sampleGround([x, 0, z])?.position[1] ?? 0; },
    }).then((created: any) => {
      if (cancelled) { created.dispose(); return; }
      created.setEmotion(settings.current.emotion); created.setIntensity(settings.current.intensity); created.setFaceOptions(settings.current.options);
      for (const [name, value] of settings.current.manual) created.setManual(name, value);
      if (settings.current.blink) { created.blink(); settings.current.blink = false; }
      owned = created; current.current = created; setRuntime(created); callbacks.current.onReady?.(created.getStatus());
    }).catch((reason: unknown) => { if (!cancelled) callbacks.current.onError?.(reason instanceof Error ? reason : new Error(String(reason))); });
    return () => { cancelled = true; if (current.current === owned) current.current = null; owned?.dispose(); };
  }, [gltf, motions, legacy, height, lighting, navigation]);
  useImperativeHandle(ref, () => ({
    setLocomotion(value) { locomotion.current = value; },
    previewClip(value) { current.current?.previewClip(value); }, seekClip(value) { current.current?.seekClip(value); },
    setPlayback(value) { current.current?.setPlayback(value); }, setEmotion(value) { settings.current.emotion = value; settings.current.manual.clear(); current.current?.setEmotion(value); },
    setManual(name, value) { settings.current.manual.set(name, value); current.current?.setManual(name, value); },
    setIntensity(value) { settings.current.intensity = value; current.current?.setIntensity(value); },
    setFaceOptions(value) { settings.current.options = { ...settings.current.options, ...value }; current.current?.setFaceOptions(value); },
    blink() { if (current.current) current.current.blink(); else settings.current.blink = true; },
    reset() { locomotion.current = idle; current.current?.reset(); },
    getStatus() { return current.current?.getStatus() ?? null; }, getRuntime() { return current.current; },
    getRoot() { return current.current?.root ?? null; },
  }), []);
  return <group rotation-y={rotationY}>{runtime && <><primitive object={runtime.root} dispose={null} />
    <Frames runtime={runtime} controller={controller} locomotion={locomotion} portrait={portrait}
      onError={reason => callbacks.current.onError?.(reason)} /></>}</group>;
});
