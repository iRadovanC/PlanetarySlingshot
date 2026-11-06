export const TAU = Math.PI * 2;
export const STEP = 1 / 120;
export const GRAVITY = 1.15;
// A gentler falloff keeps gravity useful across the sector, with bounded surface forces.
export const GRAVITY_REACH = 4;
export const MAX_FLIGHT_TIME = 28;
export const ROUND_INCOME = 100;
export const RESEARCH_PRICE = 25;

export const WEAPONS = {
  kinetic: { name: 'Kinetický projektil', short: 'Kinetický', icon: 'crosshair', cost: 0, damage: 28, terrain: 38, blast: 2, color: '#f0c17b', description: 'Spolehlivá základní munice. Neomezené zásoby.' },
  plasma: { name: 'Plazmová střela', short: 'Plazma', icon: 'flame', cost: 45, damage: 44, terrain: 50, blast: 3.8, tech: 'plasma', color: '#80dfed', description: '44 poškození a větší oblast exploze.' },
  drill: { name: 'Seismický průbojník', short: 'Průbojník', icon: 'drill', cost: 50, damage: 20, terrain: 155, blast: 2.8, tech: 'mining', color: '#cfaaef', description: '155 poškození planetám. Změň gravitační pole mapy.' },
  cluster: { name: 'Trojitá salva', short: 'Salva', icon: 'layers', cost: 65, damage: 19, terrain: 32, blast: 2.6, count: 3, tech: 'cluster', color: '#e3a4c6', description: 'Tři projektily v mírném rozptylu. Až 57 poškození.' },
  nova: { name: 'Nova', short: 'Nova', icon: 'nova', cost: 100, damage: 72, terrain: 230, blast: 8, tech: 'nova', color: '#ffab72', description: '72 poškození. Rozsáhlá exploze ničí celé planety.' },
};

export const TECH = {
  plasma: { name: 'Plazmová fyzika', cost: 2, icon: 'flame', branch: 'ZBRANĚ', description: 'Odemkne plazmovou střelu.', requires: [] },
  cluster: { name: 'Vícenásobná hlavice', cost: 3, icon: 'layers', branch: 'ZBRANĚ', description: 'Odemkne trojitou salvu.', requires: ['plasma'] },
  nova: { name: 'Reakce Nova', cost: 5, icon: 'nova', branch: 'ZBRANĚ', description: 'Odemkne nejsilnější zbraň Nova.', requires: ['cluster'] },
  mining: { name: 'Planetární inženýrství', cost: 2, icon: 'drill', branch: 'TECHNOLOGIE', description: 'Odemkne seismický průbojník.', requires: [] },
  navigation: { name: 'Orbitální navigace', cost: 3, icon: 'orbit', branch: 'TECHNOLOGIE', description: 'Trvale zobrazí celou předpověď dráhy.', requires: ['mining'] },
  defense: { name: 'Deflektorové pole', cost: 3, icon: 'shield', branch: 'OBRANA', description: 'Odemkne štít a zesílení výstřelu.', requires: [] },
};

export const UPGRADES = {
  repair: { name: 'Opravárenský dron', icon: 'repair', cost: 40, description: 'Obnoví 30 životů. Nejvýše 100.' },
  shield: { name: 'Energetický štít', icon: 'shield', cost: 50, tech: 'defense', description: 'Přidá 35 bodů štítu. Nejvýše 70.' },
  boost: { name: 'Přetížení kanónu', icon: 'bolt', cost: 35, tech: 'defense', description: 'Příští výstřel způsobí o 35 % více škod.' },
};

