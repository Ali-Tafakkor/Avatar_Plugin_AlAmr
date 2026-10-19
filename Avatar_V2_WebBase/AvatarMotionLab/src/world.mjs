import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CollisionWorld } from './physics.mjs';
import { seededRandom } from './math.mjs';

function concreteTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const ctx = c.getContext('2d'), rng = seededRandom(323);
  const image = ctx.createImageData(512, 512);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 192 + Math.floor(rng() * 18); image.data[i] = v; image.data[i + 1] = v; image.data[i + 2] = v - 2; image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  ctx.strokeStyle = 'rgba(80,90,85,.08)'; ctx.lineWidth = 1;
  for (let i = 0; i < 160; i++) { const x = rng() * 512, y = rng() * 512; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rng() * 6, y + rng() * 2); ctx.stroke(); }
  const texture = new THREE.CanvasTexture(c); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(28, 28); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function labelTexture(text, sub = '') {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#c4d1c9'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#283a35'; ctx.font = '500 68px sans-serif'; ctx.fillText(text, 52, 116);
  ctx.fillStyle = '#576e65'; ctx.font = '23px monospace'; ctx.fillText(sub, 56, 173);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
export function createWorld(renderer, scene) {
  scene.background = new THREE.Color('#d6ded8'); scene.fog = new THREE.Fog('#d6ded8', 21, 64);
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.055); scene.environment = env.texture; scene.environmentIntensity = 0.52;
  room.dispose(); pmrem.dispose();
  const hemi = new THREE.HemisphereLight('#f4f7f4', '#687267', 1.25); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3e1', 3.1); sun.position.set(4, 8, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 0.1; sun.shadow.camera.far = 30;
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7 });
  sun.shadow.normalBias = 0.016; sun.shadow.bias = -0.000025; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#ddeafa', 0.85); fill.position.set(-4, 4, 1); scene.add(fill);
  const rim = new THREE.DirectionalLight('#fcfbef', 1.3); rim.position.set(0, 4, -5); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ color: '#e8e8de', map: concreteTexture(), roughness: 0.95, metalness: 0.01 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const slab = new THREE.MeshStandardMaterial({ color: '#bfc8bf', roughness: 0.83 });
  const dark = new THREE.MeshStandardMaterial({ color: '#253c35', roughness: 0.73 });
  const trim = new THREE.MeshStandardMaterial({ color: '#839890', metalness: 0.32, roughness: 0.5 });
  const boxes = [], occluders = [];
  function box(x, z, w, d, h, material = slab, solid = true, y = h / 2) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); occluders.push(mesh);
    if (solid) boxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, bottom: y - h / 2, top: y + h / 2 });
    return mesh;
  }
  // Architectural backdrop, not a complex game level: open space keeps attention on the actor.
  box(0, -12, 25, 0.45, 3.7); box(-12.5, -5.5, 0.45, 13.5, 3.7); box(12.5, -8.5, 0.45, 7, 3.7);
  for (let i = 0; i < 19; i++) box(-9.6 + i * 0.25, -11.72, 0.09, 0.08, 2.4, dark, false, 1.65);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4), new THREE.MeshStandardMaterial({ map: labelTexture('MOTION  /  EXPRESSION', 'HUMAN PERFORMANCE LABORATORY     —     STAGE 01'), roughness: 1 }));
  sign.position.set(4.2, 2.0, -11.76); scene.add(sign);
  // Three test platforms; the second and third require a jump, not an invisible ramp.
  box(4.6, -3.7, 1.8, 2.0, 0.16);
  box(6.5, -3.7, 1.8, 2.0, 0.38);
  box(8.4, -3.7, 1.8, 2.0, 0.64);
  box(-4.7, -3.8, 3.0, 0.7, 0.44, dark);
  box(-4.7, -4.07, 3.0, 0.12, 0.38, dark, true, 0.72);
  // Restrained floor markings convey scale and expose foot sliding.
  const line = new THREE.MeshBasicMaterial({ color: '#758b81', transparent: true, opacity: 0.34, depthWrite: false });
  for (let i = -16; i <= 16; i += 2) {
    const a = new THREE.Mesh(new THREE.PlaneGeometry(34, 0.009), line); a.rotation.x = -Math.PI / 2; a.position.set(0, 0.002, i); scene.add(a);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.009, 34), line); b.rotation.x = -Math.PI / 2; b.position.set(i, 0.002, 0); scene.add(b);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.22, 1.233, 128), new THREE.MeshBasicMaterial({ color: '#547e6c', transparent: true, opacity: 0.6, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.007; scene.add(ring);
  const rng = seededRandom(645), leafMaterial = new THREE.MeshStandardMaterial({ color: '#526957', roughness: 0.9, side: THREE.DoubleSide });
  for (const [x, z] of [[-9, -7], [9.4, -8.4], [-8, 5.5]]) {
    box(x, z, 1.65, 0.9, 0.45, trim);
    const soil = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.025, 0.76), new THREE.MeshStandardMaterial({ color: '#45493b', roughness: 1 })); soil.position.set(x, 0.46, z); scene.add(soil);
    const leaves = new THREE.InstancedMesh(new THREE.ConeGeometry(0.026, 0.7, 3), leafMaterial, 90), dummy = new THREE.Object3D();
    for (let i = 0; i < 90; i++) {
      const h = 0.55 + rng() * 0.65;
      dummy.position.set(x + (rng() - 0.5) * 1.35, 0.45 + h * 0.34, z + (rng() - 0.5) * 0.63);
      dummy.scale.set(1, h, 1); dummy.rotation.set((rng() - 0.5) * 0.7, rng() * Math.PI * 2, (rng() - 0.5) * 0.6); dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix);
    }
    leaves.castShadow = true; scene.add(leaves);
  }
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext('2d'), grad = ctx.createRadialGradient(64, 64, 3, 64, 64, 64);
  grad.addColorStop(0, 'rgba(17,29,23,.40)'); grad.addColorStop(0.42, 'rgba(17,29,23,.20)'); grad.addColorStop(1, 'rgba(17,29,23,0)'); ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.85), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
  contactShadow.rotation.x = -Math.PI / 2; scene.add(contactShadow);
  const collision = new CollisionWorld(boxes);
  return { collision, occluders, sun, hemi, fill, rim, contactShadow,
    update(physics) {
      sun.position.set(physics.x + 4, 8 + physics.y, physics.z + 5); sun.target.position.set(physics.x, physics.y + 0.8, physics.z);
      const ground = collision.groundAt(physics.x, physics.z, physics.y + 0.05), height = physics.y - ground;
      contactShadow.position.set(physics.x, ground + 0.01, physics.z); contactShadow.material.opacity = Math.max(0.10, 0.8 - height * 0.6);
      contactShadow.scale.setScalar(1 + height * 0.35);
    },
    lighting(mode) {
      if (mode === 'warm') { sun.color.set('#ffdfb4'); sun.intensity = 3.0; hemi.intensity = 0.95; fill.color.set('#dceaff'); scene.background.set('#d9d1bd'); scene.fog.color.copy(scene.background); renderer.toneMappingExposure = 0.94; }
      else if (mode === 'studio') { sun.color.set('#fff6ef'); sun.intensity = 2.4; hemi.intensity = 1.15; fill.color.set('#e2edff'); scene.background.set('#b6c2bd'); scene.fog.color.copy(scene.background); renderer.toneMappingExposure = 0.98; }
      else { sun.color.set('#fff3e1'); sun.intensity = 3.1; hemi.intensity = 1.25; fill.color.set('#ddeafa'); scene.background.set('#d6ded8'); scene.fog.color.copy(scene.background); renderer.toneMappingExposure = 0.96; }
    }
  };
}
