import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/SkeletonUtils.js";

let loadedSeaweedCount = 0;
let gameState = "NORMAL";
let sharkShake = 0;
let sharkRed = 0;
let sharkActive = false;
let sharkTimer = 0;
let sharkSuccess = false;
let sharkUIHideTimer = null;
let fishReady = false;
let loadedFishCount = 0;
let scoreMultiplier = 1;
let fishSpawnRate = 0.7;
let score = 0;
let lastBigSpawnTime = 0;  
let bigEventCooldown = 0; // 초 단위
let bigEventActive = false;
let spawnTimer = 0;

const BIG_EVENT_INTERVAL = 20; // 20초마다 출현
const BOUNDS = { x: 50, y: 10, z: 50 };
const MAX_FISH = 20;
function addScore(value) {
    score += value;
    console.log("💰 SCORE:", score);
}
function clampPosition(pos) {
    pos.x = THREE.MathUtils.clamp(pos.x, -BOUNDS.x / 2, BOUNDS.x / 2);
    pos.y = THREE.MathUtils.clamp(pos.y, -3, BOUNDS.y - 3); // 수면/바닥 제한
    pos.z = THREE.MathUtils.clamp(pos.z, -BOUNDS.z / 2, BOUNDS.z / 2);
}
const sounds = {
    bgm: new Audio("./sounds/bgm.mp3"),
    shoot: new Audio("./sounds/shoot.mp3"),
    hit: new Audio("./sounds/hit.mp3"),
    whale_theme: new Audio("./sounds/whale_theme.mp3"),
    turtle_theme: new Audio("./sounds/turtle_theme.mp3"),
    shark_spawn: new Audio("./sounds/shark_spawn.mp3"),
    shark_die: new Audio("./sounds/shark_die.mp3"),
};
function unlockAudio() {

    Object.values(sounds).forEach(s => {
        s.muted = true;
        s.play().then(() => {
            s.pause();
            s.currentTime = 0;
            s.muted = false;
        }).catch(() => {});
    });

    console.log("🔊 AUDIO UNLOCKED");
}

let sfxVolume = 1;

function playHit() {
    const s = sounds.hit.cloneNode();
    s.volume = 0.2 * sfxVolume;
    s.play().catch(() => {});
}

sounds.bgm.loop = true;
sounds.bgm.volume = 0.4;

window.addEventListener("click", () => {
    unlockAudio();

    sounds.bgm.loop = true;
    sounds.bgm.volume = 0.4;
    sounds.bgm.currentTime = 0;

    sounds.bgm.play().catch(() => {});

}, { once: true });


const seaBubbles = [];
const bubbleEmitters = [];

for (let i = 0; i < 8; i++) {

    bubbleEmitters.push({
        x: (Math.random() - 0.5) * 25,
        z: (Math.random() - 0.5) * 25,
        timer: Math.random()
    });

}

console.log("Sea Story 3D Start");

const oceanArea = document.getElementById("oceanArea");

// 1) 기존 canvas 제거 (DOM 초기화)
while (oceanArea.firstChild) {
    oceanArea.removeChild(oceanArea.firstChild);
}

// 2) 이전 renderer 제거 (핵심!)
if (window.__renderer) {
    window.__renderer.dispose();

    if (window.__renderer.domElement) {
        window.__renderer.domElement.remove();
    }

    window.__renderer = null;
}

// 3) scene 새로 생성
const scene = new THREE.Scene();

scene.add(new THREE.AxesHelper(10));

/* 🌊 배경 + 안개 */
scene.background = new THREE.Color(0x003355);
scene.fog = new THREE.Fog(0x003355, 30, 120); // 👈 살짝 완화 (빛 보이게)

/* 🌞 조명 */
scene.add(new THREE.AmbientLight(0xffffff, 1.5));

const light = new THREE.DirectionalLight(0xffffff, 2.2);
light.position.set(0, 30, 0);
scene.add(light);


/* =========================
   🌊 REAL LIGHT BEAMS SYSTEM
========================= */

const beams = [];

function createBeam(x, z) {
// 실제 빛줄기 조절하는 곳
    const geo = new THREE.CylinderGeometry(
        0.01,
        0.5,
        25,
        10,
        1,
        true
    );

    const mat = new THREE.MeshBasicMaterial({
        color: 0x99ccff,
        transparent: true,
        opacity: 0.01,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });

    const beam = new THREE.Mesh(geo, mat);

    beam.position.set(x, 10, z);

    scene.add(beam);
    beams.push(beam);
}