export function randomGenerator(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function createWorld(seed = 4096) {
  const random = randomGenerator(seed);
  const names = ['Vesper', 'Aether', 'Talos', 'Nereida', 'Nyx', 'Helios', 'Erebus', 'Selene'];
  const colors = ['#8495b0', '#78949e', '#b5a18b', '#a59a86', '#a87461', '#938897', '#8c9f98', '#a8a58a'];
  const bodies = names.map((name, i) => {
    const angle = i / names.length * TAU;
    const radius = 2.5 + random() * .55;
    return { id: `planet-${i}`, name, x: Math.cos(angle) * 40, z: Math.sin(angle) * 37, radius, mass: radius * radius * 15, hp: 210, maxHp: 210, edge: true, color: colors[i], seed: Math.floor(random() * 1e6), kind: 'planet' };
  });
  const interiors = [
    { name: 'Kronos', x: -5, z: 1.5, radius: 5.2, color: '#b6a28a', ring: true },
    { name: 'Ares', x: 17, z: -10, radius: 3.5, color: '#b66f55' },
    { name: 'Glacis', x: -19, z: -16, radius: 3.2, color: '#7fabb9' },
    { name: 'Umbra', x: -23, z: 15, radius: 2.6, color: '#776b87' },
    { name: 'Cinder', x: 16, z: 18, radius: 3, color: '#9b8e75' },
  ];
  interiors.forEach((b, i) => bodies.push({ ...b, id: `inner-${i}`, x: b.x + (random() - .5) * 4, z: b.z + (random() - .5) * 4, mass: b.radius ** 2 * 16, hp: Math.round(b.radius * 50), maxHp: Math.round(b.radius * 50), edge: false, seed: Math.floor(random() * 1e6), kind: 'planet' }));
  for (let i = 0; i < 16; i++) {
    let x, z;
    for (let attempt = 0; attempt < 100; attempt++) {
      x = (random() - .5) * 68; z = (random() - .5) * 58;
      if (bodies.every(b => Math.hypot(x - b.x, z - b.z) > b.radius + 3)) break;
    }
    const radius = .45 + random() * .85;
    bodies.push({ id: `asteroid-${i}`, name: `Asteroid ${String(i + 1).padStart(2, '0')}`, x, z, radius, mass: radius ** 2 * 12, hp: 28, maxHp: 28, color: '#77766e', edge: false, seed: Math.floor(random() * 1e6), kind: 'asteroid' });
  }
  return bodies.map(body => ({ ...body, initialMass: body.mass, craters: [] }));
}

export function createGame(seed = 4096) {
  return {
    version: 1, seed, bodies: createWorld(seed), phase: 'setup', setupPlayer: 0,
    activePlayer: 0, round: 1, totalShots: 0, winner: null,
    players: [
      { name: 'Hráč 1', callsign: 'VANGUARD', color: '#81d9e8', hp: 100, shield: 0, credits: 100, research: 0, tech: [], inventory: {}, home: null, boost: false, angle: Math.PI, power: 65, weapon: 'kinetic' },
      { name: 'Hráč 2', callsign: 'NEMESIS', color: '#efa47f', hp: 100, shield: 0, credits: 100, research: 0, tech: [], inventory: {}, home: null, boost: false, angle: 0, power: 65, weapon: 'kinetic' },
    ],
    log: ['Sektor Kepler-09 připraven. Vyberte domovské planety.'],
  };
}

export function isSelectable(game, body) {
  if (game.phase !== 'setup' || !body.edge || body.hp <= 0) return false;
  if (game.setupPlayer === 0) return true;
  const home = game.bodies.find(b => b.id === game.players[0].home);
  if (!home || body.id === home.id) return false;
  const dot = (home.x * body.x + home.z * body.z) / (Math.hypot(home.x, home.z) * Math.hypot(body.x, body.z));
  return dot <= -.63;
}

export function selectHome(game, id) {
  const body = game.bodies.find(b => b.id === id);
  if (!body || !isSelectable(game, body)) return false;
  const player = game.players[game.setupPlayer];
  player.home = id;
  player.x = body.x; player.z = body.z;
  player.angle = Math.atan2(-body.z, -body.x);
  game.log.push(`${player.name} zakládá základnu na planetě ${body.name}.`);
  if (game.setupPlayer === 0) game.setupPlayer = 1;
  else game.phase = 'aim';
  return true;
}

export function currentPlayer(game) { return game.players[game.activePlayer]; }
export function homeBody(game, player = currentPlayer(game)) { return game.bodies.find(b => b.id === player.home); }
export function canAct(game) { return game.phase === 'aim'; }
export function startTurn(game) { if (game.phase === 'handoff') { game.phase = 'aim'; return true; } return false; }

export function surfaceRadius(body, nx, ny = 0, nz = 0) {
  let removed = 0;
  for (const crater of body.craters || []) {
    const dot = Math.max(-1, Math.min(1, nx * Math.cos(crater.angle) + nz * Math.sin(crater.angle)));
    const angle = Math.acos(dot);
    if (angle >= crater.width) continue;
    const profile = 1 - (angle / crater.width) ** 2;
    removed += crater.depth * profile;
  }
  return Math.max(body.radius * .32, body.radius - removed);
}

export function aimAt(game, x, z, adjustPower = false) {
  if (!canAct(game) || !Number.isFinite(x) || !Number.isFinite(z)) return false;
  const p = currentPlayer(game), dx = x - p.x, dz = z - p.z;
  if (Math.hypot(dx, dz) < .01) return false;
  p.angle = Math.atan2(dz, dx);
  if (adjustPower) {
    const home = homeBody(game, p), radius = home?.hp > 0 ? home.radius : 1;
    p.power = Math.round(Math.max(10, Math.min(100, 10 + (Math.hypot(dx, dz) - radius - 2) / 32 * 90)));
  }
  return true;
}

export function buyResearch(game, count = 1) {
  const p = currentPlayer(game);
  if (!canAct(game) || !Number.isInteger(count) || count <= 0 || p.credits < count * RESEARCH_PRICE) return false;
  p.credits -= count * RESEARCH_PRICE; p.research += count;
  return true;
}

export function researchTech(game, id) {
  const p = currentPlayer(game), tech = TECH[id];
  if (!canAct(game) || !tech || p.tech.includes(id) || p.research < tech.cost || !tech.requires.every(r => p.tech.includes(r))) return false;
  p.research -= tech.cost; p.tech.push(id);
  game.log.push(`${p.name}: dokončen výzkum ${tech.name}.`);
  return true;
}

export function buyWeapon(game, id) {
  const p = currentPlayer(game), weapon = WEAPONS[id];
  if (!canAct(game) || !weapon || !weapon.cost || p.credits < weapon.cost || (weapon.tech && !p.tech.includes(weapon.tech))) return false;
  p.credits -= weapon.cost;
  p.inventory[id] = (p.inventory[id] || 0) + 1;
  return true;
}

export function buyUpgrade(game, id) {
  const p = currentPlayer(game), item = UPGRADES[id];
  if (!canAct(game) || !item || p.credits < item.cost || (item.tech && !p.tech.includes(item.tech))) return false;
  if (id === 'repair') { if (p.hp >= 100) return false; p.hp = Math.min(100, p.hp + 30); }
  if (id === 'shield') { if (p.shield >= 70) return false; p.shield = Math.min(70, p.shield + 35); }
  if (id === 'boost') { if (p.boost) return false; p.boost = true; }
  p.credits -= item.cost;
  return true;
}

export function equipWeapon(game, id) {
  const p = currentPlayer(game);
  if (!canAct(game) || !WEAPONS[id] || (id !== 'kinetic' && !(p.inventory[id] > 0))) return false;
  p.weapon = id;
  return true;
}

export function acceleration(bodies, x, z, players = []) {
  let ax = 0, az = 0;
  for (const body of bodies) {
    if (body.hp <= 0) continue;
    const dx = body.x - x, dz = body.z - z;
    const r2 = dx * dx + dz * dz;
    const distance = Math.sqrt(r2 + .45);
    const softening = Math.max(1, (body.radius || 1) * .65);
    // Magnitude tends to 1 / distance^1.5, instead of the previous 1 / distance^2.
    const force = GRAVITY * body.mass / ((r2 + softening ** 2) * Math.sqrt(GRAVITY_REACH * distance));
    ax += dx * force; az += dz * force;
  }
  // Cannons remain light gravitational sources even after their host is destroyed.
  for (const p of players) {
    if (p.hp <= 0 || p.x == null) continue;
    const dx = p.x - x, dz = p.z - z;
    const r2 = dx * dx + dz * dz + 1;
    const force = GRAVITY * 3 / (r2 * Math.sqrt(r2));
    ax += dx * force; az += dz * force;
  }
  return { x: ax, z: az };
}

export function createProjectiles(game) {
  const p = currentPlayer(game), weapon = WEAPONS[p.weapon], home = homeBody(game, p);
  const count = weapon.count || 1;
  return Array.from({ length: count }, (_, i) => {
    const angle = p.angle + (i - (count - 1) / 2) * .055;
    const radius = home?.hp > 0 ? surfaceRadius(home, Math.cos(angle), 0, Math.sin(angle)) : 1;
    const speed = 8 + Math.max(10, Math.min(100, p.power)) * .105;
    return {
      x: p.x + Math.cos(angle) * (radius + .65), z: p.z + Math.sin(angle) * (radius + .65),
      vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed,
      age: 0, alive: true, weapon: p.weapon, owner: game.activePlayer,
      multiplier: p.boost ? 1.35 : 1, path: [], result: null,
    };
  });
}

function segmentCircle(x1, z1, x2, z2, cx, cz, radius) {
  const dx = x2 - x1, dz = z2 - z1;
  const ox = x1 - cx, oz = z1 - cz;
  const a = dx * dx + dz * dz;
  const c = ox * ox + oz * oz - radius * radius;
  if (c <= 0) return 0;
  if (a < 1e-12) return null;
  const b = 2 * (ox * dx + oz * dz), disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

function segmentBody(x1, z1, x2, z2, body) {
  const entry = segmentCircle(x1, z1, x2, z2, body.x, body.z, body.radius + .12);
  if (entry === null || !body.craters?.length) return entry;
  const inside = t => {
    const dx = x1 + (x2 - x1) * t - body.x, dz = z1 + (z2 - z1) * t - body.z;
    const distance = Math.hypot(dx, dz);
    return distance <= surfaceRadius(body, dx / (distance || 1), 0, dz / (distance || 1)) + .12;
  };
  if (inside(entry)) return entry;
  const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, z2 - z1) / Math.max(.025, body.radius * .04)));
  let previous = entry;
  for (let i = 1; i <= steps; i++) {
    const t = entry + (1 - entry) * i / steps;
    if (inside(t)) {
      let lo = previous, hi = t;
      for (let j = 0; j < 16; j++) {
        const mid = (lo + hi) / 2;
        if (inside(mid)) hi = mid; else lo = mid;
      }
      return hi;
    }
    previous = t;
  }
  return null;
}

