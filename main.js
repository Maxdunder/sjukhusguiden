import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ===== Inställningar =====
let FOLLOW_MARKER = true;
let USE_WIFI = true;
let SPAWN_HEIGHT = 1.0;
let STEP_FACTOR = 0.2; // Wi-Fi känslighet
const ALPHA = 0.1; // lågpassfilter accelerometer

// Startkoordinat i verkligheten (nollpunkt 3D)
const BASE_LAT = 62.62354146392306;
const BASE_LON = 17.928187561459936;

// ===== Position / marker =====
let markerScenePos = new THREE.Vector3(0, SPAWN_HEIGHT, 0);
let wifiFiltered = new THREE.Vector3(0, SPAWN_HEIGHT, 0);
let filteredAccel = { x: 0, z: 0 };

// ===== Renderer =====
const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0xaaaaaa);
document.body.appendChild(renderer.domElement);

// ===== Scene & Camera =====
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0,5,10);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.enableZoom = true;
controls.minDistance = 1; controls.maxDistance = 100;
controls.update();

// ===== Ground & Grid =====
const groundGeometry = new THREE.PlaneGeometry(50,50);
groundGeometry.rotateX(-Math.PI/2);
const groundMaterial = new THREE.MeshStandardMaterial({color:0x555555, side:THREE.DoubleSide});
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
groundMesh.position.y=-1;
groundMesh.receiveShadow=true;
scene.add(groundMesh);

const grid = new THREE.GridHelper(50,50,0x888888,0x444444);
grid.position.y=-0.99; scene.add(grid);

// ===== Lights =====
scene.add(new THREE.AmbientLight(0xffffff,3));
const hemiLight=new THREE.HemisphereLight(0xffffff,0xaaaaaa,1.5); hemiLight.position.set(0,50,0); scene.add(hemiLight);
const dirLight=new THREE.DirectionalLight(0xffffff,2); dirLight.position.set(20,30,20); dirLight.target.position.set(0,1,0); dirLight.castShadow=true; scene.add(dirLight); scene.add(dirLight.target);

// ===== Load Sundsvalls sjukhus =====
const loader = new GLTFLoader();
loader.load('./sundsvallssjukhus.gltf', gltf => {
    const model = gltf.scene;
    model.traverse(child=>{if(child.isMesh){child.castShadow=true;child.receiveShadow=true;}});
    model.position.set(0,0,0);
    scene.add(model);
    document.getElementById('progress-container').style.display='none';
}, xhr=>{document.getElementById('progress-container').textContent=`Laddar ${Math.round(xhr.loaded/xhr.total*100)}%`;}, err=>{console.error(err);});

// ===== Marker (platt triangel) =====
const markerShape = new THREE.Shape();
markerShape.moveTo(0,0.5); markerShape.lineTo(-0.25,-0.25); markerShape.lineTo(0.25,-0.25); markerShape.lineTo(0,0.5);
const marker = new THREE.Mesh(new THREE.ShapeGeometry(markerShape), new THREE.MeshStandardMaterial({color:0x00ff00, side:THREE.DoubleSide}));
marker.rotation.x=-Math.PI/2; marker.scale.set(2,2,2);
marker.position.copy(markerScenePos); scene.add(marker);

// ===== Destination & line =====
const destination = new THREE.Vector3(5,SPAWN_HEIGHT,-5);
const navLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([marker.position.clone(),destination.clone()]), new THREE.LineBasicMaterial({color:0xffff00}));
scene.add(navLine);
function updateNavLine(){ const start=marker.position.clone(); const end=destination.clone(); start.y=end.y=marker.position.y; navLine.geometry.setFromPoints([start,end]); }

// ===== Kamera =====
function updateCamera(){
    if(FOLLOW_MARKER){
        const desiredPos=new THREE.Vector3(marker.position.x, marker.position.y+4, marker.position.z+5);
        camera.position.lerp(desiredPos,0.1);
        const desiredTarget=new THREE.Vector3(marker.position.x, marker.position.y, marker.position.z);
        controls.target.lerp(desiredTarget,0.1);
        controls.update();
    }
}

// ===== Device orientation (pil rotation) =====
if(window.DeviceOrientationEvent){
    window.addEventListener('deviceorientation', event=>{
        const alpha = event.alpha ? THREE.MathUtils.degToRad(event.alpha) : 0;
        marker.rotation.z = alpha;
    }, true);
}

// ===== Device motion (Wi-Fi / accelerometer) =====
if(window.DeviceMotionEvent){
    window.addEventListener('devicemotion', event=>{
        if(!USE_WIFI) return;

        const ax = event.accelerationIncludingGravity.x||0;
        const az = event.accelerationIncludingGravity.z||0;

        // Lågpassfilter
        filteredAccel.x = ALPHA*ax + (1-ALPHA)*filteredAccel.x;
        filteredAccel.z = ALPHA*az + (1-ALPHA)*filteredAccel.z;

        // Smält ihop med tidigare position (Wi-Fi)
        wifiFiltered.x += filteredAccel.x*STEP_FACTOR;
        wifiFiltered.z += filteredAccel.z*STEP_FACTOR;

        marker.position.x = markerScenePos.x + wifiFiltered.x;
        marker.position.z = markerScenePos.z + wifiFiltered.z;

        updateNavLine(); updateCamera();
    }, true);
}

// ===== GPS =====
let gpsWatchId=null;
function gpsUpdate(position){
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const SCALE=50;
    const dx=(lon-BASE_LON)*SCALE;
    const dz=(lat-BASE_LAT)*SCALE;

    marker.position.x = markerScenePos.x + dx;
    marker.position.z = markerScenePos.z + dz;
    marker.position.y = SPAWN_HEIGHT;

    updateNavLine(); updateCamera();
}

function startGPS(){
    if('geolocation' in navigator){
        if(gpsWatchId!==null) navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = navigator.geolocation.watchPosition(gpsUpdate,
            err => console.warn('GPS error:', err),
            {enableHighAccuracy:true, maximumAge:1000, timeout:5000});
    }
}

// ===== UI knappar =====
document.getElementById('toggle-follow').addEventListener('click', ()=>{
    FOLLOW_MARKER = !FOLLOW_MARKER;
    document.getElementById('toggle-follow').textContent = 'Följ markör: ' + (FOLLOW_MARKER?'ON':'OFF');
});

document.getElementById('toggle-source').addEventListener('click', ()=>{
    USE_WIFI = !USE_WIFI;
    document.getElementById('toggle-source').textContent = 'Källa: '+(USE_WIFI?'Wi-Fi':'GPS');
    if(!USE_WIFI){ markerScenePos.copy(marker.position); startGPS(); } 
    else { wifiFiltered.set(0,0,0); if(gpsWatchId!==null) navigator.geolocation.clearWatch(gpsWatchId); }
});

document.getElementById('set-spawn').addEventListener('click', ()=>{
    const newY = parseFloat(prompt('Ange spawnhöjd (y-position):', SPAWN_HEIGHT));
    if(!isNaN(newY)){
        SPAWN_HEIGHT = newY;
        marker.position.y = SPAWN_HEIGHT;
        markerScenePos.y = SPAWN_HEIGHT;
        wifiFiltered.y = SPAWN_HEIGHT;
        destination.y = SPAWN_HEIGHT;
        updateNavLine();
    }
});

// ===== Resize & Animate =====
window.addEventListener('resize', ()=>{
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate(){ requestAnimationFrame(animate); controls.update(); renderer.render(scene,camera); }
animate();
