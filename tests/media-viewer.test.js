'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const viewer = require('../klas-media-viewer.js');

test('gallery navigation wraps in both directions', () => {
  assert.equal(viewer.nextIndex(0, 1, 3), 1);
  assert.equal(viewer.nextIndex(2, 1, 3), 0);
  assert.equal(viewer.nextIndex(0, -1, 3), 2);
  assert.equal(viewer.nextIndex(5, 1, 0), 0);
  assert.equal(viewer.formatCounter(1, 4), '2 / 4');
});

test('zoom remains inside the supported range', () => {
  assert.equal(viewer.clampScale(-3), viewer.MIN_SCALE);
  assert.equal(viewer.clampScale(2.75), 2.75);
  assert.equal(viewer.clampScale(99), viewer.MAX_SCALE);
});

test('media URLs are HTTPS-only with a local image exception', () => {
  assert.equal(viewer.safeMediaUrl('http://example.com/photo.jpg'), '');
  assert.equal(viewer.safeMediaUrl('javascript:alert(1)'), '');
  assert.equal(viewer.safeMediaUrl('data:text/html;base64,WA=='), '');
  assert.match(viewer.safeMediaUrl('data:image/png;base64,WA=='), /^data:image\/png/);
  assert.equal(viewer.safeMediaUrl('data:image/png;base64,WA==', 'video'), '');
  assert.equal(viewer.safeMediaUrl('https://example.com/photo.jpg'), 'https://example.com/photo.jpg');
});

test('invalid gallery records are removed and text is bounded', () => {
  const items = viewer.normaliseItems([
    { id: 'one', type: 'image', src: 'https://example.com/one.jpg', title: 'A'.repeat(300) },
    { id: 'two', type: 'video', src: 'http://example.com/two.mp4' },
    { id: 'three', type: 'video', src: 'https://example.com/three.mp4', description: 'B'.repeat(900) }
  ]);
  assert.equal(items.length, 2);
  assert.equal(items[0].title.length, 180);
  assert.equal(items[1].description.length, 500);
  assert.equal(items[1].type, 'video');
});

test('Cloudinary thumbnails use delivery transformations', () => {
  const image = viewer.cloudinaryThumbnail(
    'https://res.cloudinary.com/fitojlfl/image/upload/v1/klas/photo.jpg',
    'image'
  );
  const video = viewer.cloudinaryThumbnail(
    'https://res.cloudinary.com/fitojlfl/video/upload/v1/klas/clip.mp4',
    'video'
  );
  assert.match(image, /image\/upload\/f_auto,q_auto,c_fill,w_720,h_720,dpr_auto\//);
  assert.match(video, /video\/upload\/so_0,f_jpg,q_auto,c_fill,w_720,h_720,dpr_auto\//);
  assert.match(video, /clip\.jpg$/);
  assert.equal(
    viewer.cloudinaryThumbnail('https://example.com/photo.jpg', 'image'),
    'https://example.com/photo.jpg'
  );
});

test('direct video detection accepts common browser formats', () => {
  assert.equal(viewer.isDirectVideo('https://example.com/video.mp4?token=1'), true);
  assert.equal(viewer.isDirectVideo('https://example.com/video.webm'), true);
  assert.equal(viewer.isDirectVideo('https://youtube.com/watch?v=test'), false);
});
