export class InputController {
  constructor(canvas, handlers = {}) {
    this.keys = new Set(); this.canvas = canvas; this.handlers = handlers;
    this.dragging = false; this.lastX = 0; this.lastY = 0;
    this.down = e => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (!e.repeat) {
        if (e.code === 'Space') handlers.jump?.();
        if (e.code.startsWith('Digit')) handlers.emotion?.(e.code.slice(5));
        if (e.code.startsWith('Numpad')) handlers.emotion?.(e.code.slice(6));
        const map = { KeyF: 'face', KeyV: 'follow', KeyC: 'cycleCamera', KeyR: 'reset', KeyB: 'blink', KeyH: 'hud' };
        if (map[e.code]) handlers[map[e.code]]?.();
      }
    };
    this.up = e => this.keys.delete(e.code);
    this.clear = () => { this.keys.clear(); this.dragging = false; handlers.pauseInput?.(); };
    addEventListener('keydown', this.down); addEventListener('keyup', this.up);
    addEventListener('blur', this.clear);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {
      if (e.button > 2) return;
      this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId); canvas.focus({ preventScroll: true });
    });
    canvas.addEventListener('pointermove', e => {
      if (!this.dragging) return;
      handlers.orbit?.(e.clientX - this.lastX, e.clientY - this.lastY);
      this.lastX = e.clientX; this.lastY = e.clientY;
    });
    const end = () => { this.dragging = false; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end);
    canvas.addEventListener('wheel', e => { e.preventDefault(); handlers.zoom?.(e.deltaY); }, { passive: false });
  }
  get movement() {
    const k = this.keys;
    return { x: +(k.has('KeyD') || k.has('ArrowRight')) - +(k.has('KeyA') || k.has('ArrowLeft')),
      z: +(k.has('KeyW') || k.has('ArrowUp')) - +(k.has('KeyS') || k.has('ArrowDown')),
      run: k.has('ShiftLeft') || k.has('ShiftRight') };
  }
}
