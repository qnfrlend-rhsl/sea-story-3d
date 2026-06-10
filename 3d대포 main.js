import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/SkeletonUtils.js";


///////////////////////// 1 전역 변수 / 상태 /////////////////////////



let gameState = "NORMAL";
let score = 0;
let scoreMultiplier = 1;
let fishSpawnRate = 0.7;
let bigEventTimer = 0;
let bigEventChance = 0.01;
let spawnTimer = 0;
let shootTimer = 0;
let shooting = false;
let shootInterval = null;
let gun;
let oceanArea;
let cannon;
let whaleActive = false;
let sharkActive = false;
let sharkSuccess = false;
let whaleTimer = null;
let sharkTimer = 0;
let yaw = 0;
let pitch = 0;
let sensitivity = 0.002;

const fishes = [];
const mixers = [];
const bullets = [];
const effects = [];
const bigCreatures = [];
const FISH_MODELS = [
       {url: './models/fish1.glb',scale: 0.01,speed: 0.01, turnSpeed: 0.1,hp: 3,score: 100},
       {url: './models/fish2.glb',scale: 0.4,speed: 0.04, turnSpeed: 0.08,hp: 5,score: 200},
       {url: './models/fish3.glb',scale: 0.08,speed: 0.06, turnSpeed: 0.09, hp: 4,score: 150}
];

// ================= 공간 범위 =================
const BOUNDS = { x: 50, y: 20, z: 50 };

// ================= 입력 / 조준 =================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// ================= 로더 시스템 =================
const loader = new GLTFLoader();
const modelCache = {};
const MAX_FISH = 20;

// ================= 사운드 =================
const sounds = {
    bgm: new Audio("./sounds/bgm.mp3"),
    shoot: new Audio("./sounds/shoot.mp3"),
    hit: new Audio("./sounds/hit.mp3"),
    whale_theme: new Audio("./sounds/whale_theme.mp3"),
    turtle_theme: new Audio("./sounds/turtle_theme.mp3"),
    shark_spawn: new Audio("./sounds/shark_spawn.mp3"),
    shark_die: new Audio("./sounds/shark_die.mp3"),
};

let sfxVolume = 1;


///////////////////////// 2 사운드 시스템 /////////////////////////



// ================= 사운드 재생 함수 =================
function playSound(name, volume = 1) {
    if (!sounds[name]) return;

    sounds[name].volume = volume * sfxVolume;
    sounds[name].currentTime = 0;
    sounds[name].play().catch(() => {});
}

// ================= BGM 초기 설정 =================
sounds.bgm.loop = true;
sounds.bgm.volume = 0.4;

// ================= 오디오 언락 (브라우저 정책 대응) =================
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

// ================= 초기 클릭으로 BGM 시작 =================
window.addEventListener("click", () => {

    unlockAudio();

    sounds.bgm.loop = true;
    sounds.bgm.volume = 0.4;
    sounds.bgm.currentTime = 0;

    sounds.bgm.play().catch(() => {});
}, { once: true });




///////////////////////// 3 THREE 기본 세팅 /////////////////////////



// ================= 씬 =================
const scene = new THREE.Scene();

// ================= 카메라 =================
const camera = new THREE.PerspectiveCamera(
    80,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);
camera.position.set(0, 10, 30);
camera.lookAt(0, 0, 0);

