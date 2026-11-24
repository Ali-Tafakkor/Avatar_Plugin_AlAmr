import { createFittedHair, outlineAt, scalpCenter } from '../avatar-olive-man/hair.mjs';
import { sin } from 'three/tsl';

const clamp = x => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const line = [
  [-Math.PI, -.014], [-2.58, -.010], [-2.20, .010], [-1.90, .059],
  [-1.63, .086], [-1.36, .075], [-1.08, .082], [-.84, .099], [-.56, .123],
  [-.30, .137], [-.04, .145], [.22, .147], [.45, .143], [.65, .123],
  [.85, .097], [1.08, .077], [1.35, .075], [1.61, .090], [1.90, .062],
  [2.20, .011], [2.62, -.010], [Math.PI, -.014],
];
const temple = [[.005, .070], [.032, .066], [.046, .048], [.057, .034], [.065, .040],
  [.076, .073], [.094, .105], [.115, .129]];
// Lower edge of the painted roots under the front sweep, fitted in head space
// to the annotated forehead. The swept outer mesh keeps its own hairline.
const frontRoots = [
  [-.75, .106], [-.55, .108], [-.32, .114], [-.15, .116],
  [.23, .117], [.37, .116], [.48, .112], [.58, .107], [.73, .099],
];
const hairline = angle => outlineAt(line, Math.atan2(Math.sin(angle), Math.cos(angle)));

export function scalpCoverageFields({ x, y, z }) {
  const angle = Math.atan2(x, z - scalpCenter(y));
  const existingEdge = hairline(angle) - .004 * smooth(.25, .92, Math.cos(angle));
  const front = 1 - smooth(.70, .93, Math.abs(angle));
  const extension = Math.max(0, existingEdge - outlineAt(frontRoots, angle))
    * front;
  const fringe = y - existingEdge + extension;
  const templeDistance = Math.min(y - outlineAt(temple, z), Math.abs(x) - .056, z - .005, .115 - z);
  const rise = y - .12;
  const flow = x + .32 * rise + .009 * Math.sin(angle * 2.6 + 21 * rise);
  const rootDetail = smooth(.001, .014, extension) * smooth(-.003, .006, fringe);
  return [(fringe + .0045) / .0085, templeDistance, flow, rootDetail];
}

export function shadeRoots(roots, tint) {
  // Pick up the sweep of the adjacent locks within the painted fringe.
  const phase = roots.x.mul(790).add(sin(roots.x.mul(183)).mul(1.25));
  const variation = sin(phase).mul(.10).add(sin(phase.mul(2.71).add(.85)).mul(.085));
  return tint.mul(variation.add(.045).mul(roots.y).add(1));
}

function strand(angle, t, endY, scalp) {
  const side = Math.sin(angle), forward = Math.cos(angle);
  const face = smooth(-.35, .95, forward);
  const arch = Math.sin(Math.PI * t);
  const part = Math.exp(-(((side - .49) / .16) ** 2)) * face;
  const crest = Math.exp(-(((side + .37) / .57) ** 2)) * face;
  const flow = angle + (.19 + .46 * face) * Math.sin(2.15 * t) + .035 * Math.sin(6 * t + angle * 4);
  const lock = .68 * Math.sin(25 * flow) + .32 * Math.sin(39 * flow + .8);
  const fine = .60 * Math.cos(58 * flow - t * 3) + .40 * Math.cos(73 * flow + angle);
  const baseY = hairline(angle);
  const y = baseY + (endY - baseY) * t ** 1.08;
  const edge = -.0026 + .0055 * smooth(0, .20, t);
  const fullness = (.0012 + .0056 * crest - .0029 * part) * arch;
  const ripple = (.00055 + .00078 * face) * arch * lock;
  const radius = scalp(angle, y) + edge + fullness + ripple;
  const rise = Math.sin(Math.PI * .5 * t);
  const position = [
    side * radius - .004 * rise ** 3,
    y + .0035 * rise + (.004 * crest - .0015 * part) * arch + .27 * ripple,
    scalpCenter(y) + forward * radius,
  ];
  const silver = smooth(.43, .94, Math.abs(side)) * (1 - .64 * smooth(.25, .84, t));
  const gray = .278 + .018 * lock + .043 * fine + (.082 + .045 * fine) * silver;
  const value = gray - .027 * (1 - smooth(0, .115, t));
  return { position, rgb: [value + .014, value + .008, value + .011] };
}

export function createHair(headPoints, headIndex) {
  return createFittedHair(headPoints, headIndex, strand, {
    name: 'BlueHair', material: 'Blue man · side-swept salt-and-pepper hair',
    tipOffset: [-.004, .004], tipColor: '#494447',
  });
}
