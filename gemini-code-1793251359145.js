const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

let db = null;
if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
}

const canvas = document.getElementById('paintCanvas');
const ctx = canvas.getContext('2d');
let currentTool = 'pen';
let currentColor = '#000000';
let currentSize = 5;
let isDrawing = false;
let startX = 0, startY = 0;
let snapshot = null;
let currentRoom = 'public';
let unsubscribeRoom = null;

function initCanvas() {
  canvas.width = Math.min(window.innerWidth - 120, 1200);
  canvas.height = Math.min(window.innerHeight - 160, 800);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

window.addEventListener('load', () => {
  initCanvas();
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam) {
    joinRoom(roomParam);
  } else {
    listenToRoom('public');
  }
});

function setTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`tool-${tool}`).classList.add('active');
}

function setColor(color) {
  currentColor = color;
  document.getElementById('colorPicker').value = color;
}

document.getElementById('colorPicker').addEventListener('input', (e) => { currentColor = e.target.value; });
document.getElementById('brushSize').addEventListener('input', (e) => {
  currentSize = e.target.value;
  document.getElementById('brushSizeText').innerText = `${currentSize}px`;
});

function startDraw(e) {
  isDrawing = true;
  const rect = canvas.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function draw(e) {
  if (!isDrawing) return;
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  ctx.lineWidth = currentSize;
  ctx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : currentColor;
  ctx.fillStyle = currentColor;

  if (currentTool === 'pen' || currentTool === 'eraser') {
    ctx.lineTo(mouseX, mouseY);
    ctx.stroke();
  } else {
    ctx.putImageData(snapshot, 0, 0);
    ctx.beginPath();
    if (currentTool === 'line') {
      ctx.moveTo(startX, startY);
      ctx.lineTo(mouseX, mouseY);
      ctx.stroke();
    } else if (currentTool === 'rect') {
      ctx.strokeRect(startX, startY, mouseX - startX, mouseY - startY);
    } else if (currentTool === 'circle') {
      const radius = Math.sqrt(Math.pow(mouseX - startX, 2) + Math.pow(mouseY - startY, 2));
      ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }
}

function stopDraw() {
  if (!isDrawing) return;
  isDrawing = false;
  saveCanvasState();
}

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDraw);

function clearCanvas(broadcast = true) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (broadcast) saveCanvasState();
}

function saveCanvasState() {
  if (!db) return;
  const dataURL = canvas.toDataURL();
  db.collection('rooms').doc(currentRoom).set({
    image: dataURL,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

function listenToRoom(roomId) {
  currentRoom = roomId;
  document.getElementById('currentRoomText').innerText = roomId === 'public' ? 'Public (공공)' : `#${roomId}`;
  const copyBtn = document.getElementById('copyRoomBtn');
  if (roomId === 'public') copyBtn.classList.add('hidden');
  else copyBtn.classList.remove('hidden');

  if (unsubscribeRoom) unsubscribeRoom();
  if (!db) return;

  unsubscribeRoom = db.collection('rooms').doc(roomId).onSnapshot(doc => {
    if (doc.exists && doc.data().image) {
      const img = new Image();
      img.src = doc.data().image;
      img.onload = () => ctx.drawImage(img, 0, 0);
    }
  });
}

function openRoomModal() { document.getElementById('roomModal').classList.remove('hidden'); }
function closeRoomModal() { document.getElementById('roomModal').classList.add('hidden'); }

function joinRoom(roomId) {
  listenToRoom(roomId);
  closeRoomModal();
  const url = new URL(window.location);
  if (roomId === 'public') url.searchParams.delete('room');
  else url.searchParams.set('room', roomId);
  window.history.pushState({}, '', url);
}

function joinRoomFromInput() {
  const code = document.getElementById('roomInput').value.trim().toUpperCase();
  if (code) joinRoom(code);
}

function createPrivateRoom() {
  const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  joinRoom(randomCode);
}

function copyRoomCode() {
  navigator.clipboard.writeText(window.location.href);
  alert('방 링크가 클립보드에 복사되었습니다!');
}

function downloadCanvas() {
  const link = document.createElement('a');
  link.download = `paint_io_${currentRoom}.png`;
  link.href = canvas.toDataURL();
  link.click();
}