import { Color, Float32BufferAttribute, Group, Matrix3, Matrix4, Quaternion, Vector3 } from 'three';
import { attribute, float, materialColor, mix, smoothstep, vec3 } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
const FACE_PARTS = new Set([
  'AvatarHead', 'AvatarEyelashes', 'AvatarLeftEyeball', 'AvatarRightEyeball', 'AvatarTeethLower', 'AvatarTeethUpper',
]);
const unit = new Vector3(1, 1, 1);

function sculptPortrait(mesh, intoHeadFrame, portraitShape) {
  const { geometry, skeleton, bindMatrix, bindMatrixInverse, matrixWorld } = mesh;
  const { position, normal, skinIndex, skinWeight } = geometry.attributes;
  const targets = geometry.morphAttributes.position ?? [];
  const normalTargets = geometry.morphAttributes.normal ?? [];
  if (targets.length && !geometry.morphTargetsRelative) throw new Error('portrait_expected_relative_morphs');
  const bones = skeleton.bones.map((bone, i) => new Matrix4().multiplyMatrices(bone.matrixWorld, skeleton.boneInverses[i]));
  const prefix = new Matrix4().copy(intoHeadFrame).multiply(matrixWorld).multiply(bindMatrixInverse);
  const skin = new Matrix4(), matrix = new Matrix4(), linear = new Matrix3(), inverse = new Matrix3();
  const jacobian = new Matrix3(), normalMatrix = new Matrix3();
  const point = new Vector3(), shaped = new Vector3(), delta = new Vector3(), endpoint = new Vector3();
  const originalNormal = new Vector3(), changedNormal = new Vector3();
  const dx = new Vector3(), dy = new Vector3(), dz = new Vector3(), axis = new Vector3();
  const positions = [], e = .00001;
  const getNormalMatrix = (center, warped) => {
    portraitShape(axis.copy(center).setX(center.x + e), dx).sub(warped);
    portraitShape(axis.copy(center).setY(center.y + e), dy).sub(warped);
    portraitShape(axis.copy(center).setZ(center.z + e), dz).sub(warped);
    jacobian.set(dx.x, dy.x, dz.x, dx.y, dy.y, dz.y, dx.z, dy.z, dz.z).multiplyScalar(1 / e);
    return normalMatrix.copy(inverse).multiply(jacobian).multiply(linear).invert().transpose();
  };
  for (let i = 0; i < position.count; i++) {
    skin.elements.fill(0);
    for (let k = 0; k < 4; k++) {
      const weight = skinWeight.getComponent(i, k);
      if (weight <= 0) continue;
      const elements = bones[skinIndex.getComponent(i, k)].elements;
      for (let j = 0; j < 16; j++) skin.elements[j] += elements[j] * weight;
    }
    matrix.copy(prefix).multiply(skin).multiply(bindMatrix);
    linear.setFromMatrix4(matrix);
    inverse.copy(linear).invert();
    point.fromBufferAttribute(position, i).applyMatrix4(matrix);
    portraitShape(point, shaped);
    positions.push(shaped.clone());
    delta.copy(shaped).sub(point).applyMatrix3(inverse);
    position.setXYZ(i, position.getX(i) + delta.x, position.getY(i) + delta.y, position.getZ(i) + delta.z);
    originalNormal.fromBufferAttribute(normal, i);
    changedNormal.copy(originalNormal).applyMatrix3(getNormalMatrix(point, shaped)).normalize();
    normal.setXYZ(i, changedNormal.x, changedNormal.y, changedNormal.z);
    for (let k = 0; k < targets.length; k++) {
      const target = targets[k], normalTarget = normalTargets[k];
      delta.fromBufferAttribute(target, i);
      if (delta.lengthSq() === 0 && !normalTarget) continue;
      endpoint.copy(delta).applyMatrix3(linear).add(point);
      portraitShape(endpoint, delta);
      if (normalTarget) {
        const correction = getNormalMatrix(endpoint, delta);
        dx.fromBufferAttribute(normalTarget, i).add(originalNormal).applyMatrix3(correction).normalize().sub(changedNormal);
        normalTarget.setXYZ(i, dx.x, dx.y, dx.z);
      }
      delta.sub(shaped).applyMatrix3(inverse);
      target.setXYZ(i, delta.x, delta.y, delta.z);
    }
  }
  for (const a of [position, normal, ...targets, ...normalTargets]) a.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return positions;
}

