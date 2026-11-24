import {
  BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshStandardMaterial, SRGBColorSpace,
} from 'three';

const TAU = Math.PI * 2;
const SECTORS = 160;
const RINGS = 42;
const NAPE = -.024;
const clamp = value => Math.min(1, Math.max(0, value));
const smooth = (low, high, value) => { const t = clamp((value - low) / (high - low)); return t * t * (3 - 2 * t); };
const line = [
  [-Math.PI, NAPE], [-2.69, -.020], [-2.35, -.002], [-2.10, .026], [-1.88, .067], [-1.60, .094],
  [-1.30, .087], [-1.07, .087], [-.86, .099], [-.58, .111], [-.39, .122], [-.16, .132],
  [.12, .132], [.43, .134], [.66, .126], [.91, .109], [1.10, .092], [1.34, .088],
  [1.59, .095], [1.88, .066], [2.10, .026], [2.35, -.002], [2.69, -.020], [Math.PI, NAPE],
];

// Profile of the short hair in front of and above either ear, in head-space
// metres. The rise over the top of the ear keeps the cartilage out of the tint.
const templeEdge = [
  [.004, .070], [.021, .070], [.037, .068], [.047, .062],
  [.055, .050], [.064, .045], [.074, .047], [.086, .064],
  [.100, .088], [.117, .110],
];

export const scalpCenter = y => .033 + .014 * smooth(.122, .177, y) + .017 * smooth(.155, .186, y);

export function outlineAt(stations, value) {
  const last = stations.length - 1;
  if (value <= stations[0][0]) return stations[0][1];
  if (value >= stations[last][0]) return stations[last][1];
  const index = stations.findIndex(([x]) => x > value);
  const [a, start] = stations[index - 1], [b, finish] = stations[index];
  const [beforeAt, before] = stations[Math.max(index - 2, 0)];
  const [afterAt, after] = stations[Math.min(index + 1, last)];
  const t = (value - a) / (b - a);
  const rise = index === 1 ? 0 : (finish - before) / (b - beforeAt);
  const fall = index === last ? 0 : (after - start) / (afterAt - a);
  const influence = t * (1 - t) * (b - a) * ((1 - t) * rise - t * fall);
  const border = start + (finish - start) * t * t * (3 - 2 * t) + influence;
  return Math.min(Math.max(border, Math.min(start, finish)), Math.max(start, finish));
}

const hairline = angle => outlineAt(line, Math.atan2(Math.sin(angle), Math.cos(angle)));

export function hairlineDistance({ x, y, z }) {
  return y - hairline(Math.atan2(x, z - scalpCenter(y)));
}

/** Two coverage fields, blended on the scalp surface. Preserve the original
 * fade behind the temples and use a softer edge under the fringe. */
export function scalpCoverageFields(point) {
  const { x, y, z } = point;
  const angle = Math.abs(Math.atan2(x, z - scalpCenter(y)));
  const front = 1 - smooth(.56, 1.03, angle);
  const fringe = hairlineDistance(point) + .017 * front;
  const fadeStart = -.0062 - .0018 * front;
  const fadeEnd = .0017 + .0023 * front;
  const temple = Math.min(y - outlineAt(templeEdge, z), Math.abs(x) - .053, z - .004, .117 - z);
  return [(fringe - fadeStart) / (fadeEnd - fadeStart), temple];
}

// Horizontal cuts of the actual mounted head keep the groom fitted from the
// temples through the back. Each cut supplies a sampled radial silhouette.
function measureScalp(points, index, high) {
  const levels = 64, directions = 112, low = NAPE - .003;
  const lookup = [];
  const dx = Array.from({ length: directions }, (_, i) => Math.sin(i * TAU / directions));
  const dz = Array.from({ length: directions }, (_, i) => Math.cos(i * TAU / directions));
  for (let level = 0; level < levels; level++) {
    const y = low + level / (levels - 1) * (high - low), origin = scalpCenter(y);
    const radii = Array(directions).fill(.009);
    for (let i = 0; i < index.count; i += 3) {
      const a = points[index.getX(i)], b = points[index.getX(i + 1)], c = points[index.getX(i + 2)];
      if (y < Math.min(a.y, b.y, c.y) || y >= Math.max(a.y, b.y, c.y)) continue;
      const edge = [];
      for (const [start, end] of [[a, b], [b, c], [c, a]]) {
        if ((start.y > y) === (end.y > y)) continue;
        const f = (y - start.y) / (end.y - start.y);
        edge.push([start.x + (end.x - start.x) * f, start.z + (end.z - start.z) * f - origin]);
      }
      if (edge.length !== 2) continue;
      const [x, z] = edge[0], ex = edge[1][0] - x, ez = edge[1][1] - z;
      for (let j = 0; j < directions; j++) {
        const determinant = dx[j] * ez - dz[j] * ex;
        if (Math.abs(determinant) < 1e-10) continue;
        const t = (x * dz[j] - z * dx[j]) / determinant;
        if (t < 0 || t > 1) continue;
        radii[j] = Math.max(radii[j], (x * ez - z * ex) / determinant);
      }
    }
    lookup.push(radii.map((radius, i) => (radius * 2 + radii[(i + directions - 1) % directions] + radii[(i + 1) % directions]) / 4));
  }
  return (angle, y) => {
    const highIndex = clamp((y - low) / (high - low)) * (levels - 1);
    const vertical = Math.min(levels - 2, Math.floor(highIndex)), fraction = highIndex - vertical;
    const horizontal = (((angle / TAU) % 1 + 1) % 1) * directions;
    const i = Math.floor(horizontal) % directions, j = (i + 1) % directions, along = horizontal % 1;
    const a = lookup[vertical][i] * (1 - along) + lookup[vertical][j] * along;
    const b = lookup[vertical + 1][i] * (1 - along) + lookup[vertical + 1][j] * along;
    return a + (b - a) * fraction;
  };
}

