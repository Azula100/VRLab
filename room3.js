import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {VRButton} from "three/addons/webxr/VRButton.js";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {XRControllerModelFactory} from "three/addons/webxr/XRControllerModelFactory.js";

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

const state = {
  routerOn:false, selectedCableType:null, activeConn:null,
  cables:{rs:false,sp1:false,sp2:false,pp:false},
  positions:{}, packets:[], indicators:{},
  powerLight:null, socket:null,
  ceilingLights:{light1:null,light2:null},
  lightStates:{light1:true,light2:true},
  vrCableHeld:false, vrCableStart:null, vrTempCable:null,
  vrHoveredNode:null, vrFirstNode:null,
  moveSpeed:0.03, playerRig:null,
  correctConns:0, wrongAttempts:0,
  vrSessionEnded: false,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202025);
scene.fog = new THREE.Fog(0x1a1a2e, 20, 40);
const camera   = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 100);
camera.position.set(0, 1.6, 3);
camera.lookAt(0, 1, 0);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

const roomW = 10, roomH = 5, roomD = 10;
function makeMat(color, rough=0.8, metal=0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

const floorMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.9 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

for (let i = -4; i <= 4; i++) {
  const g = new THREE.Mesh(
    new THREE.PlaneGeometry(0.02, roomD),
    new THREE.MeshStandardMaterial({ color: 0x6b5535 })
  );
  g.rotation.x = -Math.PI / 2;
  g.position.set(i, 0.001, 0);
  scene.add(g);
}
for (let i = -4; i <= 4; i++) {
  const g = new THREE.Mesh(
    new THREE.PlaneGeometry(roomW, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x6b5535 })
  );
  g.rotation.x = -Math.PI / 2;
  g.position.set(0, 0.001, i);
  scene.add(g);
}

const wallMatA = makeMat(0xd4c9b0, 0.9);
const wallBack = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), wallMatA);
wallBack.position.set(0, roomH / 2, -roomD / 2);
wallBack.receiveShadow = true;
scene.add(wallBack);

const wallFront = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), wallMatA.clone());
wallFront.rotation.y = Math.PI;
wallFront.position.set(0, roomH / 2, roomD / 2);
wallFront.receiveShadow = true;
scene.add(wallFront);

const wallLeft = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), wallMatA.clone());
wallLeft.rotation.y = Math.PI / 2;
wallLeft.position.set(-roomW / 2, roomH / 2, 0);
wallLeft.receiveShadow = true;
scene.add(wallLeft);

const wallRight = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), wallMatA.clone());
wallRight.rotation.y = -Math.PI / 2;
wallRight.position.set(roomW / 2, roomH / 2, 0);
wallRight.receiveShadow = true;
scene.add(wallRight);

const ceiling = new THREE.Mesh(
  new THREE.PlaneGeometry(roomW, roomD),
  makeMat(0xf0ece0, 0.9)
);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.set(0, roomH, 0);
ceiling.receiveShadow = true;
scene.add(ceiling);

const corniceMatC = makeMat(0xe8e0d0, 0.7);
const corniceH = 0.12, corniceD = 0.1;
[
  { pos:[0, roomH - corniceH/2, -roomD/2 + corniceD/2], rot:[0,0,0], w:roomW },
  { pos:[0, roomH - corniceH/2,  roomD/2 - corniceD/2], rot:[0,Math.PI,0], w:roomW },
  { pos:[-roomW/2 + corniceD/2, roomH - corniceH/2, 0], rot:[0,Math.PI/2,0], w:roomD },
  { pos:[ roomW/2 - corniceD/2, roomH - corniceH/2, 0], rot:[0,-Math.PI/2,0], w:roomD },
].forEach(({pos,rot,w})=>{
  const c = new THREE.Mesh(new THREE.BoxGeometry(w, corniceH, corniceD), corniceMatC);
  c.position.set(...pos); c.rotation.set(...rot); scene.add(c);
});

const baseH = 0.1, baseD = 0.06;
const baseMat = makeMat(0xc8b89a, 0.7);
[
  { pos:[0, baseH/2, -roomD/2 + baseD/2], w:roomW },
  { pos:[0, baseH/2,  roomD/2 - baseD/2], rot:[0,Math.PI,0], w:roomW },
  { pos:[-roomW/2 + baseD/2, baseH/2, 0], rot:[0,Math.PI/2,0], w:roomD },
  { pos:[ roomW/2 - baseD/2, baseH/2, 0], rot:[0,-Math.PI/2,0], w:roomD },
].forEach(({pos,rot=[0,0,0],w})=>{
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, baseH, baseD), baseMat);
  b.position.set(...pos); b.rotation.set(...rot); scene.add(b);
});

const doorGroup = new THREE.Group();
const frameMat = makeMat(0x5c3d1e, 0.6);
[
  [0.05, 1.05, 0, 0.1, 2.1, 0.15],
  [-0.9, 1.05, 0, 0.1, 2.1, 0.15],
  [-0.425, 2.15, 0, 0.95, 0.1, 0.15]
].forEach(([x,y,z,w,h,d])=>{
  const f=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),frameMat);
  f.position.set(x,y,z); f.castShadow=true; doorGroup.add(f);
});
const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.0, 0.07), makeMat(0x8B5E3C, 0.5));
doorPanel.position.set(-0.425, 1.0, 0); doorPanel.castShadow=true; doorGroup.add(doorPanel);
const deco1=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.8,0.02),makeMat(0x7a5230,0.5));
deco1.position.set(-0.425,1.5,0.045); doorGroup.add(deco1);
const deco2=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.8,0.02),makeMat(0x7a5230,0.5));
deco2.position.set(-0.425,0.5,0.045); doorGroup.add(deco2);
const handleMat=new THREE.MeshStandardMaterial({color:0xd4af37,roughness:0.1,metalness:0.9});
const handle=new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,0.12,8),handleMat);
handle.rotation.x=Math.PI/2; handle.position.set(0,1.0,0.05); doorGroup.add(handle);
const handlePlate=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.15,0.02),handleMat);
handlePlate.position.set(0,1.0,0.04); doorGroup.add(handlePlate);
doorGroup.position.set(-roomW/2+0.08,0,-1.0); 
doorGroup.rotation.y=Math.PI/2;
scene.add(doorGroup);

const playerRig = new THREE.Group();
playerRig.add(camera);
scene.add(playerRig);
state.playerRig = playerRig;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0,1,0);
controls.update();

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
scene.add(new THREE.AmbientLight(0x404040, 2));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(3,10,10); dirLight.castShadow=true;
scene.add(dirLight);

