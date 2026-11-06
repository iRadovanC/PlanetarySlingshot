import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createWorld, selectHome, isSelectable, aimAt, surfaceRadius, acceleration, buyResearch, researchTech, buyWeapon, buyUpgrade, equipWeapon, fire, createProjectiles, advanceProjectile, previewShot, resolveImpact, finishTurn, restore, snapshot, STEP } from '../src/game.js';

function match() {
  const g = createGame();
  assert.equal(selectHome(g, 'planet-0'), true);
  assert.equal(selectHome(g, 'planet-4'), true);
  assert.equal(g.phase, 'aim');
  return g;
}

test('map generation is repeatable, and only eight outer planets can be selected first', () => {
  assert.deepEqual(createWorld(81), createWorld(81));
  assert.notDeepEqual(createWorld(81), createWorld(82));
  const g = createGame();
  assert.equal(g.bodies.filter(b => isSelectable(g, b)).length, 8);
  assert.equal(selectHome(g, 'inner-0'), false);
  assert.equal(selectHome(g, 'asteroid-0'), false);
});

test('second player is limited to the opposite three edge planets', () => {
  const g = createGame();
  selectHome(g, 'planet-0');
  assert.deepEqual(g.bodies.filter(b => isSelectable(g, b)).map(b => b.id), ['planet-3', 'planet-4', 'planet-5']);
  assert.equal(selectHome(g, 'planet-1'), false);
  assert.equal(selectHome(g, 'planet-0'), false);
  assert.equal(selectHome(g, 'planet-4'), true);
  assert.equal(g.phase, 'aim');
  assert.equal(selectHome(g, 'planet-3'), false);
});

test('all living masses attract the projectile; destroyed bodies contribute no gravity', () => {
  const bodies = [{ x: 10, z: 0, mass: 100, hp: 10 }, { x: -10, z: 0, mass: 100, hp: 10 }];
  assert.deepEqual(acceleration(bodies, 0, 0), { x: 0, z: 0 });
  bodies[1].hp = 0;
  assert.ok(acceleration(bodies, 0, 0).x > 1);
  bodies[0].hp = 0;
  assert.deepEqual(acceleration(bodies, 0, 0), { x: 0, z: 0 });
});

test('research requires credits, points, and prerequisite technology; ownership stays separate', () => {
  const g = match(), p = g.players[0];
  assert.equal(buyWeapon(g, 'plasma'), false);
  assert.equal(buyResearch(g, -1), false);
  assert.equal(buyResearch(g, 1.5), false);
  assert.equal(buyResearch(g, 5), false);
  assert.equal(buyResearch(g, 3), true);
  assert.equal(p.credits, 25);
  assert.equal(researchTech(g, 'cluster'), false);
  assert.equal(researchTech(g, 'plasma'), true);
  assert.equal(p.research, 1);
  assert.equal(researchTech(g, 'plasma'), false);
  assert.deepEqual(g.players[1].tech, []);
  assert.equal(buyWeapon(g, 'plasma'), false);
  p.credits += 100;
  assert.equal(buyWeapon(g, 'plasma'), true);
  assert.equal(p.credits, 80);
  assert.equal(p.inventory.plasma, 1);
  assert.equal(equipWeapon(g, 'nova'), false);
  assert.equal(equipWeapon(g, 'plasma'), true);
  assert.ok(fire(g));
  assert.equal(p.inventory.plasma, 0);
  assert.equal(fire(g), null);
  assert.equal(buyResearch(g), false);
});

test('round income arrives once for each player after both turns, and unused credits persist', () => {
  const g = match();
  buyResearch(g, 1);
  fire(g); finishTurn(g);
  assert.equal(g.round, 1);
  assert.deepEqual(g.players.map(p => p.credits), [75, 100]);
  assert.equal(g.activePlayer, 1);
  assert.equal(g.phase, 'aim');
  fire(g); finishTurn(g);
  assert.equal(g.round, 2);
  assert.deepEqual(g.players.map(p => p.credits), [175, 200]);
  assert.equal(finishTurn(g), false);
  assert.deepEqual(g.players.map(p => p.credits), [175, 200]);
});