/* 🌊 여러 빛줄기 (핵심) */
//createBeam(0, 0, 1.2);
//createBeam(-6, 3, 1);
//createBeam(6, -2, 1.3);


/* 🎥 카메라 */
const camera = new THREE.PerspectiveCamera(
    60,
    oceanArea.clientWidth / oceanArea.clientHeight,
    0.1,
    100
);

camera.position.set(0, 35, 45);
camera.lookAt(0, 0, 0);

let baseCamPos = camera.position.clone();

if (window.__renderer) {
    window.__renderer.dispose();
    if (window.__renderer.domElement) {
        window.__renderer.domElement.remove();
    }
}

/* 🖥️ 렌더러 */
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false
});

renderer.setSize(oceanArea.clientWidth, oceanArea.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// 🔥 핵심: 바다 색감 고정
const oceanColor = 0x003355;
oceanArea.appendChild(renderer.domElement);

//scene.add(new THREE.AxesHelper(5));   중앙 좌표 확인하는 코드

/* =========================
   🌊 바다 바닥
========================= */
const floorGeo = new THREE.PlaneGeometry(100, 100, 50, 50);

const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0a2a1f,
    roughness: 1
});

const pos = floorGeo.attributes.position;

for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getY(i);
    const y = Math.sin(x * 0.2) * Math.cos(z * 0.2) * 0.3;
    pos.setZ(i, y);
}

floorGeo.computeVertexNormals();
// 바닥높이


/* =========================
   🌿 해초 + 바위 (🔥 추가 핵심)
========================= */

const decorations = [];

function spawnSeaweedAndRocks() {

    // 🌿 해초 (자연스럽고 보기 좋은 밀도)
    const SEAWEED_COUNT = 40;

    for (let i = 0; i < SEAWEED_COUNT; i++) {

        const height = 2 + Math.random() * 2.2;
        const width = 0.2 + Math.random() * 0.15;

        const geo = new THREE.ConeGeometry(width, height, 6);

        const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(
                0.35,
                0.7,
                0.35 + Math.random() * 0.1
            ),
            roughness: 0.9
        });

        const seaweed = new THREE.Mesh(geo, mat);
        // 해초
        seaweed.position.set(
            (Math.random() - 0.5) * 50,
            -7,
            (Math.random() - 0.5) * 50
        )

        // 🔥 자연스러운 미세 크기 차이
        const s = 1 + Math.random() * 3;
        seaweed.scale.set(s, s, s);

        // 살짝 흔들림 느낌 (고정 애니메이션 준비)
        seaweed.rotation.z = Math.random() * 0.1;

        scene.add(seaweed);
        decorations.push(seaweed);
    }

    // 🪨 바위 (자연 지형 느낌)
    const ROCK_COUNT = 33;

    for (let i = 0; i < ROCK_COUNT; i++) {

        const size = 0.7 + Math.random() * 2;

        const geo = new THREE.DodecahedronGeometry(size);

        const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(
                0,
                0,
                0.35 + Math.random() * 0.15
            ),
            roughness: 1
        });

        const rock = new THREE.Mesh(geo, mat);

        rock.position.set(
            (Math.random() - 0.5) * 30,
            -4.8,
            (Math.random() - 0.5) * 30
        );

        rock.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );

        // 살짝 크기 변화
        const rs = 1 + Math.random() * 0.5;
        rock.scale.set(rs, rs, rs);

        scene.add(rock);
        decorations.push(rock);
    }

    console.log("🌊 FINAL sea world loaded (balanced)");
}

spawnSeaweedAndRocks();

/* =========================
   🌿 GLB 해초 스폰 (추가)
========================= */
function spawnGLBSeaweed() {

    const url = SEAWEED_MODELS[
        Math.floor(Math.random() * SEAWEED_MODELS.length)
    ];

    console.log("spawn:", url);

    const gltf = seaweedCache[url];
    if (!gltf) return;

    const seaweed = gltf.scene.clone();

    seaweed.position.set(
        (Math.random() - 0.5) * 25,
        -5,
        (Math.random() - 0.5) * 25
    );

    seaweed.scale.setScalar(
        SEAWEED_SCALE[url] || 1
    );

    seaweed.userData.waveOffset = Math.random() * Math.PI * 2;
    seaweed.userData.isSeaweed = true;

    scene.add(seaweed);
    decorations.push(seaweed);
}