// ── BOARD
const BOARD_W = 2.8, BOARD_H = 1.8;  
const boardCanvas  = document.createElement('canvas');
boardCanvas.width  = 1024;
boardCanvas.height = 640;
const boardCtx     = boardCanvas.getContext('2d');
const boardTex     = new THREE.CanvasTexture(boardCanvas);

function drawBoardIdle() {
  const c = boardCtx, w = boardCanvas.width, h = boardCanvas.height;
  c.clearRect(0,0,w,h);
  c.fillStyle = '#0f172a';
  roundRect(c,0,0,w,h,24); c.fill();
  c.strokeStyle = 'rgba(0,212,255,0.25)'; c.lineWidth = 4;
  roundRect(c,2,2,w-4,h-4,22); c.stroke();
  c.fillStyle = '#334155';
  c.font = 'bold 36px Segoe UI, Arial';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('VR дасгал явагдаж байна...', w/2, h/2);
  boardTex.needsUpdate = true;
}

function drawBoardResult() {
  const correct = state.correctConns;
  const wrong   = state.wrongAttempts;
  const total   = TOTAL_CONNS;
  const pct     = Math.round((correct / total) * 100);

  let grade, gradeColor;
  if      (pct===100){ grade='🏆 Маш сайн!';         gradeColor='#00ff88'; }
  else if (pct>=75)  { grade='👍 Сайн';               gradeColor='#4ade80'; }
  else if (pct>=50)  { grade='📚 Дунд зэрэг';        gradeColor='#facc15'; }
  else               { grade='❌ Дахин оролдоорой';  gradeColor='#f87171'; }

  const c = boardCtx, w = boardCanvas.width, h = boardCanvas.height;
  c.clearRect(0,0,w,h);

  const bg = c.createLinearGradient(0,0,0,h);
  bg.addColorStop(0,'#0f172a'); bg.addColorStop(1,'#1e293b');
  c.fillStyle = bg;
  roundRect(c,0,0,w,h,28); c.fill();

  c.shadowColor = gradeColor; c.shadowBlur = 24;
  c.strokeStyle = gradeColor; c.lineWidth = 3;
  roundRect(c,3,3,w-6,h-6,26); c.stroke();
  c.shadowBlur = 0;

  c.fillStyle = '#94a3b8';
  c.font = 'bold 30px Segoe UI, Arial';
  c.textAlign = 'center'; c.textBaseline = 'top';
  c.fillText('📋  VR ДАСГАЛ ДУУСЛАА', w/2, 28);

  c.fillStyle = gradeColor;
  c.font = 'bold 148px Segoe UI, Arial';
  c.textAlign = 'center'; c.textBaseline = 'top';
  c.fillText(pct + '%', w/2, 72);

  c.fillStyle = gradeColor;
  c.font = 'bold 38px Segoe UI, Arial';
  c.textAlign = 'center'; c.textBaseline = 'top';
  c.fillText(grade, w/2, 242);

  const barX=60, barY=300, barW=w-120, barH=20, barR=10;
  c.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(c,barX,barY,barW,barH,barR); c.fill();
  // Дүүрсэн хэсэг
  if(pct>0){
    const filled = barW * (pct/100);
    const grad = c.createLinearGradient(barX,0,barX+filled,0);
    grad.addColorStop(0, gradeColor + 'aa');
    grad.addColorStop(1, gradeColor);
    c.fillStyle = grad;
    roundRect(c, barX, barY, filled, barH, barR); c.fill();
  }

  const boxes = [
    { label:'Зөв холболт', value: correct, color:'#4ade80' },
    { label:'Нийт',        value: total,   color:'#94a3b8' },
    { label:'Буруу',       value: wrong,   color:'#f87171' },
  ];
  const boxW=260, boxH=160, boxY=345, gap=(w - boxes.length*boxW) / (boxes.length+1);
  boxes.forEach((box,i)=>{
    const bx = gap + i*(boxW+gap);
    c.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(c,bx,boxY,boxW,boxH,16); c.fill();
    c.strokeStyle = box.color+'55'; c.lineWidth=2;
    roundRect(c,bx,boxY,boxW,boxH,16); c.stroke();
    // Тоо
    c.fillStyle = box.color;
    c.font = 'bold 72px Segoe UI, Arial';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(box.value, bx+boxW/2, boxY+boxH*0.44);
    // Нэр
    c.fillStyle = '#64748b';
    c.font = '600 22px Segoe UI, Arial';
    c.textAlign = 'center'; c.textBaseline = 'top';
    c.fillText(box.label, bx+boxW/2, boxY+boxH-38);
  });

  c.fillStyle = '#475569';
  c.font = '22px Segoe UI, Arial';
  c.textAlign = 'center'; c.textBaseline = 'bottom';
  c.fillText('B товч → Дахин эхлэх   |   VR headset тайлах → Гарах', w/2, h-14);

  boardTex.needsUpdate = true;
}

function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}
drawBoardIdle();
const boardGroup = new THREE.Group();
const frameB = new THREE.Mesh(
  new THREE.BoxGeometry(BOARD_W+0.1, BOARD_H+0.1, 0.04),
  new THREE.MeshStandardMaterial({color:0x1e293b, roughness:0.4, metalness:0.7})
);
frameB.position.z = -0.022;
boardGroup.add(frameB);

const board = new THREE.Mesh(
  new THREE.PlaneGeometry(BOARD_W, BOARD_H),
  new THREE.MeshBasicMaterial({ map: boardTex, side: THREE.FrontSide })
);
boardGroup.add(board);

boardGroup.position.set(0, 1.9, -roomD/2 + 0.12);
boardGroup.rotation.y = 0;
scene.add(boardGroup);

const clickableObjects=[];
const raycaster=new THREE.Raycaster();
const mouse=new THREE.Vector2();

const cmf=new XRControllerModelFactory();
const ctrlR=renderer.xr.getController(0);
const ctrlRGrip=renderer.xr.getControllerGrip(0);
ctrlRGrip.add(cmf.createControllerModel(ctrlRGrip));
scene.add(ctrlR); scene.add(ctrlRGrip);
const ctrlL=renderer.xr.getController(1);
const ctrlLGrip=renderer.xr.getControllerGrip(1);
ctrlLGrip.add(cmf.createControllerModel(ctrlLGrip));
scene.add(ctrlL); scene.add(ctrlLGrip);

