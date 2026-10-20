/** The legacy GLB incorrectly labels its closed body as alpha BLEND. Fix only
 * the mounted, material-cloned preview instance; preserve model/source bytes. */
export function fixLegacyPreviewMaterials(root) {
  const audit = { meshes: 0, skinnedMeshes: 0, materials: 0, transparentBefore: 0, transparentAfter: 0 };
  const visited = new Set();
  root.traverse(node => {
    if (!node.isMesh) return;
    audit.meshes++; if (node.isSkinnedMesh) audit.skinnedMeshes++;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (visited.has(material)) continue; visited.add(material); audit.materials++;
      if (material.transparent) audit.transparentBefore++;
      material.transparent = false;
      material.depthWrite = true;
      material.depthTest = true;
      // Keep true alpha cutouts (for example hair) without blending a whole body.
      material.alphaTest = Math.max(material.alphaTest, 0.5);
      material.needsUpdate = true;
      if (material.transparent) audit.transparentAfter++;
    }
  });
  return audit;
}