// ================= 렌더러 =================
const renderer = new THREE.WebGLRenderer({
    antialias: true
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 부드러운 그림자

cannon = new THREE.Object3D();
scene.add(cannon);

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const temp = new THREE.Vector3();

function updateCannon() {

    camera.getWorldDirection(forward);

    right.crossVectors(forward, camera.up).normalize();

    temp.copy(camera.position);

    temp.add(forward.clone().multiplyScalar(0.6));
    temp.add(right.clone().multiplyScalar(0));
    temp.add(camera.up.clone().multiplyScalar(-0.2));

    cannon.position.copy(temp);

    cannon.lookAt(
        camera.position.clone().add(forward)
    );
}

// ================= DOM / oceanArea =================


window.addEventListener('DOMContentLoaded', () => {
    oceanArea = document.getElementById("oceanArea");

    if (!oceanArea) {
        console.error("❌ oceanArea element not found!");
        return;
    }

    renderer.setSize(oceanArea.clientWidth, oceanArea.clientHeight);
    oceanArea.appendChild(renderer.domElement);
});

// ================= 시계 =================
const clock = new THREE.Clock();

// ================= 창 크기 변경 이벤트 =================
window.addEventListener('resize', () => {
    if (!oceanArea) return;

    const width = oceanArea.clientWidth;
    const height = oceanArea.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
});



///////////////////////// 4 환경 (바다 / 조명 / 안개) /////////////////////////



// ================= 배경 & 안개 =================
scene.background = new THREE.Color(0x003355);
scene.fog = new THREE.Fog(0x003355, 30, 120);

// ================= 조명 =================
// 🌤️ 앰비언트 라이트
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// 🌞 방향성 라이트
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;

// 🔧 그림자 품질 강화
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.radius = 2;

scene.add(directionalLight);

// ================= 바닥 =================
const floorGeo = new THREE.PlaneGeometry(100, 100);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x004466 });
const floor = new THREE.Mesh(floorGeo, floorMat);

floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
floor.position.y = -10;

scene.add(floor);

// ================= 해초 / 바위 =================
// (GLB 모델은 5번 로더 블록에서 처리)




///////////////////////// 5 로더 시스템 (GLB 캐시) /////////////////////////



function loadModel(url, cache, callback) {
    if (cache[url]) {
        callback(SkeletonUtils.clone(cache[url].scene), cache[url].animations);
        return;
    }

    loader.load(
        url,
        (gltf) => {
            cache[url] = {
                scene: gltf.scene,
                animations: gltf.animations // ✅ 애니메이션도 같이 저장
            };
            callback(SkeletonUtils.clone(gltf.scene), gltf.animations);
        },
        undefined,
        (err) => {
            console.error("❌ GLB Load Error:", url, err);
        }
    );
}

// ================= 물고기 모델 미리 로드 =================
FISH_MODELS.forEach(f => {
    loadModel(f.url, modelCache, () => {
        console.log("🐟 Loaded:", f.url);
    });
});




///////////////////////// 6 플레이어 (총 / 조준 / 발사) /////////////////////////



loader.load('./models/gun.glb', (gltf) => {
    gun = SkeletonUtils.clone(gltf.scene);
    gun.scale.set(0.05, 0.05, 0.05);

    // ✅ cannon에만 붙이기
    cannon.add(gun);
    gun.position.set(-0.1, -0.22, 0.1);
    gun.rotation.set(0, Math.PI, 0);
});

// =============================
// 🎯 마우스 입력 (조준용)
// =============================
window.addEventListener('mousemove', (event) => {
    yaw -= event.movementX * sensitivity;
    pitch -= event.movementY * sensitivity;

    // 위아래 제한
    pitch = Math.max(-1.2, Math.min(1.2, pitch));
});


// =======================
// 🔫 발사 함수
// =======================
function shoot() {
    if (shooting) return;
    shooting = true;

    spawnBullet();

    setTimeout(() => shooting = false, 200); // 연사 속도
}

// =======================
// 💥 총알 생성 (총구 기준)
// =======================
function spawnBullet() {
    if (!gun) return;

    const bullet = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    );

    // 총구 위치 기준 오프셋
    const muzzleOffset = new THREE.Vector3(-0.1, 0, -2.5);
    muzzleOffset.applyQuaternion(gun.quaternion);

    // 총월드 위치 + 오프셋
    const origin = new THREE.Vector3();
    gun.getWorldPosition(origin);
    origin.add(muzzleOffset);
    bullet.position.copy(origin);

    // 총 방향
    const dir = new THREE.Vector3(0, 0, 1);
    dir.applyQuaternion(gun.getWorldQuaternion(new THREE.Quaternion()));
    dir.normalize();

    bullet.userData.velocity = dir.multiplyScalar(7); // 속도
    bullet.userData.life = 1.0; // 생명주기

    scene.add(bullet);
    bullets.push(bullet);
}

