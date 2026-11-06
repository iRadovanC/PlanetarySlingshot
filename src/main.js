import './style.css';
import { SpaceScene } from './scene.js';
import { createGame, currentPlayer, isSelectable, selectHome, homeBody, aimAt, WEAPONS, TECH, UPGRADES, buyResearch, researchTech, buyWeapon, buyUpgrade, equipWeapon, previewShot, fire, advanceProjectile, resolveImpact, finishTurn, snapshot, restore, STEP } from './game.js';

const paths = {
  orbit: '<ellipse cx="12" cy="12" rx="11" ry="4.5" transform="rotate(-35 12 12)"/><circle cx="12" cy="12" r="4"/><circle cx="21" cy="6" r="1"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  crosshair: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  rotate: '<path d="M20 7v5h-5M4.5 17a8 8 0 1 0 .5-10"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.2 2.4c-.7.2-.7.9-.7 1.6m0 3v.1"/>',
  sound: '<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 6 6m0-6-6 6"/>',
  shield: '<path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z"/><path d="m8 12 3 3 5-6"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-8l1-8Z"/>',
  repair: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/>',
  flask: '<path d="M9 3h6m-5 0v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M7 15h10"/>',
  flame: '<path d="M12 2c2 6 7 7 7 13a7 7 0 0 1-14 0c0-3 2-5 3-7 0 4 2 4 2 4s3-4 2-10Z"/>',
  drill: '<path d="m4 4 5-2 13 13-7 7L2 9l2-5Zm3 1-3 3m8 0-6 6m11-1-6 6m9-2-4 4"/>',
  layers: '<path d="m12 2 10 6-10 6L2 8l10-6Zm-10 11 10 6 10-6M2 18l10 6 10-6"/>',
  nova: '<path d="m12 1 2.5 7.5L22 6l-5.5 6L22 18l-7.5-2.5L12 23l-2.5-7.5L2 18l5.5-6L2 6l7.5 2.5L12 1Z"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 4v3"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 6v4"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  credit: '<path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z"/><path d="M15 8H9v8h6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  expand: '<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/>',
};
const icon = (name, className = '') => `<svg class="icon ${className}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.orbit}</svg>`;
const $ = selector => document.querySelector(selector);
const escape = str => String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STORE = 'orbital-conflict-save-v1';
let stored;
try { stored = restore(localStorage.getItem(STORE)); } catch { /* Storage may be unavailable in private browsing. */ }
let game = createGame();
let scene, selected = null, projectiles = [], flightAccumulator = 0, settleTime = 0, modal = null;
let soundEnabled = false, audioContext, hitSummary = [], turnKey = '';
let toastTimeout;

$('#app').innerHTML = `
  <header class="topbar">
    <a class="brand" href="#" aria-label="Orbital Conflict — úvod">${icon('orbit')}<span>ORBITAL<span class="brand-secondary">CONFLICT</span></span></a>
    <div class="header-divider"></div><span class="header-caption">GRAVITAČNÍ SOUBOJ</span>
    <div class="header-right"><span class="local-badge"><i></i> HOT SEAT <b>2 HRÁČI</b></span>
    <button class="icon-button" id="sound-btn" title="Zapnout zvuk" aria-label="Zapnout zvuk" aria-pressed="false">${icon('mute')}</button>
    <button class="icon-button" id="help-btn" title="Pravidla hry" aria-label="Pravidla hry">${icon('help')}</button>
    <button class="icon-button" id="new-btn" title="Nová hra" aria-label="Nová hra">${icon('reset')}</button></div>
  </header>
  <main class="workspace">
    <section class="map-panel" aria-label="Herní mapa">
      <div id="space"></div>
      <div class="map-heading"><div class="eyebrow">NEPROZKOUMANÝ SEKTOR <span class="tiny-line"></span> 09</div><h1>Kepler<span>—</span>09</h1><div class="sector-meta"><span class="status-light"></span> GRAVITAČNÍ POLE AKTIVNÍ <span id="body-count">29 TĚLES</span></div></div>
      <div class="map-top-right"><span class="map-mode">${icon('globe')} TAKTICKÝ POHLED</span><span id="map-phase">ROZMÍSTĚNÍ</span></div>
      <div id="turn-flag" class="turn-flag" role="status" aria-live="polite" aria-atomic="true" hidden></div>
      <div class="map-compass"><span>N</span><div>✦</div><span>SEKTOR 09</span></div>
      <div class="camera-toolbar" aria-label="Ovládání mapy">
        <button class="icon-button" id="zoom-in" title="Přiblížit" aria-label="Přiblížit">${icon('plus')}</button>
        <span id="zoom-level">100%</span>
        <button class="icon-button" id="zoom-out" title="Oddálit" aria-label="Oddálit">${icon('minus')}</button>
        <span class="toolbar-separator"></span>
        <button class="icon-button" id="rotate-left" title="Otočit mapu doleva" aria-label="Otočit mapu doleva">${icon('rotate')}</button>
        <button class="icon-button" id="camera-reset" title="Obnovit pohled" aria-label="Obnovit pohled">${icon('expand')}</button>
      </div>
      <div id="map-message" class="map-message"></div>
      <div class="map-help">${icon('mouse')} <span>PRAVÉ TAŽENÍ <b>kamera</b></span><span>KOLEČKO <b>zoom</b></span><span>LEVÉ <b id="click-action">vybrat</b></span></div>
      <div id="body-tooltip" class="body-tooltip" hidden></div>
      <div class="map-vignette"></div>
    </section>
    <aside class="sidebar" id="sidebar" aria-label="Herní ovládání"></aside>
  </main>
  <footer class="statusbar"><span><i></i> LOKÁLNÍ SYSTÉM <b>ONLINE</b></span><span id="footer-status">DVA HRÁČI. JEDEN SEKTOR. ŽÁDNÁ NÁHODA.</span><span>ORBITAL CONFLICT <b>v1.0</b></span></footer>
  <div class="modal-layer" id="modal-layer" hidden></div>
  <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
`;

