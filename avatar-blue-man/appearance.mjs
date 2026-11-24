import { mountHybridAppearance } from '../avatar-lab/src/hybrid-appearance.mjs';
import { stabilizeHandContact } from '../avatar-olive-man/hand-contact.mjs';
import { createHair, scalpCoverageFields, shadeRoots } from './hair.mjs';
import { makeDetails, tailorBody } from './tailoring.mjs';

const bell = (value, center, width) => Math.exp(-(((value - center) / width) ** 2));

function shapePortrait({ x, y, z }, result) {
  const side = Math.abs(x);
  const face = bell(z, .102, .064);
  const jaw = bell(y, -.033, .031) * bell(side, .055, .035) * face;
  const chin = bell(y, -.049, .022) * bell(x, 0, .036) * face;
  const cheek = bell(y, .010, .020) * bell(side, .060, .023) * face;
  const bridge = bell(y, .038, .025) * bell(x, 0, .014) * bell(z, .136, .029);
  const nose = bell(y, .016, .017) * bell(x, 0, .023) * bell(z, .152, .018);
  const brow = bell(y, .067, .010) * bell(side, .036, .023) * face;
  return result.set(
    x * (1 + .072 * jaw + .043 * cheek - .062 * nose),
    y - .006 * chin - .002 * brow,
    z + .0035 * cheek + .0035 * chin + .0025 * bridge - .003 * nose + .0022 * brow,
  );
}

export function applyBlueAppearance(runtime, clothingAlbedo) {
  return mountHybridAppearance(runtime, clothingAlbedo, {
    shape: shapePortrait, createHair, scalpCoverage: scalpCoverageFields, scalpTint: '#494447', shadeRoots,
    tailorBody, makeClothingDetails: makeDetails, stabilizeHandContact,
    clothingName: 'Blue man · cotton shirt, khakis and leather shoes',
  });
}
