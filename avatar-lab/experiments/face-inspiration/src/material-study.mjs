import { MeshPhysicalNodeMaterial, MeshSSSNodeMaterial } from 'three/webgpu';
import { attribute, float, mix, smoothstep, texture, vec3 } from 'three/tsl';

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
