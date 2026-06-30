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
let spinCount = 0;
let spawnTimer = 0;
let currentEvent = null;
let eventTimer = 0;
let eventCooldown = 0;
let currentWhale = null;
let lastHitEffectTime = 0;
let autoAimFish = null;
let gameMode = "PLAY";
let currentSlotSound = null;
let eventLock = false;
let eventActive = false;
let eventFishAlive = false;
let turtleVolume = 0.5;
let sharkVolume = 0.5;




const MAX_EFFECTS = 10;
const HIT_EFFECT_COOLDOWN = 0.05;
const MAX_BULLETS = 20;
const tempVec1 = new THREE.Vector3();
const tempVec2 = new THREE.Vector3();
const BOUNDS = { x: 50, y: 10, z: 50 };
const MAX_FISH = 50;                      /////////////////////////////////////////////// 물고기 나오는 숫자
const FLOOR_Y = -3;

function endEvent() {
    currentEvent = null;
    eventActive = false;
    eventFishAlive = false;
    //eventCooldown = 0;
}

function addScore(value) {
    score += value;
    updateSpinCount();   // ⭐ 스핀 자동 갱신
    updateUI();          // ⭐ 화면 갱신
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

        // 🎰 SLOT SOUND 추가
    slot_spin: new Audio("./sounds/slot_spin.mp3"),
    slot_stop: new Audio("./sounds/slot_stop.mp3"),
    slot_win: new Audio("./sounds/slot_win.mp3"),
    slot_jackpot: new Audio("./sounds/slot_jackpot.mp3"),


       // 🎰 jackpot 사운드
    turtle_bonus: new Audio("./sounds/turtle_bonus.mp3"),
    shark_bonus: new Audio("./sounds/shark_bonus.mp3"),
    whale_bonus: new Audio("./sounds/whale_bonus.mp3"),   
    small_win: new Audio("./sounds/small_win.mp3"),
    big_win: new Audio("./sounds/big_win.mp3"),
    jackpot_win: new Audio("./sounds/jackpot_win.mp3"),
};

function playSfx(audio, volume = 0.8) {
    const s = new Audio(audio.src);
    s.volume = Math.min(1, volume * sfxVolume);
    s.currentTime = 0;
    s.play().catch(() => {});
}


