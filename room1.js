import * as THREE from "three";

export function createRoom1(scene, camera, renderer) {

// ── HELPERS ──
const roomW = 10, roomH = 5, roomD = 10;
function mat(color, rough = 0.85, metal = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}
function box(w, h, d, color, rough, metal) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, rough, metal));
}

const room1Group = new THREE.Group();
scene.add(room1Group);

// ── LIGHTING ──
const ambient = new THREE.AmbientLight(0xffffff, 0.25);
room1Group.add(ambient);

const mainLight = new THREE.SpotLight(0xfff5e0, 2.5, 18, Math.PI / 3, 0.4);
mainLight.position.set(0, 4.9, 0);
mainLight.target.position.set(0, 0, 0);
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(1024, 1024);
room1Group.add(mainLight);
room1Group.add(mainLight.target);

// ── FLOOR ──
const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), mat(0x7a6240, 0.9));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; room1Group.add(floor);
for (let i = -4; i <= 4; i++) {
  const v = new THREE.Mesh(new THREE.PlaneGeometry(0.02, roomD), new THREE.MeshStandardMaterial({ color: 0x5a4520 }));
  v.rotation.x = -Math.PI / 2; v.position.set(i, 0.001, 0); room1Group.add(v);
  const h2 = new THREE.Mesh(new THREE.PlaneGeometry(roomW, 0.02), new THREE.MeshStandardMaterial({ color: 0x5a4520 }));
  h2.rotation.x = -Math.PI / 2; h2.position.set(0, 0.001, i); room1Group.add(h2);
}

// ── WALLS & CEILING ──
const wallBack = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), mat(0xc8bfa8, 0.9));
wallBack.position.set(0, roomH / 2, -roomD / 2); wallBack.receiveShadow = true; room1Group.add(wallBack);
const wallFront = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), mat(0xbdb099, 0.9));
wallFront.rotation.y = Math.PI; wallFront.position.set(0, roomH / 2, roomD / 2); room1Group.add(wallFront);
const wallLeft = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), mat(0xc4bb9f, 0.9));
wallLeft.rotation.y = Math.PI / 2; wallLeft.position.set(-roomW / 2, roomH / 2, 0); room1Group.add(wallLeft);
const wallRight = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), mat(0xc4bb9f, 0.9));
wallRight.rotation.y = -Math.PI / 2; wallRight.position.set(roomW / 2, roomH / 2, 0); room1Group.add(wallRight);
const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), mat(0xe8e0d0, 0.9));
ceiling.rotation.x = Math.PI / 2; ceiling.position.y = roomH; room1Group.add(ceiling);
const fixture = box(2, 0.06, 0.5, 0xf8f0d0, 0.3);
fixture.position.set(0, roomH - 0.04, 0); room1Group.add(fixture);

// ── MAIN TV ──
const mainTvG = new THREE.Group();

const mainTvBody = box(5.2, 3.1, 0.12, 0x0d0d0d, 0.2, 0.6);
mainTvG.add(mainTvBody);
const mainTvBezel = box(5.0, 2.9, 0.05, 0x111111, 0.15, 0.5);
mainTvBezel.position.z = -0.035; mainTvG.add(mainTvBezel);

// ── FALLBACK CANVAS — видео байхгүй үед харуулна ──
const fallbackCanvas = document.createElement('canvas');
fallbackCanvas.width = 960; fallbackCanvas.height = 540;
const fctx = fallbackCanvas.getContext('2d');
const fallbackTex = new THREE.CanvasTexture(fallbackCanvas);

function drawFallback(msg = '📺 lesson1.mp4 хүлээж байна...') {
  fctx.fillStyle = '#050d1a';
  fctx.fillRect(0, 0, 960, 540);
  fctx.strokeStyle = '#1d4ed8';
  fctx.lineWidth = 6;
  fctx.strokeRect(10, 10, 940, 520);
  fctx.fillStyle = '#1d88ff';
  fctx.font = 'bold 36px Arial';
  fctx.textAlign = 'center';
  fctx.textBaseline = 'middle';
  fctx.fillText(msg, 480, 240);
  fctx.fillStyle = '#446688';
  fctx.font = '24px Arial';
  fctx.fillText('▶ Тоглуулах товч дарна уу', 480, 300);
  fallbackTex.needsUpdate = true;
}
drawFallback();

