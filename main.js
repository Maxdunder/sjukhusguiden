import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ===== Inställningar =====
let SPAWN_HEIGHT = 1.0;
let FOLLOW_MARKER = true;
let STEP_FACTOR = 0.01; 
const ALPHA = 0.3;       
const MAX_STEP = 0.05;   

// ===== Position / marker =====
let markerPos = new THREE.Vector3(0, SPAWN_HEIGHT, 0);
let velocity = { x:0, z:0 };
let filteredAccel = { x:0, z:0 };

// ===== Scene & Renderer =====
const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0,5,10);

// ===== OrbitControls med touch =====
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = true;      // två-finger panorering
controls.enableZoom = true;
controls.minDistance = 1;
controls.maxDistance = 100;
controls.screenSpacePanning = true; // två-finger touch flyttar horisontellt
controls.update();

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

// ===== Load Model =====
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

// ===== Device Orientation (gyro) =====
if(window.DeviceOrientationEvent){
    window.addEventListener('deviceorientation', e=>{
        const alpha = e.alpha ? THREE.MathUtils.degToRad(e.alpha) : 0;
        marker.rotation.z = alpha;
    }, true);
}

// ===== Device Motion (accelerometer) =====
if(window.DeviceMotionEvent){
    window.addEventListener('devicemotion', e=>{
        const ax = e.accelerationIncludingGravity.x||0;
        const az = e.accelerationIncludingGravity.z||0;

        filteredAccel.x = ALPHA*ax + (1-ALPHA)*filteredAccel.x;
        filteredAccel.z = ALPHA*az + (1-ALPHA)*filteredAccel.z;

        velocity.x += filteredAccel.x*STEP_FACTOR;
        velocity.z += filteredAccel.z*STEP_FACTOR;

        velocity.x *= 0.9; velocity.z *= 0.9;
        velocity.x = Math.max(Math.min(velocity.x, MAX_STEP), -MAX_STEP);
        velocity.z = Math.max(Math.min(velocity.z, MAX_STEP), -MAX_STEP);

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

// ===== UI knappar & slider =====
const uiContainer = document.createElement('div');
uiContainer.id = 'ui-container';
uiContainer.style.position = 'absolute';
uiContainer.style.top = '10px';
uiContainer.style.left = '10px';
uiContainer.style.background = 'rgba(0,0,0,0.5)';
uiContainer.style.padding = '10px';
uiContainer.style.borderRadius = '5px';
uiContainer.style.zIndex = '100';
document.body.appendChild(uiContainer);

// Reset
const resetBtn = document.createElement('button');
resetBtn.textContent = 'Reset Position';
resetBtn.onclick = ()=>{
    marker.position.set(0, SPAWN_HEIGHT, 0);
    markerPos.set(0, SPAWN_HEIGHT, 0);
    velocity.x = velocity.z = 0;
    updateLine();
};
uiContainer.appendChild(resetBtn);

// Spawn height
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

// Follow
const followBtn = document.createElement('button');
followBtn.textContent = 'Följ markör: ON';
followBtn.onclick = ()=>{
    FOLLOW_MARKER = !FOLLOW_MARKER;
    followBtn.textContent = 'Följ markör: ' + (FOLLOW_MARKER ? 'ON' : 'OFF');
};
uiContainer.appendChild(followBtn);

// ===== Slider för STEP_FACTOR =====
const sliderLabel = document.createElement('label');
sliderLabel.textContent = `Rörelsekänslighet: ${STEP_FACTOR.toFixed(3)}`;
sliderLabel.style.display = 'block';
sliderLabel.style.marginTop = '10px';
uiContainer.appendChild(sliderLabel);

const stepSlider = document.createElement('input');
stepSlider.type = 'range';
stepSlider.min = '0';
stepSlider.max = '0.05';
stepSlider.step = '0.001';
stepSlider.value = STEP_FACTOR;
stepSlider.style.width = '150px';
stepSlider.oninput = (e) => {
    STEP_FACTOR = parseFloat(e.target.value);
    sliderLabel.textContent = `Rörelsekänslighet: ${STEP_FACTOR.toFixed(3)}`;
};
uiContainer.appendChild(stepSlider);
