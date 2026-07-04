import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Global Variables ---
let scene, camera, renderer, clock;
let orbitControls;
let isFollowCamera = true;

// Player Variables
let characterModel = null;
let playerGroup = null;
let mixer = null;
let actions = {};
let activeAction = null;
let currentClipName = '';
let currentState = 'idle';

// Physics Variables
let playerHeight = 1.8;
let playerRadius = 0.55;
let isGrounded = true;
let yVelocity = 0;
const gravity = 24.0;
const jumpForce = 9.5;
const walkSpeed = 3.2;
const runSpeed = 6.5;
const rotationSpeed = 3.2;
let moveSpeed = 0;

// Environment
const obstacles = [];
let currentGroundObstacle = null;

// Controls
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  shift: false,
  space: false
};

// UI Elements
const loaderBar = document.getElementById('loader-bar');
const loaderText = document.getElementById('loader-text');
const uiPosX = document.getElementById('pos-x');
const uiPosY = document.getElementById('pos-y');
const uiPosZ = document.getElementById('pos-z');
const uiSpeedVal = document.getElementById('speed-val');
const uiSpeedBar = document.getElementById('speed-bar');
const uiActiveState = document.getElementById('active-state');
const uiAnimProgress = document.getElementById('animation-progress-bar');
const uiCameraBadge = document.getElementById('camera-mode-badge');

// --- Initialization ---
function init() {
  // 1. Scene & Render
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090e);
  scene.fog = new THREE.FogExp2(0x07090e, 0.018);

  clock = new THREE.Clock();

  // 2. Camera
  camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 5, -8);

  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('webgl'), antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // 4. Controls
  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.05;
  orbitControls.maxPolarAngle = Math.PI / 2 - 0.05; // don't go below floor
  orbitControls.minDistance = 2;
  orbitControls.maxDistance = 25;
  orbitControls.enabled = false; // start with follow camera

  // 5. Lighting
  setupLighting();

  // 6. Environment (Grid & Neon Boxes)
  setupEnvironment();

  // 7. Event Listeners
  window.addEventListener('resize', onWindowResize);
  setupInputListeners();

  // 8. Load Bot Assets
  loadAssets();

  // 9. Start Loop
  animate();
}

// --- Lights ---
function setupLighting() {
  const ambientLight = new THREE.AmbientLight(0x00f3ff, 0.12);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
  dirLight.position.set(20, 40, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 100;
  
  const d = 30;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  dirLight.shadow.bias = -0.0003;
  scene.add(dirLight);

  // Decorative Neon Spotlights
  const lightColors = [0xff0055, 0x00f3ff, 0xffa200];
  const lightPositions = [
    { x: -15, y: 8, z: -15 },
    { x: 15, y: 8, z: 15 },
    { x: 0, y: 12, z: -25 }
  ];

  lightPositions.forEach((pos, idx) => {
    const pLight = new THREE.PointLight(lightColors[idx], 15, 25, 0.8);
    pLight.position.set(pos.x, pos.y, pos.z);
    pLight.castShadow = true;
    pLight.shadow.bias = -0.001;
    scene.add(pLight);

    // Glowing mesh indicator for lights
    const sphereGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({ color: lightColors[idx] });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.position.copy(pLight.position);
    scene.add(sphere);
  });
}

// --- Environment ---
function setupEnvironment() {
  // Floor Plane
  const floorGeo = new THREE.PlaneGeometry(120, 120);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x07090c,
    roughness: 0.7,
    metalness: 0.3
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Glowing Cyan Grid Helper
  const gridHelper = new THREE.GridHelper(120, 60, 0x00f3ff, 0x111827);
  gridHelper.position.y = 0.005; // avoid z-fighting
  scene.add(gridHelper);

  // Outer walls/borders (visual hint)
  const borderGeo = new THREE.BoxGeometry(120, 0.4, 1);
  const borderMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
  
  const b1 = new THREE.Mesh(borderGeo, borderMat);
  b1.position.set(0, 0.2, 60);
  scene.add(b1);
  const b2 = b1.clone();
  b2.position.set(0, 0.2, -60);
  scene.add(b2);
  
  const borderGeoV = new THREE.BoxGeometry(1, 0.4, 120);
  const b3 = new THREE.Mesh(borderGeoV, borderMat);
  b3.position.set(60, 0.2, 0);
  scene.add(b3);
  const b4 = b3.clone();
  b4.position.set(-60, 0.2, 0);
  scene.add(b4);

  // Random neon box obstacles
  const boxCount = 38;
  const colors = [0x00f3ff, 0xff0055, 0xffb700];

  for (let i = 0; i < boxCount; i++) {
    // Generate dimension
    const w = 2.5 + Math.random() * 4;
    const h = 1.0 + Math.random() * 4.5;
    const d = 2.5 + Math.random() * 4;

    const boxGeo = new THREE.BoxGeometry(w, h, d);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x0a0d18,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 0.95
    });

    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    
    // Position randomly, avoiding starting center
    let px = 0, pz = 0;
    while (Math.sqrt(px * px + pz * pz) < 8.0) {
      px = (Math.random() - 0.5) * 90;
      pz = (Math.random() - 0.5) * 90;
    }

    boxMesh.position.set(px, h / 2, pz);
    boxMesh.castShadow = true;
    boxMesh.receiveShadow = true;
    scene.add(boxMesh);

    // Glowing edge overlay
    const edges = new THREE.EdgesGeometry(boxGeo);
    const randColor = colors[Math.floor(Math.random() * colors.length)];
    const lineMat = new THREE.LineBasicMaterial({ color: randColor, linewidth: 2 });
    const outline = new THREE.LineSegments(edges, lineMat);
    boxMesh.add(outline);

    // Build bounding box
    const box3 = new THREE.Box3().setFromObject(boxMesh);
    obstacles.push({
      mesh: boxMesh,
      box3: box3,
      color: randColor
    });
  }
}