export function advanceProjectile(projectile, game, dt = STEP) {
  if (!projectile.alive) return null;
  const a = acceleration(game.bodies, projectile.x, projectile.z, game.players);
  // Velocity Verlet: preview and real flight share exactly the same fixed timestep.
  const x = projectile.x + projectile.vx * dt + .5 * a.x * dt * dt;
  const z = projectile.z + projectile.vz * dt + .5 * a.z * dt * dt;
  const next = acceleration(game.bodies, x, z, game.players);
  projectile.vx += .5 * (a.x + next.x) * dt;
  projectile.vz += .5 * (a.z + next.z) * dt;
  let hit = null, first = Infinity;
  for (const b of game.bodies) {
    if (b.hp <= 0) continue;
    const t = segmentBody(projectile.x, projectile.z, x, z, b);
    if (t !== null && t < first) { first = t; hit = { type: 'body', id: b.id }; }
  }
  for (let i = 0; i < game.players.length; i++) {
    const p = game.players[i];
    if (p.x == null || p.hp <= 0 || homeBody(game, p)?.hp > 0) continue;
    const t = segmentCircle(projectile.x, projectile.z, x, z, p.x, p.z, 1.15);
    if (t !== null && t < first) { first = t; hit = { type: 'player', id: i }; }
  }
  if (hit) {
    projectile.x += (x - projectile.x) * first;
    projectile.z += (z - projectile.z) * first;
    projectile.alive = false;
    projectile.result = { ...hit, x: projectile.x, z: projectile.z };
  } else { projectile.x = x; projectile.z = z; }
  projectile.age += dt;
  if (projectile.alive && (Math.hypot(x, z) > 110 || projectile.age >= MAX_FLIGHT_TIME)) {
    projectile.alive = false;
    projectile.result = { type: 'miss', x, z };
  }
  return projectile.result;
}

