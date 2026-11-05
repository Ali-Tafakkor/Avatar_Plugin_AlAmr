/** Lossless GLB -> external glTF resources. Image-only bufferViews are removed
 * after extraction so they are not shipped twice. All retained views are copied
 * byte-for-byte with four-byte alignment; accessor/sparse references are remapped. */
export function externalizeGltf(json, binary) {
  const document = structuredClone(json), images = new Map();
  const imageViews = new Set(document.images.map(image => image.bufferView));
  const retained = new Map(), chunks = []; let length = 0;
  for (const [i, view] of document.bufferViews.entries()) {
    if (imageViews.has(i)) continue;
    if ((view.buffer ?? 0) !== 0) throw new Error('gltf_externalize_multiple_buffers');
    const padding = (4 - length % 4) % 4;
    if (padding) { chunks.push(Buffer.alloc(padding)); length += padding; }
    const bytes = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    retained.set(i, {index:retained.size, view:{...view,byteOffset:length}});
    chunks.push(bytes); length += bytes.length;
  }
  const remap = index => {
    if (!retained.has(index)) throw new Error('gltf_image_view_also_used_as_data');
    return retained.get(index).index;
  };
  for (const accessor of document.accessors) {
    if (accessor.bufferView !== undefined) accessor.bufferView = remap(accessor.bufferView);
    if (accessor.sparse) for (const key of ['indices','values'])
      accessor.sparse[key].bufferView = remap(accessor.sparse[key].bufferView);
  }
  for (const [index,image] of document.images.entries()) {
    const view = json.bufferViews[image.bufferView];
    const extension = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[image.mimeType];
    if (!view || image.uri || !extension) throw new Error('gltf_unexpected_embedded_image');
    const name = `images/image-${String(index).padStart(2,'0')}.${extension}`;
    images.set(name,binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength));
    delete image.bufferView; image.uri = name;
  }
  document.bufferViews = [...retained.values()].map(({view})=>view);
  document.buffers[0] = {...document.buffers[0],byteLength:length,uri:'avatar.bin'};
  return {document,binary:Buffer.concat(chunks),images,bufferViewRemap:Object.fromEntries([...retained].map(([old,{index}])=>[old,index]))};
}