// --- Asset Loading ---
function loadAssets() {
  const loadingManager = new THREE.LoadingManager();
  const gltfLoader = new GLTFLoader(loadingManager);

  let characterLoaded = false;
  let animationsLoaded = false;
  let characterGltf = null;
  let animationsGltf = null;

  function checkAllLoaded() {
    if (characterLoaded && animationsLoaded) {
      // Remove loading overlay
      const loader = document.getElementById('loader');
      loader.style.opacity = 0;
      setTimeout(() => {
        loader.style.display = 'none';
      }, 800);

      // Setup models
      setupCharacter(characterGltf, animationsGltf);
    }
  }

  // Load Character model mesh
  gltfLoader.load(
    '/Meshy_AI_V02_Mech_biped_Character_output.glb',
    (gltf) => {
      characterGltf = gltf;
      characterLoaded = true;
      checkAllLoaded();
    },
    (xhr) => {
      const total = xhr.total || 27440740; // Fallback size in bytes
      const progress = Math.round((xhr.loaded / total) * 50);
      updateLoaderProgress(progress);
    },
    (err) => {
      console.error('Error loading character model:', err);
      loaderText.innerText = 'ERROR: FAILED TO LOAD BOT MESH';
    }
  );

  // Load Animation clips GLB
  gltfLoader.load(
    '/Meshy_AI_V02_Mech_biped_Meshy_AI_Meshy_Merged_Animations.glb',
    (gltf) => {
      animationsGltf = gltf;
      animationsLoaded = true;
      checkAllLoaded();
    },
    (xhr) => {
      const total = xhr.total || 51869784; // Fallback size in bytes
      const progress = 50 + Math.round((xhr.loaded / total) * 50);
      updateLoaderProgress(progress);
    },
    (err) => {
      console.error('Error loading animation clips:', err);
      loaderText.innerText = 'ERROR: FAILED TO LOAD ANIMATIONS';
    }
  );
}

function updateLoaderProgress(percent) {
  const clamped = Math.min(100, Math.max(0, percent));
  loaderBar.style.width = clamped + '%';
  loaderText.innerText = `Loading Assets: ${clamped}%`;
}