// =======================
// 마우스 이벤트 → 연속발사
// =======================
window.addEventListener("mousedown", () => {
    if (shooting) return;
    shooting = true;

    spawnBullet(); // 첫 발사

    shootInterval = setInterval(() => {
        spawnBullet();
    }, 120);
});

window.addEventListener("mouseup", () => {
    shooting = false;
    if (shootInterval) {
        clearInterval(shootInterval);
        shootInterval = null;
    }
});


///////////////////////// 7. 물고기 시스템 /////////////////////////




// 목표 설정 (AI 이동 타겟)
function setNewTarget(fish) {
    fish.userData.target.set(
        (Math.random() - 0.5) * 60,
        -3 + Math.random() * 8,
        (Math.random() - 0.5) * 60
    );
}

// 물고기 생성
function spawnFish() {
    if (fishes.length >= MAX_FISH) return;

    const modelInfo = FISH_MODELS[Math.floor(Math.random() * FISH_MODELS.length)];
    const cached = modelCache[modelInfo.url];
    if (!cached?.scene) return;

    const fish = SkeletonUtils.clone(cached.scene);

    // =========================
    // 🎬 애니메이션 (GLB용)
    // =========================
    let mixer = null;

    if (cached.animations && cached.animations.length > 0) {
        mixer = new THREE.AnimationMixer(fish);

        cached.animations.forEach(clip => {
            const action = mixer.clipAction(clip);
            action.reset();
            action.play();
        });

        mixers.push(mixer);
    }

    // =========================
    // 🐟 스케일
    // =========================
    fish.scale.setScalar(modelInfo.scale);

    // =========================
    // 📍 스폰 위치
    // =========================
    const randomX = (Math.random() - 0.5) * BOUNDS.x;
    const randomY = 2 + Math.random() * (BOUNDS.y - 2);
    const randomZ = (Math.random() - 0.5) * BOUNDS.z;
    const side = Math.floor(Math.random() * 6);

    switch (side) {
        case 0: fish.position.set(-35, randomY, randomZ); break;
        case 1: fish.position.set(35, randomY, randomZ); break;
        case 2: fish.position.set(randomX, randomY, -35); break;
        case 3: fish.position.set(randomX, randomY, 35); break;
        case 4: fish.position.set(randomX, 12, randomZ); break;
        case 5: fish.position.set(randomX, -12, randomZ); break;
    }

    // =========================
    // 🧠 AI 데이터
    // =========================
    fish.userData = {
        speed: modelInfo.speed,
        turnSpeed: modelInfo.turnSpeed,
        hp: modelInfo.hp,
        score: modelInfo.score,

        target: new THREE.Vector3(),

        smoothDir: new THREE.Vector3(
            Math.random() - 0.5,
            0,
            Math.random() - 0.5
        ).normalize(),

        swimOffset: Math.random() * Math.PI * 2,
        swimPower: 0.15 + Math.random() * 0.2,   // 🔥 강화됨
        swimSpeed: 0.003 + Math.random() * 0.01,

        mixer: mixer
    };

    setNewTarget(fish);

    fishes.push(fish);
    scene.add(fish);
}
function updateFish(delta) {
    for (let i = fishes.length - 1; i >= 0; i--) {
        const fish = fishes[i];
        const target = fish.userData.target;

        // =========================
        // 🎬 GLB 애니메이션 업데이트
        // =========================
        if (fish.userData.mixer) {
            fish.userData.mixer.update(delta);
        }

        // =========================
        // 🎯 목표 갱신
        // =========================
        if (fish.position.distanceTo(target) < 1.5) {
            fish.userData.target.set(
                (Math.random() - 0.5) * BOUNDS.x,
                -3 + Math.random() * BOUNDS.y,
                (Math.random() - 0.5) * BOUNDS.z
            );
        }

        // =========================
        // 🧭 방향 계산
        // =========================
        const dir = new THREE.Vector3()
            .subVectors(target, fish.position)
            .normalize();

        fish.userData.smoothDir.lerp(dir, 0.04);

        // =========================
        // 🐟 이동
        // =========================
        fish.position.add(
            fish.userData.smoothDir
                .clone()
                .multiplyScalar(fish.userData.speed * delta * 60)
        );

        // =========================
        // 🧭 회전 (핵심)
        // =========================
        const forward = new THREE.Vector3(0, 0, 1);

        const targetQuat = new THREE.Quaternion().setFromUnitVectors(
            forward,
            fish.userData.smoothDir.clone().normalize()
        );

        fish.quaternion.slerp(targetQuat, 0.08);

        // =========================
        // 🐟 헤엄 애니메이션 (보정)
        // =========================
        const swim =
            performance.now() * fish.userData.swimSpeed +
            fish.userData.swimOffset;

        // 🔥 너무 과하면 GLB 애니메이션 깨짐 → 약하게
        fish.rotation.z += Math.sin(swim) * fish.userData.swimPower * 0.02;
        fish.rotation.x += Math.cos(swim * 0.5) * 0.01;

        // =========================
        // 🐟 파츠 흔들기 (있으면만)
        // =========================
        const tail = getPart(fish, ["tail", "Tail", "fin", "Fin"]);
        if (tail) tail.rotation.y = Math.sin(swim * 2) * 0.4;

        const head = getPart(fish, ["head", "Head"]);
        if (head) head.rotation.y = Math.sin(swim * 1.2) * 0.08;

        const body = getPart(fish, ["body", "Body"]);
        if (body) body.rotation.z = Math.sin(swim) * 0.03;
    }
}
function getPart(fish, names) {
    for (const n of names) {
        const obj = fish.getObjectByName(n);
        if (obj) return obj;
    }
    return null;
}



