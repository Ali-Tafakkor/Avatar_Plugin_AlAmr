import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { FileLoader, SRGBColorSpace, TextureLoader } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createHybridRuntime } from './hybrid/runtime.mjs';
export { createHybridRuntime } from './hybrid/runtime.mjs';
export const AVATAR_HYBRID_LEGACY_MODEL_URL = new URL('./assets/avatar03.glb', import.meta.url).href;
export const AVATAR_HYBRID_MODEL_URL = new URL('./assets/avatar-v2/avatar.gltf', import.meta.url).href;
export const AVATAR_HYBRID_MOTIONS_URL = new URL('./assets/avatar-v2/motions.json', import.meta.url).href;
export const AVATAR_HYBRID_TEXTURE_URL = new URL('./assets/avatar03-texture.png', import.meta.url).href;
export const AVATAR_HYBRID_HEIGHT = 1.78;
const IDLE = { state: 'idle', horizontalSpeed: 0, verticalSpeed: 0, grounded: true };
function Frames({ runtime, current, controller, locomotion, portrait, onError }) {
    const failed = useRef(false);
    useFrame(({ camera }, delta) => {
        if (failed.current || current.current !== runtime)
            return;
        try {
            runtime.update(delta, { pose: controller.getPoseSnapshot(), locomotion: locomotion.current, camera, portrait });
        }
        catch (reason) {
            failed.current = true;
            onError(reason instanceof Error ? reason : new Error(String(reason)));
        }
    });
    return null;
}
/** The host owns Canvas, navigation, position, heading and camera. This adapter
 * mounts the accepted V1-body/native-V2-face runtime with privately owned state. */
export const AvatarHybrid = forwardRef(function AvatarHybrid({ controller, navigation, legacyModelUrl = AVATAR_HYBRID_LEGACY_MODEL_URL, modelUrl = AVATAR_HYBRID_MODEL_URL, motionsUrl = AVATAR_HYBRID_MOTIONS_URL, textureUrl = AVATAR_HYBRID_TEXTURE_URL, height = AVATAR_HYBRID_HEIGHT, lighting = 'scene', portrait = false, rotationY = Math.PI, onReady, onError, }, ref) {
    if (!Number.isFinite(height) || height <= 0)
        throw new Error('avatar_hybrid_invalid_height');
    const texture = useLoader(TextureLoader, textureUrl);
    texture.flipY = false;
    texture.colorSpace = SRGBColorSpace;
    const legacy = useLoader(GLTFLoader, legacyModelUrl, loader => loader.register(() => ({
        name: 'AVATAR_HYBRID_BUNDLED_TEXTURE',
        loadTexture: index => index === 0 ? Promise.resolve(texture) : null,
    })));
    const gltf = useLoader(GLTFLoader, modelUrl);
    const motions = useLoader(FileLoader, motionsUrl, loader => loader.setResponseType('json'));
    const current = useRef(null), [runtime, setRuntime] = useState(null);
    const locomotion = useRef(IDLE);
    const settings = useRef({ emotion: 'neutral', intensity: 0.88, manual: new Map(),
        options: {}, blink: false, clip: null, time: null,
        playback: {} });
    const callbacks = useRef({ onReady, onError });
    callbacks.current = { onReady, onError };
    useEffect(() => {
        let cancelled = false, owned = null;
        setRuntime(null);
        void createHybridRuntime(legacy, gltf, motions, { height, lighting,
            groundAt(x, z) { return navigation.sampleGround([x, 0, z])?.position[1] ?? 0; },
        }).then(created => {
            if (cancelled) {
                created.dispose();
                return;
            }
            const saved = settings.current;
            created.setEmotion(saved.emotion);
            created.setIntensity(saved.intensity);
            created.setFaceOptions(saved.options);
            for (const [name, value] of saved.manual)
                created.setManual(name, value);
            if (saved.clip !== null)
                created.previewClip(saved.clip);
            created.setPlayback(saved.playback);
            if (saved.time !== null)
                created.seekClip(saved.time);
            if (saved.blink) {
                created.blink();
                saved.blink = false;
            }
            owned = created;
            current.current = created;
            setRuntime(created);
            callbacks.current.onReady?.(created.getStatus());
        }).catch((reason) => { if (!cancelled)
            callbacks.current.onError?.(reason instanceof Error ? reason : new Error(String(reason))); });
        return () => { cancelled = true; if (current.current === owned)
            current.current = null; owned?.dispose(); };
    }, [gltf, motions, legacy, height, lighting, navigation]);
    useImperativeHandle(ref, () => ({
        setLocomotion(value) { locomotion.current = value; },
        previewClip(value) { settings.current.clip = value; settings.current.time = null; current.current?.previewClip(value); },
        seekClip(value) { settings.current.time = value; current.current?.seekClip(value); },
        setPlayback(value) { settings.current.playback = { ...settings.current.playback, ...value }; current.current?.setPlayback(value); },
        setEmotion(value) { settings.current.emotion = value; settings.current.manual.clear(); current.current?.setEmotion(value); },
        setManual(name, value) { settings.current.manual.set(name, value); current.current?.setManual(name, value); },
        setIntensity(value) { settings.current.intensity = value; current.current?.setIntensity(value); },
        setFaceOptions(value) { settings.current.options = { ...settings.current.options, ...value }; current.current?.setFaceOptions(value); },
        blink() { if (current.current)
            current.current.blink();
        else
            settings.current.blink = true; },
        reset() { locomotion.current = IDLE; settings.current.clip = null; settings.current.time = null; current.current?.reset(); },
        getStatus() { return current.current?.getStatus() ?? null; }, getRuntime() { return current.current; },
        getRoot() { return current.current?.root ?? null; },
    }), []);
    return _jsx("group", { "rotation-y": rotationY, children: runtime && _jsxs(_Fragment, { children: [_jsx("primitive", { object: runtime.root, dispose: null }), _jsx(Frames, { runtime: runtime, current: current, controller: controller, locomotion: locomotion, portrait: portrait, onError: reason => callbacks.current.onError?.(reason) })] }) });
});
//# sourceMappingURL=hybrid.js.map