function startSeaweedSystem() {

    for (let i = 0; i < 40; i++) {
        spawnGLBSeaweed();
    }

    console.log("🌊 Seaweed system ready!");
}

let whaleShake = 0;
let whaleTimer = null;

function triggerWhaleEvent() {

    if (gameState === "WHALE") return;

    showBonusEvent("🐋 WHALE EVENT");

    console.log("🐋 WHALE EVENT START");

    gameState = "WHALE";
    whaleActive = true;

    /* 🎵 음악 시작 */
    sounds.whale_theme.currentTime = 0;
    sounds.whale_theme.loop = true;
    sounds.whale_theme.volume = 0.9;
    sounds.whale_theme.play().catch(() => {});

    /* 📸 카메라 저장 */
    baseCamPos = camera.position.clone();
    whaleShake = 0;

    /* 🎮 게임 변화 */
    scoreMultiplier = 2;
    fishSpawnRate = 0.3;
    bigEventChance = 0.4;

    /* 🌊 연출 */
    scene.fog.density = 0.08;
    renderer.setClearColor(0x000b12);

    //camera.position.set(0, 28, 30);
    //camera.lookAt(0, 0, 0);

    /* ⏱ 종료 예약 */
    whaleTimer = setTimeout(() => {

        console.log("🌊 WHALE EVENT END");

        gameState = "NORMAL";
        whaleActive = false;

        /* 🎵 음악 종료 */
        sounds.whale_theme.pause();
        sounds.whale_theme.currentTime = 0;

        /* 🎮 원복 */
        scoreMultiplier = 1;
        fishSpawnRate = 0.7;
        bigEventChance = 0.1;

        /* 🌫 환경 원복 */
        scene.fog.density = 0.02;
        renderer.setClearColor(0x001a2b);

        /* 📸 카메라 복귀 */
        if (baseCamPos) camera.position.copy(baseCamPos);
        camera.lookAt(0, 0, 0);

        whaleShake = 0;

        whaleTimer = null;

    }, 15000);
}
/* =========================
   🐟 FISH MODELS
========================= */

const FISH_MODELS = [
    { url: "./models/fish.glb", weight: 40, speed: 0.02, turnSpeed: 0.05, scale: 0.002, hp: 1, score: 10 },
    { url: "./models/fish2.glb", weight: 50, speed: 0.035, turnSpeed: 0.08, scale: 0.20, hp: 3, score: 30 },
    { url: "./models/fish3.glb", weight: 5, speed: 0.012, turnSpeed: 0.03, scale: 0.05, hp: 5, score: 50 },
    { url: "./models/fish4.glb", weight: 3, speed: 0.012, turnSpeed: 0.03, scale: 0.1, hp: 10, score: 70 },
];
const BIG_MODELS = [
  { url: "./models/shark.glb", type: "shark", weight: 3, speed: 0.08, turnSpeed: 0.03, scale: 1.7, hp: 10, score: 3500, spawnBonus: 500 },
  { url: "./models/whale.glb", type: "whale", weight: 1, speed: 0.02, turnSpeed: 0.03, scale: 0.050, hp: 999, score: 10000, spawnBonus: 10000 },
  { url: "./models/turtle.glb", type: "turtle", weight: 2, speed: 0.05, turnSpeed: 0.03, scale: 0.010, hp: 999, score: 1000, spawnBonus: 1000 }
];

let bigModelsReady = false;


function getRandomBigModel() {

    let total = BIG_MODELS.reduce((sum, m) => sum + m.weight, 0);
    let r = Math.random() * total;

    for (let m of BIG_MODELS) {
        if (r < m.weight) return m;
        r -= m.weight;
    }

    return BIG_MODELS[0]; // fallback 안전장치
}

const bigCreatures = [];

let turtleTimer = 0;

