import assert from 'node:assert/strict';
import test from 'node:test';
import { customHairColor, normalizePalette } from '../src/avatar-palette.ts';

test('clothing accepts custom RGB while restored hair colors stay in the natural ranges', () => {
  assert.deepEqual(normalizePalette({ shirt: '#FF0064', trousers: '#43f485', shoes: '#1c4dff', hair: '#855231' }),
    { shirt: '#ff0064', trousers: '#43f485', shoes: '#1c4dff', hair: '#855231' });
  for (const hair of ['#ab1642', '#3154aa', '#ff8800', '#23f32a', 'white']) {
    assert.deepEqual(normalizePalette({ hair, shoes: '#1c4dff' }), { shoes: '#1c4dff' });
  }
});

test('every custom hair control value produces a valid neutral or brown', () => {
  assert.equal(customHairColor('neutral', 0, 0), '#000000');
  assert.equal(customHairColor('neutral', 100, 0), '#ffffff');
  for (let shade = 0; shade <= 100; shade++) {
    const neutral = customHairColor('neutral', shade, 0);
    assert.equal(normalizePalette({ hair: neutral }).hair, neutral);
    for (let warmth = 0; warmth <= 100; warmth++) {
      const brown = customHairColor('brown', shade, warmth);
      assert.equal(normalizePalette({ hair: brown }).hair, brown);
    }
  }
});