// ── TV SCREEN — эхэндээ fallback, видео бэлэн болмогц солино ──
const mainTvScreenMat = new THREE.MeshBasicMaterial({ map: fallbackTex, side: THREE.FrontSide });
const mainTvScreen = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.7), mainTvScreenMat);
mainTvScreen.position.z = 0.062;   // frame-ийн өмнө гарах
mainTvScreen.name = 'mainTvScreen';
mainTvScreen.userData.kind = 'tv';
mainTvG.add(mainTvScreen);

// ── VIDEO ELEMENT — JS-д шууд үүсгэнэ, DOM-оос хамааралгүй ──
const videoEl = document.createElement('video');
videoEl.loop    = false;
videoEl.muted   = false;   // дуу сонсогдоно
videoEl.playsInline = true;
videoEl.crossOrigin = 'anonymous';
videoEl.style.display = 'none';
document.body.appendChild(videoEl);

let videoTexture = null;
let tvPlaying    = false;

// VideoTexture үүсгэх — canplay дээр л дуудна
function setupVideoTexture() {
  if (videoTexture) { videoTexture.dispose(); videoTexture = null; }
  videoTexture = new THREE.VideoTexture(videoEl);
  videoTexture.minFilter    = THREE.LinearFilter;
  videoTexture.magFilter    = THREE.LinearFilter;
  videoTexture.generateMipmaps = false;
  // flipY: true (default) — PlaneGeometry-д зөв, урвуу харагдахгүй
  videoTexture.flipY        = true;
  mainTvScreenMat.map       = videoTexture;
  mainTvScreenMat.needsUpdate = true;
}

const mainTvPole = box(0.15, 0.6, 0.15, 0x111111, 0.3, 0.6);
mainTvPole.position.set(0, -1.85, 0); mainTvG.add(mainTvPole);
const mainTvBase = box(1.2, 0.06, 0.5, 0x111111, 0.3, 0.6);
mainTvBase.position.set(0, -2.18, 0); mainTvG.add(mainTvBase);
const bracket = box(0.4, 0.08, 0.2, 0x333333, 0.4, 0.5);
bracket.position.set(0, 0, 0.07); mainTvG.add(bracket);

mainTvG.position.set(0, 2.9, -roomD / 2 + 0.1);
mainTvG.userData.kind = 'tv';
room1Group.add(mainTvG);

const mainTvLight = new THREE.PointLight(0x1d4ed8, 1.5, 8);
mainTvLight.position.set(0, 2.9, -roomD / 2 + 1.0);
room1Group.add(mainTvLight);

// ── STUDENT DESKS + SEAT INTERACTION ──
// Сандлуудыг хадгалах массив — raycast-д ашиглана
const seatMeshes = [];   // { mesh, worldPos, deskX, deskZ }

function addDesk(x, z) {
  const dm = mat(0x8B6914, 0.7), lm = mat(0x2a2a2a, 0.4, 0.4);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.6), dm);
  top.position.set(x, 0.75, z); top.castShadow = top.receiveShadow = true; room1Group.add(top);
  [[0.45,0.27],[0.45,-0.27],[-0.45,0.27],[-0.45,-0.27]].forEach(([dx,dz]) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.75, 0.05), lm);
    l.position.set(x+dx, 0.375, z+dz); room1Group.add(l);
  });
  const seatZ = z + 0.58;
  const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.45), dm);
  seatMesh.position.set(x, 0.46, seatZ);
  seatMesh.userData.kind = 'seat';
  seatMesh.userData.seatWorldPos = new THREE.Vector3(x, 0.46, seatZ);
  room1Group.add(seatMesh);
  seatMeshes.push(seatMesh);

  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.38, 0.04), dm);
  back.position.set(x, 0.67, seatZ+0.205); room1Group.add(back);
  [[0.21,0.19],[0.21,-0.19],[-0.21,0.19],[-0.21,-0.19]].forEach(([dx,dz]) => {
    const sl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.46, 0.04), lm);
    sl.position.set(x+dx, 0.23, seatZ+dz); room1Group.add(sl);
  });
}
[[-2,1],[-2,-1],[-2,-3],[0,1],[0,-1],[0,-3],[2,1],[2,-1],[2,-3]].forEach(([x,z]) => addDesk(x,z));

// ── SITTING STATE ──
let isSitting = false;
let currentSeat = null;
let standingCameraPos = new THREE.Vector3();  // босоо байрлал хадгалах
let standingCameraRot = new THREE.Euler();