/* =========================
   🔊 AUDIO UNLOCK
========================= */
function unlockAudio() {

    Object.entries(sounds).forEach(([key, s]) => {

    if (
        key === "bgm" ||
        key === "slot_spin"
    ) return;

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
    bgm.volume = 0.6;
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
function updateSpinCount() {
    spinCount = Math.floor(score / 100);
}

function updateUI() {
    document.getElementById("scoreUI").textContent = `SCORE: ${score}`;
    document.getElementById("spinUI").textContent = `SPIN: ${spinCount}`;
}

/* =========================
   🖱️ FIRST CLICK INIT
========================= */
let audioUnlocked = false;

window.addEventListener("click", () => {

    if (audioUnlocked) return;

    audioUnlocked = true;

    unlockAudio();

    startBGM();

}, { once: true });

/* =========================
   🎮 INIT UI (🔥 여기!)
========================= */
updateSpinCount();
updateUI();


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



////////////////////////////////////////////////////////////
///////////////////////슬롯 코드////////////////////////////
///////////////////////////////////////////////////////////


const SLOT_CONFIG = {
    jackpot: 0.5,
    bigWin: 5,
    smallWin: 15,
};

// =========================
// 🎯 SYMBOLS (무조건 최상단)
// =========================
const symbols = ["🐟","🐠","🐢","🦈","🐋","🪙","⭐","💎"];

// =========================
// 🎯 랜덤
// =========================
function randomSymbol() {
    return symbols[Math.floor(Math.random() * symbols.length)];
}

// =========================
// 🎰 초기 슬롯 세팅
// =========================
function initSlot() {
    document.querySelectorAll(".cell").forEach(cell => {
        cell.textContent = randomSymbol();
    });
}

// ⭐ DOM 로딩 후 실행 (중요 안정화)
window.addEventListener("DOMContentLoaded", () => {
    initSlot();
});

// =========================
// 🎯 변수들
// =========================
let slotRunning = false;
let colIntervals = {};
let finalGrid = [];
let finalResult = "NOTHING";

let stopCount = 0;

// =========================
// 🎯 확률
// =========================
function getSlotResult() {
    const r = Math.random() * 100;

    if (r < SLOT_CONFIG.jackpot) return "JACKPOT";
    if (r < SLOT_CONFIG.jackpot + SLOT_CONFIG.bigWin) return "BIGWIN";
    if (r < SLOT_CONFIG.jackpot + SLOT_CONFIG.bigWin + SLOT_CONFIG.smallWin) return "SMALLWIN";

    return "NOTHING";
}

// =========================
// 🎯 결과 생성
// =========================
function generateFinalGrid(result) {

    const grid = [];

    for (let r = 0; r < 3; r++) {
        grid[r] = [];
        for (let c = 0; c < 4; c++) {
            grid[r][c] = randomSymbol();
        }
    }

    if (result === "JACKPOT") {
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 4; c++) {
                grid[r][c] = "🐋";
            }
        }
    }

    else if (result === "BIGWIN") {
        const row = Math.floor(Math.random() * 3);
        const sym = randomSymbol();

        for (let c = 0; c < 4; c++) {
            grid[row][c] = sym;
        }
    }

    else if (result === "SMALLWIN") {
        const col = Math.floor(Math.random() * 4);
        const sym = randomSymbol();

        for (let r = 0; r < 3; r++) {
            grid[r][col] = sym;
        }
    }

    return grid;
}

// =========================
// 🎰 스핀
// =========================
function startColSpin(colId) {

    const col = document.querySelectorAll(`#${colId} .cell`);

    colIntervals[colId] = setInterval(() => {

        const frame = [
            randomSymbol(),
            randomSymbol(),
            randomSymbol()
        ];

        col.forEach((cell, r) => {
            cell.textContent = frame[r];
        });

    }, 60);
}

// =========================
// ⛔ 정지
// =========================
function stopCol(colId) {

    clearInterval(colIntervals[colId]);

    const colIndex = Number(colId.replace("col", "")) - 1;
    const col = document.querySelectorAll(`#${colId} .cell`);

    let count = 0;

    const t = setInterval(() => {

        const frame = [
            randomSymbol(),
            randomSymbol(),
            randomSymbol()
        ];

        col.forEach((cell, r) => {
            cell.textContent = frame[r];
        });

        count++;

        if (count > 6) {
            clearInterval(t);

            col.forEach((cell, r) => {
                cell.textContent = finalGrid[r][colIndex];
            });

            onColumnStopped();
        }

    }, 80);
}

// =========================
// 🎯 릴 종료 감지
// =========================
function onColumnStopped() {

    stopCount++;

    if (stopCount >= 4) {

    // 슬롯 회전음 정지
    if (currentSlotSound) {
        currentSlotSound.pause();
        currentSlotSound.currentTime = 0;
        currentSlotSound = null;
    }

    stopCount = 0;

    setTimeout(() => {

    const win = checkWin(finalGrid);

if (win === "JACKPOT") {

    addScore(100000);
    playSfx(sounds.jackpot_win, 2.0);
    showBonusEvent("🐋 JACKPOT!", "34px");
}

else if (win === "BIGWIN") {

    addScore(1000);
    playSfx(sounds.big_win, 2.0);
    showBonusEvent("💰 BIG WIN!", "26px");
}

else if (win === "SMALLWIN") {

    addScore(300);
    playSfx(sounds.small_win, 2.0);
    showBonusEvent("🔥 SMALL WIN!", "22px");
}

    slotRunning = false;
    gameMode = "PLAY";

}, 500);
    }
    }

// =========================
// 🎯 WIN CHECK
// =========================
function checkWin(grid) {

    // 🐋 JACKPOT
    let allWhale = true;

    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
            if (grid[r][c] !== "🐋") {
                allWhale = false;
            }
        }
    }

    if (allWhale) return "JACKPOT";

    // 🔥 BIGWIN (가로)
    for (let r = 0; r < 3; r++) {
        if (
            grid[r][0] === grid[r][1] &&
            grid[r][1] === grid[r][2] &&
            grid[r][2] === grid[r][3]
        ) {
            return "BIGWIN";
        }
    }

    // 🔥 SMALLWIN (세로) ← 추가된 핵심
    for (let c = 0; c < 4; c++) {
        if (
            grid[0][c] === grid[1][c] &&
            grid[1][c] === grid[2][c]
        ) {
            return "SMALLWIN";
        }
    }

    return "NOTHING";
}



