import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/SkeletonUtils.js";

let loadedSeaweedCount = 0;
let gameState = "NORMAL";
let fishReady = false;
let loadedFishCount = 0;
let scoreMultiplier = 1;
let fishSpawnRate = 0.7;
let score = 0;
let spawnTimer = 0;
let currentEvent = null;
let eventTimer = 0;
let eventCooldown = 0;
let currentWhale = null;
let lastHitEffectTime = 0;
let autoAimFish = null;

const MAX_EFFECTS = 30;
const HIT_EFFECT_COOLDOWN = 0.05;
const MAX_BULLETS = 50;
const tempVec1 = new THREE.Vector3();
const tempVec2 = new THREE.Vector3();
const BOUNDS = { x: 50, y: 10, z: 50 };
const MAX_FISH = 10;
const FLOOR_Y = -3;
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

/* =========================
   🔊 AUDIO UNLOCK
========================= */
function unlockAudio() {

    Object.entries(sounds).forEach(([key, s]) => {

        // 🔥 BGM은 제외 (핵심)
        if (key === "bgm") return;

        s.muted = true;

        s.play().then(() => {
            s.pause();
            s.currentTime = 0;
            s.muted = false;
        }).catch(() => {});
    });

    console.log("🔊 AUDIO UNLOCKED");
}

/* =========================
   🔫 HIT SOUND
========================= */
let sfxVolume = 1;

function playHit() {
    const s = sounds.hit.cloneNode();
    s.volume = 0.2 * sfxVolume;
    s.play().catch(() => {});
}

/* =========================
   🎵 BGM
========================= */
sounds.bgm.loop = true;
sounds.bgm.volume = 0.8;

let bgmStarted = false;

function startBGM() {

    const bgm = sounds.bgm;

    // 🔥 이미 재생 중이면 다시 안 함 (중요)
    if (bgmStarted && !bgm.paused) return;

    bgm.loop = true;
    bgm.volume = 0.8;
    bgm.muted = false;

    const playPromise = bgm.play();

    if (playPromise) {
        playPromise
            .then(() => {
                bgmStarted = true;
                console.log("🎵 BGM STARTED");
            })
            .catch((e) => {
                console.log("❌ BGM 안됨:", e);
            });
    }
}