function spawnBigCreature(model) {
    if (model.type === "shark") {
        if (bigCreatures.some(c => c.userData.type === "shark")) {
            return;
        }
    }
    if (Date.now() - lastBigSpawnTime < 1800000) return;  //////// 이벤트 고기를 자주 출몰 시키고 싶다면
    lastBigSpawnTime = Date.now();

    const gltf = modelCache[model.url];
    if (!gltf?.scene) return;

    const creature = SkeletonUtils.clone(gltf.scene);

    const mixer = new THREE.AnimationMixer(creature);

    if (gltf.animations && gltf.animations.length > 0) {
    gltf.animations.forEach((clip) => {
        mixer.clipAction(clip).play();
    });
    }

    mixers.push(mixer);

    creature.scale.setScalar(model.scale);
    creature.userData.scale = model.scale;

    /* 🦈 SHARK EVENT START */
    if (model.type === "shark") {
    startSharkEvent();
    }

    creature.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    creature.userData = {
    type: model.type,
    hp: model.hp,
    speed: model.speed,
    score: model.score,
    spawnBonus: model.spawnBonus,
    alive: true,

    timer: 0,
    leaving: false,

    // ⭐ STEP 1 핵심 추가
    state: "wander",
    stateTimer: 0,

    target: new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        -3 + Math.random() * 8,
        (Math.random() - 0.5) * 20
    )
};

    creature.userData.target.set(
    (Math.random() - 0.5) * 20,
    -3 + Math.random() * 8,
    (Math.random() - 0.5) * 20
);

    creature.visible = true;
    scene.add(creature);
    bigCreatures.push(creature);

    handleBigSpawnReward(creature, model);
}

function startSharkEvent() {

    if (sharkActive) return;

    sharkActive = true;
    sharkTimer = 0;
    sharkSuccess = false;

    showBonusEvent("🦈 SHARK HUNT\nBONUS 300 → 500");

    sounds.shark_spawn.currentTime = 0;
    sounds.shark_spawn.loop = true;
    sounds.shark_spawn.volume = 0.7;
    sounds.shark_spawn.play().catch(() => {});

    clearTimeout(sharkUIHideTimer);
    sharkUIHideTimer = setTimeout(() => {
        const box = document.getElementById("bonusEvent");
        if (box) box.style.opacity = "0";
    }, 5000);
}

function handleBigSpawnReward(creature, model) {

    if (model.type === "shark") {

        if (!sharkActive) {
            startSharkEvent();
        }

        addScore(model.spawnBonus);
        console.log(`🦈 SHARK BONUS +500 (spawn)`);
    }

    if (model.type === "whale") {
        addScore(model.spawnBonus);
        triggerWhaleEvent();
        console.log(`🐋 WHALE EVENT +10000 (spawn event)`);
    }


    if (model.type === "turtle") {
        addScore(model.spawnBonus); // 👈 여기 추가 (네 의도 반영)
        //startHealEffect(creature);
        showBonusEvent("🐢 TURTLE VISIT");
        console.log(`🐢 TURTLE HEAL START +1000`);

        sounds.turtle_theme.currentTime = 0;
        sounds.turtle_theme.loop = true; 
        sounds.turtle_theme.volume = 0.5;
        sounds.turtle_theme.play().catch(() => {});
    }
}

let bigEventTimer = 0;
let bigEventChance = 0.01; // 기본 1%
let whaleActive = false;

const fishes = [];
const mixers = [];
const bullets = [];
const effects = [];

const clock = new THREE.Clock();
const loader = new GLTFLoader();

/* 🌿 해초 모델 리스트 (여기!) */
const SEAWEED_MODELS = [
    "./models/seaweed1.glb",
    "./models/seaweed2.glb",
    "./models/seaweed3.glb",
    "./models/seaweed4.glb",
    "./models/seaweed5.glb",
    "./models/seaweed6.glb",
    "./models/seaweed7.glb",
    "./models/seaweed8.glb"
];

const SEAWEED_SCALE = {
    "./models/seaweed1.glb": 4,
    "./models/seaweed4.glb": 5,
    "./models/seaweed5.glb": 5,
    "./models/seaweed6.glb": 5,
    "./models/seaweed7.glb": 0.03,
    "./models/seaweed8.glb": 4
};

const seaweedCache = {};

SEAWEED_MODELS.forEach(url => {
    loader.load(url, (gltf) => {
        seaweedCache[url] = gltf;

        loadedSeaweedCount++;

        if (loadedSeaweedCount === SEAWEED_MODELS.length) {
            startSeaweedSystem();
        }
    });
});

/* =========================
   TARGET SYSTEM
========================= */
function setNewTarget(fish) {
    fish.userData.target.set(
        (Math.random() - 0.5) * BOUNDS.x,
        -3 + Math.random() * BOUNDS.y,
        (Math.random() - 0.5) * BOUNDS.z
    );
}

/* =========================
   MODEL CACHE
========================= */

const modelCache = {};

FISH_MODELS.forEach(m => {
    loader.load(m.url, (gltf) => {
        modelCache[m.url] = gltf;
    });
});

