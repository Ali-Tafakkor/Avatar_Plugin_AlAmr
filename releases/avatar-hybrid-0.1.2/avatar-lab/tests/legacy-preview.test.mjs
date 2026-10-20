import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, MeshStandardMaterial, BoxGeometry, DoubleSide, Texture } from 'three';
import { fixLegacyPreviewMaterials } from '../src/legacy-preview.mjs';

test('the legacy body uses opaque depth writes while preserving its texture, colour and alpha cutouts', () => {
  const root = new Group(), texture = new Texture();
  const material = new MeshStandardMaterial({ map: texture, color: '#a87ecb', transparent: true, depthWrite: false, side: DoubleSide });
  const mesh = new Mesh(new BoxGeometry(), material); root.add(mesh);
  const audit = fixLegacyPreviewMaterials(root);
  assert.deepEqual(audit, { meshes: 1, skinnedMeshes: 0, materials: 1, transparentBefore: 1, transparentAfter: 0 });
  assert.equal(material.depthWrite, true); assert.equal(material.depthTest, true); assert.equal(material.alphaTest, 0.5);
  assert.equal(material.map, texture); assert.equal(material.color.getHexString(), 'a87ecb'); assert.equal(material.side, DoubleSide);
  assert.equal(root.children.length, 1, 'the fix must not add another body');
});

test('material correction affects only the owned clone and remains safe on repeated application', () => {
  const original = new MeshStandardMaterial({ transparent: true, depthWrite: false });
  const owned = original.clone(), root = new Group();
  root.add(new Mesh(new BoxGeometry(), owned), new Mesh(new BoxGeometry(), owned));
  assert.equal(fixLegacyPreviewMaterials(root).materials, 1);
  assert.equal(fixLegacyPreviewMaterials(root).transparentBefore, 0);
  assert.equal(original.transparent, true); assert.equal(original.depthWrite, false); assert.equal(original.alphaTest, 0);
});