const rayGeom=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,-3)]);
const rayMat=new THREE.LineBasicMaterial({color:0x00d4ff,transparent:true,opacity:0.75});
const rayLine=new THREE.Line(rayGeom,rayMat);
ctrlR.add(rayLine);

const hoverSphere=new THREE.Mesh(
  new THREE.SphereGeometry(0.13,16,16),
  new THREE.MeshBasicMaterial({color:0x00ffcc,transparent:true,opacity:0.35,wireframe:true})
);
hoverSphere.visible=false; scene.add(hoverSphere);

const firstNodeMarker=new THREE.Mesh(
  new THREE.SphereGeometry(0.1,16,16),
  new THREE.MeshBasicMaterial({color:0xffaa00,transparent:true,opacity:0.6,wireframe:true})
);
firstNodeMarker.visible=false; scene.add(firstNodeMarker);

ctrlR.addEventListener('selectstart', onVRTrigger);
ctrlR.addEventListener('squeezestart', onVRGripDown);
ctrlR.addEventListener('squeezeend', onVRGripUp);

renderer.xr.addEventListener('sessionstart', () => {
  document.body.classList.add('vr-active');
  state.vrSessionEnded = false;
  hideVRResult();
  setStatus('VR горимд орлоо! A=Router B=Reset X=Straight Y=Crossover Trigger=Холбох','success');
});

renderer.xr.addEventListener('sessionend', () => {
  document.body.classList.remove('vr-active');
  state.vrSessionEnded = true;
  showVRResult();
  setStatus('VR-с гарлаа.','');
});

function showVRResult() {
  drawBoardResult();          
  const overlay = document.getElementById('vrResultOverlay');
  if (overlay) {
    const correct=state.correctConns,wrong=state.wrongAttempts,total=TOTAL_CONNS;
    const pct=Math.round((correct/total)*100);
    let grade='',gradeColor='';
    if(pct===100){grade='🏆 Маш сайн!';gradeColor='#00ff88';}
    else if(pct>=75){grade='👍 Сайн';gradeColor='#4ade80';}
    else if(pct>=50){grade='📚 Дунд зэрэг';gradeColor='#facc15';}
    else{grade='❌ Дахин оролдоорой';gradeColor='#f87171';}
    const $ = id => document.getElementById(id);
    if($('vrResCorrect')) $('vrResCorrect').textContent=correct;
    if($('vrResTotal'))   $('vrResTotal').textContent=total;
    if($('vrResWrong'))   $('vrResWrong').textContent=wrong;
    if($('vrResPct'))     { $('vrResPct').textContent=pct+'%'; $('vrResPct').style.color=gradeColor; }
    if($('vrResGrade'))   { $('vrResGrade').textContent=grade; $('vrResGrade').style.color=gradeColor; }
    const bar=$('vrResBar');
    if(bar){bar.style.width='0%';setTimeout(()=>{bar.style.width=pct+'%';bar.style.background=gradeColor;},50);}
    overlay.style.display='flex';
    overlay.style.opacity='0'; overlay.style.transform='scale(0.88)';
    requestAnimationFrame(()=>{
      overlay.style.transition='opacity 0.45s ease, transform 0.45s cubic-bezier(0.34,1.56,0.64,1)';
      overlay.style.opacity='1'; overlay.style.transform='scale(1)';
    });
  }
}

function hideVRResult() {
  drawBoardIdle();            
  const overlay = document.getElementById('vrResultOverlay');
  if (overlay) overlay.style.display = 'none';
}
window.hideVRResult = hideVRResult;

function exitVR() {
  const session = renderer.xr.getSession();
  if (session) session.end();
  else setStatus('VR session идэвхгүй.','error');
}
window.exitVR = exitVR;

// ── CABLE TYPE ──
function setCableType(type){
  state.selectedCableType=type;
  state.vrFirstNode=null; firstNodeMarker.visible=false;
  document.getElementById('btnStraight').classList.toggle('active', type==='straight');
  document.getElementById('btnCrossover').classList.toggle('active', type==='crossover');
  setStatus(`${type==='straight'?'🟢 Straight':'🟠 Crossover'} кабель сонгогдлоо`,'');
  showTooltip('Холбох заглуур сонгоно уу');
}
window.setCableType=setCableType;

function selectConn(n){
  if(!state.routerOn){setStatus('Эхлээд Router асаана уу!','error');return;}
  if(!state.selectedCableType){setStatus('Эхлээд кабелийн төрөл сонгоно уу!','error');return;}
  state.activeConn=n;
  document.querySelectorAll('.connBtn').forEach((b,i)=>b.classList.toggle('active',i===n-1));
  setStatus(`${CONN_LABELS[n]} → ${state.selectedCableType} кабелиар холбоно`,'');
}
window.selectConn=selectConn;

const CONN_KEYS={1:'rs',2:'sp1',3:'sp2',4:'pp'};
const cableObjects={rs:null,sp1:null,sp2:null,pp:null};
const cableLabels={};

function validateAndConnect(connIndex){
  if(!state.routerOn){setStatus('Router асаагаагүй!','error');return;}
  if(!state.selectedCableType){setStatus('Кабелийн төрөл сонгоно уу!','error');return;}
  const pairKey=CONN_PAIRS[connIndex];
  const required=CABLE_RULES[pairKey];
  const chosen=state.selectedCableType;
  const key=CONN_KEYS[connIndex];
  if(chosen===required){
    drawCable(key,chosen);
    state.correctConns++;
    setStatus(`✅ Зөв! ${CONN_LABELS[connIndex]} — ${chosen}`,'success');
    updateScoreBoard(); checkAllConnected();
  } else {
    state.wrongAttempts++;
    setStatus(`❌ Буруу! ${CONN_LABELS[connIndex]}-д ${required} хэрэгтэй`,'error');
    updateScoreBoard(); showWrongEffect();
  }
  state.activeConn=null; state.vrFirstNode=null; firstNodeMarker.visible=false;
  document.querySelectorAll('.connBtn').forEach(b=>b.classList.remove('active'));
}

function showWrongEffect(){
  Object.values(cableObjects).forEach(c=>{
    if(c){const o=c.material.color.clone();c.material.color.setHex(0xff0000);setTimeout(()=>{if(c.material)c.material.color.copy(o);},400);}
  });
}