BIG_MODELS.forEach(m => {
    loader.load(
        m.url,
        (gltf) => {
            modelCache[m.url] = gltf;
            console.log("LOADED:", m.url);

            /* ⭐ 여기 추가 */
            if (Object.keys(modelCache).length === BIG_MODELS.length) {
                bigModelsReady = true;
                console.log("🐋 BIG MODELS READY");
            }
        },
        undefined,
        (err) => {
            console.error("FAILED LOAD:", m.url, err);
        }
    );
});


/* =========================
   SEAFLOOR GLB
========================= */
loader.load("./models/seafloor.glb", (gltf) => {
    //
    const floorModel = gltf.scene;

    const box = new THREE.Box3().setFromObject(floorModel);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    floorModel.position.sub(center);
    floorModel.position.y = -5;

    const maxSize = Math.max(size.x, size.y, size.z);
    const scale = 45 / maxSize;

    floorModel.scale.setScalar(scale);

    floorModel.traverse((child) => {
        if (child.isMesh) {
            child.material.side = THREE.DoubleSide;
        }
    });

    scene.add(floorModel);
});

/* =========================
   HIT EFFECT
========================= */

function spawnHitEffect(pos) {

    const group = new THREE.Group();
    const geo = new THREE.SphereGeometry(0.1, 2, 2);

    const BLOOD_COUNT = 40;
    const WATER_COUNT = 10;

    for (let i = 0; i < BLOOD_COUNT + WATER_COUNT; i++) {

        const isBlood = i < BLOOD_COUNT;

        const mat = new THREE.MeshBasicMaterial({
            color: isBlood ? 0xcc0000 : 0xcc0000,  // 죽을 때 나오는 피방울
            transparent: true,
            opacity: 1
        });

        const p = new THREE.Mesh(geo, mat);
        p.position.copy(pos);

        p.userData.velocity = new THREE.Vector3(
    (Math.random() - 0.5) * (isBlood ? 0.08 : 0.05),
    (Math.random() - 0.5) * (isBlood ? 0.08 : 0.05),
    (Math.random() - 0.5) * (isBlood ? 0.08 : 0.05)
);

        group.add(p);
    }

    scene.add(group);
    effects.push(group);
}

/* =========================
   SPAWN FISH
========================= */

function spawnFish() {

    if (fishes.length >= MAX_FISH) return;

    const modelInfo = FISH_MODELS[Math.floor(Math.random() * FISH_MODELS.length)];
    const gltf = modelCache[modelInfo.url];
    if (!gltf?.scene) return;

    const fish = SkeletonUtils.clone(gltf.scene);

    const mixer = new THREE.AnimationMixer(fish);
    gltf.animations?.forEach(c => mixer.clipAction(c).play());

    fish.scale.set(modelInfo.scale, modelInfo.scale, modelInfo.scale);

    const randomX = (Math.random() - 0.5) * BOUNDS.x;
const randomY = -3 + Math.random() * BOUNDS.y;
const randomZ = (Math.random() - 0.5) * BOUNDS.z;

const side = Math.floor(Math.random() * 6);

switch (side) {

    case 0: // 왼쪽
        fish.position.set(-35, randomY, randomZ);
        break;

    case 1: // 오른쪽
        fish.position.set(35, randomY, randomZ);
        break;

    case 2: // 앞
        fish.position.set(randomX, randomY, -35);
        break;

    case 3: // 뒤
        fish.position.set(randomX, randomY, 35);
        break;

    case 4: // 위
        fish.position.set(randomX, 12, randomZ);
        break;

    case 5: // 아래
        fish.position.set(randomX, -12, randomZ);
        break;
}

    fish.userData = {
    speed: modelInfo.speed,
    turnSpeed: modelInfo.turnSpeed,
    target: new THREE.Vector3(),

    smoothDir: new THREE.Vector3(
        Math.random() - 0.5,
        0,
        Math.random() - 0.5
    ).normalize(),

    hp: modelInfo.hp,
    score: modelInfo.score,

    swimOffset: Math.random() * Math.PI * 2,
    swimPower: 0.08 + Math.random() * 0.03
};

    fish.userData.target.set(
    (Math.random() - 0.5) * 10,
    -2 + Math.random() * 4,
    (Math.random() - 0.5) * 10
);

    fishes.push(fish);
    mixers.push(mixer);
    scene.add(fish);
}

/* =========================
   GUN + AIM + SHOOT
========================= */

const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.1, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
);

gun.position.set(0, 4.3, 10);
scene.add(gun);

