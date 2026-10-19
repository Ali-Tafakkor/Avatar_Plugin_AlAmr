import { clamp, cameraRelative, dampAngle, moveToward2 } from './math.mjs';

export const SETTINGS = Object.freeze({
  radius: 0.27, height: 1.78, walkSpeed: 1.52, runSpeed: 4.25,
  acceleration: 8.5, braking: 12.5, gravity: 18.8, jumpSpeed: 5.6,
  stepHeight: 0.20, coyoteTime: 0.10, jumpBuffer: 0.18, anticipation: 0.095,
  boundary: 17.1
});

/** Simple static test environment: boxes are solid, their tops are walkable. */
export class CollisionWorld {
  constructor(boxes = []) { this.boxes = boxes; }
  groundAt(x, z, maxY = Infinity) {
    let y = 0;
    for (const b of this.boxes) {
      if (b.top <= maxY + 0.001 && x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) y = Math.max(y, b.top);
    }
    return y;
  }
  move(x, z, y, radius, height, stepHeight = 0) {
    let px = clamp(x, -SETTINGS.boundary + radius, SETTINGS.boundary - radius);
    let pz = clamp(z, -SETTINGS.boundary + radius, SETTINGS.boundary - radius);
    for (let iteration = 0; iteration < 3; iteration++) {
      for (const b of this.boxes) {
        if (b.top <= y + stepHeight + 0.002 || (b.bottom ?? 0) >= y + height) continue;
        const nx = clamp(px, b.minX, b.maxX), nz = clamp(pz, b.minZ, b.maxZ);
        const dx = px - nx, dz = pz - nz, d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-10) { const k = (radius - Math.sqrt(d2)) / Math.sqrt(d2); px += dx * k; pz += dz * k; }
        else {
          const sides = [Math.abs(px - b.minX), Math.abs(b.maxX - px), Math.abs(pz - b.minZ), Math.abs(b.maxZ - pz)];
          const side = sides.indexOf(Math.min(...sides));
          if (side === 0) px = b.minX - radius;
          else if (side === 1) px = b.maxX + radius;
          else if (side === 2) pz = b.minZ - radius;
          else pz = b.maxZ + radius;
        }
      }
    }
    return [px, pz];
  }
}

/** Deterministic fixed-step capsule-like character controller; independent of Three.js. */
export class CharacterPhysics {
  constructor(world) { this.world = world; this.reset(); }
  reset() {
    this.x = 0; this.y = 0; this.z = 0; this.vx = 0; this.vz = 0; this.vy = 0;
    this.yaw = 0; this.grounded = true; this.coyote = SETTINGS.coyoteTime;
    this.jumpQueue = 0; this.anticipation = 0; this.landing = 0; this.impact = 0;
    this.jumpCount = 0; this.state = 'idle'; this.speed = 0; this.airTime = 0;
  }
  jump() { this.jumpQueue = SETTINGS.jumpBuffer; }
  stop() { this.vx = this.vz = 0; this.jumpQueue = 0; }
  update(dt, input, cameraYaw) {
    dt = clamp(dt, 0, 1 / 30);
    const cfg = SETTINGS;
    this.jumpQueue = Math.max(0, this.jumpQueue - dt);
    this.landing = Math.max(0, this.landing - dt);
    this.coyote = this.grounded ? cfg.coyoteTime : Math.max(0, this.coyote - dt);
    let [ix, iz] = cameraRelative(input.x, input.z, cameraYaw);
    const targetSpeed = input.run ? cfg.runSpeed : cfg.walkSpeed;
    if (this.jumpQueue > 0 && this.coyote > 0 && this.anticipation === 0) {
      this.anticipation = cfg.anticipation; this.jumpQueue = 0;
    }
    let launched = false;
    if (this.anticipation > 0) {
      this.anticipation = Math.max(0, this.anticipation - dt);
      if (this.anticipation === 0) {
        this.vy = cfg.jumpSpeed; this.grounded = false; this.coyote = 0;
        this.jumpCount++; this.airTime = 0; launched = true;
      }
    }
    const a = this.grounded ? ((ix || iz) ? cfg.acceleration : cfg.braking) : cfg.acceleration * 0.32;
    [this.vx, this.vz] = moveToward2(this.vx, this.vz, ix * targetSpeed, iz * targetSpeed, a * dt);
    const oldX = this.x, oldZ = this.z, oldY = this.y;
    [this.x, this.z] = this.world.move(this.x + this.vx * dt, this.z + this.vz * dt, this.y,
      cfg.radius, cfg.height, this.grounded ? cfg.stepHeight : 0);
    // Animation speed follows achieved motion, not input, including when blocked by a wall.
    this.speed = Math.hypot(this.x - oldX, this.z - oldZ) / Math.max(dt, 1e-6);
    if (this.speed > 0.025) this.yaw = dampAngle(this.yaw, Math.atan2(this.x - oldX, this.z - oldZ), 13, dt);
    const support = this.world.groundAt(this.x, this.z, oldY + (this.grounded ? cfg.stepHeight : 0.012));
    if (this.grounded && !launched && this.y - support <= 0.055) { this.y = support; this.vy = 0; }
    else {
      this.grounded = false;
      this.airTime += dt;
      this.vy -= cfg.gravity * dt;
      this.y += this.vy * dt;
      if (this.vy <= 0 && this.y <= support && oldY >= support - 0.025) {
        this.y = support; this.impact = Math.min(1, Math.abs(this.vy) / cfg.jumpSpeed);
        this.vy = 0; this.grounded = true; this.landing = 0.25;
      }
    }
    this.state = this.anticipation > 0 ? 'anticipation' : !this.grounded ? (this.vy > 0 ? 'rising' : 'falling') :
      this.landing > 0.08 ? 'landing' : this.speed > 2.2 ? 'run' : this.speed > 0.12 ? 'walk' : 'idle';
  }
}
