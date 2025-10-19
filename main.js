import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ===== Renderer =====
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0xaaaaaa);
document.body.appendChild(renderer.domElement);

// ===== Scene =====
const scene = new THREE.Scene();

// ===== Camera =====
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);

// ===== Controls =====
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.enableZoom = true;
controls.minDistance = 1;
controls.maxDistance = 100;
controls.update();

// ===== Ground =====
const groundGeometry = new THREE.PlaneGeometry(50, 50);
groundGeometry.rotateX(-Math.PI / 2);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, side: THREE.DoubleSide });
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
groundMesh.position.y = -1;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

// ===== Grid =====
const grid = new THREE.GridHelper(50, 50, 0x888888, 0x444444);
grid.position.y = -0.99;
scene.add(grid);

// ===== Lights =====
const ambientLight = new THREE.AmbientLight(0xffffff, 3);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0xaaaaaa, 1.5);
hemiLight.position.set(0, 50, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(20, 30, 20);
dirLight.target.position.set(0, 1, 0);
dirLight.castShadow = true;
scene.add(dirLight);
scene.add(dirLight.target);

// ===== Load Sundsvalls sjukhus =====
const loader = new GLTFLoader();
loader.load('./sundsvallssjukhus.gltf', (gltf) => {
    const model = gltf.scene;
    model.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    model.position.set(0, 0, 0);
    model.scale.set(1,1,1);
    scene.add(model);
    document.getElementById('progress-container').style.display = 'none';
}, (xhr) => {
    document.getElementById('progress-container').textContent = `Laddar ${Math.round(xhr.loaded / xhr.total * 100)}%`;
}, (error) => {
    console.error(error);
});

// ===== Marker som triangelpyramid =====
const markerGeometry = new THREE.ConeGeometry(0.2, 0.5, 3);
const markerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const marker = new THREE.Mesh(markerGeometry, markerMaterial);
marker.rotation.x = Math.PI / 2;
marker.position.y = 0.5;
scene.add(marker);

// ===== Destination & navigeringslinje =====
const destination = new THREE.Vector3(5, 0.5, -5); // ändra efter destination
const navMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 });
const navLineGeometry = new THREE.BufferGeometry().setFromPoints([marker.position.clone(), destination.clone()]);
const navLine = new THREE.Line(navLineGeometry, navMaterial);
scene.add(navLine);

// ===== GPS =====
if ('geolocation' in navigator) {
    navigator.geolocation.watchPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            const BASE_LAT = 62.3900;
            const BASE_LON = 17.3060;
            const SCALE = 50;

            const x = (lon - BASE_LON) * SCALE;
            const z = (lat - BASE_LAT) * SCALE;

            marker.position.set(x, 0.5, z);

            // Uppdatera linjens startpunkt
            const start = marker.position.clone();
            const end = destination.clone();
            start.y += 0.05;
            end.y += 0.05;
            navLine.geometry.setFromPoints([start, end]);

            // Kameran följer markören
            camera.position.x = x;
            camera.position.z = z + 5;
            camera.position.y = 5;
            controls.target.set(x, 0.5, z);
            controls.update();
        },
        (error) => console.warn('GPS error:', error),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );
} else {
    console.warn('Geolocation not available');
}

// ===== Device Orientation / Gyro =====
if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', (event) => {
        const alpha = event.alpha ? THREE.MathUtils.degToRad(event.alpha) : 0;
        marker.rotation.y = alpha;
    }, true);
} else {
    console.warn('Device orientation not supported');
}

// ===== Window resize =====
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===== Animate =====
function animate() {
    requestAnimationFrame(animate);

    // Rutnätsgolv-effekt
    grid.material.opacity = 0.5 + 0.5 * Math.sin(Date.now() * 0.002);
    grid.material.transparent = true;

    controls.update();
    renderer.render(scene, camera);
}
animate();
