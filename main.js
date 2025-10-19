import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ===== Inställningar =====
let FOLLOW_MARKER = true;
let USE_WIFI = true;
let SPAWN_HEIGHT = 1.0;
let STEP_FACTOR = 0.5; // startvärde

// Din startkoordinat i verkligheten (nollpunkt i 3D-scenen)
const BASE_LAT = 62.62354146392306;
const BASE_LON = 17.928187561459936;

// ===== Marker / Position =====
let markerScenePos = new THREE.Vector3(0, SPAWN_HEIGHT, 0);
let wifiBasePos = markerScenePos.clone();
let lastAccel = { x:0, z:0 };
let velocity = { x:0, z:0 };

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
controls.minDistance = 1;
controls.maxDistance = 100;
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
grid.position.y=-0.99;
scene.add(grid);

// ===== Lights =====
const ambientLight = new THREE.AmbientLight(0xffffff,3); scene.add(ambientLight);
const hemiLight = new THREE.HemisphereLight(0xffffff,0xaaaaaa,1.5); hemiLight.position.set(0,50,0); scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffffff,2); dirLight.position.set(20,30,20); dirLight.target.position.set(0,1,0); dirLight.castShadow=true; scene.add(dirLight); scene.add(dirLight.target);

// ===== Load Sundsvalls sjukhus =====
const loader = new GLTFLoader();
loader.load('./sundsvallssjukhus.gltf', (gltf)=>{
    const model = gltf.scene;
    model.traverse((child)=>{
        if(child.isMesh){ child.castShadow=true; child.receiveShadow=true; }
    });
    model.position.set(0,0,0);
    scene.add(model);
    document.getElementById('progress-container').style.display='none';
},(xhr)=>{
    document.getElementById('progress-container').textContent=`Laddar ${Math.round(xhr.loaded/xhr.total*100)}%`;
},(error)=>{ console.error(error); });

// ===== Marker (platt triangel) =====
const markerShape = new THREE.Shape();
markerShape.moveTo(0,0.5); markerShape.lineTo(-0.25,-0.25); markerShape.lineTo(0.25,-0.25); markerShape.lineTo(0,0.5);
const markerGeometry = new THREE.ShapeGeometry(markerShape);
const markerMaterial = new THREE.MeshStandardMaterial({color:0x00ff00, side:THREE.DoubleSide});
const marker = new THREE.Mesh(markerGeometry, markerMaterial);
marker.rotation.x=-Math.PI/2; marker.scale.set(2,2,2);
marker.position.copy(markerScenePos); scene.add(marker);

// ===== Destination & linje =====
const destination = new THREE.Vector3(5,SPAWN_HEIGHT,-5);
const navMaterial = new THREE.LineBasicMaterial({color:0xffff00});
const navLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([marker.position.clone(),destination.clone()]), navMaterial);
scene.add(navLine);

function updateNavLine(){
    const start=marker.position.clone();
    const end=destination.clone(); start.y=marker.position.y; end.y=marker.position.y;
    navLine.geometry.setFromPoints([start,end]);
}

// ===== Kamera uppdatering =====
function updateCamera(){
    if(FOLLOW_MARKER){
        const desiredPos=new THREE.Vector3(marker.position.x, marker.position.y+4, marker.position.z+5);
        camera.position.lerp(desiredPos,0.1);
        const desiredTarget=new THREE.Vector3(marker.position.x, marker.position.y, marker.position.z);
        controls.target.lerp(desiredTarget,0.1);
        controls.update();
    }
}

// ===== Wi-Fi / debug =====
const stepSlider=document.getElementById('step-slider');
const stepValueLabel=document.getElementById('step-value');
const debugControls=document.getElementById('debug-controls');

stepSlider.addEventListener('input',(e)=>{
    STEP_FACTOR=parseFloat(e.target.value);
    stepValueLabel.textContent=STEP_FACTOR.toFixed(2);
});

function updateDebugUI(){ debugControls.style.display=USE_WIFI?'block':'none'; }
updateDebugUI();

if(window.DeviceOrientationEvent){
    window.addEventListener('deviceorientation',(event)=>{
        const alpha = event.alpha ? THREE.MathUtils.degToRad(event.alpha) : 0;
        marker.rotation.z=alpha;
    },true);
}

if(window.DeviceMotionEvent){
    window.addEventListener('devicemotion',(event)=>{
        if(!USE_WIFI) return;
        const ax=event.accelerationIncludingGravity.x||0;
        const az=event.accelerationIncludingGravity.z||0;
        const dx=ax-lastAccel.x;
        const dz=az-lastAccel.z;
        velocity.x+=dx*STEP_FACTOR;
        velocity.z+=dz*STEP_FACTOR;
        marker.position.x += Math.sin(marker.rotation.z)*velocity.z + Math.cos(marker.rotation.z)*velocity.x;
        marker.position.z += Math.cos(marker.rotation.z)*velocity.z - Math.sin(marker.rotation.z)*velocity.x;
        lastAccel.x=ax; lastAccel.z=az;
        updateNavLine(); updateCamera();
    },true);
}

// ===== GPS =====
let gpsWatchId=null;
function gpsUpdate(position){
    const lat=position.coords.latitude;
    const lon=position.coords.longitude;
    const SCALE=50;
    const dx=(lon-BASE_LON)*SCALE;
    const dz=(lat-BASE_LAT)*SCALE;
    marker.position.set(markerScenePos.x+dx,SPAWN_HEIGHT,markerScenePos.z+dz);
    updateNavLine(); updateCamera();
}

function startGPS(){
    if('geolocation' in navigator){
        if(gpsWatchId!==null) navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId=navigator.geolocation.watchPosition(gpsUpdate,
            (error)=>console.warn('GPS error:',error),
            {enableHighAccuracy:true, maximumAge:1000, timeout:5000});
    }
}

// ===== UI knappar =====
document.getElementById('toggle-follow').addEventListener('click',()=>{
    FOLLOW_MARKER=!FOLLOW_MARKER;
    document.getElementById('toggle-follow').textContent='Följ markör: '+(FOLLOW_MARKER?'ON':'OFF');
});

document.getElementById('toggle-source').addEventListener('click',()=>{
    USE_WIFI=!USE_WIFI;
    document.getElementById('toggle-source').textContent='Källa: '+(USE_WIFI?'Wi-Fi':'GPS');
    if(!USE_WIFI){ markerScenePos.copy(marker.position); startGPS(); }
    else{ wifiBasePos.copy(marker.position); if(gpsWatchId!==null) navigator.geolocation.clearWatch(gpsWatchId); }
    updateDebugUI();
});

document.getElementById('set-spawn').addEventListener('click',()=>{
    const newY=parseFloat(prompt('Ange spawnhöjd (y-position):',SPAWN_HEIGHT));
    if(!isNaN(newY)){
        SPAWN_HEIGHT=newY;
        marker.position.y=SPAWN_HEIGHT;
        markerScenePos.y=SPAWN_HEIGHT;
        wifiBasePos.y=SPAWN_HEIGHT;
        destination.y=SPAWN_HEIGHT;
        updateNavLine();
    }
});

// ===== Resize & Animate =====
window.addEventListener('resize',()=>{
    camera.aspect=window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
});

function animate(){ requestAnimationFrame(animate); controls.update(); renderer.render(scene,camera); }
animate();
