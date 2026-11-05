# Avatar 03 — accepted Hybrid 0.1.3 contract

Recommended avatar.character export: **AvatarHybrid**. The November 5 owner-approved appearance includes enhanced skin/albedo and eyes, 66 native facial channels, detailed rigged hands, relaxed fingers, contact guard, friendly neutral, lightweight cloth, smooth shortened neck, fitted original neckline and quiet idle. Plugin/publisher/slug/contractVersion and peer compatibility are unchanged.

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
Props: controller, navigation, optional local asset URLs, height=1.78, lighting='scene'|'unlit', rotationY=PI, portrait=false, onReady and onError. Use host walkSpeed=5 and sprintSpeed=9 for retained V1 timing. The separate AvatarWebV2 LOCOMOTION_PROFILE remains 2.25/6.2m/s.

The host applies world position/yaw once. Runtime instances own their mutable rigs, geometry, materials and expression state; unmount disposes owned resources. The body uses eight V1 clips and V2 jump. Native face/neck anchors follow current torso and head poses.

## Controls

The handle supports setLocomotion, previewClip, seekClip, setPlayback, setEmotion, setIntensity, setManual, setFaceOptions, blink, reset, getStatus, getRoot and getRuntime (inspection). Exact types ship in dist. Emotions: neutral, smile, laugh, sad, angry, surprise. Face options: blinkEnabled, gazeEnabled, microEnabled.

Hand controls: `setHandPose(pose,side?)` and `setFingerCurl(side,digit,value)`. Poses: auto, open, relaxed, fist, point, pinch. Sides: both, left, right. Digits: thumb, index, middle, ring, pinky; curl 0..1.

createHybridRuntime also works without React. Its option garmentNeckline:false restores the original garment opening independently of neckContour. The contact guard is avatar-specific, not general physics collision.

## Optional microphone and audible laughter

setSpeechFrame, setSpeechOptions, setLaughter and clearSpeech feed a single face compositor. Import createMicrophoneSpeechController and LaughterDetector from `/speech`. The host owns explicit user activation, native/browser permission, model/WASM URLs, status UI, stopping on hide and disposal. Model/WASM assets are host-owned and optional for rendering/manual expressions. See SPEECH_INTEGRATION.md and the sample SpeechPanel.tsx. PCM stays local and is not recorded/uploaded. Audible laughter detection is experimental and does not infer internal emotion.

## Compatible APIs and release

Avatar03, Avatar03Animator, AVATAR03_CLIPS and the original model remain intact. AvatarWebV2, `/web-v2`, `/runtime`, `/web-model`, `/web-motions`, `/web-asset-manifest`, `/hybrid`, `/hybrid-runtime` and `/speech` remain available. Existing consumers are not automatically migrated; select AvatarHybrid explicitly.

Both product version fields are **0.1.3**. Select this **آواتار** folder in Desktop to send a new release of the same product. Local build/validation is separate from Registry upload/review/publication. Online version availability remains unverified because CLI authentication is required. MIT covers code only; model/texture/motion notices remain in THIRD_PARTY_NOTICES.md.
