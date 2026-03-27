import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createRoom1 } from "./room1.js";
import { createRoom2 } from "./room2.js";
import { createRoom3 } from "./room3.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202533);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

let orbitControls = null;

function initOrbitControls() {
    if (orbitControls) {
        orbitControls.dispose();
        orbitControls = null;
    }
    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.rotateSpeed = 1.0;
    orbitControls.zoomSpeed = 1.2;
    orbitControls.panSpeed = 0.8;
    orbitControls.screenSpacePanning = true;
    orbitControls.maxPolarAngle = Math.PI / 2;
    orbitControls.target.set(0, 1.6, 0);

    renderer.xr.addEventListener('sessionstart', () => {
        if (orbitControls) orbitControls.enabled = false;
    });
    renderer.xr.addEventListener('sessionend', () => {
        if (orbitControls) {
            orbitControls.enabled = true;
            camera.position.set(0, 1.6, 4);
            orbitControls.target.set(0, 1.6, 0);
            orbitControls.update();
        }
    });
}

initOrbitControls();
const clock = new THREE.Clock();

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 5);
dirLight.castShadow = true;
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0x404040));

const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0x444444);
gridHelper.position.y = -0.01;
scene.add(gridHelper);

const playerRig = new THREE.Group();
playerRig.add(camera);
scene.add(playerRig);

const room1 = createRoom1(scene, camera, renderer);
const room2 = createRoom2(scene);
const room3 = createRoom3(scene, camera, renderer);

room2.visible = false;
room3.visible = false;

let currentRoom = room1;

window.goRoom = (n) => {
    room1.visible = (n === 1);
    room2.visible = (n === 2);
    room3.visible = (n === 3);

    if (n === 1) currentRoom = room1;
    else if (n === 2) currentRoom = room2;
    else if (n === 3) currentRoom = room3;

    if (renderer.xr.isPresenting) {
        playerRig.position.set(0, 0, 0);
        if (orbitControls) orbitControls.enabled = false;
    } else {
        camera.position.set(0, 1.6, 4);
        if (orbitControls) {
            orbitControls.target.set(0, 1.6, 0);
            orbitControls.update();
        }
        camera.lookAt(0, 0, 0);
    }

    const names = { 1: 'Лекцийн өрөө', 2: 'Семинарын өрөө', 3: 'Лабораторийн өрөө' };
    console.log(`→ ${names[n]} руу шилжлээ`);
};

// ── RAYCASTING HELPER ──
// ✅ Бүх давхаргыг recursive шалгана (TV group доторх screen-г олно)
function getInteractiveObjects(room) {
    const result = [];
    room.traverse((obj) => {
        if (obj.userData?.kind || obj.userData?.interactive || obj.userData?.teleport) {
            result.push(obj);
        }
    });
    return result;
}

// ── TV TOGGLE HELPER ──
// ✅ room1-д TV байгаа тул room1.userData.toggleVideo дуудна
function handleTVInteraction() {
    if (currentRoom === room1 && room1.userData.toggleVideo) {
        room1.userData.toggleVideo();
    } else if (currentRoom === room2 && room2.userData.toggleVideo) {
        room2.userData.toggleVideo();
    }
}

// ── KIND HANDLER (хоёуланд ашиглана) ──
function handleKind(kind, obj, point, isVR = false) {
    if (kind === "door") {
        window.goRoom(2);
        return;
    }
    if (kind === "labDoor") {
        window.goRoom(3);
        return;
    }
    if (kind === "backDoor") {
        if (room2.visible) window.goRoom(1);
        if (room3.visible) window.goRoom(2);
        return;
    }
    if (kind === "teacherChair") {
        if (isVR) {
            playerRig.position.set(-3, 0, 4.22);
        } else {
            camera.position.set(-3, 1.2, 4.22);
            if (orbitControls) {
                orbitControls.target.set(-3, 1.2, 4.22);
                orbitControls.update();
            }
        }
        return;
    }
    // ✅ ЗАСВАРЛАСАН: room1-ийн TV → room1.userData.toggleVideo дуудна
    if (kind === "tv") {
        handleTVInteraction();
        return;
    }
    if (kind === "computer") {
        if (room3.userData.toggleComputer) room3.userData.toggleComputer();
        return;
    }
    if (obj.userData?.teleport && point) {
        if (isVR) {
            playerRig.position.set(point.x, 0, point.z);
        } else {
            camera.position.set(point.x, 1.6, point.z);
            if (orbitControls) {
                orbitControls.target.set(point.x, 1.6, point.z);
                orbitControls.update();
            }
        }
        return;
    }
}

