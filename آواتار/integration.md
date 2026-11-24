# Avatar 03 — single-character Hybrid 0.1.4

The avatar.character export is **AvatarHybrid**, the Young Purple Avatar. The accepted appearance includes enhanced skin/albedo and eyes, 66 native facial channels, detailed rigged hands, relaxed fingers, contact guard, friendly neutral, lightweight cloth, smooth shortened neck, fitted original neckline and quiet idle. The body and native face source assets are inputs to that single character.

## Host integration

Import from `@al-amr-community/usr-20dfea67-47be-4f4a-b48c-02c5f210a079--avatar03`. The host owns Canvas, WebGPURenderer, lights, camera, navigation, world transforms, input and frame loop. Use the existing Player Rig avatar slot. The face/garment use Three TSL node materials; standard WebGLRenderer compatibility is not established.

```tsx
import {AvatarHybrid} from '@al-amr-community/usr-20dfea67-47be-4f4a-b48c-02c5f210a079--avatar03';
// Inside the host Canvas, Suspense and PlayerRig.avatar:
<AvatarHybrid ref={avatar} controller={controller} navigation={navigation}
  legacyModelUrl={asset('avatar-hybrid/legacy.gltf')}
  textureUrl={asset('avatar-hybrid/image-0.png')}
  modelUrl={asset('avatar-v2/avatar.gltf')}
  motionsUrl={asset('avatar-v2/motions.json')}
  faceAlbedoUrl={asset('appearance/face-albedo.png')}/>
```

`asset` is the consuming host's local URL resolver. Copy full sibling resources, not only JSON. The repository's `avatar-lab/scripts/prepare-avatar-hybrid.mjs` demonstrates preparation using installed package exports `/model`, `/web-model`, `/web-motions`, and dist/assets/appearance. The face texture is also exported as AVATAR_HYBRID_FACE_ALBEDO_URL from `/hybrid`. Package-relative defaults work with the original package layout. No runtime import depends on experiments, repository source or a development server.

Peers: React >=19 <19.3, Three >=0.185.1 <0.186.0, Fiber >=9.6.1 <10.
Props: controller, navigation, optional local asset URLs, height=1.78, lighting='scene'|'unlit', rotationY=PI, portrait=false, onReady and onError. Use host walkSpeed=5 and sprintSpeed=9 for retained V1 timing.

The host applies world position/yaw once. Runtime instances own their mutable rigs, geometry, materials and expression state; unmount disposes owned resources. The body uses eight V1 clips and V2 jump. Native face/neck anchors follow current torso and head poses.

## Neck behind the shirt in a selective face pass

With ordinary whole-scene rendering, the shirt includes its own depth and neckline mask. For a host with a separately composited WebGL face tile, use the typed helpers exported from the package root and `/face-detail`. They implement the garment-depth fix verified in Hamneshin 2. Cache the subject from the mounted actor and call the tile pass after the pose update.

```ts
// Once the Hybrid instance is ready:
const subject = getHybridFaceDetailMeshes(runtime.root);
// In a WebGL port with compatible, alpha-cutout materials:
renderer.setRenderTarget(faceTile);
renderer.setClearColor(0, 0);
tileCamera.layers.set(faceLayer);
// The host assigns the intended lights to faceLayer and uses its cropped projection.
renderHybridFaceTile(renderer, scene, tileCamera, subject, faceLayer);
```

Use a dedicated layer and a depth-enabled tile with color/depth clears enabled. Keep the exact skinned shirt, its alpha cutout and the same pose/camera for both passes. The helper writes shirt depth before drawing the face and restores mesh layers, color writes and autoClear. The host still composites the tile against scene depth and owns render-target, background and camera state. Skip a hidden first-person face. The regular R3F adapter uses Three TSL/WebGPU materials; the helper is for the host's WebGL port, such as Hamneshin 2. Hosts applying their own upper-body gaze overlays should restore the prior animated joint pose before the next mixer update, then reapply the overlay once.

## Controls

The handle supports setLocomotion, previewClip, seekClip, setPlayback, setEmotion, setIntensity, setManual, setFaceOptions, blink, reset, getStatus, getRoot and getRuntime (inspection). Exact types ship in dist. Emotions: neutral, smile, laugh, sad, angry, surprise. Face options: blinkEnabled, gazeEnabled, microEnabled.

Hand controls: `setHandPose(pose,side?)` and `setFingerCurl(side,digit,value)`. Poses: auto, open, relaxed, fist, point, pinch. Sides: both, left, right. Digits: thumb, index, middle, ring, pinky; curl 0..1.

createHybridRuntime also works without React. Its option garmentNeckline:false restores the original garment opening independently of neckContour. The contact guard is avatar-specific, not general physics collision.

## Optional microphone and audible laughter

setSpeechFrame, setSpeechOptions, setLaughter and clearSpeech feed a single face compositor. Import createMicrophoneSpeechController and LaughterDetector from `/speech`. The host owns explicit user activation, native/browser permission, model/WASM URLs, status UI, stopping on hide and disposal. Model/WASM assets are host-owned and optional for rendering/manual expressions. See SPEECH_INTEGRATION.md and the sample SpeechPanel.tsx. PCM stays local and is not recorded/uploaded. Audible laughter detection is experimental and does not infer internal emotion.

## Release and migration

For the latest character, use AvatarHybrid or createHybridRuntime. Hosts pinned to an earlier release can keep that release's Avatar03 and AvatarWebV2 adapters. This release exposes the Hybrid render component and its supporting model/motion assets, typed runtime, speech and face-tile helpers.

Both product version fields are **0.1.4**. Select this **آواتار** folder in Desktop to send a new release of the same product. MIT covers code; model/texture/motion notices remain in THIRD_PARTY_NOTICES.md.
