import {
  computeOutputSize,
  fitRect,
  normalizeSelection,
  parseRatio,
  pointToNormalized,
  toSourceRect
} from "./crop.js";
import { renderPixelatedFrame } from "./pixelate.js";
import { createPlayer } from "./player.js";

const elements = {
  video: document.getElementById("sourceVideo"),
  videoFile: document.getElementById("videoFile"),
  videoUrl: document.getElementById("videoUrl"),
  loadUrlBtn: document.getElementById("loadUrlBtn"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  resetCropBtn: document.getElementById("resetCropBtn"),
  matrixCols: document.getElementById("matrixCols"),
  matrixRows: document.getElementById("matrixRows"),
  matrixPreset: document.getElementById("matrixPreset"),
  aspectMode: document.getElementById("aspectMode"),
  targetRatio: document.getElementById("targetRatio"),
  enableCrop: document.getElementById("enableCrop"),
  showGrid: document.getElementById("showGrid"),
  freezeFrame: document.getElementById("freezeFrame"),
  statusText: document.getElementById("statusText"),
  originalCanvas: document.getElementById("originalCanvas"),
  pixelCanvas: document.getElementById("pixelCanvas")
};

const player = createPlayer(elements.video);
const originalCtx = elements.originalCanvas.getContext("2d");
const pixelCtx = elements.pixelCanvas.getContext("2d");
const lowResCtx = document.createElement("canvas").getContext("2d");

const state = {
  sourceReady: false,
  selection: null,
  isSelecting: false,
  selectStart: null,
  selectCurrent: null
};

function setStatus(message, isError = false) {
  elements.statusText.textContent = message;
  elements.statusText.classList.toggle("error", isError);
}

function getMatrix() {
  const cols = Math.max(2, Number(elements.matrixCols.value) || 16);
  const rows = Math.max(2, Number(elements.matrixRows.value) || 16);
  return { cols, rows };
}

function syncCanvasSizes() {
  if (!state.sourceReady) {
    return;
  }

  const ratio = parseRatio(elements.targetRatio.value);
  const pixelSize = computeOutputSize(
    elements.video.videoWidth,
    elements.video.videoHeight,
    ratio
  );
  elements.pixelCanvas.width = pixelSize.width;
  elements.pixelCanvas.height = pixelSize.height;

  const originalSize = computeOutputSize(
    elements.video.videoWidth,
    elements.video.videoHeight,
    null
  );
  elements.originalCanvas.width = originalSize.width;
  elements.originalCanvas.height = originalSize.height;
}

function sourceRectFromSelection() {
  const manualEnabled = elements.enableCrop.checked;
  if (!manualEnabled || !state.selection) {
    return {
      x: 0,
      y: 0,
      width: elements.video.videoWidth,
      height: elements.video.videoHeight
    };
  }
  return toSourceRect(
    state.selection,
    elements.video.videoWidth,
    elements.video.videoHeight
  );
}

function drawOriginalFrame() {
  const { width: dstW, height: dstH } = elements.originalCanvas;
  const drawRect = fitRect(
    elements.video.videoWidth,
    elements.video.videoHeight,
    dstW,
    dstH
  );

  originalCtx.fillStyle = "#000";
  originalCtx.fillRect(0, 0, dstW, dstH);
  originalCtx.drawImage(
    elements.video,
    0,
    0,
    elements.video.videoWidth,
    elements.video.videoHeight,
    drawRect.x,
    drawRect.y,
    drawRect.width,
    drawRect.height
  );

  if (elements.enableCrop.checked && state.selection) {
    const sx = drawRect.x + state.selection.x * drawRect.width;
    const sy = drawRect.y + state.selection.y * drawRect.height;
    const sw = state.selection.width * drawRect.width;
    const sh = state.selection.height * drawRect.height;

    originalCtx.save();
    originalCtx.strokeStyle = "#4dd6ff";
    originalCtx.lineWidth = 2;
    originalCtx.strokeRect(sx, sy, sw, sh);
    originalCtx.fillStyle = "rgba(77,214,255,0.1)";
    originalCtx.fillRect(sx, sy, sw, sh);
    originalCtx.restore();
  }

  if (state.isSelecting && state.selectStart && state.selectCurrent) {
    const preview = normalizeSelection(state.selectStart, state.selectCurrent);
    const sx = drawRect.x + preview.x * drawRect.width;
    const sy = drawRect.y + preview.y * drawRect.height;
    const sw = preview.width * drawRect.width;
    const sh = preview.height * drawRect.height;

    originalCtx.save();
    originalCtx.setLineDash([6, 4]);
    originalCtx.strokeStyle = "#ffe066";
    originalCtx.lineWidth = 2;
    originalCtx.strokeRect(sx, sy, sw, sh);
    originalCtx.restore();
  }
}

function renderFrame() {
  if (!state.sourceReady) {
    return;
  }

  drawOriginalFrame();

  const { cols, rows } = getMatrix();
  renderPixelatedFrame({
    video: elements.video,
    pixelCtx,
    lowResCtx,
    cols,
    rows,
    baseSourceRect: sourceRectFromSelection(),
    targetAspect: parseRatio(elements.targetRatio.value),
    aspectMode: elements.aspectMode.value,
    showGrid: elements.showGrid.checked
  });
}

function loop() {
  if (state.sourceReady) {
    const shouldRender = !elements.freezeFrame.checked || elements.video.paused;
    if (shouldRender) {
      renderFrame();
    }
  }
  requestAnimationFrame(loop);
}

function updatePlaybackButton() {
  elements.playPauseBtn.textContent = elements.video.paused ? "Play" : "Pause";
}

function pointFromEvent(event) {
  const rect = elements.originalCanvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function selectionPointFromEvent(event) {
  const canvasPoint = pointFromEvent(event);
  const drawRect = fitRect(
    elements.video.videoWidth,
    elements.video.videoHeight,
    elements.originalCanvas.width,
    elements.originalCanvas.height
  );
  return pointToNormalized(canvasPoint.x, canvasPoint.y, drawRect);
}

async function loadFromFile(file) {
  await player.loadFromFile(file);
  state.sourceReady = true;
  syncCanvasSizes();
  elements.playPauseBtn.disabled = false;
  elements.resetCropBtn.disabled = false;
  updatePlaybackButton();
  setStatus(`Video cargado: ${file.name}`);
  renderFrame();
}

async function loadFromUrl(url) {
  await player.loadFromUrl(url);
  state.sourceReady = true;
  syncCanvasSizes();
  elements.playPauseBtn.disabled = false;
  elements.resetCropBtn.disabled = false;
  updatePlaybackButton();
  setStatus(
    "Video URL cargado. Si la fuente no permite CORS, la vista pixelada puede fallar."
  );
  renderFrame();
}

elements.videoFile.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  try {
    await loadFromFile(file);
  } catch (error) {
    setStatus(error.message, true);
  }
});

