const MIN_SIZE = 2;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function parseRatio(value) {
  if (!value || value === "original") {
    return null;
  }

  const [w, h] = value.split(":").map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return null;
  }
  return w / h;
}

export function fitRect(srcWidth, srcHeight, dstWidth, dstHeight) {
  const srcAspect = srcWidth / srcHeight;
  const dstAspect = dstWidth / dstHeight;

  let width;
  let height;
  if (srcAspect > dstAspect) {
    width = dstWidth;
    height = width / srcAspect;
  } else {
    height = dstHeight;
    width = height * srcAspect;
  }

  return {
    x: (dstWidth - width) / 2,
    y: (dstHeight - height) / 2,
    width,
    height
  };
}

export function toSourceRect(selection, sourceWidth, sourceHeight) {
  if (!selection) {
    return null;
  }

  return {
    x: clamp(selection.x, 0, 1) * sourceWidth,
    y: clamp(selection.y, 0, 1) * sourceHeight,
    width: clamp(selection.width, 0, 1) * sourceWidth,
    height: clamp(selection.height, 0, 1) * sourceHeight
  };
}

export function normalizeSelection(startNormPoint, endNormPoint) {
  const left = clamp(Math.min(startNormPoint.x, endNormPoint.x), 0, 1);
  const top = clamp(Math.min(startNormPoint.y, endNormPoint.y), 0, 1);
  const right = clamp(Math.max(startNormPoint.x, endNormPoint.x), 0, 1);
  const bottom = clamp(Math.max(startNormPoint.y, endNormPoint.y), 0, 1);

  return {
    x: left,
    y: top,
    width: Math.max(MIN_SIZE / 4096, right - left),
    height: Math.max(MIN_SIZE / 4096, bottom - top)
  };
}

export function pointToNormalized(pointX, pointY, drawRect) {
  return {
    x: clamp((pointX - drawRect.x) / drawRect.width, 0, 1),
    y: clamp((pointY - drawRect.y) / drawRect.height, 0, 1)
  };
}

export function coverToAspect(baseRect, targetAspect) {
  if (!targetAspect) {
    return { ...baseRect };
  }

  const baseAspect = baseRect.width / baseRect.height;
  if (Math.abs(baseAspect - targetAspect) < 1e-6) {
    return { ...baseRect };
  }

  if (baseAspect > targetAspect) {
    const nextWidth = baseRect.height * targetAspect;
    return {
      x: baseRect.x + (baseRect.width - nextWidth) / 2,
      y: baseRect.y,
      width: nextWidth,
      height: baseRect.height
    };
  }

  const nextHeight = baseRect.width / targetAspect;
  return {
    x: baseRect.x,
    y: baseRect.y + (baseRect.height - nextHeight) / 2,
    width: baseRect.width,
    height: nextHeight
  };
}

export function computeOutputSize(videoWidth, videoHeight, targetAspect, targetLongSide = 560) {
  const ratio = targetAspect ?? videoWidth / videoHeight;
  if (ratio >= 1) {
    return {
      width: Math.round(targetLongSide),
      height: Math.round(targetLongSide / ratio)
    };
  }
  return {
    width: Math.round(targetLongSide * ratio),
    height: Math.round(targetLongSide)
  };
}
