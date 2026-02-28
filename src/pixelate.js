import { coverToAspect, fitRect } from "./crop.js";

function clearCanvas(ctx) {
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

function drawGrid(ctx, cols, rows) {
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.24)";
  ctx.lineWidth = 1;
  for (let c = 1; c < cols; c += 1) {
    const x = Math.round((c * width) / cols) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let r = 1; r < rows; r += 1) {
    const y = Math.round((r * height) / rows) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

export function renderPixelatedFrame(options) {
  const {
    video,
    pixelCtx,
    lowResCtx,
    cols,
    rows,
    baseSourceRect,
    targetAspect,
    aspectMode,
    showGrid
  } = options;

  lowResCtx.canvas.width = Math.max(2, cols);
  lowResCtx.canvas.height = Math.max(2, rows);
  lowResCtx.imageSmoothingEnabled = false;

  clearCanvas(lowResCtx);

  const sourceRect =
    aspectMode === "fill" && targetAspect
      ? coverToAspect(baseSourceRect, targetAspect)
      : { ...baseSourceRect };

  if (aspectMode === "fit") {
    const targetRect = fitRect(
      sourceRect.width,
      sourceRect.height,
      lowResCtx.canvas.width,
      lowResCtx.canvas.height
    );
    lowResCtx.drawImage(
      video,
      sourceRect.x,
      sourceRect.y,
      sourceRect.width,
      sourceRect.height,
      targetRect.x,
      targetRect.y,
      targetRect.width,
      targetRect.height
    );
  } else {
    lowResCtx.drawImage(
      video,
      sourceRect.x,
      sourceRect.y,
      sourceRect.width,
      sourceRect.height,
      0,
      0,
      lowResCtx.canvas.width,
      lowResCtx.canvas.height
    );
  }

  pixelCtx.imageSmoothingEnabled = false;
  clearCanvas(pixelCtx);
  pixelCtx.drawImage(
    lowResCtx.canvas,
    0,
    0,
    lowResCtx.canvas.width,
    lowResCtx.canvas.height,
    0,
    0,
    pixelCtx.canvas.width,
    pixelCtx.canvas.height
  );

  if (showGrid) {
    drawGrid(pixelCtx, cols, rows);
  }
}
