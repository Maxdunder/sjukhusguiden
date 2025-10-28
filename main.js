import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

window.addEventListener('DOMContentLoaded', () => {

    // ===== Inställningar =====
    let FOLLOW_MARKER = true;
    let SPAWN_HEIGHT = 1.0;
    const ALPHA = 0.05; 
    const STEP_FACTOR = 0.02;

    // ===== Renderer =====
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0xaaaaaa);
    document.body.appendChild(renderer.domElement);

    // ===== Scene & Camera =====
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 5, 5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.minDistance = 1; controls.maxDistance = 100;
    controls.update();

    // ===== Ground & Grid =====
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(50, 50),
        new THREE.MeshStandardMaterial({ color: 0x555555, side: THREE.DoubleSide })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    const grid = new THREE.GridHelper(50, 50, 0x888888, 0x444444);
    grid.position.y = 0.01;
    scene.add(grid);

    // ===== Lights =====
    scene.add(new THREE.AmbientLight(0xffffff, 1));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // ===== Marker-pil =====
    const markerShape = new THREE.Shape();
    markerShape.moveTo(0, 0.5); 
    markerShape.lineTo(-0.25, -0.25); 
    markerShape.lineTo(0.25, -0.25); 
    markerShape.lineTo(0, 0.5);
    const marker = new THREE.Mesh(
        new THREE.ShapeGeometry(markerShape),
        new THREE.MeshStandardMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.scale.set(2, 2, 2);
    marker.position.set(0, SPAWN_HEIGHT, 0);
    scene.add(marker);

    // ===== Destination & navLine =====
    const destination = new THREE.Vector3(5, SPAWN_HEIGHT, -5);
    const navLineMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 });
    const navLineGeometry = new THREE.BufferGeometry().setFromPoints([marker.position.clone(), destination.clone()]);
    const navLine = new THREE.Line(navLineGeometry, navLineMaterial);
    scene.add(navLine);
    function updateNavLine() {
        const start = marker.position.clone();
        const end = destination.clone();
        start.y = end.y = marker.position.y;
        navLine.geometry.setFromPoints([start, end]);
    }

    // ===== Load model =====
    const loader = new GLTFLoader();
    loader.load('./sundsvallssjukhus.gltf', gltf => {
        const model = gltf.scene;
        model.position.set(0, 0, 0);
        model.traverse(c => { if(c.isMesh){ c.castShadow = true; c.receiveShadow = true; }});
        scene.add(model);
        const progress = document.getElementById('progress-container');
        if(progress) progress.style.display='none';
    }, xhr => {
        const progress = document.getElementById('progress-container');
        if(progress) progress.textContent=`Laddar ${Math.round(xhr.loaded/xhr.total*100)}%`;
    }, err => console.error(err));

    // ===== IMU + stabilisering =====
    let filteredAccel = {x:0, z:0};
    let velocity = {x:0, z:0};
    window.addEventListener('devicemotion', e => {
        const ax = e.accelerationIncludingGravity?.x||0;
        const az = e.accelerationIncludingGravity?.z||0;

        filteredAccel.x = ALPHA*ax + (1-ALPHA)*filteredAccel.x;
        filteredAccel.z = ALPHA*az + (1-ALPHA)*filteredAccel.z;

        velocity.x = 0.9*velocity.x + filteredAccel.x*STEP_FACTOR;
        velocity.z = 0.9*velocity.z + filteredAccel.z*STEP_FACTOR;

        marker.position.x += velocity.x;
        marker.position.z += velocity.z;
        updateNavLine();
    }, true);

    // ===== Gyro-rotation =====
    if(window.DeviceOrientationEvent){
        window.addEventListener('deviceorientation', e=>{
            const alpha = e.alpha ? THREE.MathUtils.degToRad(e.alpha) : 0;
            marker.rotation.z = alpha;
        });
    }

    // ===== Kamera =====
    function updateCamera(){
        if(FOLLOW_MARKER){
            const desiredPos = new THREE.Vector3(marker.position.x+5, marker.position.y+5, marker.position.z+5);
            camera.position.lerp(desiredPos, 0.1);
            controls.target.lerp(marker.position, 0.1);
            controls.update();
        }
    }

    // ===== UI =====
    const toggleFollow = document.getElementById('toggle-follow');
    const setSpawn = document.getElementById('set-spawn');
    if(toggleFollow){
        toggleFollow.addEventListener('click', ()=>{
            FOLLOW_MARKER = !FOLLOW_MARKER;
            toggleFollow.textContent = 'Följ markör: ' + (FOLLOW_MARKER?'ON':'OFF');
        });
    }
    if(setSpawn){
        setSpawn.addEventListener('click', ()=>{
            const newY = parseFloat(prompt('Ange spawnhöjd:', marker.position.y));
            if(!isNaN(newY)){
                marker.position.y=newY; destination.y=newY; updateNavLine();
            }
        });
    }

    // ===== Resize & Animate =====
    window.addEventListener('resize', ()=>{
        camera.aspect = window.innerWidth/window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    function animate(){ 
        requestAnimationFrame(animate); 
        updateCamera(); 
        renderer.render(scene,camera); 
    }
    animate();
});
