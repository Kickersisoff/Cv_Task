const { ipcRenderer } = require('electron');
const WebSocket = require('ws');

let video = document.getElementById('videoElement');
let startButton = document.getElementById('startButton');
let stopButton = document.getElementById('stopButton');
let canvas = document.getElementById('overlayCanvas');
let ctx = canvas.getContext('2d');
const toggleLandmarksButton = document.getElementById("toggleLandmarksButton");
const toggleAnglesButton = document.getElementById("toggleAnglesButton");

let mediaStream = null;
let ws = new WebSocket('ws://localhost:8080/ws');
let sendInterval;
let showLandmarks = true;
let showAngles = true;

let totalFramesSent = 0;
let totalFramesProcessed = 0;

// default (movenet model) connections for skeleton drawing
const connections = [
    [0, 1], [0, 2], [1, 3], [2, 4], [5, 6], [5, 7],
    [7, 9], [6, 8], [8, 10], [5, 11], [6, 12], [11, 12],
    [11, 13], [13, 15], [12, 14], [14, 16]
];

// function to calculate angle between three coordinate(a,b,c with x and y coordinate) points
function calculateAngle(a, b, c) {
  let vectorBA = { x: a.x - b.x, y: a.y - b.y };
  let vectorBC = { x: c.x - b.x, y: c.y - b.y };

  let dotProduct = vectorBA.x * vectorBC.x + vectorBA.y * vectorBC.y;

  let magnitudeBA = Math.sqrt(vectorBA.x * vectorBA.x + vectorBA.y * vectorBA.y);
  let magnitudeBC = Math.sqrt(vectorBC.x * vectorBC.x + vectorBC.y * vectorBC.y);

  let angle = Math.acos(dotProduct / (magnitudeBA * magnitudeBC));

  return angle * (180 / Math.PI);
}

startButton.addEventListener('click', () => {
  startCamera();
});

stopButton.addEventListener('click', () => {
  stopCamera();
});

toggleLandmarksButton.addEventListener("click", toggleLandmarks);
toggleAnglesButton.addEventListener("click", toggleAngles);

function toggleLandmarks() {
  showLandmarks = !showLandmarks;
  if (!showLandmarks && !showAngles) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function toggleAngles() {
  showAngles = !showAngles;
  if (!showLandmarks && !showAngles) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}


// function to start the camera using start button
function startCamera() {
  navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
    .then((stream) => {
      mediaStream = stream;
      video.srcObject = mediaStream;
      video.onloadedmetadata = () => {
        video.play();
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        console.log('Canvas size set to:', canvas.width, 'x', canvas.height);
        startSendingFrames();
      };
    })
    .catch((err) => {
      console.error('Error accessing the camera: ', err);
    });
}

// function to start the camera using stop button
function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => {
      track.stop();
    });
    mediaStream = null;
    video.srcObject = null;
    stopSendingFrames();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// function to start sending frames
function startSendingFrames() {
  sendInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      totalFramesSent++;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
      const frameDataURL = tempCanvas.toDataURL('image/jpeg');
      const base64Data = frameDataURL.replace(/^data:image\/jpeg;base64,/, '');
      ws.send(base64Data);
      console.log('Frame sent');
    } else {
      console.log('WebSocket not open. ReadyState:', ws.readyState);
    }
  }, 100); // each frame at 100 ms
}

// function to stop sending frames
function stopSendingFrames() {
  clearInterval(sendInterval);
}

ws.onopen = () => {
  console.log('WebSocket connection established');
};

ws.onclose = () => {
  console.log('WebSocket connection closed');
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onmessage = (event) => {

  // Frame Drop Rate: 
  // This shows what percentage of frames sent from the frontend are not being processed by the backend.

  totalFramesProcessed++;
  const dropRate = (totalFramesSent - totalFramesProcessed) / totalFramesSent * 100;
  console.log(`Frame drop rate: ${dropRate.toFixed(2)}%`);
  
  try {
    const landmarks = JSON.parse(event.data);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (showLandmarks) {
      drawLandmarks(landmarks);
    }
    
    if (showAngles) {
      drawAngles(landmarks);
    }
  } catch (error) {
    console.error('Error parsing landmark data:', error);
  }
};

// to print landmark points that we got from the backend.
function drawLandmarks(landmarks) {
  landmarks.forEach((point, index) => {
    if (point.confidence > 0.5) {
      ctx.beginPath();
      ctx.arc(point.x * canvas.width, point.y * canvas.height, 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'red';
      ctx.fill();
    }
  });

  ctx.strokeStyle = 'rgb(200, 200, 200)';
  ctx.lineWidth = 2;

  connections.forEach(([index1, index2]) => {
    const point1 = landmarks[index1];
    const point2 = landmarks[index2];

    if (point1.confidence > 0.5 && point2.confidence > 0.5) {
      ctx.beginPath();
      ctx.moveTo(point1.x * canvas.width, point1.y * canvas.height);
      ctx.lineTo(point2.x * canvas.width, point2.y * canvas.height);
      ctx.stroke();
    }
  });
}

// function to draw angles using the landmark points
function drawAngles(landmarks) {
  let p11 = landmarks[11];
  let p5 = landmarks[5];
  let p7 = landmarks[7];
  let p12 = landmarks[12];
  let p6 = landmarks[6];
  let p8 = landmarks[8];

  const angle1157 = calculateAngle(p11, p5, p7);
  const angle1268 = calculateAngle(p12, p6, p8);

  ctx.fillStyle = "orange";
  ctx.font = "21px Arial";
  ctx.fillText(`∠${angle1157.toFixed(2)}°`, p5.x * canvas.width, p5.y * canvas.height - 15);
  ctx.fillText(`∠${angle1268.toFixed(2)}°`, p6.x * canvas.width, p6.y * canvas.height - 15);
}

// Initial setup
canvas.width = 640;
canvas.height = 480;