test('repair, shield, and boost enforce their limits and consume credits only on success', () => {
  const g = match(), p = g.players[0];
  p.credits = 500;
  assert.equal(buyUpgrade(g, 'repair'), false);
  assert.equal(p.credits, 500);
  p.hp = 82;
  assert.equal(buyUpgrade(g, 'repair'), true);
  assert.equal(p.hp, 100);
  assert.equal(buyUpgrade(g, 'shield'), false);
  p.tech.push('defense');
  assert.equal(buyUpgrade(g, 'shield'), true);
  assert.equal(buyUpgrade(g, 'shield'), true);
  assert.equal(p.shield, 70);
  assert.equal(buyUpgrade(g, 'shield'), false);
  assert.equal(buyUpgrade(g, 'boost'), true);
  assert.equal(buyUpgrade(g, 'boost'), false);
  const projectiles = fire(g);
  assert.equal(projectiles[0].multiplier, 1.35);
  assert.equal(p.boost, false);
});

test('preview and real shot follow identical integration and collision paths', () => {
  const g = match();
  g.players[0].angle = 2.4;
  const prediction = previewShot(g, true)[0];
  const p = createProjectiles(g)[0];
  while (p.alive) advanceProjectile(p, g);
  assert.deepEqual(prediction.hit, p.result);
  assert.deepEqual(prediction.path.at(-1), { x: p.x, z: p.z });
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z));
});

test('swept collision detects the first object even when a fast projectile crosses it in one step', () => {
  const g = match();
  g.bodies = [
    { id: 'near', x: 3, z: 0, radius: .3, mass: 0, hp: 20 },
    { id: 'far', x: 6, z: 0, radius: .3, mass: 0, hp: 20 },
  ];
  g.players = [];
  const p = { x: 0, z: 0, vx: 1200, vz: 0, age: 0, alive: true };
  assert.equal(advanceProjectile(p, g, STEP).id, 'near');
  assert.ok(p.x < 3);
});

test('destruction removes gravity and leaves an independently hittable cannon', () => {
  const g = match(), target = g.players[1], body = g.bodies.find(b => b.id === target.home);
  body.hp = 20;
  const impact = resolveImpact(g, { weapon: 'drill', multiplier: 1, result: { type: 'body', id: body.id, x: body.x + body.radius, z: body.z } });
  assert.ok(impact.destroyed.includes(body.id));
  assert.equal(body.hp, 0);
  assert.equal(target.hp, 80);
  const p = { x: target.x + 4, z: target.z, vx: -200, vz: 0, age: 0, alive: true };
  while (p.alive && p.age < .1) advanceProjectile(p, g);
  assert.equal(p.result.type, 'player');
  assert.equal(p.result.id, 1);
});

test('shields absorb damage before health, and health never goes below zero', () => {
  const g = match(), target = g.players[1], body = g.bodies.find(b => b.id === target.home);
  target.shield = 35;
  const projectile = { weapon: 'plasma', multiplier: 1, result: { type: 'body', id: body.id, x: body.x + body.radius, z: body.z } };
  resolveImpact(g, projectile);
  assert.equal(target.hp, 91);
  assert.equal(target.shield, 0);
  target.hp = 4;
  resolveImpact(g, projectile);
  assert.equal(target.hp, 0);
  g.phase = 'flight'; finishTurn(g);
  assert.equal(g.phase, 'gameover');
  assert.equal(g.winner, 0);
});

test('simultaneous destruction is a draw, without awarding another round', () => {
  const g = match();
  g.players.forEach(p => { p.hp = 0; });
  g.phase = 'flight'; finishTurn(g);
  assert.equal(g.winner, -1);
  assert.equal(g.phase, 'gameover');
  assert.equal(g.round, 1);
});

test('cluster consumes one purchased round and creates three distinct projectile paths', () => {
  const g = match(), p = g.players[0];
  p.inventory.cluster = 1;
  equipWeapon(g, 'cluster');
  const projectiles = fire(g);
  assert.equal(projectiles.length, 3);
  assert.equal(p.inventory.cluster, 0);
  assert.notEqual(projectiles[0].vx, projectiles[1].vx);
});

test('local saves preserve research, body destruction, income and turn state', () => {
  const g = match();
  buyResearch(g, 2); researchTech(g, 'mining');
  g.bodies[3].hp = 0;
  assert.deepEqual(restore(snapshot(g)), g);
  assert.equal(restore('{invalid'), null);
  assert.equal(restore('{"version":1}'), null);
});

test('aiming by a map vector adjusts direction and power, while a click preserves power', () => {
  const g = match(), p = g.players[0], home = g.bodies.find(b => b.id === p.home);
  aimAt(g, p.x, p.z + home.radius + 18, true);
  assert.equal(p.angle, Math.PI / 2);
  assert.equal(p.power, 55);
  aimAt(g, p.x - 100, p.z, false);
  assert.equal(p.angle, Math.PI);
  assert.equal(p.power, 55);
  aimAt(g, p.x + 1000, p.z, true);
  assert.equal(p.power, 100);
  aimAt(g, p.x + .1, p.z, true);
  assert.equal(p.power, 10);
  assert.equal(aimAt(g, p.x, p.z, true), false);
  assert.equal(aimAt(g, NaN, 0, true), false);
  fire(g);
  assert.equal(aimAt(g, 0, 0, true), false);
});

