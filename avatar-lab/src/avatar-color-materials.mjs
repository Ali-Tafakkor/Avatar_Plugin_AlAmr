import { Color, Float32BufferAttribute, Quaternion, Vector3 } from 'three';
import { attribute, float, materialColor, mix, positionGeometry, smoothstep, sRGBTransferOETF, texture, uniform, uv, vec2, vec3 } from 'three/tsl';

const luma = vec3(.2126, .7152, .0722);
const garmentSlots = ['shirt', 'trousers', 'shoes'];
const midtones = {
  purple: [.32, .018, .47, .043],
  olive: [.065, .022, .48, .052],
  blue: [.20, .27, .13, .062],
  elder: [.24, .045, .16, .28],
};

export function getGarmentBody(runtime) {
  return runtime.body.meshes.find(mesh => mesh.name === 'Meshy_AI_Lilac_Sweatshirt_Port_0809081014_texture');
}

function dye(base, color, originalMidtone) {
  // Remap lightness around the original material's midtone, so e.g. white
  // textiles can become black and dark trousers can become bright yellow.
  return color.mul(base.dot(luma).div(originalMidtone).max(0).pow(.42).clamp(.10, 1.45));
}

function garmentRegions(atlas) {
  // The original Purple atlas is also the registration atlas for the three
  // tailored versions. Use its colour/position masks even over their albedos.
  const { x, y } = positionGeometry;
  const source = sRGBTransferOETF(texture(atlas).rgb).mul(255);
  const shade = source.dot(luma);
  const violet = smoothstep(5, 20, source.r.sub(source.g))
    .mul(smoothstep(8, 31, source.b.sub(source.g)))
    .mul(smoothstep(-2, 15, source.b.sub(source.r)));
  const collar = smoothstep(5, 10, source.b.sub(source.g))
    .mul(smoothstep(.77, .89, source.b.div(source.r.max(1))))
    .mul(smoothstep(.0048, .0056, y));
  const shirt = violet.max(collar).mul(smoothstep(-.0011, -.0004, y));
  const shoes = float(1).sub(smoothstep(-.00837, -.00800, y))
    .mul(smoothstep(30, 95, shade).max(float(1).sub(smoothstep(-.00915, -.00889, y))));
  const trousers = smoothstep(-.00917, -.00853, y)
    .mul(float(1).sub(smoothstep(.00072, .00118, y)))
    .mul(float(1).sub(smoothstep(40, 115, shade)))
    .mul(float(1).sub(smoothstep(.0029, .0033, x.abs())))
    .mul(shirt.oneMinus()).mul(shoes.oneMinus());
  return [shirt, trousers, shoes];
}

function installNodeColors(material, colorNode) {
  const original = material.colorNode;
  material.colorNode = colorNode(original ?? materialColor.rgb);
  material.needsUpdate = true;
  return () => {
    material.colorNode = original;
    material.needsUpdate = true;
  };
}

function hairCoverage(head, character) {
  if (head.geometry.hasAttribute('portraitScalpCoverage')) {
    const field = attribute('portraitScalpCoverage', character === 'blue' ? 'vec4' : 'vec2');
    return smoothstep(0, 1, field.x).max(smoothstep(-.004, .005, field.y));
  }
  const field = 'avatarColorScalpPoint';
  const bone = head.skeleton.bones.find(item => item.name === 'Head');
  const origin = bone.getWorldPosition(new Vector3());
  const inverse = bone.getWorldQuaternion(new Quaternion()).invert();
  const point = new Vector3();
  const positions = new Float32Array(head.geometry.attributes.position.count * 3);
  for (let i = 0; i < positions.length / 3; i++) {
    head.getVertexPosition(i, point).applyMatrix4(head.matrixWorld).sub(origin).applyQuaternion(inverse);
    point.toArray(positions, i * 3);
  }
  head.geometry.setAttribute(field, new Float32BufferAttribute(positions, 3));
  const { x, y, z } = attribute(field, 'vec3');
  const atlas = texture(head.material.map, character === 'elder' ? vec2(uv().x, uv().y.sub(.038)) : uv()).rgb;
  if (character === 'elder') {
    // The bald crown, beard and glasses remain outside the scalp strip.
    const rear = smoothstep(-.012, .026, z).oneMinus();
    const aroundEar = smoothstep(.050, .075, x.abs()).max(rear);
    const belowHairline = smoothstep(0, 1, attribute('elderBald', 'float')).oneMinus();
    const srgb = sRGBTransferOETF(atlas);
    const gray = smoothstep(.102, .173, srgb.r.sub(srgb.b)).oneMinus();
    const aboveNeck = mix(smoothstep(.026, .061, y), smoothstep(-.008, .028, y), rear);
    return aroundEar.mul(aboveNeck).mul(belowHairline).mul(gray);
  }
  const regions = attribute('avatarFaceStyle', 'vec3');
  const aboveBrow = smoothstep(.084, .115, y)
    .max(smoothstep(.060, .083, x.abs()).mul(smoothstep(.052, .075, y)).mul(smoothstep(.057, .082, z).oneMinus()));
  const darkHair = float(1).sub(smoothstep(.11, .31, atlas.dot(luma)));
  return regions.y.max(regions.x.mul(aboveBrow).mul(darkHair));
}

