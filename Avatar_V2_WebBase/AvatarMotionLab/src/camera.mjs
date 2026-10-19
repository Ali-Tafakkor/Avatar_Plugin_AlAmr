import * as THREE from 'three';
import { clamp, damp, dampAngle } from './math.mjs';

export class CharacterCamera {
  constructor(camera, occluders) {
    this.camera = camera; this.occluders = occluders; this.mode = 'portrait';
    this.yaw = 0; this.pitch = 0.13; this.radius = 0.74; this.portraitYaw = 0.07; this.portraitPitch = 0.02;
    this.followRadius = 3.7; this.orbitRadius = 3.2; this.portraitRadius = 0.74;
    this.lastManual = 0; this.target = new THREE.Vector3(0, 1.6, 0); this.desired = new THREE.Vector3();
    this.ray = new THREE.Raycaster(); this.initialized = false;
  }
  setMode(mode, physics) {
    this.mode = mode;
    if (mode === 'follow') { this.yaw = physics.yaw + Math.PI; this.pitch = 0.28; }
    if (mode === 'orbit') { this.yaw = physics.yaw + 0.5; this.pitch = 0.15; }
    if (mode === 'portrait') { this.portraitYaw = 0.07; this.portraitPitch = 0.02; }
  }
  orbit(dx, dy) {
    this.lastManual = performance.now();
    if (this.mode === 'portrait') { this.portraitYaw -= dx * 0.006; this.portraitPitch = clamp(this.portraitPitch + dy * 0.004, -0.22, 0.40); }
    else { this.yaw -= dx * 0.006; this.pitch = clamp(this.pitch + dy * 0.004, -0.08, 1.0); }
  }
  zoom(delta) {
    const factor = Math.exp(delta * 0.001);
    if (this.mode === 'portrait') this.portraitRadius = clamp(this.portraitRadius * factor, 0.42, 1.8);
    else if (this.mode === 'orbit') this.orbitRadius = clamp(this.orbitRadius * factor, 1.3, 8.0);
    else this.followRadius = clamp(this.followRadius * factor, 1.3, 7.5);
  }
  avoidObstacles(position, target) {
    const delta = new THREE.Vector3().subVectors(position, target), d = delta.length();
    if (d < 0.001) return position;
    this.ray.set(target, delta.multiplyScalar(1 / d)); this.ray.near = 0; this.ray.far = d;
    const hit = this.ray.intersectObjects(this.occluders, false)[0];
    if (hit) position.copy(target).addScaledVector(this.ray.ray.direction, Math.max(0.25, hit.distance - 0.20));
    return position;
  }
  update(dt, physics, eyePosition, movement) {
    const portrait = this.mode === 'portrait';
    const target = portrait ? eyePosition.clone().add(new THREE.Vector3(0, -0.05, 0)) : new THREE.Vector3(physics.x, physics.y + 1.04, physics.z);
    if (this.mode === 'follow' && physics.speed > 0.3 && movement.z > 0 && !movement.x && performance.now() - this.lastManual > 1700) {
      this.yaw = dampAngle(this.yaw, physics.yaw + Math.PI, 1.7, dt);
    }
    const yaw = portrait ? physics.yaw + this.portraitYaw : this.yaw;
    const pitch = portrait ? this.portraitPitch : this.pitch;
    const distance = portrait ? this.portraitRadius : this.mode === 'orbit' ? this.orbitRadius : this.followRadius;
    this.radius = damp(this.radius, distance, 7.5, dt);
    if (!this.initialized) this.target.copy(target);
    else this.target.lerp(target, 1 - Math.exp(-(portrait ? 10 : 8) * dt));
    this.desired.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(this.radius).add(this.target);
    this.avoidObstacles(this.desired, this.target);
    if (!this.initialized) { this.camera.position.copy(this.desired); this.initialized = true; }
    else this.camera.position.lerp(this.desired, 1 - Math.exp(-(portrait ? 8 : 10) * dt));
    this.avoidObstacles(this.camera.position, this.target);
    this.camera.lookAt(this.target);
    const fov = portrait ? 31 : this.mode === 'orbit' ? 43 : 47 + clamp((physics.speed - 1.5) * 2.4, 0, 7);
    this.camera.fov = damp(this.camera.fov, fov, 5.5, dt); this.camera.updateProjectionMatrix();
  }
}