// Камерын өндрийн тохиргоо
const STAND_HEIGHT = 1.7;   // зогсож буй нүдний өндөр
const SIT_HEIGHT   = 0.85;  // суугаа нүдний өндөр (сандлын өндөр + 0.4)

function sitDown(seatMesh) {
  if (isSitting && currentSeat === seatMesh) {
    // Аль хэдийн энэ сандалд суусан бол босно
    standUp();
    return;
  }
  // Босоо байрлал хадгал
  standingCameraPos.copy(camera.position);
  standingCameraRot.copy(camera.rotation);

  const wp = seatMesh.userData.seatWorldPos;
  // Камерыг сандал руу шилжүүлнэ — сандлаас арагш бага зэрэг
  camera.position.set(wp.x, SIT_HEIGHT, wp.z + 0.3);
  // TV рүү харах
  camera.lookAt(0, 2.0, -roomD / 2);

  isSitting = true;
  currentSeat = seatMesh;

  // Highlight: суусан сандлыг ногоонооор тодруулна
  seatMeshes.forEach(s => {
    s.material.emissive = new THREE.Color(0x000000);
    s.material.emissiveIntensity = 0;
  });
  seatMesh.material = seatMesh.material.clone();
  seatMesh.material.emissive = new THREE.Color(0x00ff88);
  seatMesh.material.emissiveIntensity = 0.3;

  showHint('🪑 Суусан! [Дахин дарж босоорой]');
}

function standUp() {
  if (!isSitting) return;
  // Буцаж босоо байрлалд оч
  camera.position.copy(standingCameraPos);
  camera.rotation.copy(standingCameraRot);

  // Highlight арилгах
  if (currentSeat) {
    currentSeat.material.emissive = new THREE.Color(0x000000);
    currentSeat.material.emissiveIntensity = 0;
  }

  isSitting = false;
  currentSeat = null;
  showHint('');
}
window.standUp = standUp;

// Hint UI
function showHint(msg) {
  let hint = document.getElementById('seatHint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'seatHint';
    hint.style.cssText = `
      position:fixed; bottom:100px; left:50%; transform:translateX(-50%);
      background:rgba(0,0,0,0.75); color:#fff; padding:10px 20px;
      border-radius:8px; font-size:15px; pointer-events:none;
      transition:opacity 0.3s; z-index:1000;
    `;
    document.body.appendChild(hint);
  }
  hint.textContent = msg;
  hint.style.opacity = msg ? '1' : '0';
}

// ── CLICK / RAYCAST HANDLER ──
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onCanvasClick(event) {
  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width)  * 2 - 1;
  mouse.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(seatMeshes, false);
  if (hits.length > 0) {
    sitDown(hits[0].object);
    return;
  }
  // Сандал дээр биш дарвал — хэрэв суусан бол босно
  // (энийг хүссэн бол идэвхжүүлж болно)
  // if (isSitting) standUp();
}

// Hover effect — сандал дээр хулганаа аваачихад cursor өөрчлөгдөнө
function onCanvasMove(event) {
  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width)  * 2 - 1;
  mouse.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(seatMeshes, false);
  canvas.style.cursor = hits.length > 0 ? 'pointer' : 'default';

  // Hover highlight
  seatMeshes.forEach(s => {
    if (s !== currentSeat) {
      s.material.emissiveIntensity = 0;
    }
  });
  if (hits.length > 0 && hits[0].object !== currentSeat) {
    hits[0].object.material.emissive = new THREE.Color(0xffff00);
    hits[0].object.material.emissiveIntensity = 0.2;
  }
}

renderer.domElement.addEventListener('click', onCanvasClick);
renderer.domElement.addEventListener('mousemove', onCanvasMove);

// ── TEACHER DESK ──
const td = box(2.2, 0.07, 0.85, 0x5d3a0a, 0.6);
td.position.set(-2.5, 0.78, 3.5); room1Group.add(td);
[[1.05,0.375],[-1.05,0.375],[1.05,-0.375],[-1.05,-0.375]].forEach(([dx,dz]) => {
  const l = box(0.07, 0.78, 0.07, 0x1a1a1a, 0.3, 0.4);
  l.position.set(-2.5+dx, 0.39, 3.5+dz); room1Group.add(l);
});