function vertexDye(mesh, slots, slotForVertex, reference) {
  const color = mesh.geometry.attributes.color;
  const original = color.array.slice();
  let previous = {};
  return palette => {
    if (slots.every(slot => previous[slot] === palette[slot])) return;
    previous = palette;
    const targets = Object.fromEntries(slots.map(slot => [slot, palette[slot] ? new Color(palette[slot]) : null]));
    for (let i = 0; i < color.count; i++) {
      const slot = slotForVertex(i), offset = i * 3;
      const r = original[offset], g = original[offset + 1], b = original[offset + 2];
      const target = targets[slot];
      if (target) {
        const brightness = (r * .2126 + g * .7152 + b * .0722) / reference[slot];
        const light = Math.min(1.45, Math.max(.1, Math.pow(brightness, .42)));
        color.setXYZ(i, target.r * light, target.g * light, target.b * light);
      } else color.setXYZ(i, r, g, b);
    }
    color.needsUpdate = true;
  };
}

export function mountAvatarColors(runtime, atlas, character) {
  const body = getGarmentBody(runtime);
  const head = runtime.face.bindings.find(({ node }) => node.name === 'AvatarHead').node;
  const original = midtones[character];
  const tints = [...garmentSlots, 'hair'].map(() => ({ value: uniform(new Color()), amount: uniform(0) }));
  const vertexUpdates = [];
  runtime.root.traverse(mesh => {
    if (mesh.userData.avatarInspectionHair) vertexUpdates.push(vertexDye(mesh, ['hair'], () => 'hair', { hair: original[3] }));
    if (mesh.isSkinnedMesh && mesh.name.endsWith('ClothingDetails')) {
      const position = mesh.geometry.attributes.position;
      vertexUpdates.push(vertexDye(mesh, ['shirt', 'shoes'], i => position.getY(i) < -.007 ? 'shoes' : 'shirt',
        { shirt: original[0], shoes: original[2] }));
    }
  });
  runtime.root.updateWorldMatrix(true, true);
  const scalpCoverage = hairCoverage(head, character);
  let restoreGarment, restoreHair;
  return {
    set(palette) {
      for (const [i, slot] of [...garmentSlots, 'hair'].entries()) {
        const tint = tints[i];
        tint.amount.value = palette[slot] ? 1 : 0;
        if (palette[slot]) tint.value.value.set(palette[slot]);
      }
      if (garmentSlots.some(slot => palette[slot])) {
        restoreGarment ??= installNodeColors(body.material, base => garmentRegions(atlas).reduce((result, mask, i) =>
          mix(result, dye(base, tints[i].value, original[i]), mask.mul(tints[i].amount)), base));
      } else { restoreGarment?.(); restoreGarment = undefined; }
      if (palette.hair) {
        restoreHair ??= installNodeColors(head.material, base => mix(base, dye(base, tints[3].value, original[3]), scalpCoverage));
      } else { restoreHair?.(); restoreHair = undefined; }
      for (const update of vertexUpdates) update(palette);
    },
    dispose() {
      restoreGarment?.();
      restoreHair?.();
      for (const update of vertexUpdates) update({});
      head.geometry.deleteAttribute('avatarColorScalpPoint');
    },
  };
}
