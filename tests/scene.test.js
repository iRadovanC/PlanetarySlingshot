import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SpaceScene } from '../src/scene.js';
import { createGame, surfaceRadius } from '../src/game.js';

function inputScene() {
  const handlers = new Map(), captures = new Set(), calls = { aim: [], camera: 0, select: [] };
  const canvas = {
    style: {},
    addEventListener: (type, handler) => handlers.set(type, handler),
    setPointerCapture: id => captures.add(id),
    hasPointerCapture: id => captures.has(id),
    releasePointerCapture: id => captures.delete(id),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 700 }),
  };
  const scene = Object.create(SpaceScene.prototype);
  Object.assign(scene, {
    renderer: { domElement: canvas },
    game: { phase: 'aim', activePlayer: 0 },
    callbacks: { onAim: (...args) => calls.aim.push(args), onSelect: id => calls.select.push(id) },
    camera: new THREE.PerspectiveCamera(44, 1000 / 700, .1, 700),
    raycaster: new THREE.Raycaster(), pointer: new THREE.Vector2(), bodyMeshes: new Map(),
    azimuth: 0, tilt: .28,
    updateCamera: () => calls.camera++,
  });
  scene.camera.position.set(0, 100, 0);
  scene.camera.up.set(0, 0, 1);
  scene.camera.lookAt(0, 0, 0);
  scene.camera.updateMatrixWorld();
  scene.bindInput();
  const send = (type, options = {}) => handlers.get(type)({ pointerId: 1, button: 0, clientX: 500, clientY: 350, preventDefault() {}, ...options });
  return { scene, calls, send };
}

test('only right dragging rotates the camera and the expanded tilt limits remain safe for aiming', () => {
  const { scene, calls, send } = inputScene();
  send('pointerdown', { button: 2 });
  send('pointermove', { button: 2, clientX: 550, clientY: 700 });
  assert.equal(scene.tilt, 1.43);
  assert.ok(scene.azimuth < 0);
  send('pointermove', { button: 2, clientY: -1000 });
  assert.equal(scene.tilt, .025);
  send('pointerup', { button: 2 });
  assert.equal(calls.camera, 2);
  assert.equal(calls.aim.length, 0);
  assert.equal(calls.select.length, 0);
});

test('left dragging continuously adjusts direction and power without rotating or firing', () => {
  const { scene, calls, send } = inputScene();
  send('pointerdown');
  send('pointermove', { clientX: 600, clientY: 450 });
  assert.equal(calls.aim.length, 1);
  assert.equal(calls.aim[0][2], true, 'drag adjusts power');
  assert.equal(calls.aim[0][3], false, 'intermediate moves do not save every frame');
  send('pointerup', { clientX: 650, clientY: 400 });
  assert.equal(calls.aim.length, 2);
  assert.deepEqual(calls.aim[1].slice(2), [true, true]);
  assert.equal(calls.camera, 0);
  assert.equal(scene.azimuth, 0);
  assert.equal(scene.tilt, .28);
  send('pointerdown'); send('pointerup');
  assert.deepEqual(calls.aim.at(-1).slice(2), [false, true], 'a click preserves power');
});

test('foreign pointers, cancelled drags, and a change of player cannot alter another turn', () => {
  const { scene, calls, send } = inputScene();
  send('pointerdown');
  send('pointermove', { pointerId: 2, clientX: 600 });
  send('pointerup', { pointerId: 2 });
  assert.equal(calls.aim.length, 0);
  assert.ok(scene.drag);
  send('pointercancel');
  send('pointerup');
  assert.equal(calls.aim.length, 0);
  send('pointerdown');
  scene.game.activePlayer = 1;
  send('pointermove', { clientX: 600 }); send('pointerup');
  assert.equal(calls.aim.length, 0);
  scene.callbacks.canInput = () => false;
  send('pointerdown', { button: 2 });
  assert.equal(scene.drag, null);
});

test('the visible mesh and its atmosphere follow the same crater surface as collisions', () => {
  const body = createGame().bodies.find(b => b.id === 'inner-0');
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(body.radius, 48, 32));
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(body.radius * 1.045, 48, 32));
  const scene = Object.create(SpaceScene.prototype);
  scene.bodyMeshes = new Map([[body.id, { body, mesh, atmosphere, craterCount: -1 }]]);
  scene.updateSurfaces();
  const original = mesh.geometry.attributes.position.array.slice();
  body.craters.push({ angle: 0, width: .6, depth: 1.5 });
  scene.updateSurfaces();
  const positions = mesh.geometry.attributes.position;
  let moved = 0;
  for (let i = 0; i < positions.count; i++) {
    const x = original[i * 3], y = original[i * 3 + 1], z = original[i * 3 + 2];
    const horizontal = Math.hypot(x, z);
    const radius = surfaceRadius(body, x / (horizontal || 1), 0, z / (horizontal || 1));
    const expected = Math.min(horizontal, radius);
    const actual = Math.hypot(positions.getX(i), positions.getZ(i));
    assert.ok(Math.abs(actual - expected) < 1e-5);
    assert.equal(positions.getY(i), y);
    const glow = atmosphere.geometry.attributes.position;
    assert.ok(Math.abs(Math.hypot(glow.getX(i), glow.getZ(i)) - actual * 1.045) < 1e-5);
    if (actual < horizontal - .01) moved++;
  }
  assert.ok(moved > 20, 'the impact removes a visible patch of geometry');
  const saved = positions.array.slice();
  scene.updateSurfaces();
  assert.deepEqual(positions.array, saved, 'refreshing indicators never deepens old craters');
  mesh.geometry.dispose(); mesh.material.dispose(); atmosphere.geometry.dispose(); atmosphere.material.dispose();
});
