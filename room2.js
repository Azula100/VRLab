import * as THREE from "three";
export function createRoom2(scene) {

    const room = new THREE.Group();
    scene.add(room);

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    room.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(4, 10, 6);
    dirLight.castShadow = true;
    room.add(dirLight);

    const RW = 10, RH = 5, RD = 10;

    function mat(color, rough = 0.8, metal = 0) {
        return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    }

    // ======================
    // ШАЛ
    // ======================
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(RW, RD),
        mat(0x8b7355, 0.9)
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.userData = { teleport: true };
    room.add(floor);

    for (let i = -4; i <= 4; i++) {
        let g = new THREE.Mesh(
            new THREE.PlaneGeometry(0.02, RD),
            new THREE.MeshStandardMaterial({ color: 0x6b5535 })
        );
        g.rotation.x = -Math.PI / 2;
        g.position.set(i, 0.001, 0);
        room.add(g);

        g = new THREE.Mesh(
            new THREE.PlaneGeometry(RW, 0.02),
            new THREE.MeshStandardMaterial({ color: 0x6b5535 })
        );
        g.rotation.x = -Math.PI / 2;
        g.position.set(0, 0.001, i);
        room.add(g);
    }

    // ======================
    // ХАНУУД
    // ======================
    const wallMat = mat(0xd4c9b0, 0.9);

    function addWall(w, h, pos, ry = 0) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat.clone());
        m.position.set(...pos);
        m.rotation.y = ry;
        m.receiveShadow = true;
        room.add(m);
    }

    addWall(RW, RH, [0, RH / 2, -RD / 2]);
    addWall(RW, RH, [0, RH / 2,  RD / 2], Math.PI);
    addWall(RD, RH, [-RW / 2, RH / 2, 0],  Math.PI / 2);
    addWall(RD, RH, [ RW / 2, RH / 2, 0], -Math.PI / 2);

    const ceil = new THREE.Mesh(
        new THREE.PlaneGeometry(RW, RD),
        mat(0xf0ece0, 0.9)
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, RH, 0);
    room.add(ceil);

    // ======================
    // СУРАГЧИЙН ШИРЭЭ + САНДАЛ
    // ======================
    function addDesk(x, z) {
        const dm = mat(0x8B6914, 0.7);
        const lm = mat(0x333333, 0.5, 0.3);

        [[x, 0.75, z, 1, 0.05, 0.6],
         [x, 0.48, z + 0.55, 0.5, 0.04, 0.45],
         [x, 0.70, z + 0.77, 0.5, 0.40, 0.04]
        ].forEach(([px, py, pz, w, h, d]) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), dm);
            mesh.position.set(px, py, pz);
            mesh.castShadow = mesh.receiveShadow = true;
            room.add(mesh);
        });

        [[0.4, 0.4],[0.4,-0.4],[-0.4, 0.4],[-0.4,-0.4]].forEach(([dx, dz]) => {
            const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.75, 0.05), lm);
            l.position.set(x + dx, 0.375, z + dz);
            l.castShadow = true;
            room.add(l);
        });

        [[0.2,-0.2],[-0.2,-0.2]].forEach(([dx, dz]) => {
            const s = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.48, 0.04), lm);
            s.position.set(x + dx, 0.24, z + 0.55 + dz);
            room.add(s);
        });
    }

    [[-2,1],[-2,-1],[-2,-3],
     [ 0,1],[ 0,-1],[ 0,-3],
     [ 2,1],[ 2,-1],[ 2,-3]].forEach(([x, z]) => addDesk(x, z));

    // ======================
    // БАГШИЙН ШИРЭЭ
    // ======================
    const tDesk = new THREE.Mesh(new THREE.BoxGeometry(2, 0.07, 0.8), mat(0x6B4C11, 0.6));
    tDesk.position.set(-3, 0.78, 3.5);
    tDesk.castShadow = tDesk.receiveShadow = true;
    room.add(tDesk);

    [[0.8,0.3],[-0.8,0.3],[0.8,-0.3],[-0.8,-0.3]].forEach(([dx, dz]) => {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.78, 0.07), mat(0x222222, 0.4, 0.4));
        l.position.set(-3 + dx, 0.39, 3.5 + dz);
        l.castShadow = true;
        room.add(l);
    });

    // ======================
    // БАГШИЙН САНДАЛ
    // ======================
    const chairG = new THREE.Group();
    const chM  = mat(0x3a2210, 0.6);
    const chLM = mat(0x1a1a1a, 0.4, 0.3);

    const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.50), chM);
    chairSeat.position.set(0, 0.48, 0);
    chairSeat.castShadow = true;
    chairSeat.userData = { kind: "teacherChair" };
    chairG.add(chairSeat);

    const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.50, 0.05), chM);
    chairBack.position.set(0, 0.75, -0.23);
    chairBack.castShadow = true;
    chairBack.userData = { kind: "teacherChair" };
    chairG.add(chairBack);

    [[0.22,0.22],[0.22,-0.22],[-0.22,0.22],[-0.22,-0.22]].forEach(([dx,dz]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.48, 0.05), chLM);
        leg.position.set(dx, 0.24, dz);
        leg.castShadow = true;
        chairG.add(leg);
    });

    [0.22,-0.22].forEach(dx => {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.52, 0.04), chLM);
        p.position.set(dx, 0.74, -0.23);
        chairG.add(p);
    });

    chairG.position.set(-3, 0, 4.22);
    room.add(chairG);

    const sitCanvas = document.createElement("canvas");
    sitCanvas.width = 192; sitCanvas.height = 48;
    const sctx = sitCanvas.getContext("2d");
    sctx.fillStyle = "rgba(0,0,0,0)";
    sctx.fillRect(0, 0, 192, 48);
    sctx.fillStyle = "#ffdd44";
    sctx.font = "bold 22px Arial";
    sctx.textAlign = "center";
    sctx.textBaseline = "middle";
    sctx.fillText("▼ Суух", 96, 24);
    const sitLabel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, 0.15),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sitCanvas), transparent: true, depthTest: false })
    );
    sitLabel.position.set(-3, 1.35, 4.22);
    room.add(sitLabel);

    // ======================
    // БАГШИЙН КОМПЬЮТЕР
    // ======================
    const pcG = new THREE.Group();
    const pcM = mat(0x1a1a1a, 0.2, 0.7);

    const monFrame = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.33, 0.025), pcM);
    monFrame.position.set(0, 0.20, 0);
    monFrame.castShadow = true;
    pcG.add(monFrame);

    const monScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.44, 0.27),
        new THREE.MeshStandardMaterial({
            color: 0x0d2a4a, emissive: 0x0d2a4a,
            emissiveIntensity: 1.0, roughness: 0.05
        })
    );
    monScreen.position.set(0, 0.20, 0.014);
    pcG.add(monScreen);

    [
        { y: 0.07, w: 0.28, color: 0x2266cc },
        { y: 0.02, w: 0.18, color: 0x115522 },
        { y:-0.03, w: 0.22, color: 0x115522 },
        { y:-0.08, w: 0.14, color: 0x333355 },
    ].forEach(({ y, w, color }) => {
        const bar = new THREE.Mesh(
            new THREE.PlaneGeometry(w, 0.016),
            new THREE.MeshBasicMaterial({ color })
        );
        bar.position.set(-0.05, 0.20 + y, 0.015);
        pcG.add(bar);
    });

    const monSt = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.10, 0.04), pcM);
    monSt.position.set(0, 0.025, 0);
    pcG.add(monSt);
    const monBase = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.12), pcM);
    monBase.position.set(0, -0.02, 0);
    pcG.add(monBase);

    const kbd = new THREE.Mesh(
        new THREE.BoxGeometry(0.30, 0.012, 0.12),
        mat(0x2a2a2a, 0.4, 0.3)
    );
    kbd.position.set(0, -0.052, 0.14);
    kbd.castShadow = true;
    pcG.add(kbd);

    const mouseMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.012, 0.09),
        mat(0x2a2a2a, 0.3, 0.4)
    );
    mouseMesh.position.set(0.21, -0.052, 0.14);
    pcG.add(mouseMesh);

    const monLight = new THREE.PointLight(0x2255ff, 0.5, 1.0);
    monLight.position.set(0, 0.20, 0.25);
    pcG.add(monLight);

    pcG.position.set(-3 + 0.48, 0.78, 3.5);
    room.add(pcG);

    // ======================
    // КОФЕНИЙ АЯГ
    // ======================
    const cupG = new THREE.Group();
    const cupMat = mat(0xf0ede8, 0.4, 0.1);

    const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.028, 0.072, 16), cupMat
    );
    cup.position.set(0, 0.036, 0);
    cup.castShadow = true;
    cupG.add(cup);

    const coffee = new THREE.Mesh(
        new THREE.CylinderGeometry(0.030, 0.030, 0.006, 16),
        new THREE.MeshStandardMaterial({ color: 0x1e0a00, roughness: 0.2 })
    );
    coffee.position.set(0, 0.069, 0);
    cupG.add(coffee);

    const steam = new THREE.Mesh(
        new THREE.TorusGeometry(0.012, 0.003, 6, 12),
        new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.5 })
    );
    steam.rotation.x = Math.PI / 2;
    steam.position.set(0, 0.10, 0);
    cupG.add(steam);

    const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.018, 0.005, 6, 10, Math.PI), cupMat
    );
    handle.rotation.y = Math.PI / 2;
    handle.position.set(0.042, 0.036, 0);
    cupG.add(handle);

    const saucer = new THREE.Mesh(
        new THREE.CylinderGeometry(0.052, 0.048, 0.010, 16), cupMat
    );
    saucer.position.set(0, 0.005, 0);
    cupG.add(saucer);

    cupG.position.set(-3 - 0.52, 0.78, 3.5);
    room.add(cupG);

    // ======================
    // TV
    // ======================
    const tvG = new THREE.Group();

    const tvFrame = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 1.55, 0.1),
        mat(0x111111, 0.2, 0.7)
    );
    tvFrame.castShadow = true;
    tvFrame.userData = { kind: "tv" };
    tvG.add(tvFrame);

    const vid = document.createElement("video");
    vid.src         = "js/view.mp4";
    vid.loop        = true;
    vid.muted       = true;   // ✅ autoplay-д заавал хэрэгтэй
    vid.playsInline = true;
    vid.style.display = "none";
    document.body.appendChild(vid);

    const videoTex = new THREE.VideoTexture(vid);
    videoTex.minFilter = THREE.LinearFilter;
    videoTex.magFilter = THREE.LinearFilter;

    const tvScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 1.35),
        new THREE.MeshBasicMaterial({ map: videoTex })
    );
    tvScreen.position.z = 0.052;
    tvScreen.userData = { kind: "tv" };
    tvG.add(tvScreen);

    const tryPlay = () => vid.play().catch(e => console.warn("Video play:", e));
    vid.addEventListener("canplay", tryPlay, { once: true });
    if (vid.readyState >= 3) tryPlay();

    room.userData.toggleVideo = () => {
        if (vid.paused) vid.play().catch(e => console.warn("Video play:", e));
        else vid.pause();
    };

    const ledBar = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.04, 0.04),
        new THREE.MeshStandardMaterial({ color: 0x1a88ff, emissive: 0x1a88ff, emissiveIntensity: 1.5 })
    );
    ledBar.position.set(0, -0.76, 0.055);
    tvG.add(ledBar);

    const stM = mat(0x1a1a1a, 0.3, 0.6);
    const tvSt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 0.12), stM);
    tvSt.position.set(0, -0.93, 0);
    tvG.add(tvSt);
    const tvBs = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.28), stM);
    tvBs.position.set(0, -1.09, 0);
    tvG.add(tvBs);

    tvG.position.set(0, 2.3, -RD / 2 + 0.07);
    room.add(tvG);

    const tvLight = new THREE.PointLight(0x3366ff, 2.0, 6);
    tvLight.position.set(0, 2.3, -RD / 2 + 0.9);
    room.add(tvLight);

    // ======================
    // ТААЗНЫ ГЭРЭЛ
    // ======================
    function addCeilingLight(x, z) {
        const g = new THREE.Group();
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.6), mat(0xeeeeee, 0.4));
        box.castShadow = true;
        g.add(box);
        const panel = new THREE.Mesh(
            new THREE.BoxGeometry(0.52, 0.02, 0.52),
            new THREE.MeshStandardMaterial({ color: 0xfffde7, emissive: 0xfffde7, emissiveIntensity: 3 })
        );
        panel.position.y = -0.05;
        g.add(panel);
        const wire = new THREE.Mesh(
            new THREE.CylinderGeometry(0.008, 0.008, 0.25, 6),
            mat(0x333333, 0.5)
        );
        wire.position.y = 0.165;
        g.add(wire);
        g.position.set(x, RH - 0.04, z);
        room.add(g);
        const l = new THREE.PointLight(0xfffde7, 2.5, 8);
        l.position.set(x, RH - 0.2, z);
        l.castShadow = true;
        room.add(l);
        return { light: l };
    }

    const cl1 = addCeilingLight(-2, -1);
    const cl2 = addCeilingLight( 2, -1);

    // ======================
    // БУЦАХ ХААЛГА → ROOM1
    // ======================
    const backDoor = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2, 0.2),
        new THREE.MeshStandardMaterial({ color: 0xff6600 })
    );
    backDoor.position.set(-2, 1, RD / 2 - 0.15);
    backDoor.userData = { kind: "backDoor" };
    room.add(backDoor);

    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 256; labelCanvas.height = 64;
    const lctx = labelCanvas.getContext("2d");
    lctx.fillStyle = "rgba(0,0,0,0)";
    lctx.fillRect(0, 0, 256, 64);
    lctx.fillStyle = "#ffffff";
    lctx.font = "bold 28px Arial";
    lctx.textAlign = "center";
    lctx.textBaseline = "middle";
    lctx.fillText("← Room 1", 128, 32);
    const label = new THREE.Mesh(
        new THREE.PlaneGeometry(1.0, 0.25),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(labelCanvas), transparent: true, depthTest: false })
    );
    label.position.set(-2, 2.2, RD / 2 - 0.05);
    room.add(label);

    // ======================
    // ✅ ЛАБОРАТОРИЙН ХААЛГА → ROOM3 (нэг удаа, RD ашигласан)
    // ======================
    const labDoor = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x00aaff, transparent: true, opacity: 0.85 })
    );
    labDoor.position.set(3, 1, -RD / 2 + 0.15);   // ✅ RD — арын хана
    labDoor.name = "labDoor_to_room3";
    labDoor.userData = { kind: "labDoor" };
    room.add(labDoor);

    const labCanvas = document.createElement("canvas");
    labCanvas.width = 512; labCanvas.height = 128;
    const labCtx = labCanvas.getContext("2d");
    labCtx.fillStyle = "#00aaff";
    labCtx.font = "bold 40px Arial";
    labCtx.textAlign = "center";
    labCtx.textBaseline = "middle";
    labCtx.fillText("Лаборатори →", 256, 64);
    const labLabel = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(labCanvas), transparent: true })
    );
    labLabel.position.set(3, 2.4, -RD / 2 + 0.15);
    labLabel.scale.set(1.4, 0.35, 1);
    room.add(labLabel);

    // ======================
    // UPDATE LOOP
    // ======================
    room.userData.update = () => {
        if (!vid.paused && !vid.ended) videoTex.needsUpdate = true;
        const t = performance.now() * 0.001;
        tvLight.intensity                 = 1.8 + Math.sin(t * 2.5) * 0.4;
        ledBar.material.emissiveIntensity = 1.2 + Math.sin(t * 1.5) * 0.5;
        cl1.light.intensity               = 2.3 + Math.sin(t * 0.5) * 0.2;
        cl2.light.intensity               = 2.3 + Math.sin(t * 0.5 + 1) * 0.2;
        monLight.intensity                = 0.4 + Math.sin(t * 1.2) * 0.15;
        steam.position.y                  = 0.10 + Math.sin(t * 2) * 0.005;
        steam.material.opacity            = 0.3 + Math.sin(t * 1.5) * 0.2;
        // Лабораторийн хаалга анивчина
        labDoor.material.opacity          = 0.6 + 0.25 * Math.sin(t * 1.8);
    };

    return room;
}