test('a surviving large planet loses mass and gravity on every impact, including splash damage', () => {
  const g = match(), body = g.bodies.find(b => b.id === 'inner-0');
  const originalMass = body.mass;
  const before = acceleration([body], body.x + 20, body.z).x;
  resolveImpact(g, { weapon: 'kinetic', multiplier: 1, result: { type: 'body', id: body.id, x: body.x + body.radius, z: body.z } });
  assert.ok(body.hp > 0);
  assert.ok(body.mass < originalMass * (body.hp / body.maxHp));
  const after = acceleration([body], body.x + 20, body.z).x;
  assert.ok(Math.abs(after) < Math.abs(before) * .85);
  assert.equal(body.craters.length, 1);
  assert.ok(surfaceRadius(body, 1, 0, 0) < body.radius * .8);
  assert.equal(surfaceRadius(body, -1, 0, 0), body.radius);
  const remainingMass = body.mass;
  resolveImpact(g, { weapon: 'plasma', multiplier: 1, result: { type: 'player', id: -1, x: body.x + body.radius + 1, z: body.z } });
  assert.ok(body.mass < remainingMass);
  assert.deepEqual(restore(snapshot(g)), g);
});

test('gravity has a slower distance falloff and visibly bends even full-power shots away from surfaces', () => {
  const body = { id: 'gravity', x: 0, z: 0, radius: 5.2, mass: 432, hp: 260 };
  const near = Math.abs(acceleration([body], 15, 0).x);
  const far = Math.abs(acceleration([body], 30, 0).x);
  assert.ok(far / near > .34, 'doubling the distance retains at least 34% of the attraction');
  const g = match();
  g.bodies = [body]; g.players = [];
  for (const power of [50, 75, 100]) {
    const launch = match();
    launch.players[0].power = power;
    const initial = createProjectiles(launch)[0], speed = Math.hypot(initial.vx, initial.vz);
    const p = { x: -30, z: 12, vx: speed, vz: 0, age: 0, alive: true };
    while (p.alive && p.x < 20) advanceProjectile(p, g);
    assert.ok(p.z < 6, `power ${power}% bends by more than six units over the flyby`);
    assert.ok(Math.atan2(-p.vz, p.vx) > .3, `power ${power}% deflects by over 17 degrees`);
  }
});

test('swept collisions enter a crater before touching the remaining surface, and preview agrees', () => {
  const g = match(), body = { id: 'cratered', x: 0, z: 0, radius: 5, mass: 0, hp: 200, craters: [{ angle: 0, width: .6, depth: 2 }] };
  g.bodies = [body]; g.players = [];
  const p = { x: 8, z: 0, vx: -1200, vz: 0, age: 0, alive: true };
  advanceProjectile(p, g);
  assert.equal(p.result.id, body.id);
  assert.ok(Math.abs(p.x - 3.12) < .001, 'collides with the crater floor, not the old sphere');
  const intact = { ...body, craters: [] };
  g.bodies = [intact];
  const straight = { x: 8, z: 0, vx: -1200, vz: 0, age: 0, alive: true };
  advanceProjectile(straight, g);
  assert.ok(Math.abs(straight.x - 5.12) < .001);
  const real = match(), home = real.bodies.find(b => b.id === real.players[0].home);
  home.craters.push({ angle: real.players[0].angle, width: .6, depth: 1 });
  const prediction = previewShot(real, true)[0], shot = createProjectiles(real)[0];
  assert.ok(Math.hypot(shot.x - home.x, shot.z - home.z) < home.radius);
  while (shot.alive) advanceProjectile(shot, real);
  assert.deepEqual(shot.result, prediction.hit);
});

test('older handoff saves resume directly and damaged planets acquire reduced mass', () => {
  const g = match(), body = g.bodies.find(b => b.id === 'inner-0');
  g.phase = 'handoff';
  body.hp /= 2;
  const originalMass = body.mass;
  for (const b of g.bodies) { delete b.initialMass; delete b.craters; }
  const loaded = restore(snapshot(g));
  assert.equal(loaded.phase, 'aim');
  const damaged = loaded.bodies.find(b => b.id === body.id);
  assert.ok(damaged.mass < originalMass * .5);
  assert.deepEqual(damaged.craters, []);
  assert.deepEqual(restore(snapshot(loaded)), loaded, 'loading again must not remove mass twice');
});
