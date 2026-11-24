import { makeClothingDetails, warpGarment } from '../avatar-olive-man/tailoring.mjs';

const clamp = x => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Hybrid body's bind units. Keep the changes above the shoes to preserve
// the measured support sole and avoid moving the wrist and upper arm.
function shapeGarment(x, y, z, result) {
  const side = Math.abs(x);
  const leg = smooth(-.0087, -.0082, y) * (1 - smooth(-.002, -.0008, y));
  const center = Math.sign(x) * (.00145 + .00021 * smooth(.0025, .0084, -y));
  const shirt = smooth(.00068, .0017, y) * (1 - smooth(.0045, .0057, y))
    * (1 - smooth(.0019, .0024, side));
  const hem = smooth(.00018, .00065, y) * (1 - smooth(.00092, .00165, y))
    * (1 - smooth(.0016, .00215, side));
  const frontBack = smooth(.00018, .0009, Math.abs(z + .00042));
  const roll = smooth(.00043, .00087, y) * (1 - smooth(.00101, .00177, y));
  return result.set(x - (x - center) * .080 * leg - x * .027 * shirt,
    y - .00037 * hem * frontBack,
    z - (z + .00038) * (.022 * shirt + .082 * hem * roll));
}

export function tailorBody(body) {
  warpGarment(body, shapeGarment);
}

export function makeDetails(body) {
  return makeClothingDetails(body, {
    name: 'BlueClothingDetails', drawCollar: null,
    laces: ['#69544b', '#4a362e'], crossedLaces: true,
  });
}
