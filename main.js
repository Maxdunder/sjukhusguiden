import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ===== Inställningar =====
let FOLLOW_MARKER = true;
let USE_WIFI = true;
let DEBUG_MODE = false; // Toggle för GPS-skala
let gpsWatchId = null;

// Wi-Fi debug
let wifiOffset = 0;
let fastWifi = false;

// Marker position i scenen
let markerScenePos = new THREE.Vector3(0, 0.01, 0);

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

// ===== Marker (platt triangel) =====
const markerShape = new THREE.Shape();
markerShape.moveTo(0, 0.5);
markerShape.lineTo(-0.25, -0.25);
markerShape.lineTo(0.25, -0.25);
markerShape.lineTo(0, 0.5);

const markerGeometry = new THREE.ShapeGeometry(markerShape);
const markerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
const marker = new THREE.Mesh(markerGeometry, markerMaterial);
marker.rotation.x = -Math.PI / 2;
marker.position.copy(markerScenePos);
scene.add(marker);

// ===== Destination & navigeringslinje =====
const destination = new THREE.Vector3(5, 0.5, -5); 
const navMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 });
const navLineGeometry = new THREE.BufferGeometry().setFromPoints([marker.position.clone(), destination.clone()]);
const navLine = new THREE.Line(navLineGeometry, navMaterial);
scene.add(navLine);

// ===== Kamera uppdatering med lerp =====
function updateCamera() {
    if (FOLLOW_MARKER) {
        const desiredPos = new THREE.Vector3(marker.position.x, 5, marker.position.z + 5);
        camera.position.lerp(desiredPos, 0.1);
        const desiredTarget = new THREE.Vector3(marker.position.x, 0.5, marker.position.z);
        controls.target.lerp(desiredTarget, 0.1);
        controls.update();
    }
}

// ===== GPS och Wi-Fi simulering =====
function wifiSimulate() {
    const speed = fastWifi ? 0.3 : 0.05;
    marker.position.x += (Math.random() - 0.5) * speed;
    marker.position.z += (Math.random() - 0.5) * speed;

    const start = marker.position.clone();
    const end = destination.clone();
    start.y += 0.05;
    end.y += 0.05;
    navLine.geometry.setFromPoints([start, end]);

    markerScenePos.copy(marker.position);
    updateCamera();
}

const BASE_LAT = 62.3900;
const BASE_LON = 17.3060;

function gpsUpdate(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    const SCALE = DEBUG_MODE ? 500 : 50;

    const dx = (lon - BASE_LON) * SCALE;
    const dz = (lat - BASE_LAT) * SCALE;

    // Lägg till förändringen relativt markerScenePos
    marker.position.set(markerScenePos.x + dx, 0.01, markerScenePos.z + dz);

    const start = marker.position.clone();
    const end = destination.clone();
    start.y += 0.05;
    end.y += 0.05;
    navLine.geometry.setFromPoints([start, end]);

    updateCamera();
}

// ===== Starta GPS =====
function startGPS() {
    if ('geolocation' in navigator) {
        if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);

        gpsWatchId = navigator.geolocation.watchPosition(
            gpsUpdate,
            (error) => console.warn('GPS error:', error),
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
        );
        console.log('GPS-watch started');
    } else {
        console.warn('Geolocation not available');
    }
}

// ===== UI-knappar =====
document.getElementById('toggle-follow').addEventListener('click', () => {
    FOLLOW_MARKER = !FOLLOW_MARKER;
    document.getElementById('toggle-follow').textContent = 'Följ markör: ' + (FOLLOW_MARKER ? 'ON' : 'OFF');
});

document.getElementById('toggle-source').addEventListener('click', () => {
    USE_WIFI = !USE_WIFI;
    document.getElementById('toggle-source').textContent = 'Källa: ' + (USE_WIFI ? 'Wi-Fi' : 'GPS');

    // Behåll positionen vid byte
    markerScenePos.copy(marker.position);

    if (!USE_WIFI) {
        startGPS();
    } else {
        if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
    }
});

// Wi-Fi speed toggle
let toggleSpeedBtn = document.createElement('button');
toggleSpeedBtn.textContent = 'Wi-Fi Speed: Normal';
toggleSpeedBtn.style.marginTop = '5px';
document.getElementById('ui-buttons').appendChild(toggleSpeedBtn);

toggleSpeedBtn.addEventListener('click', () => {
    fastWifi = !fastWifi;
    toggleSpeedBtn.textContent = 'Wi-Fi Speed: ' + (fastWifi ? 'Snabb' : 'Normal');
});

// Debug-mode toggle
const toggleDebugBtn = document.createElement('button');
toggleDebugBtn.textContent = 'GPS Skala: Normal';
toggleDebugBtn.style.marginTop = '5px';
document.getElementById('ui-buttons').appendChild(toggleDebugBtn);

toggleDebugBtn.addEventListener('click', () => {
    DEBUG_MODE = !DEBUG_MODE;
    toggleDebugBtn.textContent = 'GPS Skala: ' + (DEBUG_MODE ? 'Debug' : 'Normal');
});

// ===== Device Orientation =====
if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', (event) => {
        const alpha = event.alpha ? THREE.MathUtils.degToRad(event.alpha) : 0;
        marker.rotation.z = alpha;
    }, true);
} else {
    console.warn('Device orientation not supported');
}

// ===== Resize =====
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===== Animate =====
function animate() {
    requestAnimationFrame(animate);

    if (USE_WIFI) wifiSimulate();

    // Rutnäts-effekt
    grid.material.opacity = 0.5 + 0.5 * Math.sin(Date.now() * 0.002);
    grid.material.transparent = true;

    controls.update();
    renderer.render(scene, camera);
}
animate();