elements.loadUrlBtn.addEventListener("click", async () => {
  const url = elements.videoUrl.value.trim();
  try {
    await loadFromUrl(url);
  } catch (error) {
    setStatus(error.message, true);
  }
});

elements.playPauseBtn.addEventListener("click", async () => {
  try {
    await player.playPause();
    updatePlaybackButton();
  } catch (error) {
    setStatus(`No se pudo reproducir: ${error.message}`, true);
  }
});

elements.video.addEventListener("play", updatePlaybackButton);
elements.video.addEventListener("pause", updatePlaybackButton);

elements.matrixPreset.addEventListener("change", () => {
  if (!elements.matrixPreset.value) {
    return;
  }
  const [cols, rows] = elements.matrixPreset.value.split("x").map(Number);
  elements.matrixCols.value = String(cols);
  elements.matrixRows.value = String(rows);
  renderFrame();
});

elements.matrixCols.addEventListener("change", renderFrame);
elements.matrixRows.addEventListener("change", renderFrame);
elements.aspectMode.addEventListener("change", renderFrame);
elements.showGrid.addEventListener("change", renderFrame);
elements.freezeFrame.addEventListener("change", renderFrame);
elements.targetRatio.addEventListener("change", () => {
  if (state.sourceReady) {
    syncCanvasSizes();
  }
  renderFrame();
});
elements.enableCrop.addEventListener("change", renderFrame);

elements.resetCropBtn.addEventListener("click", () => {
  state.selection = null;
  state.selectStart = null;
  state.selectCurrent = null;
  state.isSelecting = false;
  renderFrame();
});

elements.originalCanvas.addEventListener("pointerdown", (event) => {
  if (!state.sourceReady || !elements.enableCrop.checked) {
    return;
  }
  state.isSelecting = true;
  state.selectStart = selectionPointFromEvent(event);
  state.selectCurrent = state.selectStart;
  elements.originalCanvas.setPointerCapture(event.pointerId);
});

elements.originalCanvas.addEventListener("pointermove", (event) => {
  if (!state.isSelecting || !state.selectStart) {
    return;
  }
  state.selectCurrent = selectionPointFromEvent(event);
});

elements.originalCanvas.addEventListener("pointerup", (event) => {
  if (!state.isSelecting || !state.selectStart || !state.selectCurrent) {
    return;
  }
  state.selection = normalizeSelection(state.selectStart, state.selectCurrent);
  state.isSelecting = false;
  state.selectStart = null;
  state.selectCurrent = null;
  elements.originalCanvas.releasePointerCapture(event.pointerId);
  renderFrame();
});

elements.originalCanvas.addEventListener("pointercancel", () => {
  state.isSelecting = false;
  state.selectStart = null;
  state.selectCurrent = null;
});

setStatus("Esperando video...");
loop();
