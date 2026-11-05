import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, UnsignedByteType } from 'three';
import { MeshPhysicalNodeMaterial, MeshSSSNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { attribute, float, mix, normalMap, positionGeometry, smoothstep, texture, uv, vec2, vec3 } from 'three/tsl';

/** Tiny numeric material data, generated once at mounting. Mip filtering removes
 * the weave at a distance. No extra large albedo, mesh, render pass or frame work. */
function createWeaveTexture() {
  const size = 128, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const warp = Math.cos(x * Math.PI / 2), weft = Math.cos(y * Math.PI / 2);
    const grain = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 101 / 100 - .5;
    const i = (y * size + x) * 4;
    // RGB packs a mild tangent-space normal; alpha carries the yarn variation.
    const nx = .28 * Math.sin(x * Math.PI / 2) + .04 * grain;
    const ny = .20 * Math.sin(y * Math.PI / 2) + .04 * grain;
    const length = Math.hypot(nx, ny, 1);
    data[i] = Math.round((.5 - .5 * nx / length) * 255);
    data[i + 1] = Math.round((.5 - .5 * ny / length) * 255);
    data[i + 2] = Math.round((.5 + .5 / length) * 255);
    data[i + 3] = Math.round(128 + 12 * warp + 8 * weft + 20 * grain);
  }
  const map = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  map.name = 'Avatar-Cloth-Weave-128'; map.wrapS = map.wrapT = RepeatWrapping;
  map.magFilter = LinearFilter; map.minFilter = LinearMipmapLinearFilter;
  map.generateMipmaps = true; map.anisotropy = 2; map.needsUpdate = true;
  return map;
}

/** Only the original authored body atlas. Roles use its purple cloth and the
 * lower-body bind coordinates; skin, face, new hands and white shoes retain
 * their materials. The actor already owns this body's material/geometry clones. */
export function applyClothMaterials(body) {
  const changes = [], materials = []; let detail = null, disposed = false;
  for (const node of body.meshes) {
    if (node.name !== 'Meshy_AI_Lilac_Sweatshirt_Port_0809081014_texture') continue;
    const source = node.material;
    if (Array.isArray(source) || !source.map || source.isMeshBasicMaterial) continue;
    detail ??= createWeaveTexture();
    node.geometry.computeBoundingBox();
    const bounds = node.geometry.boundingBox, span = bounds.max.y - bounds.min.y;
    const low = bounds.min.y + span * .075, high = bounds.min.y + span * .55, edge = span * .025;
    const sampled = texture(source.map).rgb;
    const shirt = smoothstep(.04, .13, sampled.b.sub(sampled.r))
      .mul(smoothstep(.04, .11, sampled.r.sub(sampled.g)));
    const luminance = sampled.dot(vec3(.2126, .7152, .0722));
    const legRegion = smoothstep(low - edge, low, positionGeometry.y)
      .mul(float(1).sub(smoothstep(high, high + edge, positionGeometry.y)));
    const pants = legRegion.mul(float(1).sub(smoothstep(.06, .16, luminance))).mul(float(1).sub(shirt));
    const cloth = shirt.max(pants), weave = texture(detail, uv().mul(96));
    // Mildly reduce baked colour noise; retain the original purple, dark pants,
    // wrinkles and silhouette. Fine grain contributes only at close distance.
    const shirtColor = sampled.mul(.96).add(vec3(.009, .005, .012));
    const pantsColor = sampled.mul(.78).add(vec3(.005, .006, .007));
    const base = mix(mix(sampled, shirtColor, shirt), pantsColor, pants);
    const material = new MeshStandardNodeMaterial({ map: source.map,
      color: source.color, roughness: source.roughness, metalness: source.metalness,
      side: source.side, alphaTest: source.alphaTest, transparent: source.transparent,
      opacity: source.opacity, depthWrite: source.depthWrite, depthTest: source.depthTest });
    material.name = 'Avatar-Lightweight-Cloth';
    // Retain the mounted head's exact collar cutout. Dropping this node
    // resurrects the old neck skin over the new neck and creates tan spikes.
    material.opacityNode = source.opacityNode ?? null;
    material.colorNode = base.mul(weave.a.sub(.5).mul(.045).mul(cloth).add(1))
      .mul(vec3(source.color.r, source.color.g, source.color.b));
    material.roughnessNode = mix(float(source.roughness), weave.a.sub(.5).mul(.035).add(.90), cloth);
    // Expose the actual owned map for resource inventory as well as its TSL use.
    material.normalMap = detail; material.normalScale.set(.18, .18);
    material.normalNode = normalMap(weave.rgb, vec2(.18).mul(cloth));
    node.material = material; changes.push({ node, source }); materials.push(material);
  }
  return {
    getStatus() { return { enabled: changes.length > 0, style: 'lightweight-woven-2026-11-03',
      changedMeshes: changes.map(({node}) => node.name), textureSize: detail ? [128,128] : null,
      textureBytes: detail?.image.data.byteLength ?? 0, textureBytesWithMipmaps: detail ? 87380 : 0,
      addedTriangles: 0, addedDrawCalls: 0, sourceAlbedoReused: true, disposed }; },
    dispose() { if (disposed) return; disposed = true;
      for (const {node,source} of changes) node.material = source;
      for (const material of materials) material.dispose(); detail?.dispose(); }
  };
}