// =========================
// 🎰 실행
// =========================

function spinSlot() {

    if (slotRunning) return;
    if (spinCount <= 0) return;

    spinCount--;
    score -= 100;
    updateUI();

    currentSlotSound = sounds.slot_spin.cloneNode();
    currentSlotSound.volume = 0.6 * sfxVolume;
    currentSlotSound.play().catch(()=>{});

    slotRunning = true;
    gameMode = "SLOT";

    shooting = false;
    shootTimer = 0;

    // ⭐ 핵심 수정 1: 확률 결과 먼저 뽑기
    finalResult = getSlotResult();

    // ⭐ 핵심 수정 2: 그 결과로 grid 생성
    finalGrid = generateFinalGrid(finalResult);

    stopCount = 0;

    startColSpin("col1");
    startColSpin("col2");
    startColSpin("col3");
    startColSpin("col4");

    setTimeout(() => stopCol("col1"), 1200);
    setTimeout(() => stopCol("col2"), 2000);
    setTimeout(() => stopCol("col4"), 3000);
    setTimeout(() => stopCol("col3"), 3800);
}

spinBtn.addEventListener("click", spinSlot);


////////////////////////////////////////////////////////////
///////////////////////슬롯 코드////////////////////////////
///////////////////////////////////////////////////////////

const fireBtn = document.getElementById("fireBtn");

//scene.add(new THREE.AxesHelper(10));     ///////////////////////////////////    화면에 중심을 알려주는 좌표

/* 🌊 배경 + 안개 */
const textureLoader = new THREE.TextureLoader();

textureLoader.load("./bg.png", (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    scene.background = texture;
});
scene.fog = new THREE.Fog(0x003355, 30, 120); ////////////////////////////////////// 👈 살짝 완화 (빛 보이게)

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
    32,   //////////////////////////////////////////////////////////////////////////// 기본 줌 가장 중요한 줌
    oceanArea.clientWidth / oceanArea.clientHeight,
    0.1,
    100
);