/* =========================
   🖱️ FIRST CLICK INIT
========================= */
window.addEventListener("click", () => {

    unlockAudio();
    startBGM();

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

const fireBtn = document.getElementById("fireBtn");

fireBtn.addEventListener("touchstart", () => {
    shooting = true;
});

fireBtn.addEventListener("touchend", () => {
    shooting = false;
});

//scene.add(new THREE.AxesHelper(10));     //    화면에 중심을 알려주는 좌표

/* 🌊 배경 + 안개 */
const textureLoader = new THREE.TextureLoader();

textureLoader.load("./bg.png", (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    scene.background = texture;
});
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
        0.1,
        4,
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

    beam.rotation.z = 0.2;
    beam.rotation.x = -0.1;

    beam.position.set(x, 10, z);

    scene.add(beam);
    beams.push(beam);
}


/* 🌊 여러 빛줄기 (핵심) */
//createBeam(0, 10, 1.2);
//createBeam(-6, 3, 1);
//createBeam(6, 10, 2.3);


/* 🎥 카메라 */
const camera = new THREE.PerspectiveCamera(
    32,   ////////////////////////////////////////////////// 기본 줌 가장 중요한 줌
    oceanArea.clientWidth / oceanArea.clientHeight,
    0.1,
    100
);

camera.position.set(0, 25, 45);  ///////////////////////////   거리줌 카메라 이동
camera.lookAt(1.5, 0, 0);

scene.add(camera);

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
   🌿 해초 + 바위 (🔥 추가 핵심)
========================= */

const decorations = [];

function spawnSeaweedAndRocks() {

    // 🌿 해초 (자연스럽고 보기 좋은 밀도)
    
    // 🪨 바위 (자연 지형 느낌)

    /*
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
        */

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

    seaweed.rotation.x = 0;
    seaweed.rotation.z = Math.random() * 0.3 - 0.15;
    seaweed.rotation.y = Math.random() * Math.PI; 

    const xRange = 30;
    const zRange = 12; // 🔥 핵심: 깊이 살짝 압축

    seaweed.position.x = (Math.random() - 0.5) * 25;
    seaweed.position.y = -9
    seaweed.position.z = (Math.random() - 0.5) * 0;

    seaweed.scale.setScalar(
        SEAWEED_SCALE[url] || 1
    );

    seaweed.userData.waveOffset = Math.random() * Math.PI * 2;
    seaweed.userData.isSeaweed = true;
    

    scene.add(seaweed);
    decorations.push(seaweed);
}

function startSeaweedSystem() {

    for (let i = 0; i < 10; i++) {
        spawnGLBSeaweed();
    }

    console.log("🌊 Seaweed system ready!");
}

/* =========================
   🐟 FISH MODELS
========================= */

const FISH_MODELS = [
    // ======================
    // 🐟 일반 물고기
    // ======================
    { url: "./models/fish.glb", weight: 40, speed: 0.02, turnSpeed: 0.2, scale: 0.05, hp: 1, score: 10, type: "normal" },
    { url: "./models/fish2.glb", weight: 50, speed: 0.050, turnSpeed: 0.08, scale: 0.20, hp: 3, score: 30, type: "normal" },
    { url: "./models/fish3.glb", weight: 5, speed: 0.050, turnSpeed: 0.03, scale: 0.05, hp: 5, score: 30, type: "normal" },
    { url: "./models/fish4.glb", weight: 3, speed: 0.025, turnSpeed: 0.03, scale: 0.2, hp: 10, score: 30, type: "normal" },

    // ======================
    // 🦈🐋🐢 이벤트 물고기 (통합됨)
    // ======================
    { url: "./models/turtle.glb", weight: 0.2, speed: 0.05, turnSpeed: 0.03, scale: 0.010, hp: 50, score: 1000, spawnBonus: 1000, type: "turtle" },
    { url: "./models/shark.glb", weight: 0.1, speed: 0.08, turnSpeed: 0.03, scale: 1.7, hp: 70, score: 3500, spawnBonus: 500, type: "shark" },
    { url: "./models/whale.glb", weight: 0.05, speed: 0.02, turnSpeed: 0.03, scale: 0.1, hp: 999, score: 10000, spawnBonus: 10000, type: "whale" }
];

const fishes = [];
const mixers = [];
const bullets = [];
const effects = [];
const floorBubbles = [];

/* =========================
   🐟 DEBUG MONITOR
========================= */
// setInterval(() => {
//     console.log("🐟 fish count:", fishes.length);
// }, 3000);

function spawnFloorBubble() {

    const bubble = new THREE.Mesh(
        new THREE.SphereGeometry(0.05 + Math.random() * 0.25, 6, 6),   //  기포 크기 조절
        new THREE.MeshBasicMaterial({
            color: 0x4f8fb3,
            transparent: true,
            opacity: 0.05
            

            
        })
    );

    bubble.position.set(
        (Math.random() - 0.5) * 30,
        -8,
        (Math.random() - 0.5) * 30
    );

    bubble.userData.velocity = new THREE.Vector3(
    (Math.random() - 0.5) * 0.005,
    0.005 + Math.random() * 0.0001,
    (Math.random() - 0.5) * 0.005
    
    
);

    
    bubble.userData.life = 1.0;

    floorBubbles.push(bubble);
    scene.add(bubble);
}
if (Math.random() < 0.005) {
    spawnFloorBubble();
}


const clock = new THREE.Clock();
const loader = new GLTFLoader();

/* =========================
   ♻️ REUSE OBJECTS (여기!)
========================= */

const bubbleGeo = new THREE.SphereGeometry(0.1, 2, 2);

const bloodMat = new THREE.MeshBasicMaterial({
    color: 0xcc0000,
    transparent: true
});

const waterMat = new THREE.MeshBasicMaterial({
    color: 0x66ccff,
    transparent: true
});

/* 🌿 해초 모델 리스트 (여기!) */
const SEAWEED_MODELS = [
    //"./models/seaweed1.glb",
    //"./models/seaweed2.glb",
    //"./models/seaweed3.glb",
    "./models/seaweed4.glb",
    "./models/seaweed5.glb",
    //"./models/seaweed6.glb",
    //"./models/seaweed7.glb",
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

const SEAWEED_Y_OFFSET = {
    "./models/seaweed5.glb": 2.5,
    "./models/seaweed8.glb": 0.0
};

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
function getNearestFish() {

    let nearest = null;
    let minDist = Infinity;

    fishes.forEach(f => {

        const d = f.position.distanceTo(camera.position);

        if (d < AUTO_AIM_DISTANCE && d < minDist) {
            minDist = d;
            nearest = f;
        }
    });

    return nearest;
}

/* =========================
   MODEL CACHE
========================= */

const modelCache = {};

FISH_MODELS.forEach(m => {
    loader.load(m.url, (gltf) => {
        modelCache[m.url] = gltf;

        // ⭐ 모든 FISH 모델 로딩 완료 체크
        if (Object.keys(modelCache).length === FISH_MODELS.length) {
            console.log("✅ ALL FISH MODELS READY");
        }
    });
});

/* =========================
   SEAFLOOR GLB 바닥 이미지
========================= */
/*
loader.load("./models/seafloor.glb", (gltf) => {
    //
    const floorModel = gltf.scene;

    const box = new THREE.Box3().setFromObject(floorModel);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    floorModel.position.sub(center);
    floorModel.rotation.x = -10;
    floorModel.position.y = -0;

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
*/

function canSpawnHitEffect() {
    const now = performance.now() / 1000;

    if (now - lastHitEffectTime < HIT_EFFECT_COOLDOWN) {
        return false;
    }
    if (effects.length > MAX_EFFECTS) {
    const old = effects.shift();
    scene.remove(old);
    }

    lastHitEffectTime = now;
    return true;
}

/* =========================
   HIT EFFECT
========================= */

function spawnHitEffect(pos) {

    const group = new THREE.Group();
    const geo = new THREE.SphereGeometry(0.1, 2, 2);

    const BLOOD_COUNT = 5;                               
    const WATER_COUNT = 2;

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

    //if (fishes.length >= MAX_FISH) return;

    const normalFishCount = fishes.reduce((count, f) => {
    return count + (f.userData?.type === "normal" ? 1 : 0);
    }, 0);

    if (normalFishCount >= MAX_FISH) return;

    // 일반 물고기만 필터링
    const normalFishModels = FISH_MODELS.filter(f => f.type === "normal");
    const modelInfo = normalFishModels[Math.floor(Math.random() * normalFishModels.length)];
    console.log(modelInfo.type);

    const gltf = modelCache[modelInfo.url];
    if (!gltf?.scene) return;

    const fish = SkeletonUtils.clone(gltf.scene);

    const mixer = new THREE.AnimationMixer(fish);
    gltf.animations?.forEach(c => mixer.clipAction(c).play());

    fish.scale.set(modelInfo.scale, modelInfo.scale, modelInfo.scale);

    const randomX = (Math.random() - 0.5) * BOUNDS.x;
    const randomY = -3 + Math.random() * BOUNDS.y;  //*************  물고기가 떠있는 공간
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
    -3 + Math.random() * 10,    //************  물고기가 위로 가는것을 제한하는 코드
    (Math.random() - 0.5) * 10
);

    fishes.push(fish);
    mixers.push(mixer);
    scene.add(fish);
}

/* =========================
   🎯 EVENT SYSTEM
========================= */

const TURTLE = FISH_MODELS.find(f => f.type === "turtle");
const SHARK = FISH_MODELS.find(f => f.type === "shark");
const WHALE = FISH_MODELS.find(f => f.type === "whale");

/* =========================
   🐢 TURTLE EVENT (보너스/힐)
========================= */
function startTurtleEvent() {

    const turtle = FISH_MODELS.find(f => f.type === "turtle");

    currentEvent = "TURTLE";

    sounds.turtle_theme.currentTime = 0;
    sounds.turtle_theme.volume = 0.5 * sfxVolume;
    sounds.turtle_theme.play().catch(() => {});

    
    for (let i = 0; i < 1; i++) {
        spawnSpecialFish(TURTLE);
    }

    addScore(turtle.spawnBonus); // 👈 이게 핵심 (1000 그대로 사용)

    showBonusEvent("🐢 TURTLE BONUS!", "20px");

    setTimeout(() => {
        sounds.turtle_theme.pause();
        currentEvent = null;
    }, 12000);
}

/* =========================
   🦈 SHARK EVENT (보스 1)
========================= */
function startSharkEvent() {

    const shark = FISH_MODELS.find(f => f.type === "shark");

    currentEvent = "SHARK";

    // 🦈 사운드 추가 (핵심)
    sounds.shark_spawn.currentTime = 0;
    sounds.shark_spawn.volume = 0.5 * sfxVolume;
    sounds.shark_spawn.play().catch(() => {});

    const count = 1

    for (let i = 0; i < count; i++) {
        spawnSpecialFish(SHARK);
    }

    // 🦈 문구
    showBonusEvent("🦈 SHARK HUNT!", "20px");

    // ⛔ 이벤트 종료
    setTimeout(() => {
        currentEvent = null;
    }, 15000);
}

/* =========================
   🐋 WHALE EVENT (보스 최종)
========================= */
function startWhaleEvent() {

    const whale = FISH_MODELS.find(f => f.type === "whale");

    currentEvent = "WHALE";

    sounds.whale_theme.currentTime = 0;
    sounds.whale_theme.volume = 0.5 * sfxVolume;
    sounds.whale_theme.play().catch(() => {});

    const count = 1

    spawnSpecialFish(WHALE);

    addScore(whale.spawnBonus);

   showBonusEvent("🐋 WHALE APPEARS!", "20px");

    setTimeout(() => {
        endWhaleEvent();
    }, 20000);
}

function endWhaleEvent() {

    sounds.whale_theme.pause();
    currentEvent = null;

    if (currentWhale) {
        scene.remove(currentWhale);
        currentWhale = null;
    }
}

/* =========================
   🧠 SPECIAL SPAWN CORE
========================= */
function spawnSpecialFish(modelInfo) {

    const gltf = modelCache[modelInfo.url];
    if (!gltf?.scene) return;

    const fish = SkeletonUtils.clone(gltf.scene);

    const mixer = new THREE.AnimationMixer(fish);
    gltf.animations?.forEach(a => mixer.clipAction(a).play());

    fish.scale.setScalar(modelInfo.scale);

    fish.position.set(
        (Math.random() - 0.5) * 10,
        -2 + Math.random() * 6,
        (Math.random() - 0.5) * 10
    );
    

    fish.userData = {
        type: modelInfo.type,
        hp: modelInfo.hp,
        score: modelInfo.score,
        spawnBonus: modelInfo.spawnBonus,
        speed: modelInfo.speed,
        turnSpeed: modelInfo.turnSpeed,
        target: new THREE.Vector3(),
        smoothDir: new THREE.Vector3(),
        swimOffset: Math.random() * Math.PI * 2,
        swimPower: 0.1
    };

    // 🔥 핵심 추가 (고래만 저장)
    if (modelInfo.type === "whale") {
        currentWhale = fish;
    }

    fishes.push(fish);
    mixers.push(mixer);
    scene.add(fish);

    return fish;
}

/* =========================
   GUN + AIM + SHOOT
========================= */

const cannonBase = new THREE.Group();   // 화면에서 보이이는 대포의 위치

cannonBase.position.set(
    0,
   -2,
   -6.0
);

camera.add(cannonBase);
cannonBase.scale.set(0.3,0.3,0.3);
const baseMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.25, 2.5, 12),
    new THREE.MeshStandardMaterial({
        color: 0x444444
    })
);