function save() {
  try { localStorage.setItem(STORE, snapshot(game)); } catch { /* A match still works without storage. */ }
}

function toast(message) {
  clearTimeout(toastTimeout);
  $('#toast').innerHTML = `${icon('orbit')}<span>${escape(message)}</span>`;
  $('#toast').hidden = false;
  toastTimeout = setTimeout(() => { $('#toast').hidden = true; }, 3500);
}

function audio(type) {
  if (!soundEnabled) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.connect(gain); gain.connect(audioContext.destination);
    const time = audioContext.currentTime;
    if (type === 'shot') { oscillator.type = 'sawtooth'; oscillator.frequency.setValueAtTime(220, time); oscillator.frequency.exponentialRampToValueAtTime(45, time + .28); }
    else if (type === 'hit') { oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(85, time); oscillator.frequency.exponentialRampToValueAtTime(22, time + .45); }
    else { oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(520, time); oscillator.frequency.exponentialRampToValueAtTime(780, time + .1); }
    gain.gain.setValueAtTime(type === 'hit' ? .12 : .045, time);
    gain.gain.exponentialRampToValueAtTime(.001, time + .5);
    oscillator.start(); oscillator.stop(time + .5);
  } catch { /* Sound is optional. */ }
}

function render() {
  const p = currentPlayer(game);
  $('#body-count').textContent = `${game.bodies.filter(b => b.hp > 0).length} TĚLES`;
  $('#map-phase').textContent = game.phase === 'setup' ? 'ROZMÍSTĚNÍ' : game.phase === 'gameover' ? 'KONEC SOUBOJE' : `KOLO ${String(game.round).padStart(2, '0')}`;
  $('#click-action').textContent = game.phase === 'setup' ? 'vybrat' : 'směr + síla';
  $('#sidebar').innerHTML = game.phase === 'setup' ? setupPanel() : battlePanel();
  $('#turn-flag').hidden = game.phase === 'setup' || game.phase === 'gameover';
  $('#turn-flag').style.setProperty('--player-color', p.color);
  $('#turn-flag').innerHTML = `<i></i><span><small>${game.phase === 'flight' ? 'PROJEKTIL V LETU' : 'NA TAHU'}</small><strong>${escape(p.name).toUpperCase()}</strong><small>${p.callsign} · KOLO ${game.round}</small></span>`;
  const nextTurnKey = `${game.seed}:${game.round}:${game.activePlayer}`;
  if (game.phase === 'aim' && turnKey !== nextTurnKey) {
    turnKey = nextTurnKey;
    $('#turn-flag').getAnimations().forEach(animation => animation.cancel());
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) $('#turn-flag').animate([{ opacity: .35, transform: 'translateX(-8px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 550 });
  }
  $('#sidebar').style.setProperty('--player-color', p.color);
  $('#sidebar').classList.toggle('has-turn', game.phase === 'aim');
  $('#map-message').innerHTML = mapMessage();
  $('#footer-status').textContent = game.phase === 'setup' ? 'DVA HRÁČI. JEDEN SEKTOR. ŽÁDNÁ NÁHODA.' : game.log.at(-1).toUpperCase();
  scene?.updateIndicators(selected); scene?.updateCannons();
  updatePreview();
  bindPanel();
}

function setupPanel() {
  const player = game.players[game.setupPlayer];
  const body = game.bodies.find(b => b.id === selected);
  const eligible = game.bodies.filter(b => isSelectable(game, b));
  return `
    <div class="sidebar-scroll setup-scroll" style="--player-color:${player.color}">
      <div class="panel-eyebrow"><span>PŘÍPRAVA SOUBOJE</span><span>01 — 02</span></div>
      <div class="setup-steps"><div class="setup-step ${game.setupPlayer === 0 ? 'active' : 'complete'}">${game.setupPlayer > 0 ? icon('check') : '01'}</div><span></span><div class="setup-step ${game.setupPlayer === 1 ? 'active' : ''}">02</div><small>ROZMÍSTĚNÍ<br>ZÁKLADEN</small></div>
      <div class="player-tag"><i></i>${player.name.toUpperCase()} <span>${player.callsign}</span></div>
      <h2>Vyber domovskou<br><em>planetu.</em></h2>
      <p class="panel-intro">${game.setupPlayer === 0 ? 'Tvůj první strategický tah. Založ základnu na jedné z planet na vnější orbitě.' : 'Soupeř už obsadil svou planetu. Vyber základnu na přibližně opačné straně sektoru.'}</p>
      <div class="selected-planet ${body ? 'has-selection' : ''}">
        ${body ? `<div class="mini-planet" style="--planet-color:${body.color}"></div><div><span class="eyebrow">VYBRANÁ ZÁKLADNA</span><strong>${body.name}</strong><span class="selection-stats">${Math.round(body.mass)} M⊕ <i>·</i> ${body.hp} integrita</span></div>${icon('check', 'selection-check')}` : `<div class="empty-orbit">${icon('orbit')}</div><div><strong>Čeká na souřadnice</strong><span>Klikni na zvýrazněnou planetu</span></div>`}
      </div>
      <button class="primary-button" id="confirm-home" ${!body ? 'disabled' : ''}>Potvrdit planetu ${icon('arrow')}</button>
      <div class="section-label"><span>DOSTUPNÉ PLANETY</span><span>${eligible.length} / 8</span></div>
      <div class="planet-options">${eligible.map(b => `<button class="planet-option ${b.id === selected ? 'selected' : ''}" data-planet="${b.id}"><i style="--planet-color:${b.color}"></i>${b.name}${b.id === selected ? icon('check') : ''}</button>`).join('')}</div>
      <div class="setup-note">${icon('shield')}<p>Oba velitelé začínají se <b>100 životy</b> a <b>100 kredity</b>. Každé další kolo přinese dalších 100 kreditů.</p></div>
    </div>
    <div class="sidebar-bottom">${icon('orbit')} <span>Gravitace je tvoje nejsilnější zbraň.</span></div>`;
}

function playerCard(player, i) {
  const home = homeBody(game, player);
  return `<div class="combat-player ${game.activePlayer === i ? 'is-active' : ''}" style="--player-color:${player.color}">
    ${game.activePlayer === i && game.phase !== 'gameover' ? `<div class="player-turn-label">${game.phase === 'flight' ? 'PROJEKTIL V LETU' : 'NA TAHU'} · ${player.callsign}</div>` : ''}
    <div class="player-card-top"><span><i></i>${player.name.toUpperCase()}</span><small>${home?.hp > 0 ? home.name.toUpperCase() : 'ORBITÁLNÍ STANICE'}</small><b>${player.hp}<small>/100</small></b></div>
    <div class="health-track"><span style="width:${player.hp}%"></span></div>
    ${player.shield ? `<div class="shield-info">${icon('shield')} Štít ${player.shield} / 70</div>` : ''}
  </div>`;
}

function battlePanel() {
  const p = currentPlayer(game), weapon = WEAPONS[p.weapon], aiming = game.phase === 'aim';
  return `<div class="sidebar-scroll battle-scroll" style="--player-color:${p.color}">
    <div class="panel-eyebrow"><span>VELITELSKÝ PANEL</span><span>KOLO ${String(game.round).padStart(2, '0')}</span></div>
    <div class="combat-players">${game.players.map(playerCard).join('<div class="versus">VS</div>')}</div>
    <div class="wallet"><div>${icon('credit')}<strong>${p.credits}</strong><span>KREDITŮ</span></div><small>+100 / kolo</small></div>
    <div class="panel-actions"><button id="arsenal-btn" ${!aiming ? 'disabled' : ''}>${icon('layers')} Arzenál <span>${icon('chevron')}</span></button><button id="research-btn" ${!aiming ? 'disabled' : ''}>${icon('flask')} Výzkum <span class="research-count">${p.research}</span></button></div>
    <div class="section-label"><span>AKTIVNÍ ZBRAŇ</span><span>${p.boost ? 'VÝKON +35 %' : '01 VÝSTŘEL'}</span></div>
    <button class="active-weapon" id="weapon-open" ${!aiming ? 'disabled' : ''}><span class="weapon-icon" style="--weapon-color:${weapon.color}">${icon(weapon.icon)}</span><span><strong>${weapon.name}</strong><small>${weapon.damage} poškození <i>·</i> ${p.weapon === 'kinetic' ? 'neomezená munice' : `${p.inventory[p.weapon] || 0} ks`}</small></span>${icon('chevron')}</button>
    <div class="aim-controls ${!aiming ? 'inactive-controls' : ''}">
      <p class="aim-help">Levým tažením nastav směr i sílu. Dál od kanónu = větší síla. Kliknutí změní jen směr.</p>
      <label class="slider-label" for="angle"><span>SMĚR STŘELBY</span><output id="angle-value">${degrees(p.angle)}<small>°</small></output></label>
      <input aria-label="Směr střelby ve stupních" id="angle" type="range" min="0" max="359" step="1" value="${degrees(p.angle)}" ${!aiming ? 'disabled' : ''} />
      <div class="range-ticks"><span>0°</span><span>90°</span><span>180°</span><span>270°</span><span>359°</span></div>
      <label class="slider-label power-label" for="power"><span>SÍLA VÝSTŘELU</span><output id="power-value">${p.power}<small>%</small></output></label>
      <input aria-label="Síla výstřelu v procentech" id="power" class="power-slider" type="range" min="10" max="100" value="${p.power}" ${!aiming ? 'disabled' : ''} />
      <div class="range-ticks"><span>10 %</span><span>100 %</span></div>
    </div>
    <div class="trajectory-info">${icon('crosshair')}<span>${p.tech.includes('navigation') ? 'Úplná předpověď trajektorie' : 'Náhled prvních 1,1 s letu'}</span><i class="status-light"></i></div>
    <button class="primary-button fire-button" id="fire-btn" ${!aiming ? 'disabled' : ''}>${icon('crosshair')}${game.phase === 'flight' ? 'Projektil v letu…' : 'Vystřelit'}<span>${icon('arrow')}</span></button>
    ${game.phase === 'flight' ? '<button class="fast-forward" id="fast-forward">Zrychlit let <b>× 4</b></button>' : '<p class="fire-note">Výstřelem ukončíš svůj tah.</p>'}
  </div><div class="sidebar-bottom"><span class="status-light"></span><span>${aiming ? 'Levým tažením: směr a síla' : 'Probíhá taktický souboj'}</span><button class="log-button" id="log-btn" title="Záznam souboje">ZÁZNAM</button></div>`;
}

function degrees(angle) { return (Math.round(angle * 180 / Math.PI) % 360 + 360) % 360; }

function mapMessage() {
  if (game.phase === 'setup') return `<div class="map-message-number">0${game.setupPlayer + 1}</div><div><span class="eyebrow">${game.setupPlayer === 0 ? 'TVŮJ SEKTOR. TVÁ VOLBA.' : 'NA OPAČNÉ STRANĚ.'}</span><strong>${game.setupPlayer === 0 ? 'Najdi svou výchozí orbitu.' : 'Najdi místo pro druhou základnu.'}</strong><span class="map-message-detail">${game.setupPlayer === 0 ? 'Zvýrazněné planety jsou připravené k osídlení.' : 'Dostupné jsou jen planety naproti soupeři.'}</span></div>`;
  if (game.phase === 'flight') return `<div class="map-message-number">${icon('orbit')}</div><div><span class="eyebrow">BALISTICKÁ TELEMETRIE</span><strong>Gravitace přebírá kontrolu.</strong><span class="map-message-detail" id="flight-telemetry">Výpočet dráhy projektilu…</span></div>`;
  return `<div class="map-message-number">${icon('crosshair')}</div><div><span class="eyebrow">${currentPlayer(game).name.toUpperCase()} · ${currentPlayer(game).callsign} · NA TAHU</span><strong>Využij sílu gravitace.</strong><span class="map-message-detail">Levým tažením nastav směr i sílu. Pravým otáčej kameru.</span></div>`;
}

function bindPanel() {
  document.querySelectorAll('[data-planet]').forEach(button => button.onclick = () => choosePlanet(button.dataset.planet));
  const confirm = $('#confirm-home');
  if (confirm) confirm.onclick = () => {
    if (!selected || !selectHome(game, selected)) return;
    audio('click'); selected = null; save(); render();
  };
  if ($('#angle')) $('#angle').oninput = e => {
    currentPlayer(game).angle = Number(e.target.value) * Math.PI / 180;
    $('#angle-value').innerHTML = `${e.target.value}<small>°</small>`;
    updateRangePaint(); updatePreview(); save();
  };
  if ($('#power')) $('#power').oninput = e => {
    currentPlayer(game).power = Number(e.target.value);
    $('#power-value').innerHTML = `${e.target.value}<small>%</small>`;
    updateRangePaint(); updatePreview(); save();
  };
  if ($('#fire-btn')) $('#fire-btn').onclick = shoot;
  if ($('#arsenal-btn')) $('#arsenal-btn').onclick = () => openArsenal();
  if ($('#weapon-open')) $('#weapon-open').onclick = () => openArsenal();
  if ($('#research-btn')) $('#research-btn').onclick = () => openResearch();
  if ($('#log-btn')) $('#log-btn').onclick = () => openLog();
  if ($('#fast-forward')) $('#fast-forward').onclick = e => {
    fastFlight = !fastFlight; e.currentTarget.innerHTML = fastFlight ? 'Normální rychlost <b>× 1</b>' : 'Zrychlit let <b>× 4</b>';
  };
  updateRangePaint();
}

function updateRangePaint() {
  document.querySelectorAll('input[type="range"]').forEach(input => {
    const percent = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
    input.style.setProperty('--range-fill', `${percent}%`);
  });
}

function choosePlanet(id) {
  const body = game.bodies.find(b => b.id === id);
  if (!body || !isSelectable(game, body)) { toast('Vyber zvýrazněnou planetu na povolené vnější orbitě.'); return; }
  selected = id; audio('click'); render();
}

function updatePreview() {
  if (!scene) return;
  if (game.phase !== 'aim' || modal) { scene.clearPreview(); return; }
  const p = currentPlayer(game);
  scene.setPreview(previewShot(game, p.tech.includes('navigation')), p.color);
}

let fastFlight = false;
function shoot() {
  if (game.phase !== 'aim' || modal) return;
  save();
  projectiles = fire(game);
  if (!projectiles) return;
  flightAccumulator = 0; settleTime = 0; fastFlight = false; hitSummary = [];
  scene.clearPreview(); scene.clearProjectiles();
  projectiles.forEach(p => scene.addProjectile(p));
  audio('shot'); render();
}

function frame(dt) {
  if (game.phase !== 'flight') return;
  flightAccumulator += dt * (fastFlight ? 12 : 3);
  while (flightAccumulator >= STEP && projectiles.some(p => p.alive)) {
    for (const p of projectiles) {
      if (!p.alive) continue;
      const result = advanceProjectile(p, game);
      if (result) {
        const impact = resolveImpact(game, p);
        if (!impact.miss) {
          scene.explode(p.x, p.z, WEAPONS[p.weapon].blast, WEAPONS[p.weapon].color, impact.destroyed.length > 0);
          audio('hit');
          hitSummary.push(...impact.damage.map(d => `${game.players[d.player].name}: −${d.amount} ŽV${d.shield ? ` / štít −${d.shield}` : ''}`));
          impact.destroyed.forEach(id => hitSummary.push(`Zničeno těleso: ${game.bodies.find(b => b.id === id).name}`));
          impact.bodyDamage.filter(d => !impact.destroyed.includes(d.id)).forEach(d => hitSummary.push(`${game.bodies.find(b => b.id === d.id).name}: hmota −${d.massLost.toFixed(1)} M⊕`));
        }
      }
    }
    flightAccumulator -= STEP;
  }
  const telemetry = $('#flight-telemetry');
  if (telemetry && projectiles[0]) {
    const p = projectiles[0];
    telemetry.textContent = `Čas ${p.age.toFixed(1)} s · rychlost ${Math.hypot(p.vx, p.vz).toFixed(1)} km/s · ${hitSummary.at(-1) || 'projektil aktivní'}`;
  }
  if (projectiles.every(p => !p.alive)) {
    settleTime += dt;
    if (settleTime > 1.35) {
      if (!hitSummary.length) { hitSummary.push('Projektil minul cíl a opustil sektor.'); game.log.push('Výstřel bez zásahu.'); }
      finishTurn(game); save(); render();
      if (game.phase === 'gameover') showVictory();
      else { scene.clearProjectiles(); toast(`${currentPlayer(game).name} je na tahu. ${hitSummary.join(' · ')}`); }
    }
  }
}

let modalReturnFocus;
function setModal(content, className = '', closable = true) {
  if (!modal) modalReturnFocus = document.activeElement;
  modal = className || 'dialog';
  const layer = $('#modal-layer');
  layer.hidden = false;
  layer.innerHTML = `<section class="modal ${className}" role="dialog" aria-modal="true" aria-labelledby="modal-title">${closable ? `<button class="icon-button modal-close" id="modal-close" aria-label="Zavřít">${icon('close')}</button>` : ''}${content}</section>`;
  if ($('#modal-close')) $('#modal-close').onclick = closeModal;
  layer.onclick = e => { if (e.target === layer && closable) closeModal(); };
  updatePreview();
  requestAnimationFrame(() => layer.querySelector('button:not([disabled])')?.focus());
}

function closeModal() {
  if (modal === 'victory-modal') return;
  modal = null; $('#modal-layer').hidden = true; $('#modal-layer').replaceChildren();
  updatePreview();
  if (modalReturnFocus?.isConnected) modalReturnFocus.focus();
}

function openArsenal(tab = 'weapons') {
  if (game.phase !== 'aim') return;
  const p = currentPlayer(game);
  const items = tab === 'weapons' ? Object.entries(WEAPONS) : Object.entries(UPGRADES);
  const html = items.map(([id, item]) => {
    const locked = item.tech && !p.tech.includes(item.tech);
    const count = id === 'kinetic' ? '∞' : p.inventory[id] || 0;
    const equipped = p.weapon === id && tab === 'weapons';
    const used = tab === 'upgrades' && ((id === 'repair' && p.hp >= 100) || (id === 'shield' && p.shield >= 70) || (id === 'boost' && p.boost));
    return `<article class="shop-item ${locked ? 'locked-item' : ''}"><div class="shop-item-icon" style="--weapon-color:${item.color || '#9ab5c9'}">${icon(item.icon)}</div><div class="shop-item-content"><div class="item-title"><h3>${item.name}</h3>${locked ? `${icon('lock')}<small>VÝZKUM</small>` : tab === 'weapons' ? `<small>ZÁSOBA ${count}</small>` : ''}</div><p>${item.description}</p><div class="item-stats">${tab === 'weapons' ? `<span>${item.damage} ŽV</span><span>${item.terrain} TĚLESŮM</span><span>${item.blast} km DOSAH EXPLOZE</span>` : `<span>${item.tech ? TECH[item.tech].name.toUpperCase() : 'ZÁKLADNÍ VYBAVENÍ'}</span>`}</div></div><div class="shop-item-actions">${locked ? `<button class="secondary-button" data-goto-research="${item.tech}">${icon('flask')} Vyvinout</button>` : tab === 'weapons' ? `${id !== 'kinetic' ? `<button class="buy-button" data-buy-weapon="${id}" ${p.credits < item.cost ? 'disabled' : ''}>${item.cost} kr ${icon('plus')}</button>` : '<span class="free-label">ZDARMA</span>'}<button class="equip-button ${equipped ? 'equipped' : ''}" data-equip="${id}" ${count === 0 || equipped ? 'disabled' : ''}>${equipped ? `${icon('check')} Vybráno` : 'Vybavit'}</button>` : `<button class="buy-button" data-upgrade="${id}" ${p.credits < item.cost || used ? 'disabled' : ''}>${used ? 'Aktivní / plné' : `${item.cost} kr ${icon('plus')}`}</button>`}</div></article>`;
  }).join('');
  setModal(`<div class="eyebrow">ZÁSOBOVACÍ STANICE</div><div class="modal-heading"><h2 id="modal-title">Arzenál<span>.</span></h2><div class="modal-balance">${icon('credit')} ${p.credits}<small>KREDITŮ</small></div></div><p class="modal-intro">Nakup munici na další výstřely. Vybavení se aktivuje okamžitě.</p><div class="modal-tabs"><button class="${tab === 'weapons' ? 'active' : ''}" data-shop-tab="weapons">${icon('crosshair')} Zbraně</button><button class="${tab === 'upgrades' ? 'active' : ''}" data-shop-tab="upgrades">${icon('shield')} Vybavení</button></div><div class="shop-items">${html}</div><div class="shop-footer">${icon('flask')} Pokročilý arzenál nejprve odemkni ve výzkumu.<button id="shop-research">Otevřít výzkum ${icon('arrow')}</button></div>`, 'shop-modal');
  document.querySelectorAll('[data-shop-tab]').forEach(b => b.onclick = () => openArsenal(b.dataset.shopTab));
  document.querySelectorAll('[data-buy-weapon]').forEach(b => b.onclick = () => { if (buyWeapon(game, b.dataset.buyWeapon)) { audio('click'); save(); render(); openArsenal(tab); } });
  document.querySelectorAll('[data-equip]').forEach(b => b.onclick = () => { if (equipWeapon(game, b.dataset.equip)) { save(); render(); closeModal(); toast(`Zbraň připravena: ${WEAPONS[b.dataset.equip].name}.`); } });
  document.querySelectorAll('[data-upgrade]').forEach(b => b.onclick = () => { if (buyUpgrade(game, b.dataset.upgrade)) { audio('click'); save(); render(); openArsenal(tab); toast(`Vybavení aktivováno: ${UPGRADES[b.dataset.upgrade].name}.`); } });
  document.querySelectorAll('[data-goto-research]').forEach(b => b.onclick = () => openResearch());
  $('#shop-research').onclick = () => openResearch();
}

function openResearch() {
  if (game.phase !== 'aim') return;
  const p = currentPlayer(game);
  const techCard = id => {
    const tech = TECH[id], done = p.tech.includes(id), blocked = !tech.requires.every(r => p.tech.includes(r));
    return `<article class="tech-card ${done ? 'researched' : ''} ${blocked ? 'blocked' : ''}"><div class="tech-card-top">${icon(tech.icon)}<span>${done ? 'DOKONČENO' : blocked ? 'ZAMČENO' : 'DOSTUPNÉ'}</span>${done ? icon('check') : blocked ? icon('lock') : `<b>${tech.cost} BV</b>`}</div><h3>${tech.name}</h3><p>${tech.description}</p><button class="secondary-button" data-tech="${id}" ${done || blocked || p.research < tech.cost ? 'disabled' : ''}>${done ? 'Vyvinuto' : blocked ? `Vyžaduje: ${TECH[tech.requires[0]].name}` : `Vyvinout · ${tech.cost} BV`}${!done && !blocked ? icon('arrow') : ''}</button></article>`;
  };
  setModal(`<div class="eyebrow">VĚDECKÁ DIVIZE</div><div class="modal-heading"><h2 id="modal-title">Výzkumný strom<span>.</span></h2><div class="modal-balance">${icon('flask')} ${p.research}<small>BODŮ VÝZKUMU</small></div></div><p class="modal-intro">Investuj do příštích kol. Každá technologie platí do konce tohoto souboje.</p><div class="research-exchange"><div>${icon('credit')}<div><strong>${p.credits} kreditů k dispozici</strong><small>25 kreditů = 1 bod výzkumu (BV)</small></div></div><button class="buy-button" id="buy-rp" ${p.credits < 25 ? 'disabled' : ''}>1 BV <span>25 kr</span>${icon('plus')}</button><button class="buy-button" id="buy-rp-four" ${p.credits < 100 ? 'disabled' : ''}>4 BV <span>100 kr</span>${icon('plus')}</button></div><div class="tech-tree"><div class="tech-branch"><div class="section-label"><span>01 / ZBRAŇOVÉ SYSTÉMY</span></div>${techCard('plasma')}<div class="tech-connector"></div>${techCard('cluster')}<div class="tech-connector"></div>${techCard('nova')}</div><div class="tech-branch"><div class="section-label"><span>02 / TECHNOLOGIE</span></div>${techCard('mining')}<div class="tech-connector"></div>${techCard('navigation')}<div class="section-label defense-label"><span>03 / OBRANNÉ SYSTÉMY</span></div>${techCard('defense')}</div></div><div class="shop-footer">${icon('orbit')} Výzkum je samostatný pro každého hráče.<button id="research-shop">Do arzenálu ${icon('arrow')}</button></div>`, 'research-modal');
  $('#buy-rp').onclick = () => { if (buyResearch(game)) { audio('click'); save(); render(); openResearch(); } };
  $('#buy-rp-four').onclick = () => { if (buyResearch(game, 4)) { audio('click'); save(); render(); openResearch(); } };
  document.querySelectorAll('[data-tech]').forEach(b => b.onclick = () => { if (researchTech(game, b.dataset.tech)) { audio('click'); save(); render(); openResearch(); toast(`${TECH[b.dataset.tech].name}: výzkum dokončen.`); } });
  $('#research-shop').onclick = () => openArsenal();
}

function openHelp() {
  setModal(`<div class="eyebrow">LETOVÁ PŘÍRUČKA / 01</div><h2 id="modal-title">Ovládni orbitu<span>.</span></h2><p class="modal-intro">Tahový dělostřelecký souboj pro dva velitele na jednom počítači.</p><div class="help-grid"><article><b>01</b><h3>Zvol základnu</h3><p>První hráč vybírá z osmi planet na okraji mapy. Druhý musí zvolit planetu alespoň 129° naproti. Polohu potvrď v panelu.</p></article><article><b>02</b><h3>Zamiř a vystřel</h3><p>Levým tažením do mapy nastav směr i sílu: dál od kanónu znamená silnější výstřel. Kliknutí mění pouze směr. Posuvníky umožňují přesné doladění. Přerušovaná čára ukazuje první 1,1 s skutečné gravitační dráhy. Po výstřelu se hráči automaticky vystřídají. Hráče na tahu poznáš podle barevného panelu a zvýrazněné základny.</p></article><article><b>03</b><h3>Investuj s rozmyslem</h3><p>Na začátku má každý 100 kreditů. Po obou tazích přibude každému dalších 100. Munici kup v Arzenálu, bod výzkumu stojí 25 kreditů. Neutracené kredity zůstávají.</p></article><article><b>04</b><h3>Přetvoř bojiště</h3><p>Každé těleso přitahuje střely i z větší vzdálenosti. Zásahy vykusují povrch a snižují hmotnost i gravitaci, a to i u největších planet. Po zničení jeho gravitace zanikne. Zásah domovské planety zraní i velitele. Zničenou planetu nahradí malá stanice, na kterou lze dál střílet.</p></article></div><div class="help-controls"><span>${icon('mouse')} Levé tažení <b>směr a síla</b></span><span>${icon('rotate')} Pravé tažení <b>rotace a náklon</b></span><span>${icon('plus')} Kolečko <b>přiblížení</b></span></div><div class="help-win">${icon('crosshair')} Sniž soupeřovy životy na nulu. Pozor, můžeš zasáhnout i sebe!</div>`, 'help-modal');
}

function openLog() {
  setModal(`<div class="eyebrow">TELEMETRICKÝ ARCHIV</div><h2 id="modal-title">Záznam souboje<span>.</span></h2><div class="battle-log">${game.log.map((entry, i) => `<div><span>${String(i + 1).padStart(2, '0')}</span><p>${escape(entry)}</p></div>`).join('')}</div>`, 'log-modal');
}

function showVictory() {
  const p = game.players[game.winner];
  setModal(`<div class="handoff-symbol" style="--player-color:${p?.color || '#f0c17b'}">${icon('nova')}</div><div class="eyebrow">SOUBOJ UKONČEN</div><h2 id="modal-title">${p ? `${p.name}<br><em style="color:${p.color}">ovládl sektor.</em>` : 'Vzájemné<br><em>zničení.</em>'}</h2><p>${p ? 'Přesné výpočty. Správná rozhodnutí. Tvá gravitace.' : 'Oba kanóny byly zničeny. Tento sektor nemá vítěze.'}</p><div class="victory-stats"><span><b>${game.round}</b>KOL</span><span><b>${game.totalShots}</b>VÝSTŘELŮ</span><span><b>${game.bodies.filter(b => b.hp <= 0).length}</b>ZNIČENÝCH TĚLES</span></div><button class="primary-button" id="play-again">Nový souboj ${icon('arrow')}</button>`, 'victory-modal', false);
  $('#play-again').onclick = () => resetGame();
}

function confirmNewGame() {
  if (game.phase === 'flight') { toast('Novou hru můžeš založit po dokončení výstřelu.'); return; }
  setModal(`<div class="eyebrow">NOVÁ EXPEDICE</div><h2 id="modal-title">Nový souboj<span>?</span></h2><p class="modal-intro">Aktuální zápas včetně výzkumu se nahradí novou hrou. Planety a asteroidy se znovu vygenerují.</p><div class="confirm-actions"><button class="secondary-button" id="cancel-new">Pokračovat ve hře</button><button class="primary-button" id="confirm-new">Začít znovu ${icon('arrow')}</button></div>`, 'confirm-modal');
  $('#cancel-new').onclick = closeModal;
  $('#confirm-new').onclick = () => resetGame();
}

function resetGame(seed = Math.floor(Math.random() * 1000000)) {
  game = createGame(seed); selected = null; modal = null; projectiles = []; turnKey = '';
  $('#modal-layer').hidden = true; $('#modal-layer').replaceChildren();
  scene.clearProjectiles(); scene.setGame(game); scene.resetCamera(); save(); render();
}

$('.brand').onclick = e => { e.preventDefault(); openHelp(); };
$('#help-btn').onclick = openHelp;
$('#new-btn').onclick = confirmNewGame;
$('#sound-btn').onclick = () => {
  soundEnabled = !soundEnabled;
  $('#sound-btn').innerHTML = icon(soundEnabled ? 'sound' : 'mute');
  $('#sound-btn').title = soundEnabled ? 'Vypnout zvuk' : 'Zapnout zvuk';
  $('#sound-btn').setAttribute('aria-label', $('#sound-btn').title);
  $('#sound-btn').setAttribute('aria-pressed', soundEnabled);
  audio('click');
};
$('#zoom-in').onclick = () => scene?.zoom(.88);
$('#zoom-out').onclick = () => scene?.zoom(1.13);
$('#rotate-left').onclick = () => scene?.rotate(Math.PI / 8);
$('#camera-reset').onclick = () => scene?.resetCamera();

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Tab' && modal) {
    const elements = [...$('#modal-layer').querySelectorAll('button:not([disabled]),a,input:not([disabled])')];
    const first = elements[0], last = elements.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  }
});

