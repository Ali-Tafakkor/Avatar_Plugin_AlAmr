const SWEATSHIRT = 'Meshy_AI_Lilac_Sweatshirt_Port_0809081014_texture';

/** Cache these private instance meshes when the Hybrid runtime is ready. */
export function getHybridFaceDetailMeshes(root) {
  const meshes = [];
  let depthOccluder;
  root.traverseVisible(node => {
    if (!node.isMesh) return;
    if (node.userData.hybridFaceMesh) meshes.push(node);
    if (node.isSkinnedMesh && node.name === SWEATSHIRT && node.geometry.hasAttribute('hybridRemoveSkin')) {
      depthOccluder = node;
    }
  });
  return { meshes, depthOccluder };
}

/** Draw one avatar in the host's face tile, using its real cloth alpha cutout.
 * The host selects the render target, tile camera/layers, its lights and clear
 * color. Both passes use the same pose, camera, resolution and depth attachment.
 */
export function renderHybridFaceTile(renderer, scene, camera, subject, layer) {
  const faces = subject.meshes.filter(mesh => mesh.visible);
  if (!faces.length) return;
  const cloth = subject.depthOccluder?.visible ? subject.depthOccluder : null;
  const faceLayers = faces.map(mesh => mesh.layers.mask);
  const oldClear = renderer.autoClear;
  try {
    renderer.autoClear = true;
    if (cloth) {
      const clothLayers = cloth.layers.mask;
      const materials = Array.isArray(cloth.material) ? cloth.material : [cloth.material];
      const colorWrites = materials.map(material => material.colorWrite);
      try {
        for (const face of faces) face.layers.disable(layer);
        cloth.layers.enable(layer);
        for (const material of materials) material.colorWrite = false;
        renderer.render(scene, camera);
      } finally {
        cloth.layers.mask = clothLayers;
        materials.forEach((material, index) => { material.colorWrite = colorWrites[index]; });
      }
      renderer.autoClear = false;
    }
    for (const face of faces) face.layers.enable(layer);
    renderer.render(scene, camera);
  } finally {
    faces.forEach((face, index) => { face.layers.mask = faceLayers[index]; });
    renderer.autoClear = oldClear;
  }
}
