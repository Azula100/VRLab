import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createRoom1 } from "./room1.js";
import { createRoom2 } from "./room2.js";
import { createRoom3 } from "./room3.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202533);

const camera = new THREE.PerspectiveCamera(75,window.innerWidth / window.innerHeight,0.1,1000);
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
    orbitControls.enableDamping = true; // Smooth damping
    orbitControls.dampingFactor = 0.05;
    orbitControls.rotateSpeed = 1.0;
    orbitControls.zoomSpeed = 1.2;
    orbitControls.panSpeed = 0.8;
    orbitControls.screenSpacePanning = true; 
    orbitControls.maxPolarAngle = Math.PI / 2; 
    orbitControls.target.set(0, 1.6, 0);
    
    renderer.xr.addEventListener('sessionstart', () => {
        if (orbitControls) {
            orbitControls.enabled = false;
        }
    });
    
    renderer.xr.addEventListener('sessionend', () => {
        if (orbitControls) {
            orbitControls.enabled = true;
            // Reset camera position when exiting VR
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
dirLight.receiveShadow = true;
scene.add(dirLight);

// Ambient light for better visibility
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

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

// Current active room reference
let currentRoom = room1;

window.goRoom = (n) => {
    // Update visibility
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

const controllers = [];
const laserLines = [];

for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    scene.add(controller);
    controllers.push(controller);
    
    // Laser pointer
    const laserGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1)
    ]);
    const laserLine = new THREE.Line(
        laserGeo,
        new THREE.LineBasicMaterial({ color: 0x00ffcc })
    );
    laserLine.scale.z = 15;
    controller.add(laserLine);
    laserLines.push(laserLine);
    
    // Optional: Add a small sphere at the tip for better visibility
    const tipGeometry = new THREE.SphereGeometry(0.02, 8, 8);
    const tipMaterial = new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x00aa88 });
    const tip = new THREE.Mesh(tipGeometry, tipMaterial);
    tip.position.set(0, 0, -1);
    controller.add(tip);
}

const tempMatrix = new THREE.Matrix4();
const raycasterVR = new THREE.Raycaster();

function handleVRControllerInteraction(controller, eventType) {
    if (eventType !== "selectstart") return;
    
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycasterVR.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycasterVR.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    
    // Get all interactive objects in current room
    const interactiveObjects = [];
    currentRoom.children.forEach(child => {
        if (child.userData?.interactive || child.userData?.kind) {
            interactiveObjects.push(child);
        }
        // Also check children recursively
        child.children?.forEach(grandChild => {
            if (grandChild.userData?.interactive || grandChild.userData?.kind) {
                interactiveObjects.push(grandChild);
            }
        });
    });
    
    const hits = raycasterVR.intersectObjects(interactiveObjects, true);
    if (!hits.length) return;
    
    // Find the actual interactive object
    let obj = hits[0].object;
    while (obj && !obj.userData?.kind && !obj.userData?.interactive) {
        obj = obj.parent;
    }
    if (!obj) return;
    
    const kind = obj.userData.kind;
    
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
        if (renderer.xr.isPresenting) {
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
    if (kind === "tv") {
        if (room2.userData.toggleVideo) room2.userData.toggleVideo();
        return;
    }
    if (kind === "computer") {
        if (room3.userData.toggleComputer) room3.userData.toggleComputer();
        return;
    }
    if (obj.userData?.teleport) {
        const point = hits[0].point;
        if (renderer.xr.isPresenting) {
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
    
    if (currentRoom === room3 && room3.userData.onVRSelect) {
        room3.userData.onVRSelect(obj, hits[0].point);
    }
}

// Add event listeners to both controllers
controllers.forEach(controller => {
    controller.addEventListener("selectstart", (event) => {
        handleVRControllerInteraction(controller, "selectstart");
    });
});

const mouse = new THREE.Vector2();
const raycasterMouse = new THREE.Raycaster();

window.addEventListener("click", (event) => {
    if (orbitControls && orbitControls.enabled && !renderer.xr.isPresenting) {}
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycasterMouse.setFromCamera(mouse, camera);
    
    const interactiveObjects = [];
    currentRoom.children.forEach(child => {
        if (child.userData?.interactive || child.userData?.kind) {
            interactiveObjects.push(child);
        }
        child.children?.forEach(grandChild => {
            if (grandChild.userData?.interactive || grandChild.userData?.kind) {
                interactiveObjects.push(grandChild);
            }
        });
    });
    
    const hits = raycasterMouse.intersectObjects(interactiveObjects, true);
    if (!hits.length) return;
    
    let obj = hits[0].object;
    while (obj && !obj.userData?.kind && !obj.userData?.interactive) {
        obj = obj.parent;
    }
    if (!obj) return;
    
    const kind = obj.userData.kind;
    
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
        camera.position.set(-3, 1.2, 4.22);
        if (orbitControls) {
            orbitControls.target.set(-3, 1.2, 4.22);
            orbitControls.update();
        }
        return;
    }
    if (kind === "tv") {
        if (room2.userData.toggleVideo) room2.userData.toggleVideo();
        return;
    }
    
    // Room3 specific mouse interactions
    if (room3.visible && room3.userData.onClick) {
        room3.userData.onClick(raycasterMouse);
    }
});
window.addEventListener("keydown", (e) => {
    if (room3.userData.onKey) {
        room3.userData.onKey(e.key);
    }
    
    // Keyboard shortcuts for room switching
    if (e.key === '1') window.goRoom(1);
    if (e.key === '2') window.goRoom(2);
    if (e.key === '3') window.goRoom(3);
    
    // Toggle orbit controls helper (for debugging)
    if (e.key === 'h' && !renderer.xr.isPresenting) {
        gridHelper.visible = !gridHelper.visible;
    }
});
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    if (orbitControls) {
        orbitControls.update();
    }
});
renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    
    // Update orbit controls if enabled and not in VR
    if (orbitControls && orbitControls.enabled && !renderer.xr.isPresenting) {
        orbitControls.update();
    }
    
    // Update current room
    if (currentRoom === room1 && room1.userData.update) {
        room1.userData.update(delta, playerRig);
    }
    if (currentRoom === room2 && room2.userData.update) {
        room2.userData.update(delta, playerRig);
    }
    if (currentRoom === room3 && room3.userData.update) {
        room3.userData.update(delta, playerRig);
    }
    
    // Update laser pointers based on controller visibility
    controllers.forEach((controller, index) => {
        if (controller.visible && renderer.xr.isPresenting) {
            laserLines[index].visible = true;
        } else {
            laserLines[index].visible = false;
        }
    });
    
    renderer.render(scene, camera);
});

console.log("✅ VR application initialized with 3 rooms and OrbitControls");