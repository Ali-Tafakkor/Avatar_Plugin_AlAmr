import { mountHybridAppearance } from '../avatar-lab/src/hybrid-appearance.mjs';
import { createHair, hairlineDistance, scalpCoverageFields } from './hair.mjs';
import { stabilizeHandContact } from './hand-contact.mjs';
import { makeClothingDetails, tailorBody } from './tailoring.mjs';

const clamp = x => Math.min(1, Math.max(0, x));
const smooth = (low, high, x) => { const t = clamp((x - low) / (high - low)); return t * t * (3 - 2 * t); };
const bell = (value, center, width) => Math.exp(-(((value - center) / width) ** 2));

function portraitShape(p, out) {
  const { x, y, z } = p, side = Math.abs(x);
  const lowerFace = smooth(-.073, -.049, y) * smooth(.041, .107, z);
  const cheek = bell(y, .011, .025) * bell(side, .059, .025) * lowerFace;
  const jaw = bell(y, -.039, .024) * smooth(.013, .046, side) * lowerFace;
  const chin = bell(y, -.053, .019) * bell(x, 0, .043) * lowerFace;
  const nose = bell(y, .024, .022) * bell(x, 0, .018) * smooth(.116, .152, z);
  const brow = bell(y, .074, .012) * bell(side, .035, .024) * smooth(.091, .131, z);
  const crown = y > .134 ? smooth(.134, .184, y) * smooth(.006, .048, hairlineDistance(p)) : 0;
  return out.set(x * (1 + .105 * jaw + .055 * cheek + .048 * chin - .047 * crown) + x * nose * .13,
    y + chin * .004 - nose * .002 - crown * .011,
    z + cheek * .0046 + jaw * .0022 + chin * .003 + nose * .003 + brow * .0027 - (z - .046) * .05 * crown);
}

export function applyOliveAppearance(runtime, clothingAlbedo) {
  return mountHybridAppearance(runtime, clothingAlbedo, {
    shape: portraitShape, createHair, scalpCoverage: scalpCoverageFields, scalpTint: '#332d2a',
    tailorBody, makeClothingDetails, stabilizeHandContact,
    clothingName: 'Olive man · woven shirt, trousers and sneakers',
  });
}