try {
  scene = new SpaceScene($('#space'), {
    onSelect: choosePlanet,
    canInput: () => !modal,
    onAim: (x, z, adjustPower = false, commit = true) => {
      if (modal || game.phase !== 'aim') return;
      if (!aimAt(game, x, z, adjustPower)) return;
      const p = currentPlayer(game);
      $('#angle').value = degrees(p.angle);
      $('#angle-value').innerHTML = `${degrees(p.angle)}<small>°</small>`;
      $('#power').value = p.power;
      $('#power-value').innerHTML = `${p.power}<small>%</small>`;
      scene.updateCannons(); updateRangePaint(); updatePreview();
      if (commit) save();
    },
    onCamera: percent => { $('#zoom-level').textContent = `${percent}%`; },
    onFrame: frame,
    onHover: (body, event) => {
      const tooltip = $('#body-tooltip');
      if (!body || modal) { tooltip.hidden = true; return; }
      const rect = $('#space').getBoundingClientRect();
      tooltip.hidden = false;
      const massLost = body.initialMass > 0 ? Math.round((1 - body.mass / body.initialMass) * 100) : 0;
      tooltip.innerHTML = `<strong>${body.name}</strong><span>${body.kind === 'asteroid' ? 'ASTEROID' : 'PLANETA'} · ${Math.round(body.mass)} M⊕${massLost ? ` · hmota −${massLost} %` : ''}</span><span>Integrita ${body.hp} / ${body.maxHp}${body.edge ? ' · vnější orbita' : ''}</span>`;
      tooltip.style.left = `${Math.min(event.clientX - rect.left + 16, rect.width - 200)}px`;
      tooltip.style.top = `${Math.min(event.clientY - rect.top + 16, rect.height - 100)}px`;
    },
  });
  scene.setGame(game);
} catch (error) {
  console.error(error);
  $('#space').innerHTML = '<div class="webgl-error"><h2>3D mapa potřebuje WebGL 2</h2><p>Zapni hardwarovou akceleraci v nastavení prohlížeče a znovu načti stránku.</p><button class="primary-button" onclick="location.reload()">Načíst znovu</button></div>';
}
render();
if (stored && stored.phase !== 'gameover' && (stored.players[0].home || stored.totalShots > 0)) {
  setModal(`<div class="eyebrow">OBNOVENÍ SPOJENÍ</div><h2 id="modal-title">Nedokončený souboj<span>.</span></h2><p class="modal-intro">V tomto prohlížeči je uložen zápas z ${stored.round}. kola. Chceš se vrátit do sektoru?</p><div class="confirm-actions"><button class="secondary-button" id="fresh-match">Nový souboj</button><button class="primary-button" id="resume-match">Pokračovat ${icon('arrow')}</button></div>`, 'confirm-modal', false);
  $('#fresh-match').onclick = () => resetGame(4096);
  $('#resume-match').onclick = () => {
    game = stored; stored = null; modal = null; $('#modal-layer').hidden = true;
    scene?.setGame(game); render();
    save();
  };
}