///////////////////////// 8. 이벤트 시스템 (상어/고래/거북이) /////////////////////////




// 점수 처리 함수
function addScore(value) {
    score += value * scoreMultiplier;
    const scoreBox = document.getElementById("score");
    if (scoreBox) scoreBox.textContent = score;
}

/* =========================
   공용 이벤트 트리거 UI
========================= */
function showBonusEvent(text) {
    const box = document.getElementById("bonusEvent");
    const name = document.getElementById("bonusName");

    if (!box || !name) return;

    name.textContent = text;
    box.style.opacity = "1";

    setTimeout(() => {
        box.style.opacity = "0";
    }, 4000);
}

/* =========================
   🐋 고래 이벤트
========================= */
function triggerWhaleEvent() {
    if (gameState === "WHALE") return;

    gameState = "WHALE";
    whaleActive = true;

    showBonusEvent("🐋 WHALE EVENT");

    // 🎵 음악
    sounds.whale_theme.currentTime = 0;
    sounds.whale_theme.loop = true;
    sounds.whale_theme.play().catch(() => {});

    // 🎮 게임 영향
    scoreMultiplier = 2;
    fishSpawnRate = 0.3;
    bigEventChance = 0.4;

    // 🌊 환경
    scene.fog.density = 0.08;

  
}

/* =========================
   🦈 상어 이벤트
========================= */
function startSharkEvent() {
    if (sharkActive) return;

    sharkActive = true;
    sharkTimer = 0;
    sharkSuccess = false;

    showBonusEvent("🦈 SHARK HUNT");

    sounds.shark_spawn.currentTime = 0;
    sounds.shark_spawn.loop = true;
    sounds.shark_spawn.play().catch(() => {});
}

/* =========================
   🐢 이벤트 기반 보상 연결
========================= */
function handleBigSpawnReward(creature, model) {
    const bonus = model.spawnBonus || 500;

    if (model.type === "shark") {
        startSharkEvent();
        addScore(bonus);
    }

    if (model.type === "whale") {
        addScore(bonus);
        triggerWhaleEvent();
    }

    if (model.type === "turtle") {
        addScore(bonus);

        showBonusEvent("🐢 TURTLE VISIT");

        sounds.turtle_theme.currentTime = 0;
        sounds.turtle_theme.loop = true;
        sounds.turtle_theme.play().catch(() => {});
    }
}