// Teacher chair
const tcGroup = new THREE.Group();
tcGroup.position.set(-2.5, 0, 4.4);
tcGroup.userData.kind = 'teacherChair';
const tcSeat = box(0.55, 0.05, 0.5, 0x1a3a6e, 0.6);
tcSeat.position.set(0, 0.5, 0); tcGroup.add(tcSeat);
const tcBack = box(0.55, 0.5, 0.05, 0x1a3a6e, 0.6);
tcBack.position.set(0, 0.77, 0.25); tcGroup.add(tcBack);
[[0.24,0.21],[0.24,-0.21],[-0.24,0.21],[-0.24,-0.21]].forEach(([dx,dz]) => {
  const cl = box(0.05, 0.5, 0.05, 0x0a1a3a, 0.4, 0.3);
  cl.position.set(dx, 0.25, dz); tcGroup.add(cl);
});
const armR = box(0.04, 0.04, 0.35, 0x0a1a3a, 0.4, 0.3);
armR.position.set(0.3, 0.65, 0);
tcGroup.add(armR);
const armL = box(0.04, 0.04, 0.35, 0x0a1a3a, 0.4, 0.3);
armL.position.set(-0.3, 0.65, 0);
tcGroup.add(armL);
room1Group.add(tcGroup);

// Book + Laptop
const book = box(0.35, 0.04, 0.25, 0x8b1a1a, 0.7);
book.position.set(-2.0, 0.83, 3.5); room1Group.add(book);
const bookPage = box(0.33, 0.02, 0.23, 0xf5f0e0, 0.8);
bookPage.position.set(-2.0, 0.86, 3.5); room1Group.add(bookPage);
const laptop = box(0.4, 0.02, 0.3, 0x777777, 0.3, 0.6);
laptop.position.set(-3.2, 0.83, 3.5); room1Group.add(laptop);
const lapScreen = box(0.38, 0.28, 0.01, 0x1a1a2e, 0.2);
lapScreen.position.set(-3.2, 0.97, 3.36); lapScreen.rotation.x = -Math.PI / 5; room1Group.add(lapScreen);

// ── DOOR (LEFT WALL) ──
const doorGroup = new THREE.Group();
[
  [0, 2.12, 0, 1.0, 0.12, 0.18],
  [-0.44, 1.05, 0, 0.12, 2.1, 0.18],
  [0.44, 1.05, 0, 0.12, 2.1, 0.18],
].forEach(([x,y,z,w,h,d]) => {
  const f = box(w,h,d, 0x4a2e0f, 0.6); f.position.set(x,y,z); doorGroup.add(f);
});
const doorPivot = new THREE.Group();
doorPivot.position.set(-0.38, 0, 0);
const panel = new THREE.Mesh(new THREE.BoxGeometry(0.76, 2.0, 0.07), mat(0x7a4a22, 0.5));
panel.position.set(0.38, 1.0, 0); panel.castShadow = true; doorPivot.add(panel);
const d1 = box(0.6, 0.75, 0.02, 0x6a3a18, 0.5); d1.position.set(0.38, 1.52, 0.045); doorPivot.add(d1);
const d2 = box(0.6, 0.75, 0.02, 0x6a3a18, 0.5); d2.position.set(0.38, 0.52, 0.045); doorPivot.add(d2);
const hMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.1, metalness: 0.95 });
const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.13, 8), hMat);
handle.rotation.x = Math.PI / 2; handle.position.set(0.7, 1.0, 0.05); doorPivot.add(handle);
const hPlate = box(0.06, 0.14, 0.02, 0xd4af37, 0.1, 0.95);
hPlate.position.set(0.72, 1.0, 0.04); doorPivot.add(hPlate);
doorGroup.add(doorPivot);
doorGroup.position.set(-roomW / 2 + 0.09, 0, -1.0);
doorGroup.rotation.y = -Math.PI / 2;
doorGroup.userData.kind = 'labDoor';
room1Group.add(doorGroup);

let doorOpen = false, doorTarget = 0, doorCurrent = 0;
function toggleDoor() {
  doorOpen = !doorOpen;
  doorTarget = doorOpen ? -Math.PI * 0.75 : 0;
  const btn = document.getElementById('btnDoor');
  if (btn) {
    btn.textContent = doorOpen ? '🚪 Хаалга хаах' : '🚪 Хаалга нээх';
    btn.style.background = doorOpen ? 'rgba(239,68,38,0.9)' : 'rgba(245,158,11,0.9)';
  }
}
window.toggleDoor = toggleDoor;

