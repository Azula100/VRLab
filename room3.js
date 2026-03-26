import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
// ── ТОГТМОЛ УТГУУД ──
const CABLE_RULES = {
  'router-switch': 'straight',
  'pc1-switch'   : 'straight',
  'pc2-switch'   : 'straight',
  'pc1-pc2'      : 'crossover',
  'switch-switch': 'crossover',
};
const CONN_PAIRS  = { 1:'router-switch', 2:'pc1-switch', 3:'pc2-switch', 4:'pc1-pc2' };
const CONN_LABELS = { 1:'Router → Switch', 2:'Switch → PC1', 3:'Switch → PC2', 4:'PC1 ↔ PC2' };
const TOTAL_CONNS = 4;
const CONN_KEYS   = { 1:'rs', 2:'sp1', 3:'sp2', 4:'pp' };

export function createRoom3(scene, camera, renderer) {
  const room = new THREE.Group();
  scene.add(room);

  // ── STATE (Room3-т хамаарах) ──
  const st = {
    routerOn: false,
    selectedCableType: null,
    activeConn: null,
    cables: { rs:false, sp1:false, sp2:false, pp:false },
    positions: {},
    packets: [],
    indicators: {},
    powerLight: null,
    correctConns: 0,
    wrongAttempts: 0,
    vrFirstNode: null,
    vrCableHeld: false,
    vrCableStart: null,
    vrTempCable: null,
    playerRig: null,
    moveSpeed: 0.03,
  };

  const cableObjects = { rs:null, sp1:null, sp2:null, pp:null };
  const cableLabels  = {};
  const clickableObjects = [];

  // ======================
  // ШАЛ
  // ======================
  const roomW = 10, roomH = 5, roomD = 10;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomW, roomD),
    new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData = { teleport: true };
  room.add(floor);

  // ======================
  // ХАНА + ТААЗ
  // ======================
  function makeMat(color, rough = 0.8, metal = 0) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  }
  const wallMat = makeMat(0xd4c9b0, 0.9);
  [
    { pos:[0, roomH/2, -roomD/2],  rot:[0,0,0] },
    { pos:[0, roomH/2,  roomD/2],  rot:[0,Math.PI,0] },
    { pos:[-roomW/2, roomH/2, 0],  rot:[0,Math.PI/2,0] },
    { pos:[ roomW/2, roomH/2, 0],  rot:[0,-Math.PI/2,0] },
  ].forEach(({ pos, rot }) => {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), wallMat.clone());
    w.position.set(...pos); w.rotation.set(...rot);
    w.receiveShadow = true; room.add(w);
  });
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(roomW, roomD),
    makeMat(0xf0ece0, 0.9)
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, roomH, 0);
  room.add(ceiling);

  // ======================
  // ГЭРЭЛТҮҮЛЭГ
  // ======================
  room.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
  room.add(new THREE.AmbientLight(0x404040, 2));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(3, 10, 10);
  dirLight.castShadow = true;
  room.add(dirLight);

  // Таазны гэрэл
  [-2, 2].forEach(x => {
    const pt = new THREE.PointLight(0xfffde7, 2.5, 8);
    pt.position.set(x, roomH - 0.2, -1);
    pt.castShadow = true;
    room.add(pt);
    const fix = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.08, 0.6),
      makeMat(0xeeeeee, 0.4)
    );
    fix.position.set(x, roomH - 0.04, -1);
    room.add(fix);
  });

  // ======================
  // БУЦАХ ХААЛГА → ROOM2
  // ======================
  const backDoor = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 0.2),
    new THREE.MeshStandardMaterial({ color: 0xff6600, transparent: true, opacity: 0.8 })
  );
  backDoor.position.set(-3, 1, roomD / 2 - 0.15);
  backDoor.name = "backDoor_to_room2";
  backDoor.userData = { kind: "backDoor" };
  room.add(backDoor);

  // Буцах хаалганы label
  const bcCanvas = document.createElement("canvas");
  bcCanvas.width = 512; bcCanvas.height = 128;
  const bcCtx = bcCanvas.getContext("2d");
  bcCtx.fillStyle = "#ff6600";
  bcCtx.font = "bold 40px Arial";
  bcCtx.textAlign = "center";
  bcCtx.textBaseline = "middle";
  bcCtx.fillText("← Буцах", 256, 64);
  const bcLabel = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(bcCanvas), transparent: true })
  );
  bcLabel.position.set(-3, 2.4, roomD / 2 - 0.15);
  bcLabel.scale.set(1.2, 0.3, 1);
  room.add(bcLabel);

  // ======================
  // САМБАР (canvas)
  // ======================
  const BOARD_W = 2.8, BOARD_H = 1.8;
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 1024; boardCanvas.height = 640;
  const boardCtx = boardCanvas.getContext('2d');
  const boardTex = new THREE.CanvasTexture(boardCanvas);

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath();
  }

  function drawBoardIdle() {
    const c = boardCtx, w = boardCanvas.width, h = boardCanvas.height;
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#0f172a';
    roundRect(c, 0, 0, w, h, 24); c.fill();
    c.strokeStyle = 'rgba(0,212,255,0.25)'; c.lineWidth = 4;
    roundRect(c, 2, 2, w-4, h-4, 22); c.stroke();
    c.fillStyle = '#00d4ff';
    c.font = 'bold 36px Segoe UI, Arial';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('🔬 Лабораторийн дасгал', w/2, h/2 - 30);
    c.fillStyle = '#334155';
    c.font = '28px Segoe UI, Arial';
    c.fillText('Router асаагаад кабель холбоно уу', w/2, h/2 + 20);
    boardTex.needsUpdate = true;
  }

  function drawBoardResult() {
    const correct = st.correctConns, wrong = st.wrongAttempts, total = TOTAL_CONNS;
    const pct = Math.round((correct / total) * 100);
    let grade, gradeColor;
    if      (pct === 100) { grade = '🏆 Маш сайн!';        gradeColor = '#00ff88'; }
    else if (pct >= 75)   { grade = '👍 Сайн';              gradeColor = '#4ade80'; }
    else if (pct >= 50)   { grade = '📚 Дунд зэрэг';       gradeColor = '#facc15'; }
    else                  { grade = '❌ Дахин оролдоорой'; gradeColor = '#f87171'; }

    const c = boardCtx, w = boardCanvas.width, h = boardCanvas.height;
    c.clearRect(0, 0, w, h);
    const bg = c.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0f172a'); bg.addColorStop(1, '#1e293b');
    c.fillStyle = bg; roundRect(c, 0, 0, w, h, 28); c.fill();
    c.shadowColor = gradeColor; c.shadowBlur = 24;
    c.strokeStyle = gradeColor; c.lineWidth = 3;
    roundRect(c, 3, 3, w-6, h-6, 26); c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = '#94a3b8';
    c.font = 'bold 30px Segoe UI, Arial';
    c.textAlign = 'center'; c.textBaseline = 'top';
    c.fillText('📋  ДАСГАЛ ДУУСЛАА', w/2, 28);
    c.fillStyle = gradeColor;
    c.font = 'bold 148px Segoe UI, Arial';
    c.textAlign = 'center'; c.textBaseline = 'top';
    c.fillText(pct + '%', w/2, 72);
    c.font = 'bold 38px Segoe UI, Arial';
    c.fillText(grade, w/2, 242);
    const boxes = [
      { label:'Зөв', value:correct, color:'#4ade80' },
      { label:'Нийт', value:total,  color:'#94a3b8' },
      { label:'Буруу', value:wrong, color:'#f87171' },
    ];
    const boxW=260, boxH=160, boxY=345, gap=(w - boxes.length*boxW)/(boxes.length+1);
    boxes.forEach((box, i) => {
      const bx = gap + i*(boxW+gap);
      c.fillStyle = 'rgba(255,255,255,0.05)';
      roundRect(c, bx, boxY, boxW, boxH, 16); c.fill();
      c.strokeStyle = box.color+'55'; c.lineWidth = 2;
      roundRect(c, bx, boxY, boxW, boxH, 16); c.stroke();
      c.fillStyle = box.color;
      c.font = 'bold 72px Segoe UI, Arial';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(box.value, bx+boxW/2, boxY+boxH*0.44);
      c.fillStyle = '#64748b';
      c.font = '22px Segoe UI, Arial';
      c.textAlign = 'center'; c.textBaseline = 'top';
      c.fillText(box.label, bx+boxW/2, boxY+boxH-38);
    });
    boardTex.needsUpdate = true;
  }

  drawBoardIdle();

  const boardGroup = new THREE.Group();
  boardGroup.add(new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_W+0.1, BOARD_H+0.1, 0.04),
    new THREE.MeshStandardMaterial({ color:0x1e293b, roughness:0.4, metalness:0.7 })
  ));
  const boardMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(BOARD_W, BOARD_H),
    new THREE.MeshBasicMaterial({ map: boardTex, side: THREE.FrontSide })
  );
  boardGroup.add(boardMesh);
  boardGroup.position.set(0, 1.9, -roomD/2 + 0.12);
  room.add(boardGroup);

  // ======================
  // VR CONTROLLERS (room3 дотор)
  // ======================
  const cmf = new XRControllerModelFactory();
  const ctrlR = renderer.xr.getController(0);
  const ctrlRGrip = renderer.xr.getControllerGrip(0);
  ctrlRGrip.add(cmf.createControllerModel(ctrlRGrip));

  const rayGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -3)
  ]);
  const rayMat = new THREE.LineBasicMaterial({ color:0x00d4ff, transparent:true, opacity:0.75 });
  const rayLine = new THREE.Line(rayGeom, rayMat);
  ctrlR.add(rayLine);

  const hoverSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 16, 16),
    new THREE.MeshBasicMaterial({ color:0x00ffcc, transparent:true, opacity:0.35, wireframe:true })
  );
  hoverSphere.visible = false;
  room.add(hoverSphere);

  const firstNodeMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 16, 16),
    new THREE.MeshBasicMaterial({ color:0xffaa00, transparent:true, opacity:0.6, wireframe:true })
  );
  firstNodeMarker.visible = false;
  room.add(firstNodeMarker);

  // ======================
  // ТУСЛАХ ФУНКЦҮҮД
  // ======================

  // ✅ connIdx тодорхойлох — нэг функцэд төвлөрүүлсэн
  function resolveConnIdx(nodeA, nodeB) {
    const sorted = [nodeA, nodeB].sort().join('-');
    if (sorted === 'router-switch') return 1;
    if (sorted === 'pc1-switch')    return 2;
    if (sorted === 'pc2-switch')    return 3;
    if (sorted === 'pc1-pc2')       return 4;
    return null;
  }

  function makeCableMesh(start, end, color) {
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.y -= 0.18;
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const pts = curve.getPoints(40);
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.016, 8, false);
    const mat = new THREE.MeshStandardMaterial({ color, emissive:0x000000, emissiveIntensity:0 });
    const mesh = new THREE.Mesh(geo, mat);
    room.add(mesh);
    return mesh;
  }

  function makeFloatingLabel(text, color, position) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.roundRect(4, 4, 248, 56, 12); ctx.fill();
    const hex = '#' + color.toString(16).padStart(6, '0');
    ctx.strokeStyle = hex; ctx.lineWidth = 3;
    ctx.roundRect(4, 4, 248, 56, 12); ctx.stroke();
    ctx.fillStyle = hex;
    ctx.font = 'bold 28px Segoe UI,Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 34);
    const tex = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, depthTest:false }));
    sp.scale.set(0.45, 0.11, 1);
    sp.position.copy(position);
    room.add(sp);
    return sp;
  }

  function setRoomStatus(msg) {
    // HTML #status байвал шинэчлэнэ, үгүй бол console-д
    const el = document.getElementById('status');
    if (el) el.textContent = msg;
    else console.log('[Room3]', msg);
  }

  function addIndicator(pos, name) {
    const l = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x444444 })
    );
    l.position.set(pos.x, pos.y + 0.25, pos.z);
    room.add(l);
    st.indicators[name] = l;
  }

  // ======================
  // VALIDATE & CONNECT
  // ======================
  function validateAndConnect(connIndex) {
    if (!st.routerOn) { setRoomStatus('Router асаагаагүй!'); return; }
    if (!st.selectedCableType) { setRoomStatus('Кабелийн төрөл сонгоно уу!'); return; }
    const pairKey  = CONN_PAIRS[connIndex];
    const required = CABLE_RULES[pairKey];
    const chosen   = st.selectedCableType;
    const key      = CONN_KEYS[connIndex];

    if (chosen === required) {
      drawCable(key, chosen);
      st.correctConns++;
      setRoomStatus(`✅ Зөв! ${CONN_LABELS[connIndex]} — ${chosen}`);
      checkAllConnected();
    } else {
      st.wrongAttempts++;
      setRoomStatus(`❌ Буруу! ${CONN_LABELS[connIndex]}-д ${required} хэрэгтэй`);
      // Буруу эффект — кабелиуд улаан болно
      Object.values(cableObjects).forEach(c => {
        if (c) {
          const o = c.material.color.clone();
          c.material.color.setHex(0xff0000);
          setTimeout(() => { if (c.material) c.material.color.copy(o); }, 400);
        }
      });
    }

    // ✅ Temp cable арилгана
    st.activeConn   = null;
    st.vrFirstNode  = null;
    firstNodeMarker.visible = false;
    rayMat.color.setHex(0x00d4ff);
    if (st.vrTempCable) { room.remove(st.vrTempCable); st.vrTempCable = null; }
  }

  function drawCable(key, cableType) {
    const p = st.positions;
    if (!p.router) return;
    if (cableObjects[key]) { room.remove(cableObjects[key]); cableObjects[key] = null; }
    if (cableLabels[key])  { room.remove(cableLabels[key]);  cableLabels[key]  = null; }
    let start, end;
    if (key === 'rs')  { start = p.router.clone();  end = p.switch1.clone(); }
    if (key === 'sp1') { start = p.switch1.clone(); end = p.pc1.clone(); }
    if (key === 'sp2') { start = p.switch1.clone(); end = p.pc2.clone(); }
    if (key === 'pp')  { start = p.pc1.clone();     end = p.pc2.clone(); }
    const color = cableType === 'straight' ? 0x4ade80 : 0xf97316;
    cableObjects[key] = makeCableMesh(start, end, color);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.y += 0.22;
    cableLabels[key] = makeFloatingLabel(cableType === 'straight' ? 'Straight' : 'Crossover', color, mid);
    st.cables[key] = true;
  }

  function checkAllConnected() {
    const allDone = st.cables.rs && st.cables.sp1 && st.cables.sp2 && st.cables.pp && st.routerOn;
    if (allDone) {
      setRoomStatus('🏆 Бүх 4 холболт зөв! Мэдээлэл урсаж байна...');
      ['rs','sp1','sp2','pp'].forEach(k => {
        if (cableObjects[k]) {
          cableObjects[k].material.emissive.setHex(0x00aa44);
          cableObjects[k].material.emissiveIntensity = 0.4;
        }
      });
      Object.values(st.indicators).forEach(i => {
        if (i) i.material.color.setHex(0x00ffcc);
      });
      drawBoardResult();
    }
  }

  // ======================
  // RESET
  // ======================
  function resetRoom3() {
    ['rs','sp1','sp2','pp'].forEach(k => {
      if (cableObjects[k]) { room.remove(cableObjects[k]); cableObjects[k] = null; }
      if (cableLabels[k])  { room.remove(cableLabels[k]);  cableLabels[k]  = null; }
      st.cables[k] = false;
    });
    st.packets.forEach(p => room.remove(p.mesh));
    st.packets.length = 0;
    st.activeConn     = null;
    st.vrFirstNode    = null;
    st.correctConns   = 0;
    st.wrongAttempts  = 0;
    firstNodeMarker.visible = false;
    if (st.vrTempCable) { room.remove(st.vrTempCable); st.vrTempCable = null; }
    drawBoardIdle();
    setRoomStatus('Кабелиуд арилгагдлаа.');
  }

  // ======================
  // VR RAY HIT
  // ======================
  function vrRayHit() {
    const m = new THREE.Matrix4();
    m.identity().extractRotation(ctrlR.matrixWorld);
    const rc = new THREE.Raycaster();
    rc.ray.origin.setFromMatrixPosition(ctrlR.matrixWorld);
    rc.ray.direction.set(0, 0, -1).applyMatrix4(m);
    const hits = rc.intersectObjects(clickableObjects, true);
    return hits.length ? hits[0] : null;
  }

  // ======================
  // VR TRIGGER (selectstart)
  // ======================
  function onVRTrigger() {
    if (!st.routerOn)         { setRoomStatus('Router асаана уу! [A]'); return; }
    if (!st.selectedCableType){ setRoomStatus('Кабель төрөл сонгоно уу! [X/Y]'); return; }
    const hit = vrRayHit();
    if (!hit) return;

    // ✅ parent chain шалгана
    let obj = hit.object;
    while (obj) {
      if (obj.userData?.nodeName) break;
      obj = obj.parent;
    }
    const nodeName = obj?.userData?.nodeName;
    if (!nodeName) return;

    if (st.vrFirstNode) {
      const first = st.vrFirstNode, second = nodeName;
      if (first === second) { setRoomStatus('Өөр node сонгоно уу!'); return; }
      const connIdx = resolveConnIdx(first, second);
      if (connIdx) {
        st.activeConn = connIdx;
        validateAndConnect(connIdx);
        vrFlash(hit.point, st.selectedCableType === 'straight' ? 0x4ade80 : 0xf97316);
      } else {
        setRoomStatus(`❌ "${first}" ↔ "${second}" холболт тодорхойгүй`);
        // ✅ temp cable арилгана
        st.vrFirstNode = null;
        firstNodeMarker.visible = false;
        rayMat.color.setHex(0x00d4ff);
        if (st.vrTempCable) { room.remove(st.vrTempCable); st.vrTempCable = null; }
      }
    } else {
      st.vrFirstNode = nodeName;
      const wp = new THREE.Vector3();
      hit.object.getWorldPosition(wp);
      firstNodeMarker.position.copy(wp);
      firstNodeMarker.visible = true;
      rayMat.color.setHex(0xffaa00);
      setRoomStatus(`✅ "${nodeName}" сонгогдлоо — хоёрдох node дарна уу`);
      vrPulse(nodeName);
    }
  }

  // ======================
  // VR GRIP
  // ======================
  function onVRGripDown() {
    const hit = vrRayHit();
    if (!hit) return;
    let obj = hit.object;
    while (obj) {
      if (obj.userData?.nodeName) break;
      obj = obj.parent;
    }
    if (!obj?.userData?.nodeName) return;
    st.vrCableHeld  = true;
    st.vrCableStart = obj.userData.nodeName;
    st.vrFirstNode  = null;
    firstNodeMarker.visible = false;
    rayMat.color.setHex(0xffaa00);
  }

  function onVRGripUp() {
    if (!st.vrCableHeld) return;
    st.vrCableHeld = false;
    rayMat.color.setHex(0x00d4ff);
    // ✅ temp cable арилгана
    if (st.vrTempCable) { room.remove(st.vrTempCable); st.vrTempCable = null; }

    const hit = vrRayHit();
    if (!hit) { setRoomStatus('Холбогдсонгүй'); st.vrCableStart = null; return; }
    let obj = hit.object;
    while (obj) {
      if (obj.userData?.nodeName) break;
      obj = obj.parent;
    }
    if (!obj?.userData?.nodeName) { st.vrCableStart = null; return; }

    const startNode = st.vrCableStart, endNode = obj.userData.nodeName;
    if (startNode === endNode) { setRoomStatus('Өөр node сонгоно уу!'); st.vrCableStart = null; return; }

    const connIdx = resolveConnIdx(startNode, endNode);
    if (connIdx) {
      st.activeConn = connIdx;
      validateAndConnect(connIdx);
      vrFlash(hit.point, st.selectedCableType === 'straight' ? 0x4ade80 : 0xf97316);
    } else {
      setRoomStatus(`❌ "${startNode}" → "${endNode}" холболт байхгүй`);
    }
    st.vrCableStart = null;
  }

  // ======================
  // VR EFFECTS
  // ======================
  function vrPulse(nodeName) {
    const keyMap = { router:'router', switch:'switch1', pc1:'pc1', pc2:'pc2' };
    const pos = st.positions[keyMap[nodeName]];
    if (!pos) return;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.15, 32),
      new THREE.MeshBasicMaterial({ color:0x00d4ff, transparent:true, opacity:0.8, side:THREE.DoubleSide })
    );
    ring.position.copy(pos); ring.rotation.x = -Math.PI / 2;
    room.add(ring);
    let t = 0;
    const anim = () => {
      t += 0.04;
      ring.scale.setScalar(1 + t * 2);
      ring.material.opacity = Math.max(0, 0.8 - t);
      if (t < 1) requestAnimationFrame(anim); else room.remove(ring);
    };
    anim();
  }

  function vrFlash(pos, color) {
    const l = new THREE.PointLight(color, 5, 2);
    l.position.copy(pos);
    room.add(l);
    let v = 5;
    const fade = () => {
      v -= 0.3; l.intensity = v;
      if (v > 0) requestAnimationFrame(fade); else room.remove(l);
    };
    fade();
  }

  // ======================
  // VR HOVER UPDATE
  // ======================
  function updateVRHover() {
    if (!renderer.xr.isPresenting) return;
    const hit = vrRayHit();
    if (hit && hit.object.userData.nodeName) {
      const wp = new THREE.Vector3();
      hit.object.getWorldPosition(wp);
      hoverSphere.position.copy(wp);
      hoverSphere.visible = true;
      rayLine.geometry.setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -hit.distance)
      ]);
    } else {
      hoverSphere.visible = false;
      rayLine.geometry.setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -3)
      ]);
    }

    // Temp cable харуулах
    const srcNodeName = st.vrCableHeld ? st.vrCableStart : (st.vrFirstNode || null);
    if (srcNodeName) {
      if (st.vrTempCable) room.remove(st.vrTempCable);
      const keyMap = { router:'router', switch:'switch1', pc1:'pc1', pc2:'pc2' };
      const sp = st.positions[keyMap[srcNodeName]];
      if (sp) {
        const ep = new THREE.Vector3();
        ctrlR.getWorldPosition(ep);
        st.vrTempCable = makeCableMesh(
          sp.clone(), ep,
          st.selectedCableType === 'crossover' ? 0xf97316 : 0x4ade80
        );
      }
    } else if (st.vrTempCable) {
      room.remove(st.vrTempCable);
      st.vrTempCable = null;
    }
  }

  // ======================
  // VR GAMEPAD
  // ======================
  const vrBtns = { A:false, B:false, X:false, Y:false };

  function handleVRGamepad(playerRig) {
    const session = renderer.xr.getSession();
    if (!session) return;
    session.inputSources.forEach(src => {
      const gp = src.gamepad;
      if (!gp) return;
      const h = src.handedness;
      if (h === 'right') {
        if (gp.buttons[4]?.pressed && !vrBtns.A) {
          vrBtns.A = true; togglePower();
        } else if (!gp.buttons[4]?.pressed) vrBtns.A = false;
        if (gp.buttons[5]?.pressed && !vrBtns.B) {
          vrBtns.B = true; resetRoom3();
        } else if (!gp.buttons[5]?.pressed) vrBtns.B = false;
      }
      if (h === 'left') {
        if (gp.buttons[4]?.pressed && !vrBtns.X) {
          vrBtns.X = true; st.selectedCableType = 'straight'; setRoomStatus('Straight сонгогдлоо');
        } else if (!gp.buttons[4]?.pressed) vrBtns.X = false;
        if (gp.buttons[5]?.pressed && !vrBtns.Y) {
          vrBtns.Y = true; st.selectedCableType = 'crossover'; setRoomStatus('Crossover сонгогдлоо');
        } else if (!gp.buttons[5]?.pressed) vrBtns.Y = false;
        // Хөдөлгөөн
        const ax = gp.axes[2] || 0, ay = gp.axes[3] || 0;
        if (Math.abs(ax) > 0.15 || Math.abs(ay) > 0.15) {
          const dir = new THREE.Vector3();
          camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
          const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
          if (playerRig) {
            playerRig.position.addScaledVector(dir, -ay * st.moveSpeed);
            playerRig.position.addScaledVector(right, ax * st.moveSpeed);
          }
        }
      }
    });
  }

  // ======================
  // PACKET ANIMATION
  // ======================
  function spawnPacket(from, to, color) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshBasicMaterial({ color })
    );
    m.position.copy(from);
    room.add(m);
    st.packets.push({ mesh:m, from:from.clone(), to:to.clone(), t:0, speed:0.008+Math.random()*0.004 });
  }

  function updatePackets() {
    for (let i = st.packets.length - 1; i >= 0; i--) {
      const p = st.packets[i];
      p.t += p.speed;
      if (p.t >= 1) { room.remove(p.mesh); st.packets.splice(i, 1); }
      else p.mesh.position.lerpVectors(p.from, p.to, p.t);
    }
  }

  let packetTimer = 0;
  function spawnNetworkPackets() {
    if (!st.routerOn) return;
    const p = st.positions;
    if (st.cables.rs && st.cables.sp1 && st.cables.sp2 && p.router && p.switch1 && p.pc1 && p.pc2) {
      spawnPacket(p.router.clone(), p.switch1.clone(), 0xff3300);
      setTimeout(() => spawnPacket(p.switch1.clone(), p.pc1.clone(), 0x00ff88), 400);
      setTimeout(() => {
        spawnPacket(p.router.clone(), p.switch1.clone(), 0xff6600);
        setTimeout(() => spawnPacket(p.switch1.clone(), p.pc2.clone(), 0x0088ff), 400);
      }, 800);
    } else if (st.cables.rs && p.router && p.switch1) {
      spawnPacket(p.router.clone(), p.switch1.clone(), 0xff3300);
    }
    if (st.cables.pp && p.pc1 && p.pc2) {
      spawnPacket(p.pc1.clone(), p.pc2.clone(), 0xf97316);
      setTimeout(() => spawnPacket(p.pc2.clone(), p.pc1.clone(), 0xf97316), 600);
    }
  }

  // ======================
  // POWER TOGGLE
  // ======================
  function togglePower() {
    st.routerOn = !st.routerOn;
    const ind = st.indicators['router'];
    if (st.routerOn) {
      if (ind) ind.material.color.setHex(0x00ff44);
      if (st.powerLight) { st.powerLight.material.opacity = 0.8; st.powerLight.material.color.setHex(0x00ff44); }
      setRoomStatus('✅ Router асаагдлаа! Кабелийн төрөл сонгоод холбоно уу.');
    } else {
      if (ind) ind.material.color.setHex(0x444444);
      if (st.powerLight) st.powerLight.material.opacity = 0;
      st.packets.forEach(p => room.remove(p.mesh));
      st.packets.length = 0;
      setRoomStatus('Router унтарлаа.');
    }
  }

  // ======================
  // GLB LOAD — lab4.glb
  // ======================
  const loader = new GLTFLoader();
  loader.load(
    './lab4.glb',
    (gltf) => {
      const model = gltf.scene;
      const box3  = new THREE.Box3().setFromObject(model);
      const center = new THREE.Vector3();
      box3.getCenter(center);
      model.position.y -= box3.min.y;
      model.position.x -= center.x;
      model.position.z -= center.z;
      room.add(model);

      const router  = model.getObjectByName('router');
      const switch1 = model.getObjectByName('switch');
      const pc1     = model.getObjectByName('pc1');
      const pc2     = model.getObjectByName('pc2');

      if (!router || !switch1 || !pc1 || !pc2) {
        setRoomStatus('GLB: router/switch/pc1/pc2 нэр олдсонгүй');
        return;
      }

      // Router өнгө
      router.traverse(o => {
        if (o.isMesh) {
          o.material = o.material.clone();
          o.material.color.setHex(0x1a3a5c);
          o.material.emissive.setHex(0x051525);
          o.material.emissiveIntensity = 0.3;
          o.material.roughness = 0.4;
          o.material.metalness = 0.7;
        }
      });

      // Байрлалуудыг авна
      const r=new THREE.Vector3(), s=new THREE.Vector3(), p1=new THREE.Vector3(), p2=new THREE.Vector3();
      router.getWorldPosition(r);
      switch1.getWorldPosition(s);
      pc1.getWorldPosition(p1);
      pc2.getWorldPosition(p2);
      st.positions = { router:r, switch1:s, pc1:p1, pc2:p2 };

      // clickableObjects-д нэмнэ
      router.traverse(o => { o.userData.nodeName = 'router';  clickableObjects.push(o); });
      switch1.traverse(o => { o.userData.nodeName = 'switch'; clickableObjects.push(o); });
      pc1.traverse(o => { o.userData.nodeName = 'pc1';        clickableObjects.push(o); });
      pc2.traverse(o => { o.userData.nodeName = 'pc2';        clickableObjects.push(o); });

      addIndicator(r, 'router');
      addIndicator(s, 'switch');
      addIndicator(p1, 'pc1');
      addIndicator(p2, 'pc2');

      setRoomStatus('✅ Лаборатори бэлэн! Router асаагаад кабель холбоно уу.');
    },
    undefined,
    (err) => {
      console.error('lab4.glb ERROR:', err);
      setRoomStatus('lab4.glb олдсонгүй');
    }
  );

  // ======================
  // VR EVENT LISTENER
  // Room visible болох үед controller-ийг холбоно
  // ======================
  let vrEventsAttached = false;

  function attachVREvents() {
    if (vrEventsAttached) return;
    vrEventsAttached = true;
    ctrlR.addEventListener('selectstart', onVRTrigger);
    ctrlR.addEventListener('squeezestart', onVRGripDown);
    ctrlR.addEventListener('squeezeend', onVRGripUp);
    scene.add(ctrlR);
    scene.add(ctrlRGrip);
  }

  function detachVREvents() {
    if (!vrEventsAttached) return;
    vrEventsAttached = false;
    ctrlR.removeEventListener('selectstart', onVRTrigger);
    ctrlR.removeEventListener('squeezestart', onVRGripDown);
    ctrlR.removeEventListener('squeezeend', onVRGripUp);
  }

  // ======================
  // UPDATE LOOP
  // main.js: room3.userData.update?.(delta, playerRig) дуудна
  // ======================
  let glowPhase = 0;
  room.userData.update = (delta, playerRig) => {
    if (!room.visible) return;

    // VR event зөвхөн room3 харагдаж байх үед
    if (renderer.xr.isPresenting) {
      attachVREvents();
      updateVRHover();
      handleVRGamepad(playerRig);
    } else {
      detachVREvents();
      hoverSphere.visible = false;
    }

    // Packet
    packetTimer += delta;
    if (packetTimer > 1.2) { packetTimer = 0; spawnNetworkPackets(); }
    updatePackets();

    // Glow
    const allGlow = st.cables.rs && st.cables.sp1 && st.cables.sp2 && st.cables.pp && st.routerOn;
    if (allGlow) {
      glowPhase += delta * 2;
      const intensity = 0.3 + 0.3 * Math.sin(glowPhase);
      ['rs','sp1','sp2','pp'].forEach(k => {
        if (cableObjects[k]) cableObjects[k].material.emissiveIntensity = intensity;
      });
    }

    // Хаалганы анивчих
    backDoor.material.opacity = 0.5 + 0.3 * Math.sin(performance.now() * 0.002);
  };

  // ======================
  // DESKTOP KEYBOARD
  // ======================
  room.userData.onKey = (key) => {
    if (!room.visible) return;
    if (key === 'p' || key === 'P') togglePower();
    if (key === '1') { st.selectedCableType = 'straight';  setRoomStatus('Straight сонгогдлоо'); }
    if (key === '2') { st.selectedCableType = 'crossover'; setRoomStatus('Crossover сонгогдлоо'); }
    if (key === 'r' || key === 'R') resetRoom3();
  };

  // ======================
  // DESKTOP CLICK — mouse raycaster
  // ======================
  room.userData.onClick = (raycasterMouse) => {
    if (!room.visible) return;
    if (!st.routerOn || !st.selectedCableType) return;
    const hits = raycasterMouse.intersectObjects(clickableObjects, true);
    if (!hits.length) return;
    let obj = hits[0].object;
    while (obj) {
      if (obj.userData?.nodeName) break;
      obj = obj.parent;
    }
    if (!obj?.userData?.nodeName) return;

    if (st.vrFirstNode) {
      const first = st.vrFirstNode, second = obj.userData.nodeName;
      if (first !== second) {
        const connIdx = resolveConnIdx(first, second);
        if (connIdx) { st.activeConn = connIdx; validateAndConnect(connIdx); }
        else setRoomStatus(`❌ "${first}" ↔ "${second}" холболт тодорхойгүй`);
      }
      st.vrFirstNode = null;
      firstNodeMarker.visible = false;
    } else {
      st.vrFirstNode = obj.userData.nodeName;
      const wp = new THREE.Vector3();
      obj.getWorldPosition(wp);
      firstNodeMarker.position.copy(wp);
      firstNodeMarker.visible = true;
      setRoomStatus(`"${obj.userData.nodeName}" сонгогдлоо — хоёрдохыг дарна уу`);
    }
  };

  return room;
}