function shadeScalp(head, points, { scalpCoverage, scalpTint, shadeRoots }) {
  // The short painted roots extend under the fringe and around the temples.
  const field = 'portraitScalpCoverage';
  head.geometry.setAttribute(field, new Float32BufferAttribute(points.flatMap(scalpCoverage), shadeRoots ? 4 : 2));
  const material = head.material;
  const source = {
    colorNode: material.colorNode,
    roughnessNode: material.roughnessNode,
    thicknessColorNode: material.thicknessColorNode,
  };
  const edge = attribute(field, shadeRoots ? 'vec4' : 'vec2');
  const coverage = smoothstep(0, 1, edge.x).max(smoothstep(-.004, .005, edge.y));
  const tint = new Color(scalpTint);
  const baseRoot = vec3(tint.r, tint.g, tint.b);
  const root = shadeRoots ? shadeRoots(edge.zw, baseRoot) : baseRoot;
  material.colorNode = mix(source.colorNode ?? materialColor.rgb, root, coverage);
  material.roughnessNode = mix(source.roughnessNode ?? float(material.roughness), float(.84), coverage);
  if (source.thicknessColorNode) material.thicknessColorNode = source.thicknessColorNode.mul(coverage.oneMinus());
  material.needsUpdate = true;
  return () => {
    head.geometry.deleteAttribute(field);
    Object.assign(material, source);
    material.needsUpdate = true;
  };
}

/** Decorate one independently mounted AvatarHybrid 0.1.3. The skin and morph
 * buffers being tailored already belong to this instance. Its rig, clips,
 * facial compositor, hand controls and foot solver still run in AvatarHybrid.
 * The caller owns the loaded texture and calls the returned disposer. */
export function mountHybridAppearance(runtime, clothingAlbedo, design) {
  const head = runtime.face.bindings.find(({ node }) => node.name === 'AvatarHead')?.node;
  const nativeHead = head?.skeleton.bones.find(bone => bone.name === 'Head');
  const body = runtime.body.meshes.find(mesh => mesh.geometry.attributes.position.count === 28961);
  if (!nativeHead || !body?.isSkinnedMesh || !head.geometry.index) throw new Error('custom_avatar_incompatible_hybrid');
  runtime.previewClip('Stand');
  runtime.seekClip(0);
  runtime.root.updateWorldMatrix(true, true);
  const frame = new Matrix4().compose(nativeHead.getWorldPosition(new Vector3()), nativeHead.getWorldQuaternion(new Quaternion()), unit);
  const inverse = frame.clone().invert();
  let points;
  runtime.root.traverse(mesh => {
    if (!mesh.isSkinnedMesh || !mesh.userData.hybridFaceMesh || !FACE_PARTS.has(mesh.name)) return;
    const shaped = sculptPortrait(mesh, inverse, design.shape);
    if (mesh === head) points = shaped;
  });
  if (!points) throw new Error('custom_avatar_missing_portrait');

  design.tailorBody(body);
  const details = design.makeClothingDetails(body);
  const hair = design.createHair?.(points, head.geometry.index);
  const restoreFace = design.prepareFace?.(head, points);
  const restoreScalp = design.scalpCoverage ? shadeScalp(head, points, design) : undefined;
  const oldMaterial = body.material;
  const material = new MeshStandardNodeMaterial({
    map: clothingAlbedo, color: oldMaterial.color, roughness: .86, metalness: 0,
    side: oldMaterial.side, alphaTest: oldMaterial.alphaTest, transparent: oldMaterial.transparent,
    depthWrite: oldMaterial.depthWrite, depthTest: oldMaterial.depthTest,
  });
  material.opacityNode = oldMaterial.opacityNode ?? null;
  material.name = design.clothingName;
  body.material = material;
  body.parent.add(details);
  const hairMount = new Group();
  hairMount.name = hair ? hair.name + 'Mount' : 'PortraitAccessoryMount';
  hairMount.matrixAutoUpdate = false;
  hairMount.matrix.copy(nativeHead.matrixWorld).invert().multiply(frame);
  nativeHead.add(hairMount);
  if (hair) {
    hair.userData.avatarInspectionHair = true;
    hairMount.add(hair);
  }
  const removeHeadDetails = design.mountHeadDetails?.(hairMount);
  runtime.root.updateWorldMatrix(true, true);
  runtime.body.refreshGeometryMeasurements();
  runtime.previewClip(null);
  const restoreHandContact = runtime.handContact && design.stabilizeHandContact(runtime);
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    restoreHandContact?.();
    restoreScalp?.();
    restoreFace?.();
    body.material = oldMaterial;
    details.removeFromParent();
    removeHeadDetails?.();
    hairMount.removeFromParent();
    for (const mesh of [details, hair]) {
      mesh?.geometry.dispose();
      mesh?.material.dispose();
    }
    material.dispose();
  };
}