function drawCable(key,cableType){
  const p=state.positions; if(!p.router) return;
  if(cableObjects[key]){scene.remove(cableObjects[key]);cableObjects[key]=null;}
  if(cableLabels[key]){scene.remove(cableLabels[key]);cableLabels[key]=null;}
  let start,end;
  if(key==='rs'){start=p.router.clone();end=p.switch1.clone();}
  if(key==='sp1'){start=p.switch1.clone();end=p.pc1.clone();}
  if(key==='sp2'){start=p.switch1.clone();end=p.pc2.clone();}
  if(key==='pp'){start=p.pc1.clone();end=p.pc2.clone();}
  const color=cableType==='straight'?0x4ade80:0xf97316;
  cableObjects[key]=makeCableMesh(start,end,color);
  const mid=new THREE.Vector3().addVectors(start,end).multiplyScalar(0.5); mid.y+=0.22;
  cableLabels[key]=makeFloatingLabel(cableType==='straight'?'Straight':'Crossover',color,mid);
  state.cables[key]=true;
  if(key==='rs') hideDashedCable();
  updateStatus();
}

function makeFloatingLabel(text,color,position){
  const c=document.createElement('canvas'); c.width=256; c.height=64;
  const ctx=c.getContext('2d');
  ctx.fillStyle='rgba(0,0,0,0.72)'; ctx.roundRect(4,4,248,56,12); ctx.fill();
  const hex='#'+color.toString(16).padStart(6,'0');
  ctx.strokeStyle=hex; ctx.lineWidth=3; ctx.roundRect(4,4,248,56,12); ctx.stroke();
  ctx.fillStyle=hex; ctx.font='bold 28px Segoe UI,Arial';
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,128,34);
  const tex=new THREE.CanvasTexture(c);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
  sp.scale.set(0.45,0.11,1); sp.position.copy(position); scene.add(sp); return sp;
}

// ── RESET ──
function resetCables(){
  ['rs','sp1','sp2','pp'].forEach(k=>{
    if(cableObjects[k]){scene.remove(cableObjects[k]);cableObjects[k]=null;}
    if(cableLabels[k]){scene.remove(cableLabels[k]);cableLabels[k]=null;}
    state.cables[k]=false;
  });
  state.packets.forEach(p=>scene.remove(p.mesh)); state.packets.length=0;
  state.activeConn=null; state.vrFirstNode=null;
  state.correctConns=0; state.wrongAttempts=0;
  firstNodeMarker.visible=false;
  document.querySelectorAll('.connBtn').forEach(b=>b.classList.remove('active'));
  document.getElementById('resultMsg').innerHTML='';
  showDashedCable();
  drawBoardIdle();
  updateStatus(); updateScoreBoard(); setStatus('Кабелиуд арилгагдлаа.','');
}
window.resetCables=resetCables;

// ── DESKTOP CLICK ──
renderer.domElement.addEventListener('click',e=>{
  if(!state.activeConn) return;
  mouse.x=(e.clientX/innerWidth)*2-1;
  mouse.y=-(e.clientY/innerHeight)*2+1;
  raycaster.setFromCamera(mouse,camera);
  const hits=raycaster.intersectObjects(clickableObjects,true);
  if(!hits.length) return;
  const nodeName=hits[0].object.userData.nodeName;
  if(!nodeName) return;
  const needed={1:['router','switch'],2:['switch','pc1'],3:['switch','pc2'],4:['pc1','pc2']}[state.activeConn];
  if(needed&&needed.includes(nodeName)) validateAndConnect(state.activeConn);
  else setStatus('Буруу объект дарлаа!','error');
});

renderer.domElement.addEventListener('mousemove',e=>{
  mouse.x=(e.clientX/innerWidth)*2-1;
  mouse.y=-(e.clientY/innerHeight)*2+1;
  raycaster.setFromCamera(mouse,camera);
  const hits=raycaster.intersectObjects(clickableObjects,true);
  document.body.style.cursor=(hits.length&&hits[0].object.userData.nodeName)?'pointer':'default';
});

// ── VR TRIGGER ──
function onVRTrigger(){
  if(!state.routerOn){setStatus('Router асаана уу! [A]','error');return;}
  if(!state.selectedCableType){setStatus('Кабель төрөл сонгоно уу! [X/Y]','error');return;}
  const hit=vrRayHit(); if(!hit) return;
  const nodeName=hit.object.userData.nodeName; if(!nodeName) return;
  if(state.vrFirstNode){
    const first=state.vrFirstNode, second=nodeName;
    if(first===second){setStatus('Өөр node сонгоно уу!','error');return;}
    const sorted=[first,second].sort().join('-');
    let connIdx=null;
    if(sorted==='router-switch') connIdx=1;
    else if(sorted==='pc1-switch') connIdx=(first==='pc1'||second==='pc1')?2:3;
    else if(sorted==='pc2-switch') connIdx=3;
    else if(sorted==='pc1-pc2') connIdx=4;
    if(connIdx){selectConn(connIdx);validateAndConnect(connIdx);vrFlash(hit.point,state.selectedCableType==='straight'?0x4ade80:0xf97316);}
    else setStatus(`❌ "${first}" ↔ "${second}" холболт тодорхойгүй`,'error');
    state.vrFirstNode=null; firstNodeMarker.visible=false; rayMat.color.setHex(0x00d4ff);
  } else {
    state.vrFirstNode=nodeName;
    const wp=new THREE.Vector3(); hit.object.getWorldPosition(wp);
    firstNodeMarker.position.copy(wp); firstNodeMarker.visible=true;
    rayMat.color.setHex(0xffaa00);
    setStatus(`✅ "${nodeName}" сонгогдлоо — хоёрдох node дарна уу`,'');
    vrPulse(nodeName);
  }
}

function onVRGripDown(){
  const hit=vrRayHit(); if(!hit||!hit.object.userData.nodeName) return;
  state.vrCableHeld=true; state.vrCableStart=hit.object.userData.nodeName;
  state.vrFirstNode=null; firstNodeMarker.visible=false;
  rayMat.color.setHex(0xffaa00);
}