/* =========================
   이벤트 상태 업데이트
========================= */
function updateEvents(delta) {
    if (sharkActive) {
        sharkTimer += delta;

        // 테스트용 10초로 조정
        if (sharkTimer > 10 && !sharkSuccess) {
            sharkActive = false;
            sounds.shark_spawn.pause();
        }
    }

    // whaleActive 체크
    if (whaleActive) {
        // 추가 효과 필요 시 확장 가능
    }
}



///////////////////////// 9. 이펙트 시스템 /////////////////////////



/* =========================
   💥 피 / 히트 이펙트
========================= */
function spawnHitEffect(pos) {

    const group = new THREE.Group();

    const geo = new THREE.SphereGeometry(0.1, 3, 3);

    const BLOOD_COUNT = 40;
    const WATER_COUNT = 10;

    for (let i = 0; i < BLOOD_COUNT + WATER_COUNT; i++) {

        const isBlood = i < BLOOD_COUNT;

        const mat = new THREE.MeshBasicMaterial({
            color: isBlood ? 0xcc0000 : 0x00ccff, // 🔥 피 / 물 구분 (원본 핵심)
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
   💨 총구 버블 이펙트
========================= */
function spawnMuzzleBubbles(pos) {

    const group = new THREE.Group();

    for (let i = 0; i < 20; i++) {

        const bubble = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 6, 6),
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.5
            })
        );

        bubble.position.copy(pos);

        bubble.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.03,
            Math.random() * 0.05,
            (Math.random() - 0.5) * 0.03
        );

        group.add(bubble);
    }

    scene.add(group);
    effects.push(group);
}

/* =========================
   🔫 총알 업데이트 + 충돌
========================= */
function updateBullets(delta) {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.position.add(b.userData.velocity.clone().multiplyScalar(delta * 60));
        b.userData.life -= delta;

        // 충돌 처리
        for (let j = fishes.length - 1; j >= 0; j--) {
            const fish = fishes[j];
            if (b.position.distanceTo(fish.position) < 0.6) {
                fish.userData.hp -= 1;
                spawnHitEffect(fish.position.clone());
                if (fish.userData.hp <= 0) {
                    addScore(fish.userData.score);
                    scene.remove(fish);
                    fishes.splice(j, 1);
                    mixers.splice(j, 1);
                }
                scene.remove(b);
                bullets.splice(i, 1);
                break;
            }
        }

        for (let j = bigCreatures.length - 1; j >= 0; j--) {
            const c = bigCreatures[j];
            if (b.position.distanceTo(c.position) < 1.2) {
                c.userData.hp -= 1;
                spawnHitEffect(c.position.clone());
                if (c.userData.hp <= 0) {
                    scene.remove(c);
                    bigCreatures.splice(j, 1);
                    addScore(1000);
                }
                scene.remove(b);
                bullets.splice(i, 1);
                break;
            }
        }

        if (b.userData.life <= 0) {
            scene.remove(b);
            bullets.splice(i, 1);
        }
    }
}

        /* =========================
           🐟 일반 물고기 충돌
        ========================= */
        for (let j = fishes.length - 1; j >= 0; j--) {

            const fish = fishes[j];
            const hitRadius = 0.6;

            const hitPoint = fish.getWorldPosition(new THREE.Vector3());

            if (b.position.distanceTo(hitPoint) < hitRadius) {

                fish.userData.hp -= 1;

                spawnHitEffect(fish.position.clone());

                if (fish.userData.hp <= 0) {

                    addScore(fish.userData.score);

                    scene.remove(fish);
                    fishes.splice(j, 1);
                    mixers.splice(j, 1);
                }

                scene.remove(b);
                bullets.splice(i, 1);
                break;
            }
        }

        /* =========================
           🐋🦈🐢 대형 생물 충돌
        ========================= */
        for (let j = bigCreatures.length - 1; j >= 0; j--) {

            const c = bigCreatures[j];
            const hitPoint = c.getWorldPosition(new THREE.Vector3());
            const hitRadius = 1.2;

            if (b.position.distanceTo(hitPoint) < hitRadius) {

                c.userData.hp -= 1;

                spawnHitEffect(c.position.clone());

                /* =========================
                   체력 0일 때 처리
                ========================= */
                if (c.userData.hp <= 0) {

                    // 제거
                    scene.remove(c);
                    bigCreatures.splice(j, 1);

                    // 기본 점수
                    addScore(1000);

                    // 🔥 원본 핵심: 이벤트별 추가 처리
                    if (c.userData.type === "shark") {
                        sharkSuccess = true;
                        sounds.shark_spawn.pause();
                        sounds.shark_die.play().catch(() => {});
                    }

                    if (c.userData.type === "whale") {
                        sounds.whale_theme.pause();
                        sounds.whale_theme.currentTime = 0;
                    }

                    if (c.userData.type === "turtle") {
                        sounds.turtle_theme.pause();
                        sounds.turtle_theme.currentTime = 0;
                    }
                }

                scene.remove(b);
                bullets.splice(i, 1);
                break;
            }
        }
    


