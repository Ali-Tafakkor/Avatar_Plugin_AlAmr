import { Matrix3, Vector3 } from 'three';
import { vertexFrames } from './neck-collar.mjs';

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t*t*(3-2*t); };

/** A smooth contraction of the existing shirt opening, in the body's neutral
 * head frame (metres). Every coincident vertex follows the same spatial field,
 * including mixed skin/cloth triangles. Never project onto the neck, select by
 * texel, repaint the atlas, or change the cutout: those break the source collar.
 * The contraction fades across the shoulders/chest and has positive radial
 * derivative, preserving the ordering of the original surface layers. */
export function necklinePoint(p, out = new Vector3()) {
  const z = p.z + .005;
  const radius = Math.hypot(p.x, z);
  // The original front rim already touches the neck; most of the excess gap
  // is at the sides/back. Fade toward the throat instead of burying that rim.
  const front = radius>1e-8 ? z/radius : 1;
  const amount = smooth(-.200, -.085, p.y) * (1-smooth(.090, .205, radius))
    * (1-smooth(.20, .92, front));
  return out.set(p.x*(1-.20*amount), p.y, -.005+z*(1-.16*amount));
}

function jacobian(p) {
  const epsilon = 1e-5, center = necklinePoint(p);
  const columns = [new Vector3(epsilon,0,0),new Vector3(0,epsilon,0),new Vector3(0,0,epsilon)]
    .map(d => necklinePoint(p.clone().add(d)).sub(center).divideScalar(epsilon));
  return new Matrix3().set(columns[0].x,columns[1].x,columns[2].x,
    columns[0].y,columns[1].y,columns[2].y,columns[0].z,columns[1].z,columns[2].z);
}

/** The caller owns a geometry clone. No head mesh, pose, bone, material, UV,
 * index, skin weight or texture is written. No frame-time work is introduced. */
export function fitGarmentNeckline(mesh, frame) {
  const geometry = mesh.geometry, {position,normal} = geometry.attributes;
  const records = vertexFrames(mesh, frame);
  let affectedVertices = 0, maximumDisplacementMeters = 0;
  for (let i=0; i<position.count; i++) {
    const record = records[i];
    const local = new Vector3().fromBufferAttribute(position,i);
    const p = local.clone().applyMatrix4(record.matrix);
    const displacement = necklinePoint(p).sub(p);
    if (displacement.lengthSq()<1e-16) continue;
    affectedVertices++;
    maximumDisplacementMeters = Math.max(maximumDisplacementMeters,displacement.length());
    local.add(displacement.applyMatrix3(record.inverse));
    position.setXYZ(i,...local);
    if (normal) {
      // Transport the original smooth normals, including UV seam duplicates.
      const normalMatrix = record.inverse.clone().multiply(jacobian(p)).multiply(record.linear).invert().transpose();
      const n = new Vector3().fromBufferAttribute(normal,i).applyMatrix3(normalMatrix).normalize();
      normal.setXYZ(i,...n);
    }
  }
  position.needsUpdate = true;
  if (normal) normal.needsUpdate = true;
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return {method:'smooth original garment contraction',affectedVertices,maximumDisplacementMeters,
    uvUnchanged:true,skinWeightsUnchanged:true,materialUnchanged:true,addedTriangles:0,addedTextures:0};
}
