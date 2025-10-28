import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ===== Inställningar =====
let SPAWN_HEIGHT = 1.0;
let FOLLOW_MARKER = true;

// ===== Position / Marker =====
let markerPos = new THREE.Vector3(0, SPAWN_HEIGHT, 0);
let velocity = { x:0, z:0 };
let filteredAccel = { x:0, z:0 };
const ALPHA = 0.1;

// ===== Scene & Renderer =====
const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0,5,10);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableZoom = true;

// ===== Ground & Grid =====
const ground = new THREE.Mesh(new THREE.PlaneGeometry(50,50), new THREE.MeshStandardMaterial({color:0x555555, side:THREE.DoubleSide}));
ground.rotation.x = -Math.PI/2;
ground.position.y = -1;
scene.add(ground);

const grid = new THREE.GridHelper(50,50,0x888888,0x444444);
grid.position.y=-0.99; scene.add(grid);

// ===== Lights =====
scene.add(new THREE.AmbientLight(0xffffff,2));
const hemiLight = new THREE.HemisphereLight(0xffffff,0xaaaaaa,1.5); hemiLight.position.set(0,50,0); scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffffff,2); dirLight.position.set(20,30,20);
dirLight.target.position.set(0,1,0); dirLight.castShadow = true;
scene.add(dirLight); scene.add(dirLight.target);

// ===== Load Sundsvalls sjukhus =====
const loader = new GLTFLoader();
loader.load('./sundsvallssjukhus.gltf', gltf=>{
    const model = gltf.scene;
    model.traverse(child=>{ if(child.isMesh){ child.castShadow=true; child.receiveShadow=true; }});
    scene.add(model);
    document.getElementById('progress-container').style.display='none';
}, xhr=>{document.getElementById('progress-container').textContent=`Laddar ${Math.round(xhr.loaded/xhr.total*100)}%`;}, err=>{console.error(err);});

// ===== Marker (platt pil) =====
const markerShape = new THREE.Shape();
markerShape.moveTo(0,0.5); markerShape.lineTo(-0.25,-0.25); markerShape.lineTo(0.25,-0.25); markerShape.lineTo(0,0.5);
const marker = new THREE.Mesh(new THREE.ShapeGeometry(markerShape), new THREE.MeshStandardMaterial({color:0x00ff00}));
marker.rotation.x = -Math.PI/2;
marker.position.copy(markerPos);
scene.add(marker);

// ===== Destination & Line =====
const destination = new THREE.Vector3(5, SPAWN_HEIGHT, -5);
const navLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([marker.position.clone(), destination.clone()]), new THREE.LineBasicMaterial({color:0xffff00}));
scene.add(navLine);
function updateLine(){
    const start = marker.position.clone();
    const end = destination.clone();
    start.y = end.y = marker.position.y;
    navLine.geometry.setFromPoints([start,end]);
}

// ===== Device Orientation =====
if(window.DeviceOrientationEvent){
    window.addEventListener('deviceorientation', e=>{
        const alpha = e.alpha ? THREE.MathUtils.degToRad(e.alpha) : 0;
        marker.rotation.z = alpha;
    }, true);
}

// ===== Device Motion (dead reckoning) =====
if(window.DeviceMotionEvent){
    window.addEventListener('devicemotion', e=>{
        const ax = e.accelerationIncludingGravity.x||0;
        const az = e.accelerationIncludingGravity.z||0;

        filteredAccel.x = ALPHA*ax + (1-ALPHA)*filteredAccel.x;
        filteredAccel.z = ALPHA*az + (1-ALPHA)*filteredAccel.z;

        velocity.x += filteredAccel.x*0.05;
        velocity.z += filteredAccel.z*0.05;

        marker.position.x += velocity.x;
        marker.position.z += velocity.z;

        updateLine();
    }, true);
}

// ===== Camera follow =====
function animate(){
    requestAnimationFrame(animate);
    if(FOLLOW_MARKER){
        const desiredPos = new THREE.Vector3(marker.position.x, marker.position.y+4, marker.position.z+5);
        camera.position.lerp(desiredPos,0.1);
        controls.target.lerp(marker.position,0.1);
        controls.update();
    }
    renderer.render(scene,camera);
}
animate();

// ===== Resize =====
window.addEventListener('resize', ()=>{
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===== UI knappar =====
const uiContainer = document.createElement('div');
uiContainer.id = 'ui-container';
document.body.appendChild(uiContainer);

// Reset marker
const resetBtn = document.createElement('button');
resetBtn.textContent = 'Reset Position';
resetBtn.onclick = ()=>{
    marker.position.set(0, SPAWN_HEIGHT, 0);
    markerPos.set(0, SPAWN_HEIGHT, 0);
    velocity.x = velocity.z = 0;
    updateLine();
};
uiContainer.appendChild(resetBtn);

// Set spawn height
const heightBtn = document.createElement('button');
heightBtn.textContent = 'Set Spawn Height';
heightBtn.onclick = ()=>{
    const newY = parseFloat(prompt('Ange spawnhöjd (y-position):', SPAWN_HEIGHT));
    if(!isNaN(newY)){
        SPAWN_HEIGHT = newY;
        marker.position.y = SPAWN_HEIGHT;
        markerPos.y = SPAWN_HEIGHT;
        destination.y = SPAWN_HEIGHT;
        updateLine();
    }
};
uiContainer.appendChild(heightBtn);

// Toggle camera follow
const followBtn = document.createElement('button');
followBtn.textContent = 'Följ markör: ON';
followBtn.onclick = ()=>{
    FOLLOW_MARKER = !FOLLOW_MARKER;
    followBtn.textContent = 'Följ markör: ' + (FOLLOW_MARKER ? 'ON' : 'OFF');
};
uiContainer.appendChild(followBtn);