export function previewShot(game, full = false) {
  if (!currentPlayer(game).home) return [];
  return createProjectiles(game).map(p => {
    const path = [{ x: p.x, z: p.z }];
    const max = full ? MAX_FLIGHT_TIME : 1.1;
    let step = 0;
    while (p.alive && p.age < max) {
      advanceProjectile(p, game);
      if (++step % 5 === 0 || !p.alive) path.push({ x: p.x, z: p.z });
    }
    return { path, hit: p.result };
  });
}

export function fire(game) {
  const p = currentPlayer(game);
  if (!canAct(game) || (p.weapon !== 'kinetic' && !(p.inventory[p.weapon] > 0))) return null;
  const projectiles = createProjectiles(game);
  if (p.weapon !== 'kinetic') p.inventory[p.weapon]--;
  p.boost = false;
  game.phase = 'flight';
  game.totalShots++;
  return projectiles;
}

export function resolveImpact(game, projectile) {
  const result = projectile.result;
  if (!result || result.type === 'miss') return { destroyed: [], damage: [], bodyDamage: [], miss: true };
  const weapon = WEAPONS[projectile.weapon];
  const destroyed = [], damage = [], bodyDamage = [];
  for (const b of game.bodies) {
    if (b.hp <= 0) continue;
    const distance = Math.max(0, Math.hypot(result.x - b.x, result.z - b.z) - b.radius);
    const direct = result.type === 'body' && result.id === b.id;
    if (direct || distance < weapon.blast) {
      const factor = direct ? 1 : Math.max(0, 1 - distance / weapon.blast) * .65;
      const previousHp = b.hp;
      const previousMass = b.mass;
      b.hp = Math.max(0, b.hp - Math.round(weapon.terrain * factor * projectile.multiplier));
      const lostHp = previousHp - b.hp;
      // Slightly amplify mass loss relative to lost integrity, including large planets.
      b.mass *= (b.hp / previousHp) ** 1.15;
      if (lostHp > 0) {
        bodyDamage.push({ id: b.id, amount: lostHp, massLost: previousMass - b.mass });
        const fraction = lostHp / (b.maxHp || previousHp);
        b.craters ??= [];
        b.craters.push({
          angle: Math.atan2(result.z - b.z, result.x - b.x),
          width: Math.min(1.05, .55 + fraction * .9 + weapon.blast / b.radius * .08),
          depth: b.radius * Math.min(.55, .16 + fraction * .9),
        });
        if (b.hp > 0) game.log.push(`${b.name}: −${lostHp} integrity, hmota −${Math.round((1 - b.mass / previousMass) * 100)} %, gravitace zeslábla.`);
      }
      if (b.hp === 0) { destroyed.push(b.id); game.log.push(`${b.name}: těleso zničeno, gravitační pole zaniklo.`); }
    }
  }
  game.players.forEach((p, index) => {
    if (p.hp <= 0) return;
    const home = homeBody(game, p);
    const direct = (result.type === 'body' && result.id === p.home) || (result.type === 'player' && result.id === index);
    const radius = home?.hp > 0 || destroyed.includes(p.home) ? home.radius : 1;
    const distance = Math.max(0, Math.hypot(result.x - p.x, result.z - p.z) - radius);
    if (!direct && distance >= weapon.blast) return;
    const amount = Math.round(weapon.damage * projectile.multiplier * (direct ? 1 : Math.max(0, 1 - distance / weapon.blast) * .75));
    const absorbed = Math.min(p.shield, amount);
    p.shield -= absorbed;
    const hpDamage = Math.min(p.hp, amount - absorbed);
    p.hp -= hpDamage;
    damage.push({ player: index, amount: hpDamage, shield: absorbed });
    game.log.push(`${p.name}: −${hpDamage} životů${absorbed ? `, štít pohltil ${absorbed}` : ''}.`);
  });
  return { destroyed, damage, bodyDamage, miss: false };
}

