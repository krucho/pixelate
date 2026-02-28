export function createPlayer(videoElement) {
  let objectUrl = null;

  function clearSource() {
    videoElement.pause();
    videoElement.removeAttribute("src");
    videoElement.load();
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function waitForMetadata() {
    return new Promise((resolve, reject) => {
      function onLoaded() {
        cleanup();
        resolve();
      }

      function onError() {
        cleanup();
        reject(new Error("No se pudo cargar el video."));
      }

      function cleanup() {
        videoElement.removeEventListener("loadedmetadata", onLoaded);
        videoElement.removeEventListener("error", onError);
      }

      videoElement.addEventListener("loadedmetadata", onLoaded);
      videoElement.addEventListener("error", onError);
    });
  }

  async function loadFromFile(file) {
    if (!file) {
      throw new Error("No se seleccionó archivo.");
    }
    clearSource();
    objectUrl = URL.createObjectURL(file);
    videoElement.src = objectUrl;
    await waitForMetadata();
  }

  async function loadFromUrl(url) {
    if (!url) {
      throw new Error("Ingresá una URL.");
    }
    clearSource();
    videoElement.crossOrigin = "anonymous";
    videoElement.src = url;
    await waitForMetadata();
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