function onVRGripUp(){
  if(!state.vrCableHeld) return;
  state.vrCableHeld=false; rayMat.color.setHex(0x00d4ff);
  if(state.vrTempCable){scene.remove(state.vrTempCable);state.vrTempCable=null;}
  const hit=vrRayHit();
  if(!hit||!hit.object.userData.nodeName){setStatus('Холбогдсонгүй','error');state.vrCableStart=null;return;}
  const startNode=state.vrCableStart, endNode=hit.object.userData.nodeName;
  if(startNode===endNode){setStatus('Өөр node сонгоно уу!','error');state.vrCableStart=null;return;}
  const sorted=[startNode,endNode].sort().join('-');
  let connIdx=null;
  if(sorted==='router-switch') connIdx=1;
  else if(sorted==='pc1-switch') connIdx=(startNode==='pc1'||endNode==='pc1')?2:3;
  else if(sorted==='pc2-switch') connIdx=3;
  else if(sorted==='pc1-pc2') connIdx=4;
  if(connIdx){selectConn(connIdx);validateAndConnect(connIdx);vrFlash(hit.point,state.selectedCableType==='straight'?0x4ade80:0xf97316);}
  else setStatus(`❌ "${startNode}" → "${endNode}" холболт байхгүй`,'error');
  state.vrCableStart=null;
}

// ── VR GAMEPAD ──
const vrBtns={A:false,B:false,X:false,Y:false};
function handleVRGamepad(){
  const session=renderer.xr.getSession(); if(!session) return;
  session.inputSources.forEach(src=>{
    const gp=src.gamepad; if(!gp) return;
    const h=src.handedness;
    if(h==='right'){
      if(gp.buttons[4]?.pressed&&!vrBtns.A){vrBtns.A=true;togglePower();}else if(!gp.buttons[4]?.pressed)vrBtns.A=false;
      if(gp.buttons[5]?.pressed&&!vrBtns.B){vrBtns.B=true;resetCables();}else if(!gp.buttons[5]?.pressed)vrBtns.B=false;
    }
    if(h==='left'){
      if(gp.buttons[4]?.pressed&&!vrBtns.X){vrBtns.X=true;setCableType('straight');}else if(!gp.buttons[4]?.pressed)vrBtns.X=false;
      if(gp.buttons[5]?.pressed&&!vrBtns.Y){vrBtns.Y=true;setCableType('crossover');}else if(!gp.buttons[5]?.pressed)vrBtns.Y=false;
      const ax=gp.axes[2]||0,ay=gp.axes[3]||0;
      if(Math.abs(ax)>0.15||Math.abs(ay)>0.15){
        const dir=new THREE.Vector3(); camera.getWorldDirection(dir); dir.y=0; dir.normalize();
        const right=new THREE.Vector3().crossVectors(dir,new THREE.Vector3(0,1,0));
        playerRig.position.addScaledVector(dir,-ay*state.moveSpeed);
        playerRig.position.addScaledVector(right,ax*state.moveSpeed);
      }
    }
  });
}

// ── VR HOVER ──
function updateVRHover(){
  if(!renderer.xr.isPresenting) return;
  const hit=vrRayHit();
  if(hit&&hit.object.userData.nodeName){
    const wp=new THREE.Vector3(); hit.object.getWorldPosition(wp);
    hoverSphere.position.copy(wp); hoverSphere.visible=true;
    rayLine.geometry.setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,-hit.distance)]);
  } else {
    hoverSphere.visible=false;
    rayLine.geometry.setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,-3)]);
  }
  if(state.vrCableHeld&&state.vrCableStart){
    if(state.vrTempCable) scene.remove(state.vrTempCable);
    const sp=state.positions[{router:'router',switch:'switch1',pc1:'pc1',pc2:'pc2'}[state.vrCableStart]];
    if(sp){const ep=new THREE.Vector3();ctrlR.getWorldPosition(ep);state.vrTempCable=makeCableMesh(sp.clone(),ep,state.selectedCableType==='crossover'?0xf97316:0x4ade80);}
  }
  if(state.vrFirstNode&&!state.vrCableHeld){
    if(state.vrTempCable) scene.remove(state.vrTempCable);
    const sp=state.positions[{router:'router',switch:'switch1',pc1:'pc1',pc2:'pc2'}[state.vrFirstNode]];
    if(sp){const ep=new THREE.Vector3();ctrlR.getWorldPosition(ep);state.vrTempCable=makeCableMesh(sp.clone(),ep,state.selectedCableType==='crossover'?0xf97316:0x4ade80);}
  } else if(!state.vrCableHeld&&!state.vrFirstNode&&state.vrTempCable){
    scene.remove(state.vrTempCable);state.vrTempCable=null;
  }
}

function vrRayHit(){
  const m=new THREE.Matrix4(); m.identity().extractRotation(ctrlR.matrixWorld);
  const rc=new THREE.Raycaster();
  rc.ray.origin.setFromMatrixPosition(ctrlR.matrixWorld);
  rc.ray.direction.set(0,0,-1).applyMatrix4(m);
  const hits=rc.intersectObjects(clickableObjects,true);
  return hits.length?hits[0]:null;
}

function vrPulse(nodeName){
  const pos=state.positions[{router:'router',switch:'switch1',pc1:'pc1',pc2:'pc2'}[nodeName]]; if(!pos) return;
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.1,0.15,32),new THREE.MeshBasicMaterial({color:0x00d4ff,transparent:true,opacity:0.8,side:THREE.DoubleSide}));
  ring.position.copy(pos); ring.rotation.x=-Math.PI/2; scene.add(ring);
  let t=0;
  const anim=()=>{t+=0.04;ring.scale.setScalar(1+t*2);ring.material.opacity=Math.max(0,0.8-t);if(t<1)requestAnimationFrame(anim);else scene.remove(ring);}; anim();
}

function vrFlash(pos,color){
  const l=new THREE.PointLight(color,5,2); l.position.copy(pos); scene.add(l);
  let v=5;const fade=()=>{v-=0.3;l.intensity=v;if(v>0)requestAnimationFrame(fade);else scene.remove(l);};fade();
}

// ── CABLE MESH ──
function makeCableMesh(start,end,color){
  const mid=new THREE.Vector3().addVectors(start,end).multiplyScalar(0.5); mid.y-=0.18;
  const curve=new THREE.QuadraticBezierCurve3(start,mid,end);
  const pts=curve.getPoints(40);
  const geo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),40,0.016,8,false);
  const mat=new THREE.MeshStandardMaterial({color,emissive:0x000000,emissiveIntensity:0});
  const mesh=new THREE.Mesh(geo,mat); scene.add(mesh); return mesh;
}

// ── DASHED CABLE ──
const dashedState={segs:[],fillT:0,filling:false,done:false,TOTAL:20};

