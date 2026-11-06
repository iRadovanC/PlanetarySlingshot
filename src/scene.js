import * as THREE from 'three';
import { randomGenerator, isSelectable, homeBody, surfaceRadius, WEAPONS } from './game.js';

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const tmp = new THREE.Vector3();

function planetTexture(body) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const random = randomGenerator(body.seed);
  const color = new THREE.Color(body.color);
  const base = [color.r, color.g, color.b].map(c => Math.round(THREE.MathUtils.clamp(c, 0, 1) ** (1 / 2.2) * 255));
  const grids = [8, 16, 32, 64, 128].map(size => ({ size, values: Array.from({ length: size * size }, random) }));
  const noise = (u, v, grid) => {
    const { size, values } = grid, x = u * size, y = v * size;
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const at = (x, y) => values[((y % size + size) % size) * size + (x % size + size) % size];
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(ix, iy), at(ix + 1, iy), fx), THREE.MathUtils.lerp(at(ix, iy + 1), at(ix + 1, iy + 1), fx), fy);
  };
  const image = ctx.createImageData(512, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 512; x++) {
    let n = 0;
    grids.forEach((g, i) => { n += noise(x / 512, y / 256, g) * (.52 / (1 << i)); });
    const bands = body.ring ? Math.sin(y * .24 + n * 5) * .12 + Math.sin(y * .63) * .04 : 0;
    const shade = .47 + n * .95 + bands;
    const i = (y * 512 + x) * 4;
    image.data[i] = Math.min(255, base[0] * shade);
    image.data[i + 1] = Math.min(255, base[1] * shade);
    image.data[i + 2] = Math.min(255, base[2] * shade);
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  if (!body.ring) {
    for (let i = 0; i < 75; i++) {
      const x = random() * 512, y = random() * 256, r = 1 + random() * 8;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * .75, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(12,17,22,${.08 + random() * .13})`; ctx.fill();
      ctx.strokeStyle = 'rgba(236,222,201,.09)'; ctx.lineWidth = .8; ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function circle(radius, color, opacity = .4, dashed = false) {
  const points = Array.from({ length: 129 }, (_, i) => new THREE.Vector3(Math.cos(i / 128 * Math.PI * 2) * radius, .035, Math.sin(i / 128 * Math.PI * 2) * radius));
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = dashed ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: .45, gapSize: .5 }) : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const line = new THREE.Line(geo, mat);
  if (dashed) line.computeLineDistances();
  return line;
}

export class SpaceScene {
  constructor(container, callbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setClearColor(0x050912, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.domElement.setAttribute('aria-label', '3D mapa. Levým tažením nastav směr a sílu, pravým otáčej kameru, kolečkem přibližuj.');
    this.renderer.domElement.setAttribute('role', 'img');
    container.prepend(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(44, 1, .1, 700);
    this.distance = 116;
    this.azimuth = 0;
    this.tilt = .28;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.bodyMeshes = new Map();
    this.cannons = [];
    this.paths = [];
    this.effects = [];
    this.shots = [];
    this.labels = document.createElement('div');
    this.labels.className = 'planet-labels';
    this.labels.setAttribute('aria-hidden', 'true');
    container.append(this.labels);
    const ambient = new THREE.AmbientLight(0x8b9cad, 1.05);
    const key = new THREE.DirectionalLight(0xffe5bd, 3.2);
    key.position.set(-30, 45, 25);
    const rim = new THREE.DirectionalLight(0x719cda, 1.3);
    rim.position.set(25, 8, -40);
    this.scene.add(ambient, key, rim);
    this.makeBackdrop();
    this.worldGroup = new THREE.Group(); this.scene.add(this.worldGroup);
    this.indicatorGroup = new THREE.Group(); this.scene.add(this.indicatorGroup);
    this.cannonGroup = new THREE.Group(); this.scene.add(this.cannonGroup);
    this.aimGroup = new THREE.Group(); this.scene.add(this.aimGroup);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.bindInput();
    this.resize();
    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    this.frame = requestAnimationFrame(this.loop);
  }

  makeBackdrop() {
    const random = randomGenerator(7293), positions = [], colors = [], sizes = [];
    for (let i = 0; i < 2600; i++) {
      positions.push((random() - .5) * 400, -30 - random() * 80, (random() - .5) * 400);
      const c = .25 + random() * .65;
      colors.push(c * (.7 + random() * .3), c * .9, c);
      sizes.push(.1 + random() * .2);
    }
    const stars = new THREE.BufferGeometry();
    stars.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    stars.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ size: .18, vertexColors: true, transparent: true, opacity: .8, sizeAttenuation: true, depthWrite: false })));
    const grid = new THREE.GridHelper(116, 29, 0x243344, 0x152331);
    grid.position.y = -.2;
    grid.material.transparent = true; grid.material.opacity = .24;
    this.scene.add(grid);
    [14, 28, 43.5].forEach((r, i) => {
      const orbit = circle(r, 0x678195, i === 2 ? .22 : .1, true);
      orbit.scale.z = .925;
      this.scene.add(orbit);
    });
    const center = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -1.1), new THREE.Vector3(0, 0, -.45)]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xa0abb8, transparent: true, opacity: .25 }));
      line.rotation.y = i * Math.PI / 2; center.add(line);
    }
    center.position.set(0, .02, 0); this.scene.add(center);
  }

  setGame(game) {
    this.game = game;
    this.clearGroup(this.worldGroup);
    this.bodyMeshes.clear(); this.labels.replaceChildren();
    for (const body of game.bodies) {
      const group = new THREE.Group();
      group.position.set(body.x, 0, body.z);
      const geometry = body.kind === 'asteroid' ? new THREE.IcosahedronGeometry(body.radius, 3) : new THREE.SphereGeometry(body.radius, 96, 64);
      geometry.rotateY(body.seed * .001);
      geometry.rotateZ(body.kind === 'asteroid' ? body.seed : .12);
      const material = new THREE.MeshStandardMaterial({ color: body.kind === 'asteroid' ? body.color : '#ffffff', map: body.kind === 'planet' ? planetTexture(body) : null, vertexColors: true, roughness: 1, metalness: .03 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.bodyId = body.id;
      group.add(mesh);
      let atmosphere;
      if (body.kind === 'planet') {
        atmosphere = new THREE.Mesh(new THREE.SphereGeometry(body.radius * 1.045, 96, 64), new THREE.ShaderMaterial({
          uniforms: { glowColor: { value: new THREE.Color(body.color).lerp(new THREE.Color('#90c6f3'), .3) } },
          vertexShader: 'varying vec3 vNormal; varying vec3 vView; void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vNormal=normalize(normalMatrix*normal);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
          fragmentShader: 'uniform vec3 glowColor; varying vec3 vNormal; varying vec3 vView; void main(){float rim=pow(1.0-max(0.0,dot(normalize(vNormal),normalize(vView))),4.0);gl_FragColor=vec4(glowColor,rim*0.24);}',
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        group.add(atmosphere);
      }
      if (body.ring) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(body.radius * 1.35, body.radius * 1.91, 100), new THREE.ShaderMaterial({
          vertexShader: 'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
          fragmentShader: 'varying vec3 p;void main(){float r=length(p.xy);float band=.35+.35*sin(r*32.0)+.12*sin(r*71.0);gl_FragColor=vec4(.69,.62,.5,band*.46);}',
          transparent: true, side: THREE.DoubleSide, depthWrite: false,
        }));
        ring.rotation.x = -Math.PI / 2 + .16; ring.rotation.y = .16;
        group.add(ring);
      }
      group.visible = body.hp > 0;
      this.worldGroup.add(group);
      const label = document.createElement('div');
      label.className = `planet-label ${body.edge ? 'edge' : ''}`;
      label.innerHTML = `<span class="planet-name">${body.name}</span><span class="planet-detail">${body.edge ? 'VNĚJŠÍ ORBITA' : `${Math.round(body.mass)} M⊕`}</span>`;
      if (body.kind === 'asteroid') label.hidden = true;
      this.labels.append(label);
      this.bodyMeshes.set(body.id, { group, mesh, atmosphere, label, body, craterCount: -1 });
    }
    this.updateIndicators();
    this.updateCannons();
  }

  clearGroup(group) {
    while (group.children.length) {
      const child = group.children[0]; group.remove(child);
      child.traverse(node => {
        node.geometry?.dispose();
        if (node.material) {
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach(m => { m.map?.dispose(); m.dispose(); });
        }
      });
    }
  }

  updateIndicators(selected = this.selected) {
    this.selected = selected;
    this.clearGroup(this.indicatorGroup);
    this.updateSurfaces();
    for (const { body, group, mesh, label } of this.bodyMeshes.values()) {
      group.visible = body.hp > 0;
      const owner = this.game.players.findIndex(p => p.home === body.id);
      const eligible = isSelectable(this.game, body);
      const selectedBody = selected === body.id;
      label.classList.toggle('eligible', eligible);
      label.classList.toggle('chosen', selectedBody);
      label.classList.toggle('owned', owner >= 0);
      const active = owner === this.game.activePlayer && this.game.phase !== 'setup' && this.game.phase !== 'gameover';
      label.classList.toggle('active-home', active);
      label.querySelector('.planet-detail').textContent = active ? 'NA TAHU' : body.edge ? 'VNĚJŠÍ ORBITA' : `${Math.round(body.mass)} M⊕`;
      label.style.setProperty('--label-color', owner >= 0 ? this.game.players[owner].color : this.game.setupPlayer === 1 ? '#efa47f' : '#81d9e8');
      const disabled = this.game.phase === 'setup' && body.edge && !eligible && owner < 0;
      label.classList.toggle('ineligible', disabled);
      mesh.material.emissive = new THREE.Color(selectedBody ? '#243944' : '#000000');
      if (body.hp <= 0) continue;
      if (eligible || owner >= 0 || selectedBody) {
        const color = owner >= 0 ? this.game.players[owner].color : this.game.setupPlayer === 1 ? '#efa47f' : '#81d9e8';
        const ring = circle(body.radius + (selectedBody ? 1.2 : .7), color, selectedBody || owner >= 0 ? .85 : .3, !selectedBody && owner < 0);
        ring.position.set(body.x, .04, body.z);
        this.indicatorGroup.add(ring);
        if (active) {
          const beacon = circle(body.radius + 1.5, color, .75, true);
          beacon.position.copy(ring.position); this.indicatorGroup.add(beacon);
        }
        if (selectedBody) {
          const outer = circle(body.radius + 1.7, color, .17); outer.position.copy(ring.position); this.indicatorGroup.add(outer);
        }
      }
    }
  }

  updateSurfaces() {
    for (const entry of this.bodyMeshes.values()) {
      const { body, mesh, atmosphere } = entry;
      const count = body.craters?.length || 0;
      if (entry.craterCount === count) continue;
      entry.craterCount = count;
      for (const object of [mesh, atmosphere].filter(Boolean)) {
        const geometry = object.geometry, position = geometry.attributes.position;
        geometry.userData.originalPositions ??= position.array.slice();
        const original = geometry.userData.originalPositions;
        const colors = new Float32Array(position.count * 3);
        for (let i = 0; i < position.count; i++) {
          const x = original[i * 3], y = original[i * 3 + 1], z = original[i * 3 + 2];
          const horizontal = Math.hypot(x, z), shellScale = Math.hypot(x, y, z) / body.radius;
          const radius = surfaceRadius(body, x / (horizontal || 1), 0, z / (horizontal || 1));
          // Carry the 2D collision contour through the sphere's height, so missing
          // terrain is visible from above as well as from the side of the planet.
          const scale = horizontal > 0 ? Math.min(1, radius * shellScale / horizontal) : 1;
          position.setXYZ(i, x * scale, y, z * scale);
          const shade = Math.max(.28, 1 - (1 - scale) * 2.2);
          colors.set([shade, shade * (scale < .99 ? .86 : 1), shade * (scale < .99 ? .78 : 1)], i * 3);
        }
        position.needsUpdate = true;
        if (object === mesh) geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.computeVertexNormals(); geometry.computeBoundingSphere();
      }
    }
  }

  updateCannons() {
    this.clearGroup(this.cannonGroup); this.cannons = [];
    this.game.players.forEach((p, i) => {
      if (!p.home) return;
      const home = homeBody(this.game, p), radius = home?.hp > 0 ? surfaceRadius(home, Math.cos(p.angle), 0, Math.sin(p.angle)) : .7;
      const root = new THREE.Group();
      root.position.set(p.x, home?.hp > 0 ? .5 : 0, p.z);
      root.rotation.y = -p.angle;
      const mount = new THREE.Group(); mount.position.x = radius + .1;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.55, .7, .45, 12), new THREE.MeshStandardMaterial({ color: '#8b9fac', metalness: .7, roughness: .3 }));
      const turret = new THREE.Mesh(new THREE.BoxGeometry(.7, .5, .8), new THREE.MeshStandardMaterial({ color: p.color, emissive: p.color, emissiveIntensity: .2, metalness: .6, roughness: .4 }));
      turret.position.y = .45;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.13, .19, 1.35, 12), new THREE.MeshStandardMaterial({ color: '#e3e6e5', metalness: .8, roughness: .2 }));
      barrel.rotation.z = -Math.PI / 2; barrel.position.set(.8, .5, 0);
      const light = new THREE.Mesh(new THREE.SphereGeometry(.18, 12, 8), new THREE.MeshBasicMaterial({ color: p.color }));
      light.position.set(1.44, .5, 0);
      mount.add(base, turret, barrel, light); root.add(mount);
      if (p.shield > 0) {
        const shield = new THREE.Mesh(new THREE.SphereGeometry(radius + .45, 32, 16), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: .08, wireframe: true }));
        root.add(shield);
      }
      const beacon = circle(radius + .7, p.color, i === this.game.activePlayer ? .9 : .5);
      root.add(beacon);
      this.cannonGroup.add(root); this.cannons[i] = root;
    });
  }

  setPreview(paths, color) {
    this.clearGroup(this.aimGroup);
    for (const { path, hit } of paths) {
      const geo = new THREE.BufferGeometry().setFromPoints(path.map(p => new THREE.Vector3(p.x, .3, p.z)));
      const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color, transparent: true, opacity: .72, dashSize: .35, gapSize: .25, depthTest: false }));
      line.computeLineDistances(); this.aimGroup.add(line);
      if (hit && hit.type !== 'miss') {
        const cross = circle(.55, color, .85); cross.position.set(hit.x, .35, hit.z); this.aimGroup.add(cross);
      }
    }
    this.cannons.forEach((c, i) => { if (c) c.rotation.y = -this.game.players[i].angle; });
  }

  clearPreview() { this.clearGroup(this.aimGroup); }

  addProjectile(projectile) {
    const color = WEAPONS[projectile.weapon].color;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(.2, 12, 8), new THREE.MeshBasicMaterial({ color }));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(.46, 12, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .16, depthWrite: false, blending: THREE.AdditiveBlending }));
    mesh.add(glow);
    const trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .55 }));
    this.scene.add(mesh, trail);
    this.shots.push({ projectile, mesh, trail, points: [] });
  }

  clearProjectiles() {
    this.shots.forEach(s => { this.scene.remove(s.mesh, s.trail); s.mesh.geometry.dispose(); s.mesh.material.dispose(); s.mesh.children.forEach(n => { n.geometry.dispose(); n.material.dispose(); }); s.trail.geometry.dispose(); s.trail.material.dispose(); });
    this.shots = [];
  }

  explode(x, z, radius, color, destroyed) {
    const group = new THREE.Group(); group.position.set(x, .3, z);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .6, depthWrite: false, blending: THREE.AdditiveBlending }));
    group.add(shell);
    const ring = circle(1, color, .9); group.add(ring);
    const debris = [];
    for (let i = 0; i < (destroyed ? 36 : 18); i++) {
      const mesh = new THREE.Mesh(new THREE.TetrahedronGeometry(.12 + Math.random() * .16), new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? '#e3c49d' : color, transparent: true, opacity: .9 }));
      const a = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * radius * 1.5;
      debris.push({ mesh, vx: Math.cos(a) * speed, vy: Math.random() * 3, vz: Math.sin(a) * speed }); group.add(mesh);
    }
    this.scene.add(group);
    this.effects.push({ group, shell, ring, debris, age: 0, radius });
    this.updateIndicators(); this.updateCannons();
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.width = w; this.height = h;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.updateCamera();
  }

  updateCamera() {
    const narrow = Math.max(1, 1.17 / (this.camera.aspect || 1));
    const d = this.distance * narrow;
    this.camera.position.set(Math.sin(this.azimuth) * Math.sin(this.tilt) * d, Math.cos(this.tilt) * d, Math.cos(this.azimuth) * Math.sin(this.tilt) * d);
    this.camera.up.set(Math.sin(this.azimuth), 0, Math.cos(this.azimuth));
    this.camera.lookAt(0, 0, 0);
    this.callbacks.onCamera?.(Math.round(116 / this.distance * 100));
  }

  zoom(factor) { this.distance = THREE.MathUtils.clamp(this.distance * factor, 62, 190); this.updateCamera(); }
  rotate(delta) { this.azimuth += delta; this.updateCamera(); }
  resetCamera() { this.distance = 116; this.azimuth = 0; this.tilt = .28; this.updateCamera(); }

  pointerRay(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  bindInput() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.zoom(Math.exp(e.deltaY * .001)); }, { passive: false });
    const aim = (e, adjustPower, commit) => {
      this.pointerRay(e);
      if (this.raycaster.ray.intersectPlane(plane, tmp)) this.callbacks.onAim?.(tmp.x, tmp.z, adjustPower, commit);
    };
    canvas.addEventListener('pointerdown', e => {
      if (this.drag || !this.game || (e.button !== 0 && e.button !== 2) || this.callbacks.canInput?.() === false) return;
      e.preventDefault();
      this.drag = { id: e.pointerId, button: e.button, player: this.game.activePlayer, phase: this.game.phase, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false };
      this.callbacks.onHover?.(null);
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      if (this.drag) {
        if (e.pointerId !== this.drag.id) return;
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
        if (Math.hypot(e.clientX - this.drag.startX, e.clientY - this.drag.startY) > 5) this.drag.moved = true;
        if (this.drag.moved && this.callbacks.canInput?.() !== false) {
          if (this.drag.button === 2) {
            this.azimuth -= dx * .006;
            this.tilt = THREE.MathUtils.clamp(this.tilt + dy * .004, .025, 1.43);
            this.updateCamera();
          } else if (this.game.phase === 'aim' && this.drag.phase === 'aim' && this.drag.player === this.game.activePlayer) aim(e, true, false);
        }
        this.drag.x = e.clientX; this.drag.y = e.clientY;
        canvas.style.cursor = this.drag.button === 2 ? 'grabbing' : 'crosshair';
        return;
      }
      if (!this.game) return;
      this.pointerRay(e);
      const hits = this.raycaster.intersectObjects([...this.bodyMeshes.values()].filter(b => b.body.hp > 0).map(b => b.mesh));
      const body = hits[0] ? this.bodyMeshes.get(hits[0].object.userData.bodyId)?.body : null;
      canvas.style.cursor = body && isSelectable(this.game, body) ? 'pointer' : this.game.phase === 'aim' ? 'crosshair' : 'grab';
      this.callbacks.onHover?.(body, e);
    });
    canvas.addEventListener('pointerup', e => {
      if (!this.drag || e.pointerId !== this.drag.id || e.button !== this.drag.button) return;
      const drag = this.drag;
      this.drag = null; canvas.style.cursor = 'grab';
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (drag.button !== 0 || !this.game || this.callbacks.canInput?.() === false || drag.phase !== this.game.phase || drag.player !== this.game.activePlayer) return;
      this.pointerRay(e);
      if (this.game.phase === 'setup' && !drag.moved) {
        const hits = this.raycaster.intersectObjects([...this.bodyMeshes.values()].filter(b => b.body.hp > 0).map(b => b.mesh));
        if (hits[0]) this.callbacks.onSelect?.(hits[0].object.userData.bodyId);
      } else if (this.game.phase === 'aim') {
        aim(e, drag.moved, true);
      }
    });
    canvas.addEventListener('pointercancel', () => { this.drag = null; });
    canvas.addEventListener('lostpointercapture', () => { this.drag = null; });
    canvas.addEventListener('pointerleave', () => this.callbacks.onHover?.(null));
  }

  loop(now) {
    const dt = Math.min((now - this.lastTime) / 1000, .06); this.lastTime = now;
    this.callbacks.onFrame?.(dt);
    if (this.game) {
      for (const { body, group, mesh, label } of this.bodyMeshes.values()) {
        group.visible = body.hp > 0;
        if (body.kind === 'asteroid') continue;
        tmp.set(body.x, 0, body.z + body.radius + 1).project(this.camera);
        const x = (tmp.x * .5 + .5) * this.width, y = (-tmp.y * .5 + .5) * this.height;
        const visible = body.hp > 0 && tmp.z < 1 && x > 15 && x < this.width - 15 && y > 70 && y < this.height - 50;
        label.hidden = !visible;
        if (visible) label.style.transform = `translate(${x}px,${y}px) translate(-50%,0)`;
      }
    }
    for (const shot of this.shots) {
      const p = shot.projectile;
      shot.mesh.visible = p.alive;
      shot.mesh.position.set(p.x, .5, p.z);
      if (p.alive) {
        shot.points.push(new THREE.Vector3(p.x, .35, p.z));
        if (shot.points.length > 160) shot.points.shift();
        shot.trail.geometry.dispose(); shot.trail.geometry = new THREE.BufferGeometry().setFromPoints(shot.points);
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i]; e.age += dt;
      const t = e.age / 1.3;
      e.shell.scale.setScalar(Math.max(.01, e.radius * Math.min(t * 2, 1)));
      e.shell.material.opacity = Math.max(0, .45 * (1 - t));
      e.ring.scale.setScalar(Math.max(.01, e.radius * t * 1.8));
      e.ring.material.opacity = Math.max(0, .8 * (1 - t));
      e.debris.forEach(d => { d.mesh.position.x += d.vx * dt; d.mesh.position.y += d.vy * dt; d.mesh.position.z += d.vz * dt; d.mesh.material.opacity = Math.max(0, 1 - t); d.mesh.rotation.x += dt * 2; });
      if (t > 1) { this.scene.remove(e.group); this.clearGroup(e.group); this.effects.splice(i, 1); }
    }
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.loop);
  }
}
