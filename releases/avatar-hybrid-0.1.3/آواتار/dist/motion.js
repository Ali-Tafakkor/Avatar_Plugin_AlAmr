import { AnimationMixer, LoopOnce, LoopRepeat } from 'three';
export const AVATAR03_CLIPS = ['Stand', 'Walk', 'Run', 'Fly', 'Jump', 'HandRaise', 'StandToSit', 'Sitting', 'SittoStand'];
export const MOTION_CLIPS = Object.freeze({
    idle: 'Stand', walk: 'Walk', run: 'Run', jump: 'Jump', fly: 'Fly', fall: 'Jump', land: 'Stand',
});
/** One mixer per character. It never moves the host's player root or camera. */
export class Avatar03Animator {
    root;
    mixer;
    actions = new Map();
    current;
    clip = 'Stand';
    motion = { state: 'idle' };
    manual = null;
    disposed = false;
    constructor(root, clips) {
        this.root = root;
        const missing = AVATAR03_CLIPS.filter(name => !clips.some(clip => clip.name === name));
        if (missing.length)
            throw new Error(`avatar03_missing_clips: ${missing.join(', ')}`);
        this.mixer = new AnimationMixer(root);
        for (const name of AVATAR03_CLIPS) {
            const action = this.mixer.clipAction(clips.find(clip => clip.name === name));
            this.actions.set(name, action);
        }
        this.current = this.actions.get('Stand');
        this.configure(this.current, 'Stand', false);
        this.current.play();
        this.mixer.update(0);
    }
    configure(action, name, preview) {
        const once = ['Jump', 'HandRaise', 'StandToSit', 'SittoStand'].includes(name);
        action.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity);
        action.clampWhenFinished = once;
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(1);
        // Preview transitions intentionally hold their last pose for inspection.
        void preview;
    }
    switchTo(name, restart = false) {
        if (this.disposed || (this.clip === name && !restart))
            return;
        const previous = this.current;
        const next = this.actions.get(name);
        next.reset();
        this.configure(next, name, this.manual !== null);
        next.play();
        if (previous !== next)
            previous.crossFadeTo(next, 0.18, false);
        this.current = next;
        this.clip = name;
    }
    setMotion(motion) {
        const was = this.motion.state;
        this.motion = motion;
        if (this.manual || this.disposed)
            return;
        // A fall uses the existing jump pose; no newly authored fall/land clip is claimed.
        this.switchTo(MOTION_CLIPS[motion.state], motion.state === 'jump' && was !== 'jump');
        if (motion.state === 'walk' || motion.state === 'run') {
            const reference = motion.state === 'walk' ? 2.4 : 5.5;
            const speed = motion.horizontalSpeed ?? reference;
            this.current.setEffectiveTimeScale(Math.max(0.3, Math.min(2, speed / reference)));
        }
        else
            this.current.setEffectiveTimeScale(1);
    }
    preview(name) {
        if (this.disposed)
            return;
        if (name !== null && !this.actions.has(name))
            throw new Error(`avatar03_unknown_clip: ${name}`);
        this.manual = name;
        this.switchTo(name ?? MOTION_CLIPS[this.motion.state], true);
    }
    update(delta) {
        if (this.disposed || !Number.isFinite(delta) || delta < 0)
            return;
        this.mixer.update(Math.min(delta, 0.1));
    }
    getStatus() {
        return { clip: this.clip, mode: this.manual ? 'preview' : 'locomotion', sourceState: this.motion.state,
            fallback: !this.manual && (this.motion.state === 'fall' || this.motion.state === 'land'),
            time: this.current.time, duration: this.current.getClip().duration };
    }
    dispose() {
        if (this.disposed)
            return;
        this.mixer.stopAllAction();
        this.mixer.uncacheRoot(this.root);
        this.actions.clear();
        this.disposed = true;
    }
}
//# sourceMappingURL=motion.js.map