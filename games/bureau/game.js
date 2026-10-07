(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const ACID = '#e8f449', RED = '#ff715d', PAPER = '#f5efdf';
  const spriteSheet = new Image();
  spriteSheet.src = 'characters.png';
  const spriteRects = [[0,0,548,512],[548,0,476,512],[1024,0,512,512],[0,512,512,512],[512,512,512,512],[1024,512,512,512]];
  const TAU = Math.PI * 2, keys = new Set();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 1200, H = 760, dpr = 1, clock = 0, lastFrame = 0, uiClock = 0, state = 'menu';
  let player, enemies = [], bullets = [], hostile = [], particles = [], pickups = [], labels = [], rings = [], hazards = [], confetti = [];
  let elapsed = 0, wave = 1, waveTime = 0, spawnTime = 0, score = 0, kills = 0, charge = 0;
  let eventTime = 0, mutation = null, mutationLeft = 0, toastLeft = 0, streak = 0, streakTime = 0, shake = 0;
  let boss = null, bossSpawned = false, endless = false, choices = [], resumeState = 'play', runNumber = 1;
  let record = 0, soundOn = false, audio = null, audioMaster = null, musicTime = 0;
  let aim = { x: 0, y: 0, active: false, down: false }, stick = { x: 0, y: 0, pointer: null };
  const departments = ['PANIC<br>RECEPTION', 'VOID<br>ACCOUNTING', 'CAFFEINE<br>DIVISION', 'CHAOS<br>COMMITTEE', 'THE FINAL<br>INTERVIEW'];
  const waveDuration = 25;
  const anecdotes = ['The printer printed its own resignation.', 'Donuts are now classified as office supplies.', 'Coffee got promoted. You did not.', 'Reality has requested sick leave.', 'Accounting found meaning. It was destroyed.', 'Goose refuses to sign the NDA.', 'Meeting cancelled. Apocalypse in progress.', 'Breaking: the floor knows what you did.', 'The intern turned out to be interdimensional.', 'HR offered to pay you in toast.'];
  const enemyTypes = [
    { name: 'RECEIPT', icon: '🧾', sprite: 1, color: '#ff93bf', hp: 3, speed: 63, radius: 21, value: 100 },
    { name: 'PRINTER', icon: '🖨️', sprite: 2, color: '#77d8f4', hp: 6, speed: 43, radius: 25, value: 180, shoot: true },
    { name: 'INTERN', icon: '🛒', sprite: 3, color: '#ffd16d', hp: 4, speed: 110, radius: 23, value: 140, rush: true },
    { name: 'CRISIS', icon: '🧻', sprite: 4, color: '#d8b6ff', hp: 9, speed: 45, radius: 30, value: 220, split: true }
  ];
  const mutations = [
    { id: 'donuts', title: 'DONUT FORECAST', desc: 'Falling sugar destroys enemies. Stay out of the red circles.', log: 'Weather forecast: scattered sugar apocalypse.' },
    { id: 'coffee', title: 'ESPRESSO SPACETIME', desc: 'Move and fire 50% faster. Caffeine is a dimension now.', log: 'Time has been replaced by a double espresso.' },
    { id: 'tax', title: 'EXISTENCE TAX', desc: 'Red zones deduct health. Do not stand in them.', log: 'Accounting has started taxing the floor.' },
    { id: 'tiny', title: 'GOOSE.ZIP', desc: 'Half the goose. Twice the room to dodge problems.', log: 'Goose successfully compressed. Nobody can unzip it.' },
    { id: 'disco', title: 'ETERNAL FRIDAY', desc: 'Enemies slow down. Donuts bounce. Mandatory dancing.', log: 'Office party extended until the heat death of the universe.' },
    { id: 'magnet', title: 'ALL-INCLUSIVE CHAOS', desc: 'Coffee and health fly straight to you. Look entitled.', log: 'Magnet for other people’s coffee activated.' },
    { id: 'reverse', title: 'MARKET REVERSAL', desc: 'Enemies flee for 8 seconds. Chase them down and fire them.', log: 'Bureaucracy experiences fear for the first time.' }
  ];
  const upgradePool = [
    { id: 'triple', icon: '🍩', title: 'DONUT SHOTGUN', desc: 'Two extra donuts in every volley.', apply: () => { player.shots += 2; } },
    { id: 'fast', icon: '⚡', title: 'UNREASONABLE CAFFEINE', desc: 'Fire 25% faster. Sleep is a myth.', apply: () => { player.fireRate *= .75; } },
    { id: 'damage', icon: '💥', title: 'SUGAR DIABLO', desc: 'Every donut deals +1 damage.', apply: () => { player.damage++; } },
    { id: 'health', icon: '🩹', title: 'PAID DEATH LEAVE', desc: '+30 maximum health and a full heal.', apply: () => { player.maxHp += 30; player.hp = player.maxHp; } },
    { id: 'orbit', icon: '🪿', title: 'OUTSOURCED GOOSE', desc: 'An orbiting goose smacks nearby enemies.', apply: () => { player.orbits++; } },
    { id: 'speed', icon: '🛼', title: 'ROLLERBLADES OF DOOM', desc: '+20% speed and a faster dash recharge.', apply: () => { player.speed *= 1.2; player.dashMax *= .8; } },
    { id: 'magnet', icon: '🧲', title: 'CAFFEINE KLEPTOMANIAC', desc: 'A much bigger pickup radius. +35% chaos charge.', apply: () => { player.magnet *= 1.8; player.chargeBoost *= 1.35; } },
    { id: 'pierce', icon: '📎', title: 'APPROVED TO PIERCE', desc: 'Donuts pierce through two extra enemies.', apply: () => { player.pierce += 2; } }
  ];

  try { record = Number(localStorage.getItem('bureauAbsurdRecord')) || 0; } catch (_) { /* Storage is optional. */ }
  $('bestScore').textContent = formatScore(record);
  function formatScore(n) { return Math.floor(n).toString().padStart(6, '0'); }
  function timeLabel(t) { return `${Math.floor(t / 60).toString().padStart(2, '0')}:${Math.floor(t % 60).toString().padStart(2, '0')}`; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) { const out = [...arr]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; }
  function resetInputs() { keys.clear(); aim.down = false; aim.active = false; stick.x = 0; stick.y = 0; stick.pointer = null; $('joystickKnob').style.transform = ''; }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const oldW = W, oldH = H;
    H = 760; W = Math.max(500, H * rect.width / rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
    if (player) {
      const sx = W / oldW, sy = H / oldH;
      for (const arr of [[player], enemies, bullets, hostile, pickups, hazards, particles, rings, labels]) {
        for (const e of arr) { e.x *= sx; e.y *= sy; }
      }
      player.x = clamp(player.x, 24, W - 24); player.y = clamp(player.y, 24, H - 24);
    }
  }
  new ResizeObserver(resize).observe($('arena'));
  resize();

  function initAudio() {
    if (!audio) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audio = new AudioContext(); audioMaster = audio.createGain(); audioMaster.gain.value = .13; audioMaster.connect(audio.destination);
    }
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  }
  function tone(freq, duration = .08, type = 'square', volume = .2, endFreq) {
    if (!soundOn || !audio || audio.state !== 'running') return;
    const o = audio.createOscillator(), g = audio.createGain(); o.type = type; o.frequency.setValueAtTime(freq, audio.currentTime);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), audio.currentTime + duration);
    g.gain.setValueAtTime(volume, audio.currentTime); g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
    o.connect(g); g.connect(audioMaster); o.start(); o.stop(audio.currentTime + duration);
  }
  function toggleSound() {
    soundOn = !soundOn;
    if (soundOn) initAudio();
    $('soundBtn').textContent = `SOUND: ${soundOn ? 'ON' : 'OFF'}`;
    $('soundBtn').setAttribute('aria-pressed', String(soundOn));
    $('soundBtn').setAttribute('aria-label', soundOn ? 'Turn sound off' : 'Turn sound on');
    if (soundOn) tone(440, .14, 'triangle', .4, 880);
  }
  function log(text) {
    const p = document.createElement('p'), t = document.createElement('span');
    t.textContent = timeLabel(elapsed); p.append(t, document.createTextNode(text));
    $('incidentLog').prepend(p);
    while ($('incidentLog').children.length > 3) $('incidentLog').lastChild.remove();
  }
  function toast(title, description, tag = 'REALITY MALFUNCTION', duration = 3.5) {
    $('eventTitle').textContent = title; $('eventDescription').textContent = description; $('eventTag').textContent = tag;
    $('eventToast').classList.add('show'); toastLeft = duration;
  }
  function hideOverlays() { for (const id of ['titleScreen', 'pauseScreen', 'upgradeScreen', 'endScreen']) $(id).hidden = true; }
  function focusCanvas() { canvas.focus({ preventScroll: true }); }

  function startGame() {
    resetInputs(); hideOverlays(); resize(); state = 'play'; endless = false;
    enemies = []; bullets = []; hostile = []; particles = []; pickups = []; labels = []; rings = []; hazards = []; confetti = [];
    elapsed = waveTime = spawnTime = score = kills = charge = eventTime = mutationLeft = toastLeft = streak = streakTime = shake = 0;
    wave = 1; mutation = boss = null; bossSpawned = false; musicTime = 0;
    player = { x: W / 2, y: H / 2, hp: 100, maxHp: 100, r: 19, speed: 235, aim: 0, fire: .15, fireRate: .32, damage: 1, shots: 1, pierce: 0, invincible: 1.5, dash: 0, dashCooldown: 0, dashMax: 2.6, dx: 0, dy: 0, moveX: 0, moveY: -1, orbits: 0, magnet: 115, chargeBoost: 1, orbitCooldown: 0, muzzle: 0 };
    $('runNumber').textContent = String(runNumber++).padStart(4, '0');
    $('incidentLog').replaceChildren(); log('Goose begins an unscheduled firing spree.');
    $('bossHud').hidden = true; $('pauseBtn').disabled = false;
    $('arena').classList.add('playing'); $('eventToast').classList.remove('show');
    for (let i = 0; i < 6; i++) spawnEnemy(0);
    toast('SHIFT STARTED', 'Keep moving. Goose auto-fires. Space gets you out of trouble.', 'DEPT. 01 · PANIC RECEPTION', 4);
    updateUI(); focusCanvas(); tone(220, .2, 'sawtooth', .3, 660);
  }
  function pauseGame() {
    if (state === 'play') { resumeState = state; state = 'pause'; resetInputs(); $('pauseScreen').hidden = false; $('resumeBtn').focus({ preventScroll: true }); }
    else if (state === 'pause') { state = resumeState; $('pauseScreen').hidden = true; lastFrame = performance.now(); focusCanvas(); }
  }
  function offerUpgrade() {
    state = 'upgrade'; resetInputs(); $('arena').classList.remove('playing');
    choices = shuffle(upgradePool.filter(u => u.id !== 'triple' || player.shots < 7)).slice(0, 3);
    $('upgradeOptions').replaceChildren();
    choices.forEach((u, i) => {
      const b = document.createElement('button'); b.className = 'upgrade-card';
      b.innerHTML = `<span>${u.icon}</span><strong>${u.title}</strong><small>${u.desc}</small><kbd>${i + 1}</kbd>`;
      b.addEventListener('click', () => chooseUpgrade(i)); $('upgradeOptions').append(b);
    });
    $('upgradeScreen').hidden = false; $('upgradeOptions').firstChild.focus({ preventScroll: true });
    tone(523, .2, 'triangle', .3, 1046);
  }
  function chooseUpgrade(index) {
    if (state !== 'upgrade' || !choices[index]) return;
    const choice = choices[index]; choice.apply(); choices = []; log(`Promotion: ${choice.title.toLowerCase()}.`);
    $('upgradeScreen').hidden = true; state = 'play'; $('arena').classList.add('playing');
    player.hp = Math.min(player.maxHp, player.hp + 20); player.invincible = 2;
    toast(`DEPARTMENT ${String(wave).padStart(2, '0')}`, departments[(wave - 1) % 5].replace('<br>', ' '), 'A NEW LEVEL OF ABSURDITY', 2.8);
    resetInputs(); updateUI(); focusCanvas();
  }

  function spawnEnemy(typeIndex, position) {
    const type = enemyTypes[typeIndex ?? Math.floor(rand(0, Math.min(wave, 4)))];
    const edge = Math.floor(rand(0, 4));
    let x = edge === 0 ? -30 : edge === 1 ? W + 30 : rand(30, W - 30);
    let y = edge === 2 ? -30 : edge === 3 ? H + 30 : rand(30, H - 30);
    if (position) { x = position.x; y = position.y; }
    const health = type.hp + Math.max(0, wave - 1) * .65;
    enemies.push({ ...type, x, y, hp: health, maxHp: health, speed: type.speed * (1 + .075 * (wave - 1)), r: type.radius, phase: rand(0, TAU), shootTime: rand(1, 3), rushTime: rand(1.3, 4), rushing: 0, hurt: 0, hitSet: new Set() });
  }
  function spawnBoss() {
    bossSpawned = true;
    const hp = endless ? 280 + wave * 35 : 350;
    boss = { x: W / 2, y: -60, hp, maxHp: hp, r: 62, icon: '🍞', color: RED, name: 'HR-TOASTER', speed: 44, phase: 0, hurt: 0, attack: 2, ringAttack: 5, summon: 8, isBoss: true, value: 5000 };
    enemies.push(boss); $('bossHud').hidden = false;
    hostile = []; hazards = []; player.invincible = 3;
    toast('HR-TOASTER 9000', 'It wants to discuss your resilience. Answer with donuts.', 'THE FINAL INTERVIEW', 4);
    log('HR has materialized out of collective burnout.'); tone(70, .7, 'sawtooth', .5, 180);
  }
  function enemyBullet(x, y, angle, speed = 165, radius = 8) {
    hostile.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: radius, life: 7, angle, icon: '📎' });
  }
  function shoot() {
    let target = null, nearest = Infinity;
    for (const e of enemies) { if (e.hp <= 0) continue; const d = distance(e, player); if (d < nearest) { nearest = d; target = e; } }
    let angle = aim.active && aim.down ? Math.atan2(aim.y - player.y, aim.x - player.x) : target ? Math.atan2(target.y - player.y, target.x - player.x) : player.aim;
    player.aim = angle;
    if (!target && !aim.down) return;
    for (let i = 0; i < player.shots; i++) {
      const a = angle + (i - (player.shots - 1) / 2) * .17;
      bullets.push({ x: player.x + Math.cos(a) * 24, y: player.y + Math.sin(a) * 24, vx: Math.cos(a) * 530, vy: Math.sin(a) * 530, r: 8, life: 2.1, angle: a, damage: player.damage, pierce: player.pierce, hitSet: new Set(), bounce: mutation?.id === 'disco' ? 2 : 0 });
    }
    player.fire = player.fireRate / (mutation?.id === 'coffee' ? 1.6 : 1);
    player.muzzle = .09;
    tone(rand(540, 690), .045, 'triangle', .09, 160);
  }
  function dash() {
    if (state !== 'play' || player.dashCooldown > 0 || player.dash > 0) return;
    let dx = player.moveX, dy = player.moveY, mag = Math.hypot(dx, dy);
    if (!mag) { dx = Math.cos(player.aim); dy = Math.sin(player.aim); mag = 1; }
    player.dx = dx / mag; player.dy = dy / mag; player.dash = .19; player.dashCooldown = player.dashMax; player.invincible = Math.max(player.invincible, .35);
    ring(player.x, player.y, ACID, 65, .22); tone(350, .16, 'sawtooth', .12, 80);
  }
  function unleashChaos() {
    if (state !== 'play' || charge < 100) return;
    charge = 0; player.invincible = 2; player.hp = Math.min(player.maxHp, player.hp + 15);
    ring(player.x, player.y, ACID, Math.max(W, H), .8); ring(player.x, player.y, RED, Math.max(W, H) * .8, 1);
    for (const e of [...enemies]) damageEnemy(e, e.isBoss ? 45 : 18);
    hostile = []; hazards = []; shake = 15; burst(player.x, player.y, ACID, 65);
    toast('HONK. HONK. APOCALYPSE.', 'Bureaucracy has temporarily ceased to exist.', 'GOOSE SINGULARITY', 2.4);
    log('Goose has shared some thoughts on corporate culture.');
    tone(80, .6, 'sawtooth', .5, 1000); updateUI();
  }
  function burst(x, y, color, count = 12) {
    for (let i = 0; i < count && particles.length < 480; i++) { const a = rand(0, TAU), s = rand(35, 210); particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, life: rand(.25, .8), max: .8, size: rand(2, 6) }); }
  }
  function ring(x, y, color, size, life) { rings.push({ x, y, color, size, life, max: life }); }
  function floatText(x, y, text, color = ACID, size = 16) { if (labels.length < 45) labels.push({ x, y, text, color, size, life: 1.1 }); }
  function damagePlayer(amount) {
    if (player.invincible > 0 || state !== 'play') return;
    player.hp = Math.max(0, player.hp - amount); player.invincible = .85; shake = 7;
    burst(player.x, player.y, RED, 16); floatText(player.x, player.y - 34, `−${amount}`, RED, 24);
    tone(95, .15, 'sawtooth', .4, 35);
    if (player.hp <= 0) finish(false);
  }
  function damageEnemy(e, amount) {
    if (e.hp <= 0) return;
    e.hp -= amount; e.hurt = .12;
    if (e.hp > 0) { if (e.isBoss) burst(e.x + rand(-30, 30), e.y + rand(-30, 30), RED, 3); return; }
    kills++; streak++; streakTime = 2.8; const multiplier = 1 + Math.min(3, Math.floor(streak / 8));
    score += e.value * multiplier; charge = Math.min(100, charge + (e.isBoss ? 25 : 3) * player.chargeBoost);
    burst(e.x, e.y, e.color, e.isBoss ? 65 : 15); floatText(e.x, e.y - 15, `+${e.value * multiplier}`, e.color, e.isBoss ? 34 : 15);
    if (confetti.length < 24) confetti.push({ x:e.x, y:e.y, angle:rand(-.35,.35), life:7, color:e.color });
    ring(e.x, e.y, e.color, e.isBoss ? 180 : 43, .32);
    if (Math.random() < .5 || e.isBoss) pickups.push({ x: clamp(e.x, 20, W - 20), y: clamp(e.y, 20, H - 20), kind: 'coffee', life: 16, phase: rand(0, TAU) });
    if (Math.random() < .105) pickups.push({ x: clamp(e.x + 12, 20, W - 20), y: clamp(e.y + 12, 20, H - 20), kind: 'health', life: 16, phase: rand(0, TAU) });
    if (e.split && enemies.length < 55) { spawnEnemy(0, { x: e.x - 18, y: e.y }); spawnEnemy(0, { x: e.x + 18, y: e.y }); }
    if (streak % 8 === 0) floatText(player.x, player.y - 56, `MASS LAYOFF ×${multiplier}`, ACID, 17);
    if (e.isBoss) { $('bossHud').hidden = true; if (endless) { waveTime = waveDuration; boss = null; } else finish(true); }
  }

  function triggerMutation() {
    const options = mutations.filter(m => m.id !== mutation?.id);
    mutation = randomItem(options); mutationLeft = mutation.id === 'reverse' ? 8 : 10;
    toast(mutation.title, mutation.desc); log(mutation.log); tone(180, .3, 'square', .16, 650);
    if (mutation.id === 'tax') for (let i = 0; i < 4; i++) hazards.push({ x: rand(70, W - 70), y: rand(70, H - 70), r: rand(60, 100), wait: 1.5, life: 7.5, kind: 'tax', tick: 0 });
    if (mutation.id === 'magnet') for (let i = 0; i < 8; i++) pickups.push({ x: rand(25, W - 25), y: rand(25, H - 25), kind: i % 4 === 0 ? 'health' : 'coffee', life: 16, phase: rand(0, TAU) });
  }
  function nextWave() {
    wave++; waveTime = 0; spawnTime = 1; hostile = []; hazards = []; mutation = null; mutationLeft = 0;
    eventTime = 0; bossSpawned = false; player.invincible = 2; charge = Math.min(100, charge + 20);
    for (const e of enemies) { if (!e.isBoss) { burst(e.x, e.y, e.color, 7); e.hp = 0; } }
    enemies = []; offerUpgrade(); updateUI();
  }
  function finish(won) {
    if (state === 'end') return;
    state = 'end'; resetInputs(); $('arena').classList.remove('playing'); $('pauseBtn').disabled = true;
    $('eventToast').classList.remove('show'); $('endScreen').hidden = false;
    if (won) { score += Math.round(player.hp * 25); burst(player.x, player.y, ACID, 80); }
    const isRecord = score > record;
    if (isRecord) { record = score; try { localStorage.setItem('bureauAbsurdRecord', String(record)); } catch (_) {} }
    $('endKicker').textContent = won ? 'CORPORATE CULTURE: DESTROYED' : 'EMPLOYEE PERFORMANCE REVIEW';
    $('endTitle').innerHTML = won ? 'YOU FIRED<br>REALITY.' : 'GOOSE<br>BURNOUT.';
    $('endText').textContent = won ? 'Toaster defeated. Donuts liberated. Open a new branch of infinite absurdity.' : randomItem(['You were too normal for this position. Try again. HR is still warm.', 'Reason for termination: insufficient honk. Grab coffee and dash more often next time.', 'Bureaucracy won this shift. But you still have donuts and a right to a rematch.']);
    $('endScore').textContent = Math.floor(score).toLocaleString('en-US'); $('endKills').textContent = String(kills); $('endTime').textContent = timeLabel(elapsed);
    $('newRecord').textContent = isRecord ? '✳ NEW RECORD OF UNREASONABLENESS' : `BEST SHIFT: ${Math.floor(record).toLocaleString('en-US')}`;
    $('endlessBtn').hidden = !won; $('againBtn').focus({ preventScroll: true }); updateUI();
    tone(won ? 523 : 220, .45, 'triangle', .4, won ? 1046 : 55);
  }
  function continueEndless() {
    if (state !== 'end' || !bossSpawned || player.hp <= 0) return;
    endless = true; boss = null; enemies = []; player.hp = player.maxHp;
    $('endScreen').hidden = true; $('pauseBtn').disabled = false; $('arena').classList.add('playing');
    state = 'play'; nextWave();
  }

  function update(dt) {
    if (state !== 'play') return;
    elapsed += dt; waveTime += dt; eventTime += dt; musicTime += dt;
    if (toastLeft > 0) { toastLeft -= dt; if (toastLeft <= 0) $('eventToast').classList.remove('show'); }
    if (mutationLeft > 0) { mutationLeft -= dt; if (mutationLeft <= 0) mutation = null; }
    if (eventTime >= 15) { eventTime = 0; triggerMutation(); }
    if (wave < 5 || endless) { if (waveTime >= waveDuration && (!boss || boss.hp <= 0)) { nextWave(); return; } }
    if (!endless && wave === 5 && !bossSpawned && waveTime >= 3) spawnBoss();
    if (endless && wave % 5 === 0 && !bossSpawned && waveTime >= 3) spawnBoss();
    spawnTime -= dt;
    if (spawnTime <= 0 && enemies.length < 50) {
      const n = Math.min(4, Math.ceil(wave / 2));
      for (let i = 0; i < n; i++) spawnEnemy();
      spawnTime = Math.max(.5, 1.35 - wave * .11) * (boss ? 2.2 : 1);
    }
    player.invincible = Math.max(0, player.invincible - dt); player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.muzzle = Math.max(0, player.muzzle - dt);
    player.fire -= dt; player.orbitCooldown = Math.max(0, player.orbitCooldown - dt);
    let mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + stick.x;
    let my = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + stick.y;
    const length = Math.hypot(mx, my);
    if (length > 1) { mx /= length; my /= length; }
    if (length > .05) { player.moveX = mx; player.moveY = my; }
    const speed = player.speed * (mutation?.id === 'coffee' ? 1.5 : 1);
    if (player.dash > 0) {
      player.dash -= dt; player.x += player.dx * 1000 * dt; player.y += player.dy * 1000 * dt;
      burst(player.x, player.y, ACID, 2);
      for (const e of enemies) { if (e.hp > 0 && distance(e, player) < e.r + player.r + 15) damageEnemy(e, 3); }
    } else { player.x += mx * speed * dt; player.y += my * speed * dt; }
    const pr = mutation?.id === 'tiny' ? 10 : player.r;
    player.x = clamp(player.x, pr + 10, W - pr - 10); player.y = clamp(player.y, pr + 10, H - pr - 10);
    if (player.fire <= 0) shoot();
    if (streakTime > 0) streakTime -= dt; else streak = 0;
    if (musicTime > .25) {
      musicTime = 0; const pattern = [110, 110, 165, 110, 130.81, 110, 196, 146.83];
      tone(pattern[Math.floor(elapsed * 4) % pattern.length], .18, 'triangle', .045);
    }
    if (mutation?.id === 'donuts' && Math.random() < dt * 2.4) hazards.push({ x: rand(40, W - 40), y: rand(40, H - 40), r: 45, wait: 1.25, life: .5, kind: 'donut', tick: 0 });
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      e.phase += dt * 4; e.hurt = Math.max(0, e.hurt - dt);
      let a = Math.atan2(player.y - e.y, player.x - e.x);
      let s = e.speed * (mutation?.id === 'disco' ? .58 : 1) * (mutation?.id === 'reverse' && !e.isBoss ? -1 : 1);
      if (e.rush) {
        e.rushTime -= dt; e.rushing = Math.max(0, e.rushing - dt);
        if (e.rushTime <= 0) { e.rushing = .55; e.rushAngle = a; e.rushTime = rand(2, 4); }
        if (e.rushing > 0) { a = e.rushAngle; s *= 2.3; }
      }
      if (e.isBoss) {
        e.attack -= dt; e.ringAttack -= dt; e.summon -= dt;
        if (e.y < 100) { a = Math.PI / 2; s = 80; } else if (distance(player, e) < 180) s = 0;
        const enraged = e.hp < e.maxHp * .4;
        if (e.attack <= 0) {
          const fireA = Math.atan2(player.y - e.y, player.x - e.x);
          for (let j = -2; j <= 2; j++) enemyBullet(e.x, e.y, fireA + j * .16, enraged ? 205 : 165, 10);
          e.attack = enraged ? 1 : 1.8; tone(75, .1, 'square', .12, 140);
        }
        if (e.ringAttack <= 0) {
          const count = enraged ? 18 : 12;
          for (let j = 0; j < count; j++) enemyBullet(e.x, e.y, j * TAU / count + elapsed * .3, 135, 9);
          ring(e.x, e.y, RED, 220, .6); e.ringAttack = enraged ? 3 : 5;
          floatText(e.x, e.y - 90, randomItem(['HOW RESILIENT ARE YOU?', 'WE ARE A FAMILY!', '300 YEARS EXPERIENCE', 'SALARY: TOAST']), RED, 19);
        }
        if (e.summon <= 0) { for (let j = 0; j < 3; j++) spawnEnemy(0, { x: e.x + rand(-65, 65), y: e.y + 65 }); e.summon = 8; }
      } else if (e.shoot) {
        e.shootTime -= dt;
        if (distance(player, e) < 230) s *= -.2;
        if (e.shootTime <= 0) { enemyBullet(e.x, e.y, a, 145); e.shootTime = rand(2, 3.4); }
      }
      e.x += Math.cos(a) * s * dt; e.y += Math.sin(a) * s * dt;
      e.x = clamp(e.x, -35, W + 35); e.y = clamp(e.y, -35, H + 35);
      if (distance(e, player) < pr + e.r - 4) { damagePlayer(e.isBoss ? 20 : 10); if (!e.isBoss && player.invincible > 0) { e.x -= Math.cos(a) * 8; e.y -= Math.sin(a) * 8; } }
      if (player.orbits && player.orbitCooldown <= 0) {
        for (let j = 0; j < player.orbits; j++) {
          const oa = elapsed * 3 + j * TAU / player.orbits;
          const ox = player.x + Math.cos(oa) * 73, oy = player.y + Math.sin(oa) * 73;
          if (Math.hypot(e.x - ox, e.y - oy) < e.r + 18) { damageEnemy(e, 3); player.orbitCooldown = .18; }
        }
      }
    }
    for (const b of bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; b.angle += dt * 5;
      if (b.bounce > 0 && (b.x < 0 || b.x > W || b.y < 0 || b.y > H)) { if (b.x < 0 || b.x > W) b.vx *= -1; if (b.y < 0 || b.y > H) b.vy *= -1; b.bounce--; b.x = clamp(b.x, 1, W - 1); b.y = clamp(b.y, 1, H - 1); }
      for (const e of enemies) {
        if (e.hp <= 0 || b.life <= 0 || b.hitSet.has(e)) continue;
        if (distance(b, e) < b.r + e.r) {
          b.hitSet.add(e); damageEnemy(e, b.damage); burst(b.x, b.y, e.color, 3);
          if (b.pierce-- <= 0) b.life = 0;
        }
      }
    }
    for (const b of hostile) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; b.angle += dt * 3;
      if (distance(b, player) < b.r + pr - 2) { damagePlayer(9); b.life = 0; }
    }
    for (const h of hazards) {
      if (h.wait > 0) {
        h.wait -= dt;
        if (h.wait <= 0 && h.kind === 'donut') {
          burst(h.x, h.y, '#e5a4c0', 16); ring(h.x, h.y, '#e5a4c0', 80, .35);
          for (const e of enemies) if (e.hp > 0 && distance(e, h) < h.r + e.r) damageEnemy(e, 5);
          if (distance(player, h) < h.r + pr) damagePlayer(12);
        }
      } else {
        h.life -= dt; h.tick -= dt;
        if (h.kind === 'tax' && h.tick <= 0) { if (distance(player, h) < h.r + pr) { damagePlayer(6); floatText(h.x, h.y, '−TAX', RED, 18); } h.tick = .8; }
      }
    }
    for (const p of pickups) {
      p.life -= dt; p.phase += dt * 3;
      const d = distance(player, p), magnetRadius = mutation?.id === 'magnet' ? 2000 : player.magnet;
      if (d < magnetRadius && d > 1) { const s = (mutation?.id === 'magnet' ? 380 : 330) * dt; p.x += (player.x - p.x) / d * s; p.y += (player.y - p.y) / d * s; }
      if (d < pr + 14) {
        p.life = 0; score += p.kind === 'health' ? 50 : 30;
        if (p.kind === 'health') { player.hp = Math.min(player.maxHp, player.hp + 15); floatText(player.x, player.y - 30, '+15 HEALTH', PAPER, 13); }
        else { charge = Math.min(100, charge + 10 * player.chargeBoost); floatText(player.x, player.y - 30, '+COFFEE', ACID, 13); }
        tone(p.kind === 'health' ? 880 : 660, .08, 'sine', .2, 1200);
      }
    }
    enemies = enemies.filter(e => e.hp > 0); bullets = bullets.filter(b => b.life > 0 && b.x > -30 && b.x < W + 30 && b.y > -30 && b.y < H + 30);
    hostile = hostile.filter(b => b.life > 0 && b.x > -30 && b.x < W + 30 && b.y > -30 && b.y < H + 30);
    hazards = hazards.filter(h => h.life > 0); pickups = pickups.filter(p => p.life > 0);
    if (Math.random() < dt * .065) log(randomItem(anecdotes));
  }

  function updateUI() {
    $('score').textContent = formatScore(score); $('bestScore').textContent = formatScore(record); $('timer').textContent = timeLabel(elapsed);
    $('statusLabel').textContent = state === 'menu' ? 'REALITY: NOT APPROVED' : state === 'end' ? 'SHIFT COMPLETE' : state === 'pause' ? 'GOOSE ON A BREAK' : endless ? 'ENDLESS OVERTIME' : 'UNAUTHORIZED CHAOS';
    const hp = player?.hp ?? 100, maxHp = player?.maxHp ?? 100;
    $('healthLabel').textContent = `${Math.ceil(hp)} / ${maxHp}`; $('healthFill').style.width = `${hp / maxHp * 100}%`; $('healthFill').style.background = hp / maxHp < .3 ? RED : '#477f64';
    $('fieldWave').textContent = String(wave).padStart(2, '0'); $('fieldKills').textContent = String(kills); $('fieldCharge').textContent = `${Math.floor(charge)}%`;
    $('wave').innerHTML = `${String(wave).padStart(2, '0')}<span>/ ${endless ? '∞' : '05'}</span>`;
    $('departmentName').innerHTML = departments[(wave - 1) % 5]; $('waveFill').style.width = `${Math.min(100, waveTime / waveDuration * 100)}%`;
    $('waveHint').textContent = state === 'menu' ? 'Clock in. No paperwork required.' : wave === 5 && !endless ? boss ? 'Fire HR. Take back your donuts.' : 'HR is on the way. Stay sharp.' : `Next promotion: ${Math.max(0, Math.ceil(waveDuration - waveTime))} sec.`;
    $('chaosLabel').textContent = `${Math.floor(charge)}%`; $('chaosFill').style.width = `${charge}%`;
    $('chaosBtn').disabled = charge < 100 || state !== 'play'; $('chaosHint').textContent = charge >= 100 ? 'Press E. Fire everything around you.' : 'Collect coffee. Charge chaos.';
    const cooldown = player?.dashCooldown ?? 0, maxCooldown = player?.dashMax ?? 2.6;
    $('dashStatus').textContent = cooldown > 0 ? `${cooldown.toFixed(1)} SEC` : 'READY'; $('dashFill').style.width = `${(1 - cooldown / maxCooldown) * 100}%`;
    $('mutationName').textContent = mutation?.title ?? 'SUSPICIOUSLY STABLE'; $('mutationTimer').textContent = mutation ? `Malfunction: ${Math.ceil(mutationLeft)} sec.` : state === 'menu' ? 'Give it a minute.' : `Next malfunction: ${Math.ceil(15 - eventTime)} sec.`;
    if (boss && boss.hp > 0) { $('bossFill').style.width = `${Math.max(0, boss.hp / boss.maxHp * 100)}%`; $('bossPercent').textContent = `${Math.ceil(Math.max(0, boss.hp / boss.maxHp) * 100)}%`; }
  }

  function circle(x, y, r, fill, stroke, width = 1) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); } }
  function emoji(icon, x, y, size, angle = 0) { ctx.save(); ctx.translate(x, y); if (angle) ctx.rotate(angle); ctx.font = `${size}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; ctx.fillStyle = PAPER; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon, 0, 2); ctx.restore(); }
  function sprite(index, x, y, size, angle = 0, flip = false) {
    if (!spriteSheet.complete || !spriteSheet.naturalWidth) { emoji(['🪿','🧾','🖨️','🛒','🧻','🍞'][index], x, y, size * .7, angle); return; }
    const [sx,sy,sw,sh] = spriteRects[index];
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle); if (flip) ctx.scale(-1,1);
    ctx.drawImage(spriteSheet,sx,sy,sw,sh,-size/2,-size/2,size,size); ctx.restore();
  }
  function drawFloor() {
    const palettes = [['#263c51','#2b4258','#648397'],['#343a54','#3b415e','#8581a6'],['#25484d','#2b5056','#69a499'],['#4b3c4c','#524355','#ad869f'],['#303447','#383c50','#8a7e99']];
    const palette = palettes[(wave-1)%5], cell = 62, disco = mutation?.id === 'disco';
    ctx.fillStyle = palette[0]; ctx.fillRect(0,0,W,H);
    for (let x=0;x<W;x+=cell) for (let y=0;y<H;y+=cell) {
      if (disco) ctx.fillStyle=['#504974','#315d63','#61505b','#586344'][(Math.floor(x/cell)+Math.floor(y/cell)+Math.floor(elapsed*2))%4];
      else ctx.fillStyle=(Math.floor(x/cell)+Math.floor(y/cell))%2 ? palette[1] : palette[0];
      ctx.fillRect(x+1,y+1,cell-2,cell-2);
    }
    ctx.strokeStyle=palette[2]+'33';ctx.lineWidth=1;ctx.beginPath();
    for(let x=0;x<W;x+=cell){ctx.moveTo(x,0);ctx.lineTo(x,H)}for(let y=0;y<H;y+=cell){ctx.moveTo(0,y);ctx.lineTo(W,y)}ctx.stroke();
    ctx.fillStyle='#a6d0d422';for(let x=0;x<W;x+=cell)for(let y=0;y<H;y+=cell)ctx.fillRect(x-2,y-2,4,4);
    ctx.fillStyle='#172b3a77';ctx.fillRect(0,0,W,58);ctx.fillRect(0,H-42,W,42);
    ctx.strokeStyle='#a8cbdc66';ctx.lineWidth=2;ctx.strokeRect(21,21,W-42,H-42);
    ctx.setLineDash([11,9]);ctx.strokeStyle='#e8f44988';ctx.strokeRect(29,29,W-58,H-58);ctx.setLineDash([]);
    for(let i=0;i<7;i++){ctx.fillStyle=i%2? '#192b3d':'#d1d86199';ctx.fillRect(21+i*12,H-42,8,13);ctx.fillRect(W-103+i*12,29,8,13)}
    circle(W/2,H/2,155,null,palette[2]+'30',2);circle(W/2,H/2,162,null,palette[2]+'30');
    ctx.save();ctx.translate(W/2,H/2);ctx.rotate(-.08);ctx.textAlign='center';ctx.font='900 66px "Barlow Condensed",Impact,sans-serif';ctx.fillStyle='#acc6d61a';ctx.fillText('BUREAU OF',0,-13);ctx.fillText('ABSURDITY',0,44);ctx.restore();
    ctx.font='11px monospace';ctx.fillStyle='#a7c3d699';ctx.textAlign='left';ctx.fillText(`DEPT. ${String(wave).padStart(2,'0')} / NO REFUNDS`,40,47);
    ctx.textAlign='right';ctx.fillText('KEEP CLEAR OF BUREAUCRACY',W-40,H-22);
    for(const [x,y] of [[W/2,0],[W/2,H],[0,H/2],[W,H/2]]){
      ctx.save();ctx.translate(x,y);ctx.rotate(reduceMotion?0:clock*.35);ctx.setLineDash([9,10]);circle(0,0,34,null,'#ff93bf77',3);ctx.setLineDash([]);circle(0,0,24,'#192e3c66','#85d6d366',2);ctx.restore();
    }
    for(const c of confetti){ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.angle);ctx.globalAlpha=Math.min(.45,c.life/6);ctx.strokeStyle=c.color;ctx.fillStyle=c.color;ctx.lineWidth=2;ctx.strokeRect(-28,-13,56,26);ctx.font='900 20px "Barlow Condensed",Impact,sans-serif';ctx.textAlign='center';ctx.fillText('FIRED!',0,7);ctx.restore();}
  }
  function drawHazards() {
    for (const h of hazards) {
      const warning = h.wait > 0;
      circle(h.x, h.y, h.r, warning ? '#fc634a14' : '#fc634a38', warning ? '#fc634a88' : RED, 2);
      ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(clock * .4); ctx.strokeStyle = warning ? '#fc634a66' : '#fc634a'; ctx.setLineDash([8, 8]); ctx.lineWidth = 2; circle(0, 0, h.r * .75, null, ctx.strokeStyle, 2); ctx.setLineDash([]); ctx.restore();
      if (h.kind === 'tax') { ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = RED; ctx.fillText('TAX', h.x, h.y + 5); }
      else if (!warning) emoji('🍩', h.x, h.y, 52);
      else { ctx.font = '24px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = RED; ctx.fillText('!', h.x, h.y + 7); }
    }
  }
  function drawEnemy(e) {
    const wobble = reduceMotion ? 0 : Math.sin(e.phase) * 3;
    ctx.save();ctx.translate(e.x+2,e.y+e.r*.8);ctx.scale(1,.4);circle(0,0,e.r*1.15,'#101d3266');ctx.restore();
    if (e.isBoss) {
      circle(e.x,e.y,90,'#ff715d14','#ff715d66',2);
      ctx.save();ctx.translate(e.x,e.y);ctx.rotate(reduceMotion?0:clock*.2);ctx.setLineDash([8,10]);circle(0,0,96,null,RED,2);ctx.setLineDash([]);ctx.restore();
      sprite(5,e.x,e.y+wobble-5,190,Math.sin(e.phase*.4)*.04);
      ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillStyle=PAPER;ctx.fillText('HR-9000',e.x,e.y+105);
    } else {
      circle(e.x,e.y+wobble,e.r+5,`${e.color}13`,e.hurt>0?PAPER:`${e.color}88`,1.5);
      sprite(e.sprite,e.x,e.y+wobble,e.r*2.9,e.rushing>0?Math.sin(e.phase)*.13:Math.sin(e.phase)*.035);
      if (e.hp < e.maxHp) { ctx.fillStyle = '#00000088'; ctx.fillRect(e.x - 17, e.y - e.r - 12, 34, 3); ctx.fillStyle = e.color; ctx.fillRect(e.x - 17, e.y - e.r - 12, Math.max(0, e.hp / e.maxHp * 34), 3); }
      if (e.rushing > 0) { ctx.strokeStyle = RED; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e.x - Math.cos(e.rushAngle) * 35, e.y - Math.sin(e.rushAngle) * 35); ctx.lineTo(e.x - Math.cos(e.rushAngle) * 50, e.y - Math.sin(e.rushAngle) * 50); ctx.stroke(); }
    }
    if(e.hurt>0){ctx.save();ctx.globalAlpha=e.hurt/.12*.5;circle(e.x,e.y,e.r+6,PAPER);ctx.restore();}
  }
  function drawPlayer() {
    if (!player) return;
    const tiny = mutation?.id === 'tiny', scale = tiny ? .58 : 1;
    for(let j=0;j<player.orbits;j++){const a=elapsed*3+j*TAU/player.orbits,x=player.x+Math.cos(a)*73,y=player.y+Math.sin(a)*73;circle(x,y,18,'#e8f44922','#e8f44988');sprite(0,x,y,44,Math.sin(clock*6)*.07,Math.cos(a)<0);}
    ctx.save();ctx.translate(player.x+2,player.y+26*scale);ctx.scale(1,.4);circle(0,0,29*scale,'#0f1b3166');ctx.restore();
    if (player.invincible > 0 && Math.floor(clock * 18) % 2 === 0 && player.dash <= 0) ctx.globalAlpha = .5;
    circle(player.x,player.y,29*scale,'#e8f44919',ACID,player.dash>0?3:1.5);
    ctx.save(); ctx.translate(player.x, player.y); ctx.scale(scale, scale); ctx.rotate(Math.sin(clock * (Math.abs(player.moveX) + Math.abs(player.moveY) > .1 ? 10 : 4)) * .07);
    sprite(0,0,-7,82,0,Math.cos(player.aim)<0);
    ctx.restore();
    if(player.muzzle>0){ctx.save();ctx.translate(player.x+Math.cos(player.aim)*39*scale,player.y+Math.sin(player.aim)*39*scale);ctx.rotate(player.aim);ctx.fillStyle=ACID;ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(19,-12);ctx.lineTo(12,0);ctx.lineTo(19,12);ctx.lineTo(0,5);ctx.fill();ctx.restore();}
    ctx.globalAlpha=1;ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.fillStyle=ACID;ctx.fillText('YOU. THE GOOSE.',player.x,player.y-52*scale);
    ctx.fillStyle='#10283b';ctx.fillRect(player.x-24*scale,player.y+43*scale,48*scale,4);ctx.fillStyle=player.hp/player.maxHp<.3?RED:ACID;ctx.fillRect(player.x-24*scale,player.y+43*scale,48*scale*player.hp/player.maxHp,4);
    if (charge >= 100) { ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(clock); ctx.setLineDash([3, 9]); circle(0, 0, 40, null, RED, 2); ctx.setLineDash([]); ctx.restore(); }
  }
  function draw(dt) {
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.clearRect(0, 0, W, H); ctx.save();
    if (shake > 0 && !reduceMotion && state === 'play') ctx.translate(rand(-shake, shake), rand(-shake, shake));
    drawFloor(); drawHazards();
    for(const p of pickups){circle(p.x,p.y,19,p.kind==='health'?'#b7ffb533':'#e8f44933',p.kind==='health'?'#d5ffb5aa':'#e8f449aa',1.5);emoji(p.kind==='health'?'🩹':'☕',p.x,p.y+Math.sin(p.phase)*3,29);}
    for (const r of rings) { const age = 1 - r.life / r.max; ctx.globalAlpha = Math.max(0, r.life / r.max) * .7; circle(r.x, r.y, r.size * age, null, r.color, 2 + 4 * (1 - age)); ctx.globalAlpha = 1; }
    for (const e of enemies) drawEnemy(e);
    for(const b of bullets){ctx.strokeStyle='#ffb7d755';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(b.x-b.vx*.045,b.y-b.vy*.045);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.angle);circle(0,0,10,'#f9bc66','#ffa3ce',4);circle(0,0,3,'#263e52');ctx.fillStyle='#fff4b2';ctx.fillRect(-4,-7,2,4);ctx.fillRect(5,1,2,3);ctx.restore();}
    for(const b of hostile){ctx.strokeStyle='#ff715d44';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(b.x-b.vx*.065,b.y-b.vy*.065);ctx.lineTo(b.x,b.y);ctx.stroke();circle(b.x,b.y,b.r+2,'#ff715d','#ffe4af',2);ctx.fillStyle='#823f2b';ctx.fillRect(b.x-2,b.y-3,4,6);}
    drawPlayer();
    for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.strokeStyle=p.color;ctx.lineWidth=Math.max(2,p.size*.7);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*.035,p.y-p.vy*.035);ctx.stroke();}
    ctx.globalAlpha = 1;
    for (const l of labels) { ctx.globalAlpha = Math.min(1, l.life * 2); ctx.font = `bold ${l.size}px monospace`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#111a13'; ctx.strokeText(l.text, l.x, l.y); ctx.fillStyle = l.color; ctx.fillText(l.text, l.x, l.y); }
    ctx.globalAlpha = 1;
    if (state === 'play' && player.hp / player.maxHp < .25) { ctx.strokeStyle = '#fc634a55'; ctx.lineWidth = 12; ctx.strokeRect(5, 5, W - 10, H - 10); }
    ctx.restore();
    if (state === 'play' || state === 'end') {
      for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96; p.life -= dt; }
      for (const r of rings) r.life -= dt;
      for (const l of labels) { l.life -= dt; l.y -= 27 * dt; }
      for (const c of confetti) c.life -= dt;
      confetti = confetti.filter(c => c.life > 0);
      particles = particles.filter(p => p.life > 0); rings = rings.filter(r => r.life > 0); labels = labels.filter(l => l.life > 0);
      shake = Math.max(0, shake - dt * 30);
    }
  }
  function frame(now) {
    const dt = Math.min((now - (lastFrame || now)) / 1000, .04); lastFrame = now; clock += dt;
    update(dt); draw(dt); uiClock += dt;
    if (uiClock > .1) { uiClock = 0; updateUI(); }
    requestAnimationFrame(frame);
  }

  $('startBtn').addEventListener('click', startGame); $('againBtn').addEventListener('click', startGame);
  $('restartPauseBtn').addEventListener('click', startGame); $('resumeBtn').addEventListener('click', pauseGame);
  $('pauseBtn').addEventListener('click', pauseGame); $('soundBtn').addEventListener('click', toggleSound);
  $('chaosBtn').addEventListener('click', unleashChaos); $('touchChaos').addEventListener('pointerdown', e => { e.preventDefault(); unleashChaos(); });
  $('touchDash').addEventListener('pointerdown', e => { e.preventDefault(); dash(); }); $('endlessBtn').addEventListener('click', continueEndless);
  $('fullBtn').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); } catch (_) { toast('THE OFFICE WILL NOT FIT', 'This browser did not allow fullscreen.', 'INTERNAL MEMO', 2); }
  });
  document.addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && state === 'play') e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Enter' && (state === 'menu' || state === 'end')) { e.preventDefault(); startGame(); }
    else if (e.code === 'Escape' || e.code === 'KeyP') pauseGame();
    else if (e.code === 'KeyM') toggleSound();
    else if (e.code === 'Space') dash();
    else if (e.code === 'KeyE') unleashChaos();
    else if (state === 'upgrade' && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) chooseUpgrade(Number(e.code.slice(-1)) - 1);
  });
  document.addEventListener('keyup', e => keys.delete(e.code));
  canvas.addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; const rect = canvas.getBoundingClientRect(); aim = { ...aim, x: (e.clientX - rect.left) / rect.width * W, y: (e.clientY - rect.top) / rect.height * H, active: true }; });
  canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') return; aim.down = true; focusCanvas(); });
  document.addEventListener('pointerup', () => { aim.down = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerleave', () => { aim.active = false; });
  function setStick(e) {
    const rect = $('joystick').getBoundingClientRect(), dx = e.clientX - rect.left - rect.width / 2, dy = e.clientY - rect.top - rect.height / 2;
    const mag = Math.hypot(dx, dy), max = rect.width * .34, scale = mag > max ? max / mag : 1;
    stick.x = dx * scale / max; stick.y = dy * scale / max;
    $('joystickKnob').style.transform = `translate(${dx * scale}px,${dy * scale}px)`;
  }
  $('joystick').addEventListener('pointerdown', e => { if (state !== 'play') return; e.preventDefault(); stick.pointer = e.pointerId; $('joystick').setPointerCapture(e.pointerId); setStick(e); });
  $('joystick').addEventListener('pointermove', e => { if (e.pointerId === stick.pointer) { e.preventDefault(); setStick(e); } });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) $('joystick').addEventListener(name, () => { stick.x = stick.y = 0; stick.pointer = null; $('joystickKnob').style.transform = ''; });
  window.addEventListener('blur', () => { resetInputs(); if (state === 'play') pauseGame(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') pauseGame(); lastFrame = performance.now(); });
  // Internal game loop starts here.
  updateUI(); requestAnimationFrame(frame);
})();