// ── VR CONTROLLERS ──
const controllers = [];
const laserLines = [];
const tempMatrix = new THREE.Matrix4();
const raycasterVR = new THREE.Raycaster();

for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    scene.add(controller);
    controllers.push(controller);

    const laserGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1)
    ]);
    const laserLine = new THREE.Line(laserGeo, new THREE.LineBasicMaterial({ color: 0x00ffcc }));
    laserLine.scale.z = 15;
    controller.add(laserLine);
    laserLines.push(laserLine);

    const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x00aa88 })
    );
    tip.position.set(0, 0, -1);
    controller.add(tip);
}

function handleVRControllerInteraction(controller, eventType) {
    if (eventType !== "selectstart") return;

    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycasterVR.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycasterVR.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    // ✅ traverse ашиглан бүх объектыг авна
    const interactiveObjects = getInteractiveObjects(currentRoom);
    const hits = raycasterVR.intersectObjects(interactiveObjects, true);
    if (!hits.length) return;

    let obj = hits[0].object;
    while (obj && !obj.userData?.kind && !obj.userData?.interactive && !obj.userData?.teleport) {
        obj = obj.parent;
    }
    if (!obj) return;

    handleKind(obj.userData.kind, obj, hits[0].point, true);

    if (currentRoom === room3 && room3.userData.onVRSelect) {
        room3.userData.onVRSelect(obj, hits[0].point);
    }
}

controllers.forEach(controller => {
    controller.addEventListener("selectstart", (event) => {
        handleVRControllerInteraction(controller, "selectstart");
    });
});

// ── MOUSE CLICK ──
const mouse = new THREE.Vector2();
const raycasterMouse = new THREE.Raycaster();

window.addEventListener("click", (event) => {
    mouse.x =  (event.clientX / window.innerWidth)  * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycasterMouse.setFromCamera(mouse, camera);

    // ✅ traverse ашиглан бүх объектыг авна
    const interactiveObjects = getInteractiveObjects(currentRoom);
    const hits = raycasterMouse.intersectObjects(interactiveObjects, true);
    if (!hits.length) return;

    let obj = hits[0].object;
    while (obj && !obj.userData?.kind && !obj.userData?.interactive && !obj.userData?.teleport) {
        obj = obj.parent;
    }
    if (!obj) return;

    handleKind(obj.userData.kind, obj, hits[0].point, false);

    if (room3.visible && room3.userData.onClick) {
        room3.userData.onClick(raycasterMouse);
    }
});

// ── KEYBOARD ──
window.addEventListener("keydown", (e) => {
    if (room3.userData.onKey) room3.userData.onKey(e.key);
    if (e.key === 'F1') window.goRoom(1);
    if (e.key === 'F2') window.goRoom(2);
    if (e.key === 'F3') window.goRoom(3);
    if (e.key === 'h' && !renderer.xr.isPresenting) {
        gridHelper.visible = !gridHelper.visible;
    }
});

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (orbitControls) orbitControls.update();
});

// ── ANIMATE LOOP ──
renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();

    if (orbitControls && orbitControls.enabled && !renderer.xr.isPresenting) {
        orbitControls.update();
    }

    if (currentRoom === room1 && room1.userData.update) room1.userData.update(delta, playerRig);
    if (currentRoom === room2 && room2.userData.update) room2.userData.update(delta, playerRig);
    if (currentRoom === room3 && room3.userData.update) room3.userData.update(delta, playerRig);

    controllers.forEach((controller, index) => {
        laserLines[index].visible = controller.visible && renderer.xr.isPresenting;
    });

    renderer.render(scene, camera);
});

console.log("✅ VR application initialized");