/* =========================
   🌊 파티클 이펙트 업데이트
========================= */
function updateEffects(delta) {

    for (let i = effects.length - 1; i >= 0; i--) {

        const g = effects[i];
        let alive = false;

        g.children.forEach(p => {

            p.position.add(p.userData.velocity);

            // 중력 느낌
            p.userData.velocity.y -= 0.001;

            p.material.opacity -= 0.03;

            if (p.material.opacity > 0) alive = true;
        });

        if (!alive) {
            scene.remove(g);
            effects.splice(i, 1);
        }
    }
}



///////////////////////// 10 빅 크리처 스폰 /////////////////////////



// GLB 캐시 (이미 loadModel()에서 채워졌다고 가정)
const bigModelCache = {}; // url: GLTF.scene

// -------------------------
// 빅고기 스폰
// -------------------------
function spawnBigCreature(model) {
    const cached = bigModelCache[model.url];
    if (!cached) return;

    const creature = SkeletonUtils.clone(cached.scene);

    creature.scale.setScalar(model.scale);

    // 헤엄치기용 데이터
    creature.userData = {
        type: model.type,
        spawnBonus: model.spawnBonus,
        target: new THREE.Vector3(),
        smoothDir: new THREE.Vector3(Math.random()-0.5,0,Math.random()-0.5).normalize(),
        speed: 0.05,          // 속도 올리기
        swimOffset: Math.random() * Math.PI * 2,
        swimPower: 0.05,
        mixer: null           // 애니메이션용
    };

    // GLB 애니메이션 적용
    const mixer = new THREE.AnimationMixer(creature);
    cached.animations.forEach(clip => mixer.clipAction(clip).play());
    creature.userData.mixer = mixer;
    mixers.push(mixer);

    // 카메라 앞 스폰
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    const forward = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
    creature.position.copy(camPos).add(forward.multiplyScalar(15));
    creature.position.y += (Math.random() - 0.5) * 3;
    creature.position.x += (Math.random() - 0.5) * 5;

    // 초기 목표
    creature.userData.target.set(
        creature.position.x + (Math.random() - 0.5) * 20,
        3 + Math.random() * 10,
        creature.position.z + (Math.random() - 0.5) * 20
    );

    scene.add(creature);
    bigCreatures.push(creature);

    handleBigSpawnReward(creature, model);

    return creature;
}

// -------------------------
// 빅고기 헤엄치기
// animate 루프에서 호출
// -------------------------