cannonBase.add(baseMesh);

const cannonBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(
        0.2,
        0.25,
        2.5,
        12
    ),
    new THREE.MeshStandardMaterial({
        color: 0x222222
    })
);

cannonBarrel.rotation.z =
Math.PI / 2;

cannonBarrel.position.y = 0.5;

cannonBase.add(cannonBarrel);

const muzzle = new THREE.Object3D();   //  충구에서 나오는 물방울 거리

muzzle.position.set(
    0.9,
    0,
    0
);

cannonBarrel.add(muzzle);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const aimPoint = new THREE.Vector3();

let lockedFish = null;
const AUTO_AIM_DISTANCE = 6;

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

    const plane = new THREE.Plane(
    new THREE.Vector3(0, 1, 0),
    0
);

raycaster.ray.intersectPlane(
    plane,
    aimPoint
);
});

/* =========================
   📱 MOBILE TOUCH AIM + SHOOT
========================= */

window.addEventListener("touchstart", (e) => {

    unlockAudio();
    startBGM();

    shooting = true;

}, { passive: true });

window.addEventListener("touchend", () => {

    shooting = false;

}, { passive: true });

window.addEventListener("touchmove", (e) => {
    
    const rect = renderer.domElement.getBoundingClientRect();
    const touch = e.touches[0];

    mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const hits = raycaster.intersectObjects(fishes, true);

    if (hits.length > 0) {

        let obj = hits[0].object;

        while (obj && !obj.userData?.hp) obj = obj.parent;

        lockedFish = obj;

    } else {
        lockedFish = null;
    }

    const plane = new THREE.Plane(
        new THREE.Vector3(0, 1, 0),
        0
    );

    raycaster.ray.intersectPlane(plane, aimPoint);
    autoAimFish = getNearestFish();

}, { passive: true });