const muzzle = new THREE.Object3D();
muzzle.position.set(0, 0, -0.25);
gun.add(muzzle);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const aimPoint = new THREE.Vector3();

let lockedFish = null;

window.addEventListener("mousemove", (e) => {

    const rect = renderer.domElement.getBoundingClientRect();

    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const hits = raycaster.intersectObjects(fishes, true);

    if (hits.length > 0) {
        let obj = hits[0].object;
        while (obj && !obj.userData?.hp) obj = obj.parent;
        lockedFish = obj;
    } else {
        lockedFish = null;
    }

    const temp = new THREE.Vector3();
raycaster.ray.at(10, temp); // 카메라 앞 10 거리

aimPoint.copy(temp);
});

let shooting = false;
let shootTimer = 0;
const fireRate = 0.12;

window.addEventListener("mousedown", () => shooting = true);
window.addEventListener("mouseup", () => shooting = false);



function shoot() {      //////////////////////////////////  총소리 볼륨
    sounds.shoot.currentTime = 0;
    sounds.shoot.volume = 0.2 * sfxVolume; 
    sounds.shoot.play().catch(() => {});

    const bullet = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );

    bullet.position.copy(gun.position);

    const target = lockedFish ? lockedFish.position : aimPoint;

    const dir = new THREE.Vector3()
        .subVectors(target, gun.position)
        .normalize();

    const spread = new THREE.Vector3(
        (Math.random() - 0.5) * 0.08,
        (Math.random() - 0.5) * 0.08,
        (Math.random() - 0.5) * 0.08
    );

    dir.add(spread).normalize();

    bullet.userData.velocity = dir.multiplyScalar(0.9);
    bullet.userData.life = 2.5;

    bullets.push(bullet);
    scene.add(bullet);

    const muzzlePos = gun.position.clone();

    const forward = new THREE.Vector3()
    .subVectors(aimPoint, gun.position)
    .normalize();

    muzzlePos.add(forward.multiplyScalar(0.5));

    spawnMuzzleBubbles(muzzlePos);
    }

function spawnMuzzleBubbles(pos) {

    const group = new THREE.Group();

    for (let i = 0; i < 20; i++) {

        const bubble = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 6, 6),
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.5
            })
        );

        bubble.position.copy(pos);

        bubble.userData.velocity = new THREE.Vector3(
    (Math.random() - 0.5) * 0.03,
    Math.random() * 0.04,
    (Math.random() - 0.5) * 0.03
);

        group.add(bubble);
    }

    scene.add(group);
    effects.push(group);
}

function showBonusEvent(text){

    const box = document.getElementById("bonusEvent");
    const name = document.getElementById("bonusName");

    name.textContent = text;

    name.style.fontSize = "20px";
    name.style.fontWeight = "bold";

    box.style.opacity = "1";

    setTimeout(() => {
        box.style.opacity = "0";
    }, 5000);
}

/* =========================
   LOOP
========================= */


function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (sharkActive) {

    sharkTimer += delta;

    // 5분 초과 = 실패
    if (sharkTimer > 300 && !sharkSuccess) {
        sharkFail();
     }
    }

    mixers.forEach(m => m.update(delta));

    /* =========================
       🌊 BIG EVENT SYSTEM (여기 넣어)
    ========================= */

    bigEventTimer += delta;
bigEventCooldown -= delta;

// 확률 증가 (느리게)
bigEventChance = Math.min(0.005 + bigEventTimer * 0.00015, 0.03);