// ── DECORATIONS ──
function addPlant(x, z) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.3, 8), mat(0x8b4513, 0.8));
  pot.position.set(x, 0.15, z); room1Group.add(pot);
  const bush = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), mat(0x2d7a2d, 0.9));
  bush.position.set(x, 0.55, z); room1Group.add(bush);
}
addPlant(-4.6, -4.6); addPlant(4.6, -4.6);

// Clock
const clockBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 16), mat(0xffffff, 0.5));
clockBase.rotation.x = Math.PI / 2; clockBase.position.set(4.2, 3.8, -4.9); room1Group.add(clockBase);
const clockRim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 8, 16), mat(0x333333, 0.4, 0.3));
clockRim.position.set(4.2, 3.8, -4.9); room1Group.add(clockRim);
const secHand = box(0.01, 0.18, 0.01, 0xff0000, 0.5);
secHand.position.set(4.2, 3.8, -4.87); room1Group.add(secHand);

// ── LIGHT TOGGLE ──
let lightOn = true;
function toggleLight() {
  lightOn = !lightOn;
  mainLight.intensity = lightOn ? 2.5 : 0;
  ambient.intensity   = lightOn ? 0.25 : 0.05;
  const btn = document.getElementById('btnLight');
  if (btn) btn.textContent = lightOn ? '💡 Гэрэл унтраах' : '💡 Гэрэл асаах';
}
window.toggleLight = toggleLight;

// ── PLAYLIST — статик + динамик файлууд ──
const STATIC_VIDEOS = [
  { name: 'Хичээл 1', url: new URL('./lesson1.mp4', import.meta.url).href }
];
let playlist = [...STATIC_VIDEOS], currentIdx = 0;

// ── canplay: нэг л удаа дуудна, texture солино ──
videoEl.addEventListener('canplay', () => {
  setupVideoTexture();
  videoEl.play().catch(() => {
    drawFallback('▶ Тоглуулах товч дарна уу');
  });
}, { once: false });   // once:false — шинэ src ачаалах бүрт дахин ажиллана

// ── error: файл олдоогүй ──
videoEl.addEventListener('error', () => {
  drawFallback('⚠ ' + (playlist[currentIdx]?.name || 'видео') + ' олдсонгүй');
  console.warn('room1: видео файл олдсонгүй:', videoEl.src);
});

// ── timeupdate: progress bar + texture refresh ──
videoEl.addEventListener('timeupdate', () => {
  if (!videoEl.duration) return;
  const pct = (videoEl.currentTime / videoEl.duration) * 100;
  const bar = document.getElementById('tvBar');
  if (bar) bar.style.width = pct + '%';
  const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  const tvTime = document.getElementById('tvTime');
  if (tvTime) tvTime.textContent = fmt(videoEl.currentTime) + ' / ' + fmt(videoEl.duration);
  if (videoTexture) videoTexture.needsUpdate = true;
});

// ── ended: дараагийн дараах ──
videoEl.addEventListener('ended', () => {
  if (currentIdx < playlist.length - 1) {
    playTrack(currentIdx + 1);
  } else {
    tvPlaying = false;
    updatePlayBtn();
    updateTVGlow(false);
    drawFallback('✅ Тоглуулж дууслаа');
    mainTvScreenMat.map = fallbackTex;
    mainTvScreenMat.needsUpdate = true;
  }
});

function loadTrack(idx) {
  if (!playlist.length) return;
  currentIdx = idx;
  // src солих — canplay event автоматаар дуудагдана
  videoEl.src = playlist[idx].url;
  videoEl.load();
  drawFallback('⏳ ' + playlist[idx].name + ' ачааллаж байна...');
  mainTvScreenMat.map = fallbackTex;
  mainTvScreenMat.needsUpdate = true;
  const ti = document.getElementById('trackInfo');
  if (ti) ti.textContent = '🎬 ' + playlist[idx].name;
  renderPlaylist();
}

function renderPlaylist() {
  const pl = document.getElementById('playlist');
  if (!pl) return;
  pl.innerHTML = playlist.map((t, i) =>
    `<div class="pl-item${i === currentIdx ? ' active' : ''}" onclick="playTrack(${i})">
      ${i === currentIdx ? '▶ ' : ''}${t.name}
    </div>`
  ).join('');
}