let shooting = false;
let shootTimer = 0;
const fireRate = 0.12;

window.addEventListener("mousedown", () => shooting = true);
window.addEventListener("mouseup", () => shooting = false);



let lastShootSound = 0;

function shoot() {

    const now = performance.now();

    if (now - lastShootSound > 80) {

        const s = sounds.shoot.cloneNode();

        s.volume = 0.08 * sfxVolume;

        s.play().catch(()=>{});

        lastShootSound = now;
    }

    const bullet = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffff00 })
);

// 총구 위치 얻기
const muzzlePos = new THREE.Vector3();

muzzle.getWorldPosition(muzzlePos);

// 총알을 총구 위치에 생성
bullet.position.copy(muzzlePos);

const target = autoAimFish ? autoAimFish.position : aimPoint;

const dir = target.clone()
    .sub(muzzlePos)
    .normalize();

    const spread = new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,   //  0.02 일반기관총, 0.10 산탄총,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02
    );

    dir.add(spread).normalize();

    bullet.userData.velocity = dir.multiplyScalar(2.0);  // 총알 속도
    bullet.userData.life = 2.5;

    bullets.push(bullet);
    scene.add(bullet);

    /* =========================
       🥉 총알 제한 핵심
    ========================= */

    if (bullets.length > MAX_BULLETS) {
    const old = bullets.shift();
    scene.remove(old);

    // 메모리 정리
    old.geometry.dispose();
    old.material.dispose();
}

    

    const forward = new THREE.Vector3()
    .subVectors(aimPoint, muzzlePos)
    .normalize();
    muzzlePos.add(forward.multiplyScalar(0.10));

    spawnMuzzleBubbles(muzzlePos);
    }