camera.position.set(0, 25, 45);  /////////////////////////////////////////////////////// 거리줌 카메라 이동
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
    //{ url: "./models/fish.glb", weight: 20, speed: 0.02, turnSpeed: 0.2, scale: 0.05, hp: 1, score: 10, type: "normal" },
    { url: "./models/fish2.glb", weight: 25, speed: 0.050, turnSpeed: 0.08, scale: 0.20, hp: 50, score: 15, type: "normal" },
    { url: "./models/fish3.glb", weight: 10, speed: 0.050, turnSpeed: 0.03, scale: 0.05, hp: 10, score: 10, type: "normal" },
    { url: "./models/fish4.glb", weight: 10, speed: 0.025, turnSpeed: 0.03, scale: 0.3, hp: 10, score: 10, type: "normal" },
    { url: "./models/fish5.glb", weight: 15, speed: 0.050, turnSpeed: 0.08, scale: 0.35, hp: 50, score: 15, type: "normal" },
    { url: "./models/fish6.glb", weight: 20, speed: 0.050, turnSpeed: 0.08, scale: 0.15, hp: 50, score: 15, type: "normal" },
    { url: "./models/fish7.glb", weight: 10, speed: 0.050, turnSpeed: 0.08, scale: 0.30, hp: 10, score: 10, type: "normal" },
    { url: "./models/fish8.glb", weight: 10, speed: 0.050, turnSpeed: 0.08, scale: 0.03, hp: 10, score: 10, type: "normal" }, 
    //{ url: "./models/fish9.glb", weight: 20, speed: 0.050, turnSpeed: 0.08, scale: 0.90, hp: 150, score: 50, type: "normal" },

    // ======================
    // 🦈🐋🐢 이벤트 물고기 (통합됨)
    // ======================
    { url: "./models/turtle.glb", weight: 0.2, speed: 0.05, turnSpeed: 0.03, scale: 0.010, hp: 150, score: 1000, spawnBonus: 500, type: "turtle" },
    { url: "./models/shark.glb", weight: 0.1, speed: 0.08, turnSpeed: 0.03, scale: 1.6, hp: 450, score: 3000, spawnBonus: 500, type: "shark" },
    { url: "./models/whale.glb", weight: 0.01, speed: 0.02, turnSpeed: 0.03, scale: 0.08, hp: 999, score: 10000, spawnBonus: 10000, type: "whale" }
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
        new THREE.SphereGeometry(0.05 + Math.random() * 0.25, 6, 6),   ///////////////////// 기포 크기 조절
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
            color: isBlood ? 0xcc0000 : 0xcc0000,  /////////////////////////////////// 죽을 때 나오는 피방울
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