function playTrack(idx) {
  loadTrack(idx);
  // play() нь canplay event-ийн дараа л ажиллана — loadTrack дотор автомат
  tvPlaying = true; updatePlayBtn(); updateTVGlow(true);
}
window.playTrack = playTrack;

// Эхний track-г ачаална
setTimeout(() => loadTrack(0), 100);

// ── Файл оруулах (динамик нэмэлт) ──
const fileInput = document.getElementById('fileInput');
if (fileInput) {
  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newTracks = files.map(f => ({
      name: f.name.replace(/\.[^.]+$/, ''),
      url: URL.createObjectURL(f)
    }));
    playlist = [...STATIC_VIDEOS, ...newTracks];
    renderPlaylist();
    playTrack(STATIC_VIDEOS.length);
  });
}

function updatePlayBtn() {
  const btn = document.getElementById('btnPlayPause');
  if (btn) btn.textContent = tvPlaying ? '⏸ Зогсоох' : '▶ Тоглуулах';
}
function updateTVGlow(on) {
  mainTvLight.intensity = on ? 3.5 : 1.5;
  mainTvLight.color.set(on ? 0x8866ff : 0x1d4ed8);
}

window.audioPlayPause = () => {
  if (videoEl.readyState >= 2) {
    if (videoEl.paused) { videoEl.play().catch(() => {}); tvPlaying = true; }
    else { videoEl.pause(); tvPlaying = false; }
  } else {
    // Бэлэн болоогүй бол дахин load хийж тоглуулна
    videoEl.load();
    videoEl.addEventListener('canplay', () => videoEl.play().catch(() => {}), { once: true });
    tvPlaying = true;
  }
  updatePlayBtn(); updateTVGlow(tvPlaying);
};
window.audioPrev = () => { if (playlist.length) playTrack((currentIdx - 1 + playlist.length) % playlist.length); };
window.audioNext = () => { if (playlist.length) playTrack((currentIdx + 1) % playlist.length); };
window.audioMute = () => {
  if (!videoEl) return;
  videoEl.muted = !videoEl.muted;
  const btn = document.getElementById('btnMute');
  if (btn) btn.textContent = videoEl.muted ? '🔇' : '🔊';
};
window.seekAudio = (e) => {
  if (!videoEl || !videoEl.duration) return;
  const bar = document.getElementById('tvProgress');
  if (!bar) return;
  const rect = bar.getBoundingClientRect();
  videoEl.currentTime = ((e.clientX - rect.left) / rect.width) * videoEl.duration;
};
window.openTVOverlay = () => { const o = document.getElementById('tvOverlay'); if (o) o.style.display = 'block'; };
window.closeTV = () => { const o = document.getElementById('tvOverlay'); if (o) o.style.display = 'none'; };

// ── VR — TV INTERACTION ──
function toggleVideo() {
  if (!playlist.length) {
    window.openTVOverlay();
    return;
  }
  window.audioPlayPause();
}
room1Group.userData.toggleVideo = toggleVideo;

// ── UPDATE LOOP ──
let t = 0;
room1Group.userData.update = (delta) => {
  t += delta;

  // Door animation
  const diff = doorTarget - doorCurrent;
  if (Math.abs(diff) > 0.005) doorCurrent += diff * 0.08;
  doorPivot.rotation.y = doorCurrent;

  // TV screen glow — тоглуулж байвал pulse, байхгүй бол тайван
  if (tvPlaying && videoTexture && !videoEl.paused) {
    videoTexture.needsUpdate = true;
    mainTvLight.intensity = 2.8 + Math.sin(t * 6) * 0.5;
  } else if (!tvPlaying) {
    mainTvLight.intensity = 1.2 + Math.sin(t * 1.2) * 0.15;
  }

  // Clock second hand
  const s = new Date().getSeconds();
  secHand.rotation.z = -(s / 60) * Math.PI * 2;
};

// Cleanup function — өрөө солигдоход event listener-г арилгана
room1Group.userData.dispose = () => {
  renderer.domElement.removeEventListener('click', onCanvasClick);
  renderer.domElement.removeEventListener('mousemove', onCanvasMove);
  const hint = document.getElementById('seatHint');
  if (hint) hint.remove();
};

return room1Group;
}
