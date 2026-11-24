import {
  BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Matrix3, Matrix4, MeshStandardMaterial,
  SkinnedMesh, Uint16BufferAttribute, Vector3,
} from 'three';

const clamp = x => Math.min(1, Math.max(0, x));
const smooth = (low, high, x) => { const t = clamp((x - low) / (high - low)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// These cuts are in the verified Hybrid 0.1.3 body's bind coordinates.
export function tailorBody(body) {
  const cut = (x, y, z, result) => {
    const leg = smooth(-.00897, -.00845, y) * (1 - smooth(-.00265, -.00113, y));
    const center = Math.sign(x) * lerp(.00145, .00165, smooth(.0025, .0084, -y));
    const chest = smooth(.0008, .0021, y) * (1 - smooth(.00537, .00626, y)) * (1 - smooth(.0015, .00209, Math.abs(x)));
    const hem = smooth(.00015, .00055, y) * (1 - smooth(.00082, .00163, y)) * (1 - smooth(.00025, .00187, Math.abs(x)));
    const hemRoll = smooth(.00043, .00087, y) * (1 - smooth(.00097, .00167, y)) * (1 - smooth(.00158, .00198, Math.abs(x)));
    return result.set(x - (x - center) * .13 * leg - x * .032 * chest,
      y - hem * .00019, z * (1 - .055 * hemRoll) - Math.min(.000085, Math.max(0, z) * .16) * chest);
  };
  warpGarment(body, cut);
}

export function warpGarment(body, cut) {
  const geometry = body.geometry;
  const positions = geometry.attributes.position, normals = geometry.attributes.normal;
  const from = new Vector3(), to = new Vector3(), normal = new Vector3(), dx = new Vector3(), dy = new Vector3(), dz = new Vector3();
  const jacobian = new Matrix3(), epsilon = .0000001;
  for (let i = 0; i < positions.count; i++) {
    from.fromBufferAttribute(positions, i);
    const { x, y, z } = from;
    cut(x, y, z, to);
    if (from.distanceToSquared(to) < 1e-19) continue;
    cut(x + epsilon, y, z, dx).sub(to);
    cut(x, y + epsilon, z, dy).sub(to);
    cut(x, y, z + epsilon, dz).sub(to);
    jacobian.set(dx.x, dy.x, dz.x, dx.y, dy.y, dz.y, dx.z, dy.z, dz.z).multiplyScalar(1 / epsilon).invert().transpose();
    normal.fromBufferAttribute(normals, i).applyMatrix3(jacobian).normalize();
    positions.setXYZ(i, to.x, to.y, to.z);
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  positions.needsUpdate = normals.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

function shoeProjector(geometry) {
  const position = geometry.attributes.position;
  const index = geometry.index, triangles = [];
  for (let offset = 0; offset < index.count; offset += 3) {
    const ids = [index.getX(offset), index.getX(offset + 1), index.getX(offset + 2)];
    const values = ids.map(i => [position.getX(i), position.getY(i), position.getZ(i)]);
    if (values.some(v => v[1] > -.00834)) continue;
    const [a, b, c] = values;
    const ux = b[0] - a[0], uz = b[2] - a[2];
    const vx = c[0] - a[0], vz = c[2] - a[2];
    const determinant = ux * vz - uz * vx;
    if (Math.abs(determinant) < 1e-14) continue;
    triangles.push({ ids, a, b, c, ux, uz, vx, vz, determinant });
  }
  return (x, z) => {
    let best = null, bestDepth = -Infinity;
    for (const { ids, a, b, c, ux, uz, vx, vz, determinant } of triangles) {
      const dx = x - a[0], dz = z - a[2];
      const q = (dx * vz - dz * vx) / determinant, r = (ux * dz - uz * dx) / determinant;
      if (q < -1e-5 || r < -1e-5 || q + r > 1.00001) continue;
      const p = 1 - q - r;
      const depth = a[1] * p + b[1] * q + c[1] * r;
      if (depth <= bestDepth) continue;
      bestDepth = depth;
      best = { depth, ids, weights: [p, q, r] };
    }
    return best;
  };
}

export function makeClothingDetails(body, {
  name = 'OliveClothingDetails', drawCollar = drawOliveNeckband,
  laces = ['#d2c9bd', '#9a8e81'], crossedLaces = false,
} = {}) {
  const source = body.geometry, position = source.attributes.position;
  if (position.count !== 28961) throw new Error('olive_shirt_incompatible_body');
  const skinIndex = source.attributes.skinIndex, skinWeight = source.attributes.skinWeight;
  const positions = [], colors = [], indices = [], joints = [], weights = [];
  const shoe = shoeProjector(source);
  const [lace, laceShadow] = laces.map(hex => new Color(hex));
  const spine = body.skeleton.bones.findIndex(bone => /Spine2$/.test(bone.name));
  const neck = body.skeleton.bones.findIndex(bone => /Neck$/.test(bone.name));
  const neckShare = .28;
  if (spine < 0 || neck < 0) throw new Error('olive_shirt_missing_neck_anchor');

  function add(x, y, z, color, surface) {
    positions.push(x, y, z);
    colors.push(color.r, color.g, color.b);
    const influences = new Map();
    if (surface) {
      surface.ids.forEach((vertex, i) => {
        for (let j = 0; j < 4; j++) {
          const joint = skinIndex.getComponent(vertex, j);
          const weight = skinWeight.getComponent(vertex, j) * surface.weights[i];
          if (weight > 0) influences.set(joint, (influences.get(joint) ?? 0) + weight);
        }
      });
    } else {
      influences.set(spine, 1 - neckShare);
      influences.set(neck, neckShare);
    }
    const selected = [...influences].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const total = selected.reduce((sum, pair) => sum + pair[1], 0);
    for (let i = 0; i < 4; i++) {
      joints.push(selected[i]?.[0] ?? 0);
      weights.push((selected[i]?.[1] ?? 0) / total);
    }
  }

  function panel(rows, columns, vertex) {
    const offset = positions.length / 3;
    for (let row = 0; row <= rows; row++) {
      for (let column = 0; column <= columns; column++) vertex(column / columns, row / rows);
    }
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const a = offset + row * (columns + 1) + column, b = a + columns + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }

  // Fit the neckband in metres around the mounted native neck in the neutral
  // Stand pose. Convert it to bind geometry with the same torso/neck weights
  // it will use during animation.
  const neckPosition = body.skeleton.bones[neck].getWorldPosition(new Vector3());
  const collarCenter = neckPosition.clone().add(new Vector3(-.003, 0, .017));
  const blend = new Matrix4();
  blend.elements.fill(0);
  for (const [bone, weight] of [[spine, 1 - neckShare], [neck, neckShare]]) {
    const skin = new Matrix4().multiplyMatrices(body.skeleton.bones[bone].matrixWorld, body.skeleton.boneInverses[bone]);
    for (let i = 0; i < 16; i++) blend.elements[i] += skin.elements[i] * weight;
  }
  const collarToBind = body.matrixWorld.clone().multiply(body.bindMatrixInverse).multiply(blend).multiply(body.bindMatrix).invert();
  const collarVertex = (point, tint) => {
    point.add(collarCenter).applyMatrix4(collarToBind);
    add(point.x, point.y, point.z, tint, null);
  };
  const bandPoint = (angle, t) => {
    const front = Math.cos(angle);
    const frontRadius = lerp(.060, .069, t), rearRadius = lerp(.067, .056, t);
    return new Vector3(Math.sin(angle) * lerp(.072, .059, t),
      lerp(.013, .039, t) - .020 * front,
      front * (front >= 0 ? frontRadius : rearRadius));
  };
  drawCollar?.({ panel, collarVertex, bandPoint });

  // Real raised cotton laces, projected to each sneaker separately.
  for (const side of [-1, 1]) {
    for (let row = 0; row < 5; row++) {
      const diagonal = crossedLaces && row % 2 === 0 ? -1 : 1;
      const length = row * .000092;
      const z = .00076 + length, center = side * (.00147 + length * .21);
      const span = .00040 + row * .000016;
      panel(3, 14, (u, v) => {
        const x = center + (u - .5) * span;
        const along = z + (u - .5) * .000064 * diagonal + (v - .5) * .000036;
        const sample = shoe(x, along);
        if (!sample) throw new Error('olive_lace_outside_shoe');
        add(x, sample.depth + .000024 + .000017 * Math.sin(Math.PI * v), along, v < .22 ? laceShadow : lace, sample);
      });
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(joints, 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material = new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .90, side: DoubleSide });
  material.name = name;
  const details = new SkinnedMesh(geometry, material);
  details.name = name;
  details.position.copy(body.position);
  details.quaternion.copy(body.quaternion);
  details.scale.copy(body.scale);
  details.bindMode = body.bindMode;
  details.bind(body.skeleton, body.bindMatrix);
  details.castShadow = true;
  details.receiveShadow = true;
  details.frustumCulled = false;
  return details;
}

function drawOliveNeckband({ panel, collarVertex, bandPoint }) {
  const fold = new Color('#4b4737'), seam = new Color('#454132');
  panel(12, 80, (u, v) => {
    const angle = u * Math.PI * 2;
    const top = bandPoint(angle, Math.min(v * 1.12, 1));
    const inward = smooth(.89, 1, v);
    top.x -= Math.sin(angle) * .0022 * inward;
    top.z -= Math.cos(angle) * .0022 * inward;
    top.y -= .0038 * inward;
    collarVertex(top, v > .87 ? seam : fold);
  });
}
