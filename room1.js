import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
export function createRoom1(scene, camera) {
    const room = new THREE.Group();
    scene.add(room);

    // ======================
    // FLOOR
    // ======================
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.MeshStandardMaterial({ color: 0x101826 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.userData = { teleport: true };
    room.add(floor);

    // ======================
    // LIGHTS
    // ======================
    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(5, 10, 5);
    room.add(light);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    room.add(ambient);

    // ======================
    // DOOR → ROOM2
    // ✅ userData.targetRoom нэмэгдлээ — энэ нь шилжих өрөөний нэр
    // ======================
    const door = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.8 })
    );
    door.position.set(2, 1, -2);
    door.name = "door_to_room2";
    door.userData = {
        kind: "door",
        targetRoom: "room2"   // ✅ Шилжих өрөөний нэр
    };
    room.add(door);

    // ======================
    // GLB LOAD — ✅ Дараалал засагдлаа
    // ======================
    const loader = new GLTFLoader();
    loader.load(
        "./pc_network.glb",
        (gltf) => {
            const model = gltf.scene;
            model.scale.set(0.09, 0.09, 0.09);

            // ✅ Эхлээд scene-д нэмнэ
            room.add(model);

            // ✅ Дараа нь Box3 тооцоолно (энэ дараалал чухал!)
            const box = new THREE.Box3().setFromObject(model);
            const center = new THREE.Vector3();
            const size = new THREE.Vector3();
            box.getCenter(center);
            box.getSize(size);

            // ✅ Төвд авчирна
            model.position.sub(center);
            model.position.y = 0;

            // ✅ Camera тохируулна
            if (camera) {
                camera.position.set(0, size.y * 1.5, size.z * 2);
                camera.lookAt(0, 0, 0);
            }

            console.log("GLB LOADED ✅");
        },
        undefined,
        (err) => {
            console.error("GLB ERROR ❌", err);
        }
    );

    return room;
}