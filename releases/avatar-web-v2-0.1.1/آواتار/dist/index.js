import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, SRGBColorSpace } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createAvatar03Instance } from './model.js';
import { Avatar03Animator } from './motion.js';
export { AvatarWebV2, AVATAR_V2_MODEL_URL, AVATAR_V2_MOTIONS_URL, AVATAR_V2_HEIGHT, EMOTIONS, FACE_GROUPS, LOCOMOTION_PROFILE, createWebAvatarRuntime } from './v2.js';
export { AVATAR03_CLIPS, MOTION_CLIPS, Avatar03Animator } from './motion.js';
export const AVATAR03_MODEL_URL = new URL('./assets/avatar03.glb', import.meta.url).href;
export const AVATAR03_HEIGHT = 1.78;
/** Mount as the official PlayerRig's avatar ReactNode, inside the host's Canvas/Suspense. */
export const Avatar03 = forwardRef(function Avatar03({ modelUrl = AVATAR03_MODEL_URL, textureUrl = new URL('./assets/avatar03-texture.png', import.meta.url).href, height = AVATAR03_HEIGHT, rotationY = Math.PI, castShadow = true, lighting = 'scene', onReady, children, }, ref) {
    if (!Number.isFinite(height) || height <= 0)
        throw new Error('avatar03_invalid_height');
    const texture = useLoader(TextureLoader, textureUrl);
    texture.flipY = false;
    texture.colorSpace = SRGBColorSpace;
    const gltf = useLoader(GLTFLoader, modelUrl, loader => loader.register(() => ({
        name: 'AVATAR03_BUNDLED_TEXTURE',
        loadTexture: index => index === 0 ? Promise.resolve(texture) : null,
    })));
    const readyCallback = useRef(onReady);
    readyCallback.current = onReady;
    const latestMotion = useRef({ state: 'idle' });
    const manualClip = useRef(null);
    const animator = useRef(null);
    const instance = useMemo(() => createAvatar03Instance(gltf, height, lighting), [gltf, height, lighting]);
    useEffect(() => {
        const driver = new Avatar03Animator(instance.model, gltf.animations);
        animator.current = driver;
        driver.setMotion(latestMotion.current);
        if (manualClip.current)
            driver.preview(manualClip.current);
        readyCallback.current?.({ height, clips: gltf.animations.map(clip => clip.name), meshCount: instance.meshes.length });
        return () => { driver.dispose(); if (animator.current === driver)
            animator.current = null; };
    }, [instance, gltf, height]);
    useEffect(() => {
        for (const mesh of instance.meshes) {
            mesh.castShadow = castShadow;
            mesh.receiveShadow = true;
        }
    }, [instance, castShadow]);
    useEffect(() => () => instance.dispose(), [instance]);
    useImperativeHandle(ref, () => ({
        setLocomotion(motion) { latestMotion.current = motion; animator.current?.setMotion(motion); },
        previewClip(clip) { manualClip.current = clip; animator.current?.preview(clip); },
        getStatus() { return animator.current?.getStatus() ?? null; },
    }), []);
    useFrame((_, delta) => animator.current?.update(delta));
    return _jsxs("group", { "rotation-y": rotationY, children: [_jsx("primitive", { object: instance.root, dispose: null }), children] });
});
//# sourceMappingURL=index.js.map