/** An owned review instance only. Original geometry, UVs, skinning, morphs,
 * source textures and accepted baseline materials are never edited. */
export function applyMaterialStudy(runtime, albedo) {
  const changes = [], materials = [], seen = new Set();
  for (const { node } of runtime.face.bindings) {
    if (seen.has(node)) continue; seen.add(node);
    if (!['AvatarHead', 'AvatarLeftEyeball', 'AvatarRightEyeball', 'AvatarTeethUpper', 'AvatarTeethLower'].includes(node.name)) continue;
    const source = node.material;
    if (Array.isArray(source)) throw new Error('unexpected_face_material_array');
    let material;
    if (node.name === 'AvatarHead') {
      material = new MeshSSSNodeMaterial({ map: albedo, normalMap: source.normalMap,
        roughness: 0.50, metalness: 0, ior: 1.4, specularIntensity: 0.35 });
      material.normalScale.copy(source.normalScale).multiplyScalar(1.5);
      const sampled = texture(albedo).rgb;
      const luminance = sampled.dot(vec3(0.2126, 0.7152, 0.0722));
      const regions = attribute('avatarFaceStyle', 'vec3');
      const hair = regions.x.mul(float(1).sub(smoothstep(0.10, 0.30, luminance))).max(regions.y);
      material.colorNode = sampled;
      material.roughnessNode = mix(float(0.50), float(0.88), hair);
      material.thicknessColorNode = vec3(0.60, 0.18, 0.12).mul(float(1).sub(hair));
      material.thicknessAttenuationNode = float(0.025);
      material.thicknessScaleNode = float(2.0);
      material.thicknessDistortionNode = float(0.15);
      material.thicknessPowerNode = float(3.0);
    } else {
      const eye = node.name.includes('Eyeball');
      material = new MeshPhysicalNodeMaterial({ map: source.map, normalMap: source.normalMap,
        roughness: eye ? 0.14 : 0.32, metalness: 0,
        clearcoat: eye ? 1 : 0.15, clearcoatRoughness: eye ? 0.04 : 0.25,
        ior: eye ? 1.38 : 1.45, specularIntensity: eye ? 0.75 : 0.3 });
      material.color.copy(source.color);
      if (eye && source.colorNode) material.colorNode = source.colorNode;
      if (source.normalScale) material.normalScale.copy(source.normalScale);
    }
    material.name = node.name + '-LocalPhysicalStudy'; material.side = source.side;
    material.needsUpdate = true; node.material = material;
    changes.push({ node, source }); materials.push(material);
  }
  if (!changes.some(({ node }) => node.name === 'AvatarHead')) throw new Error('review_head_not_found');
  return { changedMeshes: changes.map(({node}) => node.name), geometryChanged: false,
    dispose() { for (const {node,source} of changes) node.material = source; for (const material of materials) material.dispose(); } };
}