function updateBigCreatures(delta) {
    for (let i = bigCreatures.length - 1; i >= 0; i--) {
        const creature = bigCreatures[i];
        const target = creature.userData.target;

        // 목표 도달 시 새 목표
        if (creature.position.distanceTo(target) < 1.5) {
            creature.userData.target.set(
                (Math.random() - 0.5) * BOUNDS.x,
                3 + Math.random() * BOUNDS.y,
                (Math.random() - 0.5) * BOUNDS.z
            );
        }

        // 방향 보간 (lerp 계수 0.1)
        const dir = new THREE.Vector3().subVectors(target, creature.position).normalize();
        creature.userData.smoothDir.lerp(dir, 0.02);

        // 이동 (delta 적용)
        creature.position.add(
            creature.userData.smoothDir.clone().multiplyScalar(creature.userData.speed * delta * 60)
        );

        // 🔹 Quaternion 회전 적용 (Euler 직접 세팅 제거)
        const modelForward = new THREE.Vector3(0, 0, 1); // 모델 기본 앞 방향 (필요 시 0,0,-1로 변경)
        const targetQuat = new THREE.Quaternion().setFromUnitVectors(
            modelForward,
            creature.userData.smoothDir.clone().normalize()
        );
        const ROT_SPEED = 0.02;
        creature.quaternion.slerp(targetQuat, ROT_SPEED); // 회전 부드러움 조절

        // 흔들기 (roll/pitch)
        const swim = performance.now() * 0.002 + creature.userData.swimOffset;
        creature.rotation.z = Math.sin(swim) * creature.userData.swimPower;
        creature.rotation.x = Math.cos(swim * 0.5) * 0.03;

        // 부위별 흔들기
        const tail = getPart(creature, ["tail","Tail","fin","Fin","尾"]);
        if (tail) tail.rotation.y = Math.sin(swim * 2) * creature.userData.swimPower * 2;

        const head = getPart(creature, ["head","Head","頭"]);
        if (head) head.rotation.y = Math.sin(swim * 1.2) * 0.1;

        const body = getPart(creature, ["body","Body","身"]);
        if (body) body.rotation.z = Math.sin(swim) * 0.05;

        // GLB 애니 업데이트
        if (creature.userData.mixer) creature.userData.mixer.update(delta);
    }
}


///////////////////////// 11 메인 업데이트 루프 /////////////////////////



function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.033);

    updateEvents(delta);
    updateFish(delta);
    updateEffects(delta);
    updateBigCreatures(delta);
    updateCannon();
    updateBullets(delta);
    cannon.lookAt(camera.position);
    renderer.render(scene, camera);

    // 물고기 스폰
    spawnTimer += delta;
    if (spawnTimer > fishSpawnRate) {
        spawnTimer = 0;
        spawnFish();
    }

// =========================
// 🐋 BIG EVENT SPAWN SYSTEM
// =========================
bigEventTimer += delta;

bigEventChance = Math.min(
    0.01 + bigEventTimer * 0.002,
    0.25
);

// 빅고기 스폰 트리거
if (
    gameState !== "WHALE" &&
    !whaleActive &&
    Math.random() < bigEventChance
) {
    const model = getRandomBigModel();
    if (!model) return;

    spawnBigCreature(model);   // 🔥 핵심

    if (model.type === "whale") {
        triggerWhaleEvent();
    }

    if (model.type === "shark") {
        startSharkEvent();
    }

    if (model.type === "turtle") {
        showBonusEvent("🐢 TURTLE VISIT");
    }

    bigEventTimer = 0;
    bigEventChance = 0.01;
}
    // =========================
    // 🧠 렌더링
    // =========================
    renderer.render(scene, camera);
}



///////////////////////// 12 big 이벤트 모델 /////////////////////////


const BIG_MODELS = [
    {type: "shark",url: "./models/shark.glb", scale: 1.5, hp: 5, spawnBonus: 500},
    {type: "whale",url: "./models/whale.glb", scale: 0.070, hp: 10, spawnBonus: 1000},
    {type: "turtle",url: "./models/turtle.glb", scale: 0.007, hp: 3, spawnBonus: 200}
];

function getRandomBigModel() {
    if (BIG_MODELS.length === 0) return null;
    const index = Math.floor(Math.random() * BIG_MODELS.length);
    return BIG_MODELS[index];
}

// ================= 대형 생물 미리 로드 =================
BIG_MODELS.forEach(m => {
    loadModel(m.url, bigModelCache, () => {
        console.log("🐋 Loaded:", m.type);
    });
});

animate();