function buildDashedCable(fromPos,toPos){
  dashedState.segs.forEach(s=>{scene.remove(s.dash);scene.remove(s.fill)});
  dashedState.segs=[];
  dashedState.fillT=0; dashedState.filling=false; dashedState.done=false;
  const mid=new THREE.Vector3((fromPos.x+toPos.x)*0.5,Math.max(fromPos.y,toPos.y)+0.2,(fromPos.z+toPos.z)*0.5);
  const curve=new THREE.QuadraticBezierCurve3(fromPos.clone(),mid,toPos.clone());
  const N=dashedState.TOTAL;
  for(let i=0;i<N;i++){
    const t0=i/N,t1=(i+0.55)/N;
    const pts=[];
    for(let s=0;s<=8;s++) pts.push(curve.getPoint(THREE.MathUtils.clamp(t0+(t1-t0)*(s/8),0,1)));
    const geo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),8,0.012,6,false);
    const dashMesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0x445566,transparent:true,opacity:0.5}));
    scene.add(dashMesh);
    const fillMesh=new THREE.Mesh(geo.clone(),new THREE.MeshBasicMaterial({color:0x00ff88,transparent:true,opacity:0}));
    fillMesh.visible=false; scene.add(fillMesh);
    dashedState.segs.push({dash:dashMesh,fill:fillMesh});
  }
}

function hideDashedCable(){dashedState.segs.forEach(s=>{s.dash.visible=false;s.fill.visible=false;});}
function showDashedCable(){
  dashedState.segs.forEach(s=>{s.dash.visible=true;s.fill.visible=false;});
  dashedState.fillT=0; dashedState.filling=false; dashedState.done=false;
}
function startDashedFill(){
  if(state.cables.rs) return;
  dashedState.fillT=0; dashedState.filling=true; dashedState.done=false;
  dashedState.segs.forEach(s=>{s.dash.visible=true;s.fill.visible=false;});
}
function stopDashedFill(){
  dashedState.filling=false; dashedState.done=false; dashedState.fillT=0;
  dashedState.segs.forEach(s=>{s.fill.visible=false;});
}
function updateDashedCable(delta){
  if(!dashedState.segs.length) return;
  if(state.cables.rs){hideDashedCable();return;}
  const N=dashedState.TOTAL;
  if(dashedState.done){
    const p=0.5+0.5*Math.sin(Date.now()*0.004);
    dashedState.segs.forEach(s=>{s.fill.visible=true;s.fill.material.opacity=0.5+p*0.5;});
    return;
  }
  if(!dashedState.filling) return;
  dashedState.fillT=Math.min(1,dashedState.fillT+delta*1.2);
  const visCount=Math.floor(dashedState.fillT*N);
  for(let i=0;i<N;i++){
    const s=dashedState.segs[i];
    if(i<visCount){s.fill.visible=true;s.fill.material.opacity=i===visCount-1?1.0:0.85;}
    else{s.fill.visible=false;}
  }
  if(dashedState.fillT>=1){dashedState.done=true;dashedState.filling=false;}
}

// ── WIFI + PHONE ──
const wifiGroup=new THREE.Group(); scene.add(wifiGroup);
const wifiRings=[]; let wifiPhase=0; let phoneObj=null; let wifiLineMesh=null;

function createWifiRings(rPos){
  wifiRings.forEach(r=>wifiGroup.remove(r)); wifiRings.length=0;
  for(let i=1;i<=3;i++){
    const r=new THREE.Mesh(new THREE.TorusGeometry(i*0.18,0.012,8,32),new THREE.MeshBasicMaterial({color:0x00d4ff,transparent:true,opacity:0}));
    r.position.copy(rPos); r.position.y+=0.3; r.rotation.x=Math.PI/2;
    r.userData.phase=(i-1)*0.6; wifiGroup.add(r); wifiRings.push(r);
  }
}
function createPhone(rPos){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.16,0.012),new THREE.MeshStandardMaterial({color:0x111111,roughness:0.3,metalness:0.8}));
  g.add(body);
  const scr=new THREE.Mesh(new THREE.BoxGeometry(0.065,0.13,0.013),new THREE.MeshBasicMaterial({color:0x1a88ff}));
  scr.position.z=0.001; g.add(scr);
  g.position.set(rPos.x+0.5,rPos.y+0.15,rPos.z+0.3); g.rotation.y=-0.5;
  scene.add(g); return g;
}
function createWifiLine(fromPos,toPos){
  if(wifiLineMesh) scene.remove(wifiLineMesh);
  const pts=[fromPos.clone().add(new THREE.Vector3(0,0.3,0)),toPos.clone()];
  const geo=new THREE.BufferGeometry().setFromPoints(pts);
  const mat=new THREE.LineDashedMaterial({color:0x00d4ff,dashSize:0.08,gapSize:0.05,transparent:true,opacity:0.8});
  wifiLineMesh=new THREE.Line(geo,mat); wifiLineMesh.computeLineDistances(); scene.add(wifiLineMesh);
}
function updateWifiLine(){
  if(!wifiLineMesh||!phoneObj) return;
  const rPos=state.positions.router; if(!rPos) return;
  const pts=[rPos.clone().add(new THREE.Vector3(0,0.3,0)),phoneObj.position.clone()];
  const geo=new THREE.BufferGeometry().setFromPoints(pts);
  wifiLineMesh.geometry.dispose(); wifiLineMesh.geometry=geo; wifiLineMesh.computeLineDistances();
}
function updateWifi(delta){
  if(!state.routerOn){wifiRings.forEach(r=>r.material.opacity=0);return;}
  wifiPhase+=delta;
  wifiRings.forEach(ring=>{
    const p=(wifiPhase*0.9+ring.userData.phase)%2;
    if(p<1){ring.scale.setScalar(0.4+p*0.9);ring.material.opacity=0.75*(1-p);}
    else{ring.scale.setScalar(0.4);ring.material.opacity=0;}
  });
  if(phoneObj) phoneObj.position.y+=Math.sin(wifiPhase*1.5)*0.0003;
}

function toggleLight(idx){
  const lk=`light${idx}`,l=state.ceilingLights[lk]; if(!l) return;
  const on=state.lightStates[lk]=!state.lightStates[lk];
  l.bulbMat.color.setHex(on?0xffdd88:0x888888);
  l.bulbMat.emissive.setHex(on?0x442200:0x000000);
  l.cone.material.opacity=on?0.4:0;
  l.light.intensity=on?1.5:0;
  document.getElementById(`lightBtn${idx}`).classList.toggle('on',on);
  setStatus(`Гэрэл ${idx} ${on?'асааллаа':'унтраалаа'}`,'success');
}
window.toggleLight=toggleLight;