function sweep(t, angle) {
  return (.11 + .48 * smooth(-.28, .80, Math.cos(angle))) * Math.sin(2.39 * t)
    + .065 * Math.sin(angle * 3 + t * 7) * Math.sin(Math.PI * t);
}

function oliveStrand(angle, t, endY, scalp) {
  const side = Math.sin(angle), forward = Math.cos(angle);
  const front = smooth(.03, .96, forward);
  const flow = angle - sweep(t, angle), arch = Math.sin(Math.PI * t);
  const crest = front * Math.exp(-(((side - .21) / .64) ** 2));
  const weave = .71 * Math.cos(24 * flow + .65 * Math.sin(angle * 4 - t * 9))
    + .29 * Math.cos(43 * flow - 2.1 * t);
  const baseY = hairline(angle);
  const measuredY = baseY + (endY - baseY) * t ** 1.12;
  const edge = -.0028 + .0052 * smooth(0, .23, t);
  const waveHeight = (.00075 + .0022 * front) * arch * weave;
  const lift = (.0011 + .0044 * crest) * arch;
  const width = scalp(angle, measuredY) + edge + lift + waveHeight;
  const rise = Math.sin(Math.PI * .50 * t);
  const position = [
    side * width + .0023 * rise ** 3,
    measuredY + .0035 * rise + crest * .0023 * arch + waveHeight * .43,
    scalpCenter(measuredY) + forward * width,
  ];
  const temples = smooth(.53, .92, Math.abs(side)) * (1 - smooth(.23, .77, t));
  const strands = Math.cos(51 * flow + .6 * Math.sin(t * 13));
  const root = 1 - smooth(0, .13, t);
  const salt = temples * (.62 + .38 * Math.sin(11 * flow + .3)) ** 2;
  const value = .205 + weave * .019 + strands * .009 + salt * (.107 + strands * .023) - root * .011;
  return { position, rgb: [value + .019, value + .004, value - .008 + salt * .025] };
}

export function createHair(headPoints, headIndex) {
  return createFittedHair(headPoints, headIndex, oliveStrand, {
    name: 'OliveHair', material: 'Olive man · swept salt-and-pepper hair',
    tipOffset: [.0023, .004], tipColor: '#39322d',
  });
}

export function createFittedHair(headPoints, headIndex, strand, style) {
  const crown = headPoints.reduce((highest, point) => point.y > highest.y ? point : highest);
  const endY = crown.y - .0023;
  const scalp = measureScalp(headPoints, headIndex, endY);
  const positions = [], colors = [], indices = [], color = new Color();
  function add(angle, t) {
    const { position, rgb } = strand(angle, t, endY, scalp);
    positions.push(...position);
    color.setRGB(...rgb, SRGBColorSpace);
    colors.push(color.r, color.g, color.b);
  }
  for (let row = 0; row < RINGS; row++) {
    const t = row / (RINGS - 1);
    for (let column = 0; column < SECTORS; column++) add(column * TAU / SECTORS, t);
  }
  for (let row = 0; row < RINGS - 1; row++) {
    for (let column = 0; column < SECTORS; column++) {
      const a = row * SECTORS + column, b = row * SECTORS + (column + 1) % SECTORS;
      indices.push(a, b, a + SECTORS, b, b + SECTORS, a + SECTORS);
    }
  }
  const tip = positions.length / 3;
  positions.push(crown.x + style.tipOffset[0], crown.y + style.tipOffset[1], crown.z);
  color.set(style.tipColor);
  colors.push(color.r, color.g, color.b);
  const top = (RINGS - 1) * SECTORS;
  for (let column = 0; column < SECTORS; column++) {
    indices.push(top + column, top + (column + 1) % SECTORS, tip);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: .76 });
  material.name = style.material;
  const mesh = new Mesh(geometry, material);
  mesh.name = style.name;
  mesh.castShadow = true;
  return mesh;
}