function spawnDeathEffect(pos) {   ////////////////////////////////////////////////////  핏방울 퍼지는 코드

    const group = new THREE.Group();
    const geo = new THREE.SphereGeometry(0.15, 6, 6);

    const COUNT = 25;

    for (let i = 0; i < COUNT; i++) {

        const mat = new THREE.MeshBasicMaterial({
            color: 0x8b0000,
            transparent: true,
            opacity: 1
        });

        const p = new THREE.Mesh(geo, mat);
        p.position.copy(pos);

        p.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.15,
            Math.random() * 0.15,
            (Math.random() - 0.5) * 0.15
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

      if (fishes.length >= MAX_FISH) return;  /////////////////////////////주석을 풀면 고기는 30마리로 한정됨.

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
    const randomY = -2 + Math.random() * 1;  //*************  물고기가 떠있는 공간
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
    swimPower: 0.08 + Math.random() * 0.03,

    targetTimer: 0,
    stuckTimer: 0,
    lastMovePos: fish.position.clone()
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

    if (eventActive || eventFishAlive) return;
    eventActive = true;
    eventFishAlive = true;

    currentEvent = "TURTLE";

    sounds.turtle_theme.loop = true;
    sounds.turtle_theme.currentTime = 0;
    sounds.turtle_theme.volume = turtleVolume * sfxVolume;
    sounds.turtle_theme.play().catch(() => {});

    const turtle = spawnSpecialFish(TURTLE);

    addScore(500);
    showBonusEvent("🐢 TURTLE BONUS!", "20px");

/*
//////////////////////////////////////////////////////////////////// 여기부터 시간 안에 못 잡으면 사라지는 코드
    setTimeout(() => {
    if (currentEvent === "TURTLE") {

        sounds.turtle_theme.pause();
        sounds.turtle_theme.currentTime = 0;

        currentEvent = null;
        eventActive = false;
        eventFishAlive = false;

        fishes.forEach(f => {
            if (f.userData.type === "turtle") {
                scene.remove(f);
            }
        });
       }
     }, 30000);                     ////////////////////////////////3000  (현재 30초)
     ///////////////////////////////////////////////////////////////  여기까지 시간 안에 잡지못하면 사라짐 코드
*/
    }
/* =========================
   🦈 SHARK EVENT (보스 1)
========================= */
function startSharkEvent() {

    if (eventActive || eventFishAlive) return;
    eventActive = true;
    eventFishAlive = true;

    currentEvent = "SHARK";

    sounds.shark_spawn.loop = true;
    sounds.shark_spawn.currentTime = 0;
    sounds.shark_spawn.volume = sharkVolume * sfxVolume;
    sounds.shark_spawn.play().catch(() => {});

    spawnSpecialFish(SHARK);

    addScore(500);     //////////////////////////////////////////////////////////// 상어 등장하면 주는 보너스.
    showBonusEvent("🦈 SHARK HUNT!", "20px");

/*
//////////////////////////////////////////////////////////////////// 여기부터 시간 안에 못 잡으면 사라지는 코드
    setTimeout(() => {
    if (currentEvent === "SHARK") {
        sounds.shark_spawn.pause();
        sounds.shark_spawn.currentTime = 0;

        currentEvent = null;
        eventActive = false;
        eventFishAlive = false;

        fishes.forEach(f => {
            if (f.userData.type === "shark") {
                scene.remove(f);
            }
        });
       }
     }, 30000);                     ////////////////////////////////3000  (현재 30초)
     ///////////////////////////////////////////////////////////////  여기까지 시간 안에 잡지못하면 사라짐 코드
*/

    }

/* =========================
   🐋 WHALE EVENT (보스 최종)
========================= */
function startWhaleEvent() {

    if (currentEvent) return;

    const whale = FISH_MODELS.find(f => f.type === "whale");

    currentEvent = "WHALE";

    sounds.whale_theme.loop = true; 
    sounds.whale_theme.currentTime = 0;
    sounds.whale_theme.volume = 1.0 * sfxVolume;
    sounds.whale_theme.play().catch(() => {});

    spawnSpecialFish(WHALE);

    addScore(whale.spawnBonus + whale.score);

    showBonusEvent("🐋 WHALE APPEARS!", "20px");

    setTimeout(() => {
        endWhaleEvent();
    }, 30000);
}

function endWhaleEvent() {

    sounds.whale_theme.pause();
    sounds.whale_theme.currentTime = 0; /// 추가

    currentEvent = null;
    eventActive = false;
    eventFishAlive = false;

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

    smoothDir: new THREE.Vector3(
        Math.random() - 0.5,
        0,
        Math.random() - 0.5
    ).normalize(),

    swimOffset: Math.random() * Math.PI * 2,
    swimPower: 0.1,

    targetTimer: 0,
    stuckTimer: 0,
    lastMovePos: fish.position.clone()
};

setNewTarget(fish);



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

const cannonBase = new THREE.Group();   /////////////////////////////////////// 화면에서 보이이는 대포의 위치

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

const muzzle = new THREE.Object3D();   ////////////////////////////////////////  충구에서 나오는 물방울 거리

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

    if (e.target.closest("#spinBtn")) return;

    if (gameMode !== "PLAY") return;

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

window.addEventListener("mousedown", (e) => {

    // ⭐ UI 버튼 클릭이면 무시
    if (e.target.closest("#spinBtn")) return;

    if (gameMode !== "PLAY") return;

    shooting = true;
});

window.addEventListener("mouseup", () => {
    shooting = false;
});



let lastShootSound = 0;

function shoot() {

    if (gameMode !== "PLAY") return;

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
        (Math.random() - 0.5) * 0.02,   ////////////////////////////////////  0.02 일반기관총, 0.10 산탄총,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02
    );

    dir.add(spread).normalize();

    bullet.userData.velocity = dir.multiplyScalar(3.0);  /////////////////////////////////////// 총알 속도
    bullet.userData.life = 4.0;/////////////////////////총알 사거리(2.5면 일반사거리임, 현재 4.0이면 멀리나감)

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
            new THREE.SphereGeometry(0.05, 6, 6),   //////////////////////////////  총구에서 나오는 기포 효과
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

function showBonusEvent(text, size = "24px") {/////////////////////////////////  이벤트 문구 기본텍스트 크기

    const fireBtn = document.getElementById("fireBtn");
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
     ////////////////////////////////////////////////////////////// 이벤트 물고기 대량출물 수정할 때 쓰는 코드
    
    eventTimer += delta;
    eventCooldown += delta;

    if (!currentEvent && eventCooldown > 60){ /////////////////////////////////////////  60은 1분, 300은 5분

    const r = Math.random();
    if (r < 0.5) {                ///////////////////////////////////////// 전체 이벤트 확률 0.5는 50%를 뜻함.
        const rr = Math.random();


    if (rr < 0.5) startTurtleEvent();   /////////////////////////////////////// 10%
    else if (rr < 0.8) startSharkEvent();   //////////////////////////////////// 6%
    else startWhaleEvent();   ////////////////////////////////////////////////// 4%
    }

    eventCooldown = 0;
   }
    /////////////////////////////////////////////////////////////// 이벤트 물고기 대량출물 수정할 때 쓰는 코드

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
        obj.intensity = 1.5 + Math.sin(Date.now() * 0.0001) * 0.3; ///전체 화면을 어두웠다가 밝아지는 느낌주는 코드
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
    if (spawnTimer > 2.0) {
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
    if (gameMode === "PLAY" && shooting && shootTimer > fireRate) {
        shootTimer = 0;
        for (let i = 0; i < 4; i++) {      /////////////////////////////////////////////////총알 증가하는 코드
         setTimeout(() => shoot(), i * 50);
      }
    }

/* =========================
   fish 이동 로직
========================= */

    fishes.forEach(fish => {

    if (!fish.userData.target) {
        console.error("target 없음", fish);
        return;
    }

    if (!fish.userData.lastMovePos) {
        console.error("lastMovePos 없음", fish);
        return;
    }

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
    // ⭐ 타겟 타이머 증가
    fish.userData.targetTimer += delta;

    // 도착 OR 5초 경과 OR 벽 근처
    if (
    fish.position.distanceTo(target) < 1.5 ||
    fish.userData.targetTimer > 5
    ) {
    setNewTarget(fish);
    fish.userData.targetTimer = 0;
    }
    const edgeLimit = 40;

    if (
    Math.abs(fish.position.x) > edgeLimit ||
    Math.abs(fish.position.z) > edgeLimit
    ) {
    setNewTarget(fish);
    }
    // ⭐ stuck 감지
    const moved = fish.position.distanceTo(fish.userData.lastMovePos);

    if (moved < 0.01) {
    fish.userData.stuckTimer += delta;
    } else {
    fish.userData.stuckTimer = 0;
    }

    fish.userData.lastMovePos.copy(fish.position);

   // 3초 이상 안 움직이면 강제 리셋
    if (fish.userData.stuckTimer > 3) {
    setNewTarget(fish);
    fish.userData.stuckTimer = 0;

    // 방향도 리셋
    fish.userData.smoothDir.set(
        Math.random() - 0.5,
        0,
        Math.random() - 0.5
    ).normalize();
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
        fish.userData.type === "shark" ? 3.0 : 2.0; ////현재 상어는 3.0, 물고기는2.0 쉽게 하려면 수치올리면 됨.

    const hitRadiusSq = hitRadius * hitRadius;

    const hitPoint = tempVec1;
    fish.getWorldPosition(hitPoint);

    // 충돌 체크
    if (b.position.distanceToSquared(hitPoint) < hitRadiusSq) {

        // 🦈 SHARK
        if (fish.userData.type === "shark") {

            fish.userData.hp -= 1;   //////////////////////////////////////////////////  상어 총알 타격치 수치

            // ❌ 삭제됨: fish.scale.multiplyScalar(0.999);

            if (fish.userData.hp <= 0) {

                const now = performance.now() * 0.001;

                if (now - lastHitEffectTime > HIT_EFFECT_COOLDOWN) {
                    spawnDeathEffect(fish.position.clone());
                    lastHitEffectTime = now;
                }

                    playHit();
                    addScore(3000); ///////////////////////////////////////////////////  상어 잡으면 주는 보너스

                    if (fish.userData.type === "shark") {
                     sounds.shark_spawn.pause();
                     sounds.shark_spawn.currentTime = 0;

                     endEvent();
                    }

                // sharkDie();

                scene.remove(fish);

                const idx = fishes.indexOf(fish);
                if (idx !== -1) fishes.splice(idx, 1);

                const mIdx = mixers.findIndex(m => m._root === fish);
                if (mIdx !== -1) mixers.splice(mIdx, 1);

                console.log("🐟 spawn check:", {
                    total: fishes.length,
                    normal: fishes.filter(f => f.userData?.type === "normal").length
                });
            }
        }



        // 🐟 NORMAL + EVENT
        else {

            fish.userData.hp -= 1;

            // ❌ 삭제됨: fish.scale.multiplyScalar(0.999);

            if (fish.userData.hp <= 0) {

                const now = performance.now() * 0.001;

                if (now - lastHitEffectTime > HIT_EFFECT_COOLDOWN) {
                    spawnDeathEffect(fish.position.clone());
                    lastHitEffectTime = now;
                }

                playHit();
                addScore(fish.userData.score);   ////////////////////////////////// 거북이 잡으면 주는 보너스. 
                if (fish.userData.type === "turtle") {
                    sounds.turtle_theme.pause();
                    sounds.turtle_theme.currentTime = 0;
                    endEvent();
                }
                
                if (fish.userData.type === "shark") {
                    sounds.shark_spawn.pause();
                    sounds.shark_spawn.currentTime = 0;
                    endEvent();
                }
                
                if (fish.userData.type === "whale") {
                    sounds.whale_theme.pause();
                    sounds.whale_theme.currentTime = 0;
                    endEvent();
                }

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
            p.userData.velocity.y -= 0.0;  //////////////////////////////// 총알 발사될 때 물방울이 나오는 것
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

    function startNoticeCycle() {

    const notices = [
        "✨100만 SCORE 달성 시 대박선물 증정!✨",
        "✨보너스 타임 진행 중!✨",
        "✨매일 이벤트 진행중!✨",
        "✨대형 이벤트 준비 완료!✨"
    ];

    let index = 0;
    const banner = document.getElementById("topNotice");

    function cycle() {

        banner.textContent = notices[index];
        banner.style.display = "block";

        setTimeout(() => {

            banner.style.display = "none";

            index = (index + 1) % notices.length;

            setTimeout(() => {
                cycle();
            }, 60000); // 1분30초 대기

        }, 20000); // 20초 표시
    }

    setTimeout(() => {
        cycle();
    }, 3000); // 시작 지연
}

window.addEventListener("DOMContentLoaded", () => {
    
startNoticeCycle();

const bottomNotices = [
  "🎯 현재 보너스 이벤트 진행 중",
  "💰 점수 누적 시 추가 보상 지급",
  "🐋 대형 이벤트 등장 확률 상승",
  "🔥 연속 히트 시 보너스 증가"
];

const bottomEl = document.getElementById("bottomNotice");

let i = 0;

function runTicker() {

    bottomEl.textContent = bottomNotices[i];

    const width = bottomEl.offsetWidth;

    bottomEl.style.transition = "none";

    // 👉 화면 오른쪽 밖 시작
    bottomEl.style.transform = `translateX(${width}px)`;

    void bottomEl.offsetWidth;

    bottomEl.style.transition = "transform 10s linear";

    // 👉 화면 왼쪽 밖 끝
    bottomEl.style.transform = `translateX(-${width}px)`;

    i = (i + 1) % bottomNotices.length;

    setTimeout(runTicker, 9500);
}

runTicker();
})
    /* resize */
    window.addEventListener("resize", () => {

    camera.aspect = oceanArea.clientWidth / oceanArea.clientHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(oceanArea.clientWidth, oceanArea.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
});
// test