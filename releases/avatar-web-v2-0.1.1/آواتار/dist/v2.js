import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { FileLoader } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createWebAvatarRuntime } from './web-v2/runtime.mjs';
export const AVATAR_V2_MODEL_URL = new URL('./assets/avatar-v2/avatar.gltf', import.meta.url).href;
export const AVATAR_V2_MOTIONS_URL = new URL('./assets/avatar-v2/motions.json', import.meta.url).href;
export const AVATAR_V2_HEIGHT = 1.78;
export { createWebAvatarRuntime, EMOTIONS, FACE_GROUPS, LOCOMOTION_PROFILE } from './web-v2/runtime.mjs';
const INITIAL_LOCOMOTION = {
    state: 'idle',
    horizontalSpeed: 0, verticalSpeed: 0, grounded: true,
};
function RuntimeFrame({ runtime, current, controller, locomotion, failed, portrait, onError }) {
    useFrame(({ camera }, deltaSeconds) => {
        if (current.current !== runtime || failed.current)
            return;
        try {
            runtime.update(deltaSeconds, {
                pose: controller.getPoseSnapshot(), locomotion: locomotion.current, camera, portrait,
            });
        }
        catch (reason) {
            // A persistent frame error is reported once, rather than flooding the HUD.
            failed.current = true;
            onError(reason);
        }
    });
    return null;
}
/** The Environment owns movement/camera; the extracted runtime owns bones and face. */
export const AvatarWebV2 = forwardRef(function AvatarWebV2({ controller, navigation, modelUrl = AVATAR_V2_MODEL_URL, motionsUrl = AVATAR_V2_MOTIONS_URL, height = AVATAR_V2_HEIGHT, lighting = 'scene', portrait = false, rotationY = Math.PI, onReady, onError, }, ref) {
    if (!Number.isFinite(height) || height <= 0)
        throw new Error('avatar_v2_invalid_height');
    // Both resources are Suspense-cached. The runtime clones the GLTF scene so
    // separate avatar instances never share mutable bones or face influences.
    const gltf = useLoader(GLTFLoader, modelUrl);
    const motionPack = useLoader(FileLoader, motionsUrl, loader => { loader.setResponseType('json'); });
    const current = useRef(null);
    const [runtime, setRuntime] = useState(null);
    const locomotion = useRef(INITIAL_LOCOMOTION);
    const failed = useRef(false);
    const callbacks = useRef({ onReady, onError });
    callbacks.current = { onReady, onError };
    const settings = useRef({
        emotion: 'smile',
        intensity: 0.88,
        manual: new Map(),
        options: {},
        pendingBlink: false,
    });
    useEffect(() => {
        let cancelled = false;
        let owned = null;
        failed.current = false;
        setRuntime(null);
        void (async () => {
            try {
                const created = await createWebAvatarRuntime(gltf, motionPack, {
                    height, lighting,
                    groundAt(x, z, _maxY) {
                        return navigation.sampleGround([x, 0, z])?.position[1] ?? 0;
                    },
                });
                if (cancelled) {
                    created.dispose();
                    return;
                }
                owned = created;
                const saved = settings.current;
                created.setEmotion(saved.emotion);
                created.setIntensity(saved.intensity);
                created.setFaceOptions(saved.options);
                for (const [group, value] of saved.manual)
                    created.setManual(group, value);
                if (saved.pendingBlink) {
                    created.blink();
                    saved.pendingBlink = false;
                }
                current.current = created;
                setRuntime(created);
                callbacks.current.onReady?.(created.getStatus());
            }
            catch (reason) {
                if (cancelled)
                    return;
                failed.current = true;
                callbacks.current.onError?.(reason instanceof Error ? reason : new Error(String(reason)));
            }
        })();
        return () => {
            cancelled = true;
            if (current.current === owned)
                current.current = null;
            owned?.dispose();
        };
    }, [gltf, motionPack, height, lighting, navigation]);
    useImperativeHandle(ref, () => ({
        setLocomotion(value) { locomotion.current = value; },
        setEmotion(name) {
            settings.current.emotion = name;
            settings.current.manual.clear();
            current.current?.setEmotion(name);
        },
        setManual(group, value) {
            settings.current.manual.set(group, value);
            current.current?.setManual(group, value);
        },
        setIntensity(value) { settings.current.intensity = value; current.current?.setIntensity(value); },
        setFaceOptions(options) {
            settings.current.options = { ...settings.current.options, ...options };
            current.current?.setFaceOptions(options);
        },
        blink() {
            if (current.current)
                current.current.blink();
            else
                settings.current.pendingBlink = true;
        },
        reset() { locomotion.current = INITIAL_LOCOMOTION; current.current?.reset(); },
        getStatus() { return current.current?.getStatus() ?? null; },
        getRuntime() { return current.current; },
    }), []);
    // PlayerRig's yaw=0 travels toward -Z; this model's anatomical forward is +Z.
    // Mount the frame subscriber only after async initialization in useEffect.
    // PlayerRig's layout-effect subscriber is then already registered at priority
    // zero, so its current pose, locomotion and camera reach this frame together.
    // A positive priority would take rendering away from R3F and is unnecessary.
    return _jsx("group", { "rotation-y": rotationY, children: runtime && _jsxs(_Fragment, { children: [_jsx("primitive", { object: runtime.root, dispose: null }), _jsx(RuntimeFrame, { runtime: runtime, current: current, controller: controller, locomotion: locomotion, failed: failed, portrait: portrait, onError: reason => callbacks.current.onError?.(reason instanceof Error ? reason : new Error(String(reason))) })] }) });
});
//# sourceMappingURL=v2.js.map