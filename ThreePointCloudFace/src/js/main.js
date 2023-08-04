import * as THREE from 'three';
import {
  OrbitControls
} from 'three/examples/jsm/controls/OrbitControls';

//TASKS-VISION/TF VARS 
import { FaceLandmarker, FilesetResolver, DrawingUtils } from "./tasks-vision.js";
let faceLandmarker;
let runningMode = "VIDEO";
let webcamRunning = false;
// const videoWidth = 480;
const videoWidth = 340;
let boundingBoxHelper;
let landmarkPointsMesh; // integ

// 3D - THREE.JS VARS
let camera, scene, renderer;
const canvas = document.getElementById('canvas_001');
// Get the camera state radio inputs
const cameraOnRadio = document.querySelector('input[value="on"]');
const cameraOffRadio = document.querySelector('input[value="off"]');
let webcamStream; // Variable to store the webcam stream


//TASKS-VISION Preload :
async function preLoadAssets() {    
  const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");
  faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: "GPU"
      },
      outputFaceBlendshapes: true,
      runningMode,
      numFaces: 1
  });
  console.log('Done preloading vision- task')  
}
preLoadAssets();


const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
let lastVideoTime = -1;
let results = undefined;
const drawingUtils = new DrawingUtils(canvasCtx);



function init() {

  // SCENE
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x898989);

  // MAIN CAMERA
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
  camera.position.z = 5;

  //Lights

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(20, 30, 20);
  light.shadow.camera.near = 0.1;
  light.shadow.camera.far = 1000;
  light.intensity = 1;
  light.shadow.mapSize.width = 1200;
  light.shadow.mapSize.height = 1200;
  var shadowIntensity = 0.7; // between 0 and 1
  const light2 = light.clone();
  light.castShadow = true;
  light2.castShadow = false;
  light.intensity = shadowIntensity;
  light2.intensity = 1 - shadowIntensity;
  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(light);
  scene.add(light2);    
  scene.add(ambientLight);

  // OBJECTS

  // FLOOR  
  const planeGeometry = new THREE.PlaneGeometry(10, 10);
  const planeMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFF2DB
    });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.position.set(0, -0.5, 0);
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);

  // WALLS:
  // Back Wall
  const backGeometry = new THREE.PlaneGeometry(10, 8);
  const backMaterial = new THREE.MeshStandardMaterial({ color: 0xFFF2DB });
  const backWall = new THREE.Mesh(backGeometry, backMaterial);
  backWall.position.set(0, 3.5, -5);
  backWall.receiveShadow = true;
  scene.add(backWall); 

  // Left Wall
  const leftGeometry = new THREE.PlaneGeometry(10, 8);
  const leftMaterial = new THREE.MeshStandardMaterial({ color: 0xFFF2DB });
  const leftWall = new THREE.Mesh(leftGeometry, leftMaterial);
  leftWall.position.set(-5, 3.5, 0);
  leftWall.rotation.y = Math.PI / 2;
  scene.add(leftWall);

  // Right Wall
  const rightGeometry = new THREE.PlaneGeometry(10, 8);
  const rightMaterial = new THREE.MeshStandardMaterial({ color: 0xFFF2DB });
  const rightWall = new THREE.Mesh(rightGeometry, rightMaterial);
  rightWall.position.set(5, 3.5, 0);
  rightWall.rotation.y = -Math.PI / 2;
  scene.add(rightWall);
  
  //Renderer Main
  renderer = new THREE.WebGLRenderer({
    antialias: true
  });
  renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Orbit controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = true;
  // Enable vertical panning
  
  controls.minDistance = 1;
  controls.maxDistance = 50;
  controls.maxPolarAngle = Math.PI / 2;  
  animate();

}

function animate() {
  // Call the animate function on every frame update
  requestAnimationFrame(animate);

  // Render the scene
  renderer.render(scene, camera);
}


// Function to handle starting the webcam
function startWebcam() {
  // Request permission to access the webcam
  navigator.mediaDevices.getUserMedia({ video: true })
    .then((stream) => {
      // Get the video element from the DOM
      const videoElement = document.getElementById('webcam');

      // Attach the stream to the video element to display the webcam feed
      // Store the stream in the variable
      webcamStream = stream;
      webcamRunning = true;

      videoElement.srcObject = stream;
      // TF TASKS - VISION
      video.addEventListener("loadeddata", predictWebcam);

      
    })
    .catch((error) => {
      // Handle any errors that occur during webcam access
      console.error('Error accessing webcam:', error);
    });    
}