// ===== 💡 ТААЗНЫ 2 ГЭРЭЛ =====
function addCeilingLight(x, z) {
  const group = new THREE.Group();

  // Fixture хайрцаг
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.08, 0.6),
    makeMat(0xeeeeee, 0.4)
  );
  box.castShadow = true;
  group.add(box);

  // Гэрлийн панел
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.02, 0.52),
    new THREE.MeshStandardMaterial({ color: 0xfffde7, emissive: 0xfffde7, emissiveIntensity: 3.0 })
  );
  panel.position.y = -0.05;
  group.add(panel);

  // Утас
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.008,0.25,6), makeMat(0x333333,0.5));
  wire.position.y = 0.165;
  group.add(wire);

  group.position.set(x, roomH - 0.04, z);
  scene.add(group);

  // Point light
  const light = new THREE.PointLight(0xfffde7, 2.5, 8);
  light.position.set(x, roomH - 0.2, z);
  light.castShadow = true;
  light.shadow.mapSize.width = 512;
  light.shadow.mapSize.height = 512;
  scene.add(light);

  return light;
}

const light1 = addCeilingLight(-2, -1);
const light2 = addCeilingLight(2, -1);

// ── WALL SOCKET ──
function createWallSocket(pos){
  const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,0.04),new THREE.MeshStandardMaterial({color:0xeeeecc})));
  [-0.025,0.025].forEach(ox=>{
    const h=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.05,8),new THREE.MeshStandardMaterial({color:0x111111}));
    h.rotation.z=Math.PI/2; h.position.set(ox,0,0.01); g.add(h);
  });
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.07,0.09,16),new THREE.MeshBasicMaterial({color:0xff4444,side:THREE.DoubleSide,transparent:true,opacity:0}));
  ring.position.z=0.025; g.add(ring); state.powerLight=ring;
  g.position.copy(pos); scene.add(g);
}
createWallSocket(new THREE.Vector3(-1.38,0.4,-0.2));

// ── POWER ──
function togglePower(){
  state.routerOn=!state.routerOn;
  const btn=document.getElementById('powerBtn');
  const ind=state.indicators['router'];
  if(state.routerOn){
    btn.textContent='Router Унтраах'; btn.classList.add('on');
    if(ind) ind.material.color.setHex(0x00ff44);
    if(state.powerLight){state.powerLight.material.opacity=0.8;state.powerLight.material.color.setHex(0x00ff44);}
    startDashedFill();
    setStatus('✅ Router асаагдлаа! Кабелийн төрөл сонгоод холбоно уу.','success');
    document.getElementById('powerStatus').textContent='Router: Асаалттай ✅';
  } else {
    btn.textContent='⚡ Router Асаах'; btn.classList.remove('on');
    if(ind) ind.material.color.setHex(0x444444);
    if(state.powerLight) state.powerLight.material.opacity=0;
    stopDashedFill();
    state.packets.forEach(p=>scene.remove(p.mesh)); state.packets.length=0;
    setStatus('Router унтарлаа.','');
    document.getElementById('powerStatus').textContent='Router: Унтарсан';
    document.getElementById('dataStatus').textContent='Өгөгдөл: Зогссон';
  }
}
window.togglePower=togglePower;

function addIndicator(pos,name){
  const l=new THREE.Mesh(new THREE.SphereGeometry(0.04,8,8),new THREE.MeshBasicMaterial({color:0x444444}));
  l.position.set(pos.x,pos.y+0.25,pos.z); scene.add(l); state.indicators[name]=l;
}

// ── PACKETS ──
function spawnPacket(from,to,color){
  const m=new THREE.Mesh(new THREE.SphereGeometry(0.04,8,8),new THREE.MeshBasicMaterial({color}));
  m.position.copy(from);
  m.add(new THREE.Mesh(new THREE.SphereGeometry(0.07,8,8),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.3})));
  scene.add(m);
  state.packets.push({mesh:m,from:from.clone(),to:to.clone(),t:0,speed:0.008+Math.random()*0.004});
}
function updatePackets(){
  for(let i=state.packets.length-1;i>=0;i--){
    const p=state.packets[i]; p.t+=p.speed;
    if(p.t>=1){scene.remove(p.mesh);state.packets.splice(i,1);}
    else p.mesh.position.lerpVectors(p.from,p.to,p.t);
  }
}
let packetTimer=0;
function spawnNetworkPackets(){
  if(!state.routerOn) return;
  const p=state.positions;
  const all3=state.cables.rs&&state.cables.sp1&&state.cables.sp2;
  if(all3&&p.router&&p.switch1&&p.pc1&&p.pc2){
    spawnPacket(p.router.clone(),p.switch1.clone(),0xff3300);
    setTimeout(()=>spawnPacket(p.switch1.clone(),p.pc1.clone(),0x00ff88),400);
    setTimeout(()=>{spawnPacket(p.router.clone(),p.switch1.clone(),0xff6600);setTimeout(()=>spawnPacket(p.switch1.clone(),p.pc2.clone(),0x0088ff),400);},800);
  } else if(state.cables.rs&&p.router&&p.switch1){
    spawnPacket(p.router.clone(),p.switch1.clone(),0xff3300);
  }
  if(state.cables.pp&&p.pc1&&p.pc2){
    spawnPacket(p.pc1.clone(),p.pc2.clone(),0xf97316);
    setTimeout(()=>spawnPacket(p.pc2.clone(),p.pc1.clone(),0xf97316),600);
  }
}

function checkAllConnected(){
  const allDone=state.cables.rs&&state.cables.sp1&&state.cables.sp2&&state.cables.pp&&state.routerOn;
  if(allDone){
    setStatus('🏆 Бүх 4 холболт зөв! Мэдээлэл урсаж байна...','success');
    document.getElementById('dataStatus').textContent='Өгөгдөл: Идэвхтэй 🟢';
    ['rs','sp1','sp2','pp'].forEach(k=>{if(cableObjects[k]){cableObjects[k].material.emissive.setHex(0x00aa44);cableObjects[k].material.emissiveIntensity=0.4;}});
    Object.values(state.indicators).forEach(i=>{if(i)i.material.color.setHex(0x00ffcc);});
    document.getElementById('resultMsg').innerHTML='<span style="color:#00ff88">🏆 Бүх холболт амжилттай!</span>';
  } else if(state.cables.rs&&state.cables.sp1&&state.cables.sp2&&state.routerOn){
    document.getElementById('dataStatus').textContent='Өгөгдөл: Хэсэгчлэн 🟡';
  }
}