// --- Setup Character & Mixer ---
function setupCharacter(charGltf, animGltf) {
  characterModel = charGltf.scene;

  // Setup shadow casting
  characterModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // Create character group for position/physics management
  playerGroup = new THREE.Group();
  playerGroup.position.set(0, 0, 0);
  scene.add(playerGroup);
  playerGroup.add(characterModel);

  // Automatically calculate size and scale model to 1.8m height
  const box = new THREE.Box3().setFromObject(characterModel);
  const size = box.getSize(new THREE.Vector3());
  const origHeight = size.y;
  
  const scale = playerHeight / origHeight;
  characterModel.scale.set(scale, scale, scale);

  // Position mesh pivot so feet are grounded at y = 0
  const center = box.getCenter(new THREE.Vector3());
  characterModel.position.x = -center.x * scale;
  characterModel.position.y = -box.min.y * scale;
  characterModel.position.z = -center.z * scale;

  // Animation Mixer
  mixer = new THREE.AnimationMixer(characterModel);

  // Stitched animations array
  const allClips = [...charGltf.animations, ...animGltf.animations];
  setupAnimations(allClips);
}

function setupAnimations(clips) {
  const listEl = document.getElementById('animations-list');
  listEl.innerHTML = '';

  if (clips.length === 0) {
    listEl.innerHTML = '<li class="loading-item">No animation clips detected.</li>';
    return;
  }

  // Instantiate clipActions
  clips.forEach((clip, index) => {
    // Some exporter systems include duplicate track paths, make them clean
    const action = mixer.clipAction(clip);
    actions[clip.name] = action;

    // Add list item to diagnostics HUD
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="clip-name">${clip.name}</span>
      <span class="clip-index">#${index}</span>
    `;
    li.addEventListener('click', () => {
      // Force play clicked animation manually
      fadeToAction(clip.name, 0.25);
    });
    listEl.appendChild(li);
  });

  // Fuzzy find actions for movement controller
  const findClip = (keywords) => {
    return clips.find(clip => {
      const nameLower = clip.name.toLowerCase();
      return keywords.some(k => nameLower.includes(k));
    });
  };

  // Maps state triggers
  const idleClip = findClip(['idle', 'pose', 'stand']) || clips[0];
  const walkClip = findClip(['walk', 'march', 'move']) || clips[1] || clips[0];
  const runClip = findClip(['run', 'sprint', 'dash']) || clips[2] || walkClip;
  const jumpClip = findClip(['jump', 'leap', 'hop', 'air']) || clips[3] || clips[0];

  actions['idle'] = mixer.clipAction(idleClip);
  actions['walk'] = mixer.clipAction(walkClip);
  actions['run'] = mixer.clipAction(runClip);
  
  const jumpAction = mixer.clipAction(jumpClip);
  jumpAction.setLoop(THREE.LoopOnce, 1);
  jumpAction.clampWhenFinished = true;
  actions['jump'] = jumpAction;

  // Play initial idle
  fadeToAction('idle', 0.1);
}

function fadeToAction(name, duration = 0.2) {
  const nextAction = actions[name];
  if (!nextAction) return;
  if (activeAction === nextAction) return;

  // Highlight list item in HUD
  const listItems = document.querySelectorAll('#animations-list li');
  listItems.forEach(li => {
    const nameSpan = li.querySelector('.clip-name');
    if (nameSpan && nameSpan.innerText.trim() === name) {
      li.classList.add('active');
    } else {
      li.classList.remove('active');
    }
  });

  uiActiveState.innerText = name.toUpperCase();

  if (activeAction) {
    activeAction.fadeOut(duration);
  }

  nextAction
    .reset()
    .setEffectiveTimeScale(1)
    .setEffectiveWeight(1)
    .fadeIn(duration)
    .play();

  activeAction = nextAction;
  currentClipName = name;
}

// --- Inputs & Controls ---
function setupInputListeners() {
  const handleKey = (e, isDown) => {
    const key = e.key.toLowerCase();
    
    if (key === 'w' || e.key === 'ArrowUp') keys.w = isDown;
    if (key === 'a' || e.key === 'ArrowLeft') keys.a = isDown;
    if (key === 's' || e.key === 'ArrowDown') keys.s = isDown;
    if (key === 'd' || e.key === 'ArrowRight') keys.d = isDown;
    if (e.key === 'Shift') keys.shift = isDown;
    
    if (e.key === ' ') {
      keys.space = isDown;
      e.preventDefault(); // stop scrolling page
    }

    if (isDown && key === 'c') {
      isFollowCamera = !isFollowCamera;
      orbitControls.enabled = !isFollowCamera;
      uiCameraBadge.innerText = isFollowCamera ? 'Third-Person Follow' : 'Orbit Inspect';
    }

    updateKeyUI();
  };

  window.addEventListener('keydown', (e) => handleKey(e, true));
  window.addEventListener('keyup', (e) => handleKey(e, false));
}

function updateKeyUI() {
  const toggleClass = (id, active) => {
    const el = document.getElementById(id);
    if (el) {
      if (active) el.classList.add('active');
      else el.classList.remove('active');
    }
  };

  toggleClass('key-w', keys.w);
  toggleClass('key-a', keys.a);
  toggleClass('key-s', keys.s);
  toggleClass('key-d', keys.d);
  toggleClass('key-space', keys.space);
  toggleClass('key-shift', keys.shift);
}

// --- Window Resize ---
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Collisions & Physics Loop ---
function resolveHorizontalCollisions(axis) {
  if (!playerGroup) return;

  for (const obs of obstacles) {
    const boxMin = obs.box3.min;
    const boxMax = obs.box3.max;

    // Check vertical overlap with obstacle
    const playerBottom = playerGroup.position.y;
    const playerTop = playerGroup.position.y + playerHeight;

    if (playerBottom < boxMax.y - 0.05 && playerTop > boxMin.y + 0.05) {
      // Find closest point on obstacle box in XZ plane
      const closestX = Math.max(boxMin.x, Math.min(playerGroup.position.x, boxMax.x));
      const closestZ = Math.max(boxMin.z, Math.min(playerGroup.position.z, boxMax.z));

      const diffX = playerGroup.position.x - closestX;
      const diffZ = playerGroup.position.z - closestZ;
      const distSq = diffX * diffX + diffZ * diffZ;

      if (distSq < playerRadius * playerRadius) {
        const dist = Math.sqrt(distSq);
        const overlap = playerRadius - dist;

        if (dist > 0.001) {
          if (axis === 'x') {
            playerGroup.position.x += (diffX / dist) * overlap;
          } else if (axis === 'z') {
            playerGroup.position.z += (diffZ / dist) * overlap;
          }
        }
      }
    }
  }
}

function updatePhysics(dt) {
  if (!playerGroup) return;

  // 1. Handle Rotations
  if (keys.a) {
    playerGroup.rotation.y += rotationSpeed * dt;
  }
  if (keys.d) {
    playerGroup.rotation.y -= rotationSpeed * dt;
  }

  // 2. Handle Velocities
  let targetSpeed = 0;
  if (keys.w) {
    targetSpeed = keys.shift ? runSpeed : walkSpeed;
  } else if (keys.s) {
    targetSpeed = -(keys.shift ? runSpeed : walkSpeed) * 0.55; // slower backing up
  }

  // Interpolate moveSpeed for smoothness
  moveSpeed += (targetSpeed - moveSpeed) * 12 * dt;

  // 3. Move Horizontally
  if (Math.abs(moveSpeed) > 0.02) {
    const angle = playerGroup.rotation.y;
    const dx = Math.sin(angle) * moveSpeed * dt;
    const dz = Math.cos(angle) * moveSpeed * dt;

    playerGroup.position.x += dx;
    resolveHorizontalCollisions('x');

    playerGroup.position.z += dz;
    resolveHorizontalCollisions('z');
  }

  // Boundaries clamp (stay within the 120x120 grid)
  const mapLimit = 59.2;
  playerGroup.position.x = Math.min(mapLimit, Math.max(-mapLimit, playerGroup.position.x));
  playerGroup.position.z = Math.min(mapLimit, Math.max(-mapLimit, playerGroup.position.z));

  // 4. Apply Vertical Movement (Gravity / Jumps)
  if (!isGrounded) {
    yVelocity -= gravity * dt;
  }

  playerGroup.position.y += yVelocity * dt;

  // 5. Landings check
  let landed = false;

  if (yVelocity <= 0) {
    // Check if landing on any box top
    for (const obs of obstacles) {
      const boxMin = obs.box3.min;
      const boxMax = obs.box3.max;

      const inX = playerGroup.position.x > boxMin.x - playerRadius && playerGroup.position.x < boxMax.x + playerRadius;
      const inZ = playerGroup.position.z > boxMin.z - playerRadius && playerGroup.position.z < boxMax.z + playerRadius;

      if (inX && inZ) {
        // Check if bottom of player is intersecting box top threshold
        if (playerGroup.position.y >= boxMax.y - 0.22 && playerGroup.position.y <= boxMax.y + 0.08) {
          playerGroup.position.y = boxMax.y;
          yVelocity = 0;
          isGrounded = true;
          currentGroundObstacle = obs;
          landed = true;
          break;
        }
      }
    }
  }

  // Ground landing fallback
  if (!landed && playerGroup.position.y <= 0) {
    playerGroup.position.y = 0;
    yVelocity = 0;
    isGrounded = true;
    currentGroundObstacle = null;
    landed = true;
  }

  // 6. Check if walked off current box
  if (isGrounded && currentGroundObstacle !== null) {
    const boxMin = currentGroundObstacle.box3.min;
    const boxMax = currentGroundObstacle.box3.max;

    const inX = playerGroup.position.x > boxMin.x - playerRadius && playerGroup.position.x < boxMax.x + playerRadius;
    const inZ = playerGroup.position.z > boxMin.z - playerRadius && playerGroup.position.z < boxMax.z + playerRadius;

    if (!inX || !inZ) {
      currentGroundObstacle = null;
      isGrounded = false;
    }
  }

  // 7. Jump Trigger
  if (keys.space && isGrounded) {
    yVelocity = jumpForce;
    isGrounded = false;
    currentGroundObstacle = null;
  }

  // 8. Animation States Blending
  updateAnimationState();
}

function updateAnimationState() {
  let newState = 'idle';

  if (!isGrounded) {
    newState = 'jump';
  } else {
    const isMoving = keys.w || keys.s || keys.a || keys.d;
    if (isMoving) {
      // Rotate counts as movement, but prioritize walking/running
      if (keys.w || keys.s) {
        newState = keys.shift ? 'run' : 'walk';
      } else {
        newState = 'walk'; // turning
      }
    } else {
      newState = 'idle';
    }
  }

  if (newState !== currentState) {
    fadeToAction(newState, 0.2);
    currentState = newState;
  }
}

// --- Telemetry Display Updates ---
function updateHUD() {
  if (!playerGroup) return;

  // Positions
  uiPosX.innerText = playerGroup.position.x.toFixed(2);
  uiPosY.innerText = playerGroup.position.y.toFixed(2);
  uiPosZ.innerText = playerGroup.position.z.toFixed(2);

  // Speed math (units per sec to km/h visualization)
  const currentSpeedKMH = Math.abs(moveSpeed) * 3.6;
  uiSpeedVal.innerText = currentSpeedKMH.toFixed(1) + ' km/h';

  const maxAnimSpeed = runSpeed * 3.6;
  const speedPercent = Math.min(100, (currentSpeedKMH / maxAnimSpeed) * 100);
  uiSpeedBar.style.width = speedPercent + '%';

  // Animation Progress tracker
  if (activeAction) {
    const clipDur = activeAction.getClip().duration;
    if (clipDur > 0) {
      const progressPercent = ((activeAction.time / clipDur) * 100) % 100;
      uiAnimProgress.style.width = progressPercent.toFixed(1) + '%';
    }
  }
}

// --- Main Render / Tick Loop ---
function animate() {
  requestAnimationFrame(animate);

  let dt = clock.getDelta();
  // clamp dt to prevent physics clips on lag spikes
  if (dt > 0.1) dt = 0.1;

  // Physics & Movement
  updatePhysics(dt);

  // Mixer
  if (mixer) {
    mixer.update(dt);
  }

  // Camera Management
  if (isFollowCamera && playerGroup) {
    // Dynamic third-person follow camera
    const cameraOffset = new THREE.Vector3(0, 3.2, -6.5); // height 3.2m, distance 6.5m behind
    
    // Rotate offset according to bot's heading direction
    const targetCameraPos = cameraOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), playerGroup.rotation.y);
    targetCameraPos.add(playerGroup.position);

    // Smooth lerp to camera location
    camera.position.lerp(targetCameraPos, 12 * dt);

    // Target point above character center
    const lookAtTarget = playerGroup.position.clone();
    lookAtTarget.y += 1.35;
    camera.lookAt(lookAtTarget);
  } else {
    // In Orbit mode, update controls
    if (playerGroup) {
      orbitControls.target.copy(playerGroup.position).add(new THREE.Vector3(0, 1.2, 0));
    }
    orbitControls.update();
  }

  // Diagnostics HUD
  updateHUD();

  renderer.render(scene, camera);
}

// Start application
init();