// TF TASKS - VISION
async function predictWebcam() {
  const radio = video.videoHeight / video.videoWidth;
  video.style.width = videoWidth + "px";
  video.style.height = videoWidth * radio + "px";
  canvasElement.style.width = videoWidth + "px";
  canvasElement.style.height = videoWidth * radio + "px";
  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;
  let nowInMs = Date.now();
  if (lastVideoTime !== video.currentTime) {
      lastVideoTime = video.currentTime;
      results = faceLandmarker.detectForVideo(video, nowInMs);
      // console.log(results);
  }
  if (results.faceLandmarks) {
    // console.log(results.faceLandmarks);
      for (const landmarks of results.faceLandmarks) {
          drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#C0C0C070", lineWidth: 1 });
          drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: "#FF3030" , lineWidth: 1});
          drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, { color: "#FF3030" , lineWidth: 1});
          drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: "#30FF30" , lineWidth: 1});
          drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, { color: "#30FF30" , lineWidth: 1});
          drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, { color: "#E0E0E0", lineWidth: 1 });
          drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, { color: "#E0E0E0" , lineWidth: 1});
          drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, { color: "#FF3030" , lineWidth: 1});
          drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, { color: "#30FF30" , lineWidth: 1});
      }
  }

  // Integ
  if (landmarkPointsMesh) {
    scene.remove(landmarkPointsMesh);
  }
  if (results.faceLandmarks.length > 0) {
    const landmarks = results.faceLandmarks[0];
    const landmarkPoints = landmarks.map(point => ({
      x: (-point.x)*12,
      y: -(point.y)*12,
      z: (-point.z)*12
    }));

    let bottomMostPoint = landmarkPoints[0];
    for (let i = 1; i < landmarkPoints.length; i++) {
      if (landmarkPoints[i].y < bottomMostPoint.y) {
        bottomMostPoint = landmarkPoints[i];
      }
    }

    
    // Calculate the vertical shift to move the points above the floor
    const floorOffset = -bottomMostPoint.y - 0.2; // Adjust the offset as needed

    // Calculate the positions of the walls
    const backWallPosition = new THREE.Vector3(0, 3.5, -5);
    const leftWallPosition = new THREE.Vector3(-5, 3.5, 0);
    const rightWallPosition = new THREE.Vector3(5, 3.5, 0);  
    
    // Calculate the horizontal shift to center the points    

    for (let i = 0; i < landmarkPoints.length; i++) {
      landmarkPoints[i].y += floorOffset;
      landmarkPoints[i].x += 6;
    }  


    if (boundingBoxHelper) {
      scene.remove(boundingBoxHelper);
    }
  
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    for (const point of landmarkPoints) {
      positions.push(point.x, point.y, point.z);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({ color: 0xff0000, size: 0.06 });
    landmarkPointsMesh = new THREE.Points(geometry, material);
    
    // Calculate the bounding box
    const boundingBox = new THREE.Box3();
    boundingBox.setFromPoints(landmarkPoints);    
    boundingBoxHelper = new THREE.Box3Helper(boundingBox, 0x00ff00);
    
    // Create the wireframe box helper
    
    scene.add(boundingBoxHelper);
    scene.add(landmarkPointsMesh);    
  }

  
    
  // Call this function again to keep predicting when the browser is ready.
  if (webcamRunning === true) {
      window.requestAnimationFrame(predictWebcam);
  }
}



// Function to handle stopping the webcam
function stopWebcam() {
  // Check if the webcam stream exists
  if (webcamStream) {
    // Get the tracks of the stream
    const tracks = webcamStream.getTracks();

    // Stop each track
    tracks.forEach((track) => track.stop());

    // Clear the stream from the video element
    const videoElement = document.getElementById('webcam');
    videoElement.srcObject = null;

    // Reset the webcamStream variable
    webcamStream = null;
    webcamRunning = false;
  }
}

// Function to handle the camera state change
function handleCameraStateChange() {
  if (cameraOnRadio.checked) {
    startWebcam();
  } else {
    stopWebcam();
  }
}

// Add event listeners to camera state radio inputs
cameraOnRadio.addEventListener('change', handleCameraStateChange);
cameraOffRadio.addEventListener('change', handleCameraStateChange);


window.addEventListener('resize', function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}, false);


init();