function updateScoreBoard(){
  document.getElementById('correctCount').textContent=state.correctConns;
  document.getElementById('wrongCount').textContent=state.wrongAttempts;
}
function updateStatus(){
  const c=Object.values(state.cables).filter(Boolean).length;
  document.getElementById('cableStatus').textContent=`🔌 Холболт: ${c}/${TOTAL_CONNS}`;
}
// ── GLB LOAD ──
const loader=new GLTFLoader();
loader.load('./lab4.glb',gltf=>{
  const model=gltf.scene;
  const box=new THREE.Box3().setFromObject(model);
  const center=new THREE.Vector3(); box.getCenter(center);
  model.position.y-=box.min.y; model.position.x-=center.x; model.position.z-=center.z;
  scene.add(model);
  const router  =model.getObjectByName('router');
  const switch1 =model.getObjectByName('switch');
  const pc1     =model.getObjectByName('pc1');
  const pc2     =model.getObjectByName('pc2');
  const monitor1=model.getObjectByName('monitor1');
  const monitor2=model.getObjectByName('monitor2');
  const shiree1 =model.getObjectByName('shiree1');
  const sandal1 =model.getObjectByName('sandal1');
  const sandal2 =model.getObjectByName('sandal2');
  if(!router||!switch1||!pc1||!pc2){setStatus('GLB: router/switch/pc1/pc2 нэр олдсонгүй','error');return;}
  router.traverse(o=>{
    if(o.isMesh){
      o.material=o.material.clone();
      o.material.color.setHex(0x1a3a5c);
      o.material.emissive.setHex(0x051525);
      o.material.emissiveIntensity=0.3;
      o.material.roughness=0.4; o.material.metalness=0.7;
    }
  });
  const textureLoader=new THREE.TextureLoader();
  const screenTex=textureLoader.load('screen.jpg');
  [monitor1,monitor2].forEach(m=>{
    if(!m) return;
    m.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.map=screenTex;o.material.emissiveMap=screenTex;o.material.emissive.set(0xffffff);o.material.emissiveIntensity=1;}});
  });

  const sandalColor=new THREE.Color(0x8B5A2B);
  const shireeColor=new THREE.Color(0xD2B48C);
  function applyColor(obj,color){
    if(!obj) return;
    obj.traverse(child=>{if(child.isMesh) child.material=new THREE.MeshStandardMaterial({color,roughness:0.6,metalness:0.2});});
  }
  applyColor(sandal1,sandalColor);
  applyColor(sandal2,sandalColor);
  applyColor(shiree1,shireeColor);

  const r=new THREE.Vector3(),s=new THREE.Vector3(),p1=new THREE.Vector3(),p2=new THREE.Vector3();
  router.getWorldPosition(r); switch1.getWorldPosition(s); pc1.getWorldPosition(p1); pc2.getWorldPosition(p2);
  state.positions={router:r,switch1:s,pc1:p1,pc2:p2};

  router.traverse(o=>{o.userData.nodeName='router'; clickableObjects.push(o);});
  switch1.traverse(o=>{o.userData.nodeName='switch'; clickableObjects.push(o);});
  pc1.traverse(o=>{o.userData.nodeName='pc1'; clickableObjects.push(o);});
  pc2.traverse(o=>{o.userData.nodeName='pc2'; clickableObjects.push(o);});

  addIndicator(r,'router'); addIndicator(s,'switch'); addIndicator(p1,'pc1'); addIndicator(p2,'pc2');

  const phoneTargetPos=new THREE.Vector3(r.x+0.5,r.y+0.15,r.z+0.3);
  buildDashedCable(r,phoneTargetPos);
  createWifiRings(r);
  phoneObj=createPhone(r);
  createWifiLine(r,phoneObj.position);

  setStatus('✅ GLB ачаалагдлаа! [P] Router асаана уу → кабель сонгоод холбоно уу','success');
},
undefined,
err=>{console.error(err);setStatus('lab4.glb олдсонгүй','error');});

// ── KEYBOARD ──
window.addEventListener('keydown',e=>{
  if(e.key==='p'||e.key==='P') togglePower();
  if(e.key==='1') setCableType('straight');
  if(e.key==='2') setCableType('crossover');
  if(e.key==='r'||e.key==='R') resetCables();
  if(e.key==='l'||e.key==='L'){toggleLight(1);setTimeout(()=>toggleLight(2),200);}
  if(e.key==='q'||e.key==='Q') selectConn(1);
  if(e.key==='w'||e.key==='W') selectConn(2);
  if(e.key==='e'||e.key==='E') selectConn(3);
  if(e.key==='t'||e.key==='T') selectConn(4);
});

// ── HELPERS ──
function setStatus(msg,type=''){
  const el=document.getElementById('status'); el.textContent=msg; el.className=type;
}
function showTooltip(msg){
  const el=document.getElementById('tooltip'); el.textContent=msg; el.style.display='block';
  setTimeout(()=>el.style.display='none',3000);
}

// ── ANIMATION LOOP ──
const clock=new THREE.Clock(); let glowPhase=0;
renderer.setAnimationLoop(()=>{
  const delta=clock.getDelta();
  if(renderer.xr.isPresenting){
    controls.enabled=false; handleVRGamepad(); updateVRHover();
  } else {
    controls.enabled=true; hoverSphere.visible=false;
    if(state.vrTempCable&&!state.vrCableHeld&&!state.vrFirstNode){scene.remove(state.vrTempCable);state.vrTempCable=null;}
  }
  controls.update();
  if(state.routerOn){packetTimer+=delta;if(packetTimer>1.2){packetTimer=0;spawnNetworkPackets();}}
  updatePackets();
  updateWifi(delta);
  updateWifiLine();
  updateDashedCable(delta);
  const allGlow=state.cables.rs&&state.cables.sp1&&state.cables.sp2&&state.cables.pp&&state.routerOn;
  if(allGlow){
    glowPhase+=delta*2;
    const intensity=0.3+0.3*Math.sin(glowPhase);
    ['rs','sp1','sp2','pp'].forEach(k=>{if(cableObjects[k])cableObjects[k].material.emissiveIntensity=intensity;});
  }
  if(state.routerOn&&state.powerLight) state.powerLight.material.opacity=0.5+0.4*Math.sin(glowPhase*1.5);
  renderer.render(scene,camera);
});

window.addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});