if (
    !bigEventActive &&
    gameState !== "WHALE" &&
    bigEventCooldown <= 0 &&
    Math.random() < bigEventChance
) {
    const model = getRandomBigModel();

// 이벤트 시작 잠금
if (model.type === "whale" || model.type === "shark" || model.type === "turtle") {
    bigEventActive = true;
}

// 이벤트 종류별 처리
if (model.type === "whale") {
    triggerWhaleEvent();
}

// 🐋🐢🦈 공통 스폰
spawnBigCreature(model);

bigEventTimer = 0;
bigEventCooldown = 12;
}

    if (sharkActive) {

    bigCreatures.forEach(c => {

        if (c.userData.type !== "shark") return;

        // 카메라 방향
        const dir = new THREE.Vector3()
            .subVectors(camera.position, c.position)
            .normalize();

        // 🌀 기본 맴돌기
        c.position.x += Math.sin(performance.now() * 0.001) * 0.02;
        c.position.z += Math.cos(performance.now() * 0.001) * 0.02;

        // 💥 랜덤 돌진
        if (Math.random() < 0.02) {
            c.position.add(dir.multiplyScalar(0.5));
        }
    });
}

    /* ========================= */

    beams.forEach((b, i) => {
        b.material.opacity =
            0.2 + Math.sin(Date.now() * 0.001 + i) * 0.08;
    });


    gun.lookAt(aimPoint);

    spawnTimer += delta;
    if (spawnTimer > 0.7) {
        spawnTimer = 0;
        spawnFish();
    }

    shootTimer += delta;
    if (shooting && shootTimer > fireRate) {
        shootTimer = 0;
        shoot();
        shoot();
        shoot();
    }

    fishes.forEach(fish => {
        fish.position.add(
    fish.userData.smoothDir.clone().multiplyScalar(fish.userData.speed)
      );

    // ⭐ 핵심 추가
      clampPosition(fish.position);

        const target = fish.userData.target;

        if (fish.position.distanceTo(target) < 1.5) {
            setNewTarget(fish);
        }

        const dir = new THREE.Vector3()
            .subVectors(target, fish.position)
            .normalize();

        fish.userData.smoothDir.lerp(dir, 0.05);

        fish.position.add(
            fish.userData.smoothDir.clone().multiplyScalar(fish.userData.speed)
        );

        fish.rotation.y = THREE.MathUtils.lerp(
            fish.rotation.y,
            Math.atan2(fish.userData.smoothDir.x, fish.userData.smoothDir.z),
            fish.userData.turnSpeed
        );
        const swim =
                performance.now() * 0.004 +
                fish.userData.swimOffset;

            // 좌우 흔들림
            fish.rotation.z =
                Math.sin(swim) *
                fish.userData.swimPower;

            // 살짝 끄덕임
            fish.rotation.x =
                Math.cos(swim * 0.5) * 0.04;
                });

                for (let i = bullets.length - 1; i >= 0; i--) {

        const b = bullets[i];

        b.position.add(b.userData.velocity);
        b.userData.life -= delta;

        if (b.userData.life <= 0) {
            scene.remove(b);
            bullets.splice(i, 1);
            continue;
        }

        for (let j = fishes.length - 1; j >= 0; j--) {

    const fish = fishes[j];
    const hitRadius = fish.userData.type === "shark" ? 1.5 : 0.5;

    const hitPoint = fish.getWorldPosition(new THREE.Vector3());
    if (b.position.distanceTo(hitPoint) < hitRadius) {
        // 🦈 SHARK 먼저 처리
        if (fish.userData?.type === "shark") {

            fish.userData.hp -= 10;
            fish.scale.multiplyScalar(0.98);

            spawnHitEffect(fish.position.clone());

            if (fish.userData.hp <= 0) {

                sharkDie();

                scene.remove(fish);
                fishes.splice(j, 1);
                break;
            }
        }

        // 🐟 일반 fish 처리
        else {

            fish.userData.hp -= 1;
            fish.scale.multiplyScalar(0.99);

            if (fish.userData.hp <= 0) {

                playHit();
                spawnHitEffect(fish.position.clone());
                addScore(fish.userData.score);

                scene.remove(fish);
                fishes.splice(j, 1);
                mixers.splice(j, 1);
            }
        }

        scene.remove(b);
        bullets.splice(i, 1);
        break;
        }
      }
    }

    for (let i = effects.length - 1; i >= 0; i--) {

        const g = effects[i];
        let alive = false;

        g.children.forEach(p => {

            p.position.add(p.userData.velocity);
            p.userData.velocity.y -= 0.0;  // 총알 발사될 때 물방울이 나오는 것
            p.material.opacity -= 0.03;

            if (p.material.opacity > 0) alive = true;
        });

        if (!alive) {
            scene.remove(g);
            effects.splice(i, 1);
        }       
    }
    
    const time = clock.elapsedTime;

    decorations.forEach(obj => {

    if (!obj.userData.isSeaweed) return;

    obj.rotation.z =
        Math.sin(time + obj.userData.waveOffset) * 0.10;

    });

    /* 🐋 WHALE CAMERA SHAKE (여기!) */
    
    for (let i = bigCreatures.length - 1; i >= 0; i--) {
    const creature = bigCreatures[i];

    const dir = new THREE.Vector3()
        .subVectors(creature.userData.target, creature.position)
        .normalize();

    creature.position.addScaledVector(dir, creature.userData.speed);
    clampPosition(creature.position);

    creature.lookAt(creature.userData.target);

    if (creature.position.distanceTo(creature.userData.target) < 2) {
        creature.userData.target.set(
            (Math.random() - 0.5) * 25,
            creature.position.y,
            (Math.random() - 0.5) * 25
        );
    }

    creature.userData.timer += delta;

    // 🐋 WHALE
    if (creature.userData.type === "whale") {

    const t = creature.userData.timer;

    // 🧭 수평 회전
    creature.rotation.y += delta * 0.4;

    // 🔄 수직 + 롤 회전 (핵심)
    creature.rotation.x = Math.sin(t * 1.2) * 0.15;
    creature.rotation.z = Math.cos(t * 1.0) * 0.1;

    // 🌊 이동 + 물결
    creature.position.x += Math.sin(performance.now() * 0.0005) * 0.03;
    creature.position.z += Math.cos(performance.now() * 0.0005) * 0.03;

    // 🫧 숨 쉬는 느낌
    const breathe = Math.sin(t * 2.0);
    creature.scale.setScalar(
    creature.userData.scale * (1 + breathe * 0.03)
    );

    if (t > 35) creature.userData.leaving = true;

    continue;
}

    // 🐢 TURTLE
    if (creature.userData.type === "turtle") {

    creature.userData.timer += delta;
    const t = creature.userData.timer;

    // 1. 랜덤 이동
    if (!creature.userData.leaving) {

        const dir = new THREE.Vector3()
            .subVectors(creature.userData.target, creature.position)
            .normalize();

        creature.position.addScaledVector(dir, delta * 0.08);

        if (creature.position.distanceTo(creature.userData.target) < 3) {
            creature.userData.target.set(
                (Math.random() - 0.5) * 40,
                creature.position.y,
                (Math.random() - 0.5) * 40
            );
        }
    }
    if (bigCreatures.length === 0) {
    bigEventActive = false;
}

    // 2. 퇴장 시작
    if (t > 25 && !creature.userData.leaving) {
        creature.userData.leaving = true;

        creature.userData.target.set(
            50,
            creature.position.y,
            creature.position.z
        );
    }

    // 3. 퇴장 이동
    if (creature.userData.leaving) {

        const dir = new THREE.Vector3()
            .subVectors(creature.userData.target, creature.position)
            .normalize();

        creature.position.addScaledVector(dir, delta * 0.12);

        if (creature.position.x > 45) {
    scene.remove(creature);
    bigCreatures.splice(i, 1);
    continue;
}
    }
}


function createHPLabel() {
    const div = document.createElement("div");
    div.style.position = "absolute";
    div.style.color = "white";
    div.style.fontSize = "14px";
    div.style.fontWeight = "bold";
    div.style.padding = "2px 6px";
    div.style.background = "rgba(0,0,0,0.5)";
    div.style.borderRadius = "6px";
    div.style.pointerEvents = "none";

    document.body.appendChild(div);
    return div;
}

    if (creature.userData.type === "shark") {

    const t = creature.userData.timer;

    // 🎯 플레이어 추적
    const dirToCamera = new THREE.Vector3()
        .subVectors(camera.position, creature.position)
        .normalize();

    creature.position.addScaledVector(dirToCamera, delta * 0.5);

    // 🐟 유영 (아주 약하게만)
    creature.position.x += Math.sin(t * 2) * 0.01;
    creature.position.z += Math.cos(t * 1.5) * 0.01;

    // 🔄 회전만
    creature.rotation.y += delta * 0.6;

    // 💀 죽음 처리
    if (creature.userData.hp <= 0) {
        sharkDie();
        scene.remove(creature);
        bigCreatures.splice(i, 1);
        continue;
    }
}

    // 🐟 일반 AI
    if (!creature.userData.leaving) {

        if (Math.random() < 0.01) {

            creature.userData.target.set(
                (Math.random() - 0.5) * 20,
                -3 + Math.random() * 8,
                (Math.random() - 0.5) * 20
            );
        }

        creature.position.lerp(creature.userData.target, 0.02);

        if (creature.userData.timer > 10) {

            creature.userData.leaving = true;

            creature.userData.target.set(
                40,
                creature.position.y,
                creature.position.z
            );
        }
    }
}

    renderer.render(scene, camera);
    }

    animate();

    /* resize */
    window.addEventListener("resize", () => {

    camera.aspect = oceanArea.clientWidth / oceanArea.clientHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(oceanArea.clientWidth, oceanArea.clientHeight);
});