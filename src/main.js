import {
  computeOutputSize,
  fitRect,
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
  lockCropAspect: document.getElementById("lockCropAspect"),
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
  selectCurrent: null,
  isMovingSelection: false,
  moveOffset: null,
  isResizingSelection: false,
  resizeAnchor: null,
  resizeSigns: null
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

function getVideoDrawRect() {
  return fitRect(
    elements.video.videoWidth,
    elements.video.videoHeight,
    elements.originalCanvas.width,
    elements.originalCanvas.height
  );
}

function getSelectionAspectRatio() {
  if (!elements.lockCropAspect.checked || !state.sourceReady) {
    return null;
  }
  const targetRatio = parseRatio(elements.targetRatio.value);
  if (targetRatio) {
    return targetRatio;
  }
  return elements.video.videoWidth / elements.video.videoHeight;
}

function getSelectionHandles(selection) {
  return {
    nw: { x: selection.x, y: selection.y },
    ne: { x: selection.x + selection.width, y: selection.y },
    sw: { x: selection.x, y: selection.y + selection.height },
    se: { x: selection.x + selection.width, y: selection.y + selection.height }
  };
}

function buildSelectionFromAnchor(anchor, point, forcedSigns = null) {
  const xSign = forcedSigns?.x ?? (point.x >= anchor.x ? 1 : -1);
  const ySign = forcedSigns?.y ?? (point.y >= anchor.y ? 1 : -1);
  const minBase = 0.01;
  const targetAspect = getSelectionAspectRatio();

  const maxWidth = xSign > 0 ? 1 - anchor.x : anchor.x;
  const maxHeight = ySign > 0 ? 1 - anchor.y : anchor.y;

  let width = clamp(Math.abs(point.x - anchor.x), minBase, maxWidth);
  let height = clamp(Math.abs(point.y - anchor.y), minBase, maxHeight);

  if (targetAspect) {
    const minWidth = minBase;
    const minHeight = minBase;
    if (width / height > targetAspect) {
      width = height * targetAspect;
    } else {
      height = width / targetAspect;
    }

    if (width > maxWidth) {
      width = maxWidth;
      height = width / targetAspect;
    }
    if (height > maxHeight) {
      height = maxHeight;
      width = height * targetAspect;
    }

    width = clamp(width, Math.min(minWidth, maxWidth), maxWidth);
    height = clamp(height, Math.min(minHeight, maxHeight), maxHeight);
  }

  const targetX = anchor.x + xSign * width;
  const targetY = anchor.y + ySign * height;

  return {
    x: Math.min(anchor.x, targetX),
    y: Math.min(anchor.y, targetY),
    width: Math.max(minBase, Math.abs(targetX - anchor.x)),
    height: Math.max(minBase, Math.abs(targetY - anchor.y))
  };
}

function getHandleAtPoint(point, selection) {
  if (!selection || !state.sourceReady) {
    return null;
  }

  const drawRect = getVideoDrawRect();
  const thresholdX = 10 / drawRect.width;
  const thresholdY = 10 / drawRect.height;
  const handles = getSelectionHandles(selection);

  for (const [name, handle] of Object.entries(handles)) {
    if (
      Math.abs(point.x - handle.x) <= thresholdX &&
      Math.abs(point.y - handle.y) <= thresholdY
    ) {
      return name;
    }
  }
  return null;
}

function drawOriginalFrame() {
  const { width: dstW, height: dstH } = elements.originalCanvas;
  const drawRect = getVideoDrawRect();

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

    const handles = getSelectionHandles(state.selection);
    originalCtx.fillStyle = "#4dd6ff";
    for (const handle of Object.values(handles)) {
      const hx = drawRect.x + handle.x * drawRect.width;
      const hy = drawRect.y + handle.y * drawRect.height;
      originalCtx.fillRect(hx - 4, hy - 4, 8, 8);
    }
    originalCtx.restore();
  }

  if (state.isSelecting && state.selectStart && state.selectCurrent) {
    const preview = buildSelectionFromAnchor(state.selectStart, state.selectCurrent);
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
    x: ((event.clientX - rect.left) / rect.width) * elements.originalCanvas.width,
    y: ((event.clientY - rect.top) / rect.height) * elements.originalCanvas.height
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isPointInsideSelection(point, selection) {
  if (!selection) {
    return false;
  }
  return (
    point.x >= selection.x &&
    point.x <= selection.x + selection.width &&
    point.y >= selection.y &&
    point.y <= selection.y + selection.height
  );
}

function selectionPointFromEvent(event) {
  const canvasPoint = pointFromEvent(event);
  const drawRect = getVideoDrawRect();
  return pointToNormalized(canvasPoint.x, canvasPoint.y, drawRect);
}

async function ensurePlaybackAfterLoad() {
  try {
    await elements.video.play();
  } catch (_error) {
    // Some browsers block autoplay. User can still press Play.
  }
  updatePlaybackButton();
}

async function loadFromFile(file) {
  await player.loadFromFile(file);
  state.sourceReady = true;
  syncCanvasSizes();
  elements.playPauseBtn.disabled = false;
  elements.resetCropBtn.disabled = false;
  setStatus(`Video cargado: ${file.name}`);
  renderFrame();
  await ensurePlaybackAfterLoad();
}

async function loadFromUrl(url) {
  await player.loadFromUrl(url);
  state.sourceReady = true;
  syncCanvasSizes();
  elements.playPauseBtn.disabled = false;
  elements.resetCropBtn.disabled = false;
  setStatus(
    "Video URL cargado. Si la fuente no permite CORS, la vista pixelada puede fallar."
  );
  renderFrame();
  await ensurePlaybackAfterLoad();
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
elements.lockCropAspect.addEventListener("change", renderFrame);

elements.resetCropBtn.addEventListener("click", () => {
  state.selection = null;
  state.selectStart = null;
  state.selectCurrent = null;
  state.isSelecting = false;
  state.isMovingSelection = false;
  state.moveOffset = null;
  state.isResizingSelection = false;
  state.resizeAnchor = null;
  state.resizeSigns = null;
  renderFrame();
});

elements.originalCanvas.addEventListener("pointerdown", (event) => {
  if (!state.sourceReady || !elements.enableCrop.checked) {
    return;
  }
  const currentPoint = selectionPointFromEvent(event);
  const handle = getHandleAtPoint(currentPoint, state.selection);
  if (handle) {
    const xSign = handle.includes("e") ? 1 : -1;
    const ySign = handle.includes("s") ? 1 : -1;
    state.isResizingSelection = true;
    state.resizeSigns = { x: xSign, y: ySign };
    state.resizeAnchor = {
      x: xSign > 0 ? state.selection.x : state.selection.x + state.selection.width,
      y: ySign > 0 ? state.selection.y : state.selection.y + state.selection.height
    };
  } else if (isPointInsideSelection(currentPoint, state.selection)) {
    state.isMovingSelection = true;
    state.moveOffset = {
      x: currentPoint.x - state.selection.x,
      y: currentPoint.y - state.selection.y
    };
  } else {
    state.isSelecting = true;
    state.selectStart = currentPoint;
    state.selectCurrent = currentPoint;
  }
  elements.originalCanvas.setPointerCapture(event.pointerId);
});

elements.originalCanvas.addEventListener("pointermove", (event) => {
  if (!state.sourceReady || !elements.enableCrop.checked) {
    return;
  }
  const currentPoint = selectionPointFromEvent(event);

  if (state.isResizingSelection && state.resizeAnchor && state.resizeSigns) {
    state.selection = buildSelectionFromAnchor(
      state.resizeAnchor,
      currentPoint,
      state.resizeSigns
    );
    renderFrame();
    return;
  }

  if (state.isMovingSelection && state.selection && state.moveOffset) {
    const nextX = clamp(currentPoint.x - state.moveOffset.x, 0, 1 - state.selection.width);
    const nextY = clamp(currentPoint.y - state.moveOffset.y, 0, 1 - state.selection.height);
    state.selection = {
      ...state.selection,
      x: nextX,
      y: nextY
    };
    renderFrame();
    return;
  }

  if (!state.isSelecting || !state.selectStart) {
    return;
  }
  state.selectCurrent = currentPoint;
  renderFrame();
});

elements.originalCanvas.addEventListener("pointerup", (event) => {
  if (state.isResizingSelection) {
    state.isResizingSelection = false;
    state.resizeAnchor = null;
    state.resizeSigns = null;
    elements.originalCanvas.releasePointerCapture(event.pointerId);
    renderFrame();
    return;
  }

  if (state.isMovingSelection) {
    state.isMovingSelection = false;
    state.moveOffset = null;
    elements.originalCanvas.releasePointerCapture(event.pointerId);
    renderFrame();
    return;
  }

  if (!state.isSelecting || !state.selectStart || !state.selectCurrent) {
    return;
  }
  state.selection = buildSelectionFromAnchor(state.selectStart, state.selectCurrent);
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
  state.isMovingSelection = false;
  state.moveOffset = null;
  state.isResizingSelection = false;
  state.resizeAnchor = null;
  state.resizeSigns = null;
});

setStatus("Esperando video...");
loop();
