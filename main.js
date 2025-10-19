import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ===== Renderer =====
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
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
camera.position.set(20, 30, 20);

// ===== Controls =====
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.enableZoom = true;      // tillåter zoom
controls.minDistance = 5;
controls.maxDistance = 100;
controls.minPolarAngle = 0;
controls.maxPolarAngle = Math.PI;
controls.target.set(0, 1, 0);
controls.update();

// ===== Ground =====
const groundGeometry = new THREE.PlaneGeometry(50, 50);
groundGeometry.rotateX(-Math.PI / 2);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, side: THREE.DoubleSide });
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
groundMesh.position.y = -1;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

// ===== Grid (tydlig golveffekt) =====
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
loader.load('sundsvalls_sjukhus.gltf', (gltf) => {
  const model = gltf.scene;
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  model.position.set(0, 0, 0);
  model.scale.set(1, 1, 1);
  scene.add(model);
  document.getElementById('progress-container').style.display = 'none';
}, (xhr) => {
  document.getElementById('progress-container').textContent = `Laddar ${Math.round(xhr.loaded / xhr.total * 100)}%`;
}, (error) => {
  console.error(error);
});

// ===== Green marker =====
const markerGeo = new THREE.SphereGeometry(0.15, 16, 16);
const markerMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const marker = new THREE.Mesh(markerGeo, markerMat);
scene.add(marker);

// ===== Compass line =====
const compassLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-1)]),
  new THREE.LineBasicMaterial({ color: 0xff0000 })
);
marker.add(compassLine); // linjen följer markören

// ===== GPS Setup =====
const BASE_LAT = 62.3900;   // Ange exakt latitud för referenspunkt
const BASE_LON = 17.3060;   // Ange exakt longitud för referenspunkt
const SCALE_FACTOR = 1000;   // Justera så att GPS motsvarar modellens enheter

if ('geolocation' in navigator) {
  navigator.geolocation.watchPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      const modelX = (lon - BASE_LON) * SCALE_FACTOR;
      const modelZ = (lat - BASE_LAT) * SCALE_FACTOR;

      marker.position.x = modelX;
      marker.position.z = modelZ;
      controls.target.copy(marker.position);
    },
    (error) => {
      console.warn('GPS error:', error);
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
  );
} else {
  console.warn('Geolocation not available');
}

// ===== Optional keyboard control =====
window.addEventListener('keydown', (e) => {
  const speed = 0.2;
  if (e.key === 'ArrowUp') marker.position.z -= speed;
  if (e.key === 'ArrowDown') marker.position.z += speed;
  if (e.key === 'ArrowLeft') marker.position.x -= speed;
  if (e.key === 'ArrowRight') marker.position.x += speed;
  controls.target.copy(marker.position);
});

// ===== Window resize =====
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===== Animate =====
function animate() {
  requestAnimationFrame(animate);

  // Kamera följer marker
  const camOffset = new THREE.Vector3(5, 5, 5);
  const desiredCamPos = new THREE.Vector3().addVectors(marker.position, camOffset);
  camera.position.lerp(desiredCamPos, 0.05);
  controls.target.lerp(marker.position, 0.05);

  // Puls på rutnät för rörelse-effekt
  grid.material.opacity = 0.5 + 0.5 * Math.sin(Date.now() * 0.002);
  grid.material.transparent = true;

  controls.update();
  renderer.render(scene, camera);
}
animate();