export function finishTurn(game) {
  if (game.phase !== 'flight') return false;
  const living = game.players.map((p, i) => p.hp > 0 ? i : null).filter(i => i !== null);
  if (living.length < 2) {
    game.winner = living.length === 1 ? living[0] : -1;
    game.phase = 'gameover';
    return true;
  }
  game.activePlayer = 1 - game.activePlayer;
  if (game.activePlayer === 0) {
    game.round++;
    game.players.forEach(p => { p.credits += ROUND_INCOME; });
    game.log.push(`Kolo ${game.round}: oba hráči získávají 100 kreditů.`);
  }
  const p = currentPlayer(game);
  if (p.weapon !== 'kinetic' && !(p.inventory[p.weapon] > 0)) p.weapon = 'kinetic';
  game.phase = 'aim';
  game.log = game.log.slice(-30);
  return true;
}

export function snapshot(game) { return JSON.stringify(game); }
export function restore(serialized) {
  try {
    const g = JSON.parse(serialized);
    const phases = ['setup', 'aim', 'handoff', 'flight', 'gameover'];
    if (g.version !== 1 || !phases.includes(g.phase) || !Array.isArray(g.players) || g.players.length !== 2 || !Array.isArray(g.bodies) || !g.bodies.length) return null;
    if (!g.players.every(p => Number.isFinite(p.hp) && Number.isFinite(p.credits) && Array.isArray(p.tech) && p.inventory)) return null;
    if (!g.bodies.every(b => Number.isFinite(b.x) && Number.isFinite(b.z) && Number.isFinite(b.mass))) return null;
    // A flight cannot be resumed without its transient projectiles. Saves are written before launching.
    if (g.phase === 'flight' || g.phase === 'handoff') g.phase = 'aim';
    for (const body of g.bodies) {
      if (body.initialMass == null) {
        body.initialMass = body.mass;
        body.mass = body.initialMass * (body.hp / body.maxHp) ** 1.15;
      }
      body.craters ??= [];
    }
    return g;
  } catch { return null; }
}