function spawnMuzzleBubbles(pos) {

    const group = new THREE.Group();

    for (let i = 0; i < 20; i++) {

        const bubble = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 6, 6),   //  총구에서 나오는 기포 효과
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

function showBonusEvent(text, size = "24px") {//...............................  이벤트 문구 기본텍스트 크기

    const box = document.getElementById("bonusEvent");
    const name = document.getElementById("bonusName");

    name.textContent = text;
    name.style.fontSize = size;          
    name.style.fontWeight = "bold";

    box.style.opacity = "1";

    setTimeout(() => {
        box.style.opacity = "0";
    }, 6000);
}

/* =========================
   LOOP
========================= */

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
     //................................................................. 이벤트 물고기 대량출물 수정할 때 쓰는 코드
    
    eventTimer += delta;
    eventCooldown += delta;

    if (!currentEvent && eventCooldown > 600) {

    const r = Math.random();
    if (r < 0.2) {                //................................ 전체 이벤트 확률 20%
        const rr = Math.random();


    if (rr < 0.5) startTurtleEvent();   //................................ 10%
    else if (rr < 0.8) startSharkEvent();   //............................. 6%
    else startWhaleEvent();   //.......................................... 4%
    }

    eventCooldown = 0;
   }
    //................................................................. 이벤트 물고기 대량출물 수정할 때 쓰는 코드

    mixers.forEach(m => m.update(delta));

/* =========================
   빛 효과 
========================= */

    beams.forEach((b, i) => {
        b.material.opacity =
            0.2 + Math.sin(Date.now() * 0.001 + i) * 0.08;
    });
    scene.children.forEach(obj => {
    if (obj.isAmbientLight) {
        obj.intensity = 1.5 + Math.sin(Date.now() * 0.0001) * 0.3;   //  전체 화면을 어두웠다가 밝아지는 느낌주는 코드
    }
});
/* =========================
   초 조준
========================= */

    cannonBase.lookAt(
    aimPoint.x,
    cannonBase.position.y,
    aimPoint.z
);

/* =========================
   물고기 스폰
========================= */

    spawnTimer += delta;
    if (spawnTimer > 1.2) {
        spawnTimer = 0;
        spawnFish();
    }
    if (Math.random() < 0.02) {
    spawnFloorBubble();
    }
    
/* =========================
   발사 시스템 총알 증가하고 싶다면~
========================= */

    shootTimer += delta;
    if (shooting && shootTimer > fireRate) {
        shootTimer = 0;
        for (let i = 0; i < 4; i++) {      //.......................................총알 증가하는 코드
         setTimeout(() => shoot(), i * 50);
      }
    }

/* =========================
   fish 이동 로직
========================= */

    fishes.forEach(fish => {

    const distToCam = fish.position.distanceTo(camera.position);
    const isFar = distToCam > 25;

    // ⭐ 바닥/벽 제한
    clampPosition(fish.position);

    // ⭐ 벽 반사 로직
    if (fish.position.x > BOUNDS.x / 2 || fish.position.x < -BOUNDS.x / 2) {
        fish.userData.smoothDir.x *= -1;
    }

    if (fish.position.z > BOUNDS.z / 2 || fish.position.z < -BOUNDS.z / 2) {
        fish.userData.smoothDir.z *= -1;
    }

    // ⭐ temp vector 초기화
    if (!fish.userData._tempVec) {
        fish.userData._tempVec = new THREE.Vector3();
    }

    const target = fish.userData.target;

    // ⭐ 목표 갱신
    if (fish.position.distanceTo(target) < 1.5) {
        setNewTarget(fish);
    }

    // =========================
    // 🧠 LOD AI (핵심 최적화)
    // =========================

    if (!isFar) {

        // 🔥 가까운 물고기: 정상 AI
        const dir = fish.userData._tempVec
            .subVectors(target, fish.position)
            .normalize();

        fish.userData.smoothDir.lerp(dir, 0.05);

        fish.position.add(
            fish.userData.smoothDir.clone().multiplyScalar(fish.userData.speed)
        );

    } else {

        // 🔥 먼 물고기: 단순 이동 (CPU 절약)
        fish.position.add(
            fish.userData.smoothDir.clone().multiplyScalar(fish.userData.speed * 0.5)
        );
    }

    // =========================
    // 🎯 회전 (항상 적용)
    // =========================

    fish.rotation.y = THREE.MathUtils.lerp(
        fish.rotation.y,
        Math.atan2(fish.userData.smoothDir.x, fish.userData.smoothDir.z),
        fish.userData.turnSpeed
    );

    // =========================
    // 🌊 물고기 자연 애니메이션
    // =========================

    const swim =
        performance.now() * 0.004 + fish.userData.swimOffset;

    // 좌우 흔들림
    fish.rotation.z =
        Math.sin(swim) * fish.userData.swimPower;

    // 살짝 끄덕임
    fish.rotation.x =
        Math.cos(swim * 0.5) * 0.04;
});

/* =========================
   총알 이동 + 생명시간
========================= */

                outer: for (let i = bullets.length - 1; i >= 0; i--) {
               const b = bullets[i];

        b.position.add(b.userData.velocity);
        b.userData.life -= delta;

        if (b.userData.life <= 0) {
            scene.remove(b);
            bullets.splice(i, 1);
            continue;
        }
/* =========================
   총알 이동 + 생명시간
========================= */

        for (let j = fishes.length - 1; j >= 0; j--) {

    const fish = fishes[j];

    const hitRadius =
        fish.userData.type === "shark" ? 2.5 : 1.2;        //   물고기 타격수치로 맞으면 죽는 수치(낮으면 잘 안죽음)

    const hitRadiusSq = hitRadius * hitRadius;

    // ✔ 재사용 Vector
    const hitPoint = tempVec1;
    fish.getWorldPosition(hitPoint);

    // ✔ 충돌 (sqrt 제거)
    if (b.position.distanceToSquared(hitPoint) < hitRadiusSq) {        

        // 🦈 SHARK
        if (fish.userData.type === "shark") {

            fish.userData.hp -= 10;
            fish.scale.multiplyScalar(0.999);

            if (fish.userData.hp <= 0) {

                // 🔥 이펙트 제한 (쿨타임)
                const now = performance.now() * 0.001;

                if (now - lastHitEffectTime > HIT_EFFECT_COOLDOWN) {

                    spawnHitEffect(fish.position.clone());
                    lastHitEffectTime = now;
                }

                sharkDie();

                scene.remove(fish);

// fishes 제거
const idx = fishes.indexOf(fish);
if (idx !== -1) {
    fishes.splice(idx, 1);
}

// mixers는 안전하게 따로 찾기
const mIdx = mixers.findIndex(m => m._root === fish);
if (mIdx !== -1) {
    mixers.splice(mIdx, 1);
}
console.log("🐟 spawn check:", {
    total: fishes.length,
    normal: fishes.filter(f => f.userData?.type === "normal").length
});
            }
        }

        // 🐟 NORMAL + EVENT
        else {

            fish.userData.hp -= 1;
            fish.scale.multiplyScalar(0.999);

            if (fish.userData.hp <= 0) {

                // 🔥 이펙트 제한 (쿨타임)
                const now = performance.now() * 0.001;

                if (now - lastHitEffectTime > HIT_EFFECT_COOLDOWN) {

                    spawnHitEffect(fish.position.clone());
                    lastHitEffectTime = now;
                }

                playHit();
                addScore(fish.userData.score);

                scene.remove(fish);
                fishes.splice(j, 1);
                mixers.splice(j, 1);
            }
        }

        scene.remove(b);
        bullets.splice(i, 1);
        break outer;
    }
}
}

/* =========================
   effects (이펙트 처리)
========================= */

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

            g.children.forEach(p => {
            p.geometry.dispose();
            p.material.dispose();
         });
        }       
    }

/* =========================
   decorations (해초 애니메이션)
========================= */

    const time = clock.elapsedTime;

    decorations.forEach(obj => {

    if (!obj.userData.isSeaweed) return;

    obj.rotation.z =
        Math.sin(time + obj.userData.waveOffset) * 0.10;

    });

    /* =========================
       🫧  바닥 거품(기포)
    ========================= */

    for (let i = floorBubbles.length - 1; i >= 0; i--) {

        const b = floorBubbles[i];

        b.position.add(b.userData.velocity);
        b.userData.velocity.y += 0.001;
        b.position.add(b.userData.velocity);

// ✔ 서서히 줄어들게
        b.userData.life -= 0.0001;
        b.material.opacity = b.userData.life;

        if (b.material.opacity <= 0) {
            scene.remove(b);
            floorBubbles.splice(i, 1);
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
});