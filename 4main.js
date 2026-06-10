import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/SkeletonUtils.js";

const oceanArea = document.getElementById("oceanArea");

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    45,
    oceanArea.clientWidth / oceanArea.clientHeight,
    0.1,
    1000
);

camera.position.set(0, 18, 20);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(
    oceanArea.clientWidth,
    oceanArea.clientHeight
);

oceanArea.appendChild(renderer.domElement);

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

animate();