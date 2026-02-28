export function createPlayer(videoElement) {
  let objectUrl = null;
  videoElement.loop = true;

  function clearSource() {
    videoElement.pause();
    videoElement.removeAttribute("src");
    videoElement.removeAttribute("crossorigin");
    videoElement.load();
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function waitForMetadata(timeoutMs = 15000) {
    if (videoElement.readyState >= 1) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      let timeoutId = null;

      function onLoaded() {
        cleanup();
        resolve();
      }

      function onError() {
        cleanup();
        reject(new Error("No se pudo cargar el video."));
      }

      function onTimeout() {
        cleanup();
        reject(
          new Error(
            "Timeout cargando el video. Revisá la URL, CORS o que el servidor permita range requests."
          )
        );
      }

      function cleanup() {
        videoElement.removeEventListener("loadedmetadata", onLoaded);
        videoElement.removeEventListener("error", onError);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }

      videoElement.addEventListener("loadedmetadata", onLoaded);
      videoElement.addEventListener("error", onError);
      timeoutId = setTimeout(onTimeout, timeoutMs);
    });
  }

  async function loadFromFile(file) {
    if (!file) {
      throw new Error("No se seleccionó archivo.");
    }
    clearSource();
    const metadataPromise = waitForMetadata();
    objectUrl = URL.createObjectURL(file);
    videoElement.src = objectUrl;
    videoElement.load();
    await metadataPromise;
  }

  async function loadFromUrl(url) {
    if (!url) {
      throw new Error("Ingresá una URL.");
    }
    clearSource();
    const metadataPromise = waitForMetadata();
    videoElement.src = url;
    videoElement.load();
    await metadataPromise;
  }

  function playPause() {
    if (videoElement.paused) {
      return videoElement.play();
    }
    videoElement.pause();
    return Promise.resolve();
  }

  return {
    loadFromFile,
    loadFromUrl,
    playPause,
    clearSource
  };
}
