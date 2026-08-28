console.log("Mohammad Universe v2 loaded");

document.addEventListener("DOMContentLoaded", function () {
  const introScene = document.getElementById("introScene");
  const transitionScene = document.getElementById("transitionScene");
  const skyScene = document.getElementById("skyScene");
  const transitionCopy = document.getElementById("transitionCopy");
  const enterUniverseBtn = document.getElementById("enterUniverseBtn");
  const revealMusicBtn = document.getElementById("revealMusicBtn");
  const skySurprise = document.getElementById("skySurprise");
  const musicPanel = document.getElementById("musicPanel");
  const closeMusicBtn = document.getElementById("closeMusicBtn");

  const mainSong = document.getElementById("mainSong");
  const playSongBtn = document.getElementById("playSongBtn");
  const songProgress = document.getElementById("songProgress");
  const currentTimeEl = document.getElementById("currentTime");
  const durationEl = document.getElementById("duration");

  createStars(document.querySelector(".intro-stars"), 120, "white");
  createStars(document.querySelector(".transition-stars"), 80, "white");
  createStars(document.querySelector(".dynamic-stars"), 72, "orange");

  let ambient = null;
  let ambientPermanentlyStopped = false;
  let audioGraphReady = false;
  let analyser = null;
  let audioContext = null;
  let sourceNode = null;
  let reactionFrame = null;

  enterUniverseBtn.addEventListener("click", async function () {
    // A user gesture is available here, so initialise/resume Web Audio now.
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") {
      try { await audioContext.resume(); } catch (e) {}
    }

    switchScene(introScene, transitionScene);

    await runCinematicPhrase([
      "On the night",
      "you were born..."
    ]);

    await pause(520);

    await runCinematicPhrase([
      "the universe",
      "painted a sky",
      "like this."
    ]);

    await pause(650);
    switchScene(transitionScene, skyScene);

    await pause(500);
    if (!ambientPermanentlyStopped) {
      ambient = startAmbientSpaceSound(audioContext);
    }

    await pause(3200);
    skySurprise.classList.add("visible");
  });

  revealMusicBtn.addEventListener("click", function () {
    musicPanel.classList.add("open");
  });

  closeMusicBtn.addEventListener("click", function () {
    musicPanel.classList.remove("open");
  });

  playSongBtn.addEventListener("click", async function () {
    if (mainSong.paused) {
      if (!ambientPermanentlyStopped) {
        ambientPermanentlyStopped = true;
        if (ambient) ambient.fadeOutAndStop(1.3);
      }

      try {
        await setupSongAudioGraph();
        await mainSong.play();
        playSongBtn.textContent = "❚❚";
        startMusicReaction();
      } catch (error) {
        console.error("Could not play main song:", error);
      }
    } else {
      mainSong.pause();
      playSongBtn.textContent = "▶";
    }
  });

  mainSong.addEventListener("loadedmetadata", function () {
    durationEl.textContent = formatTime(mainSong.duration);
  });

  mainSong.addEventListener("timeupdate", function () {
    if (!mainSong.duration) return;
    songProgress.value = (mainSong.currentTime / mainSong.duration) * 100;
    currentTimeEl.textContent = formatTime(mainSong.currentTime);
  });

  mainSong.addEventListener("ended", function () {
    playSongBtn.textContent = "▶";
    songProgress.value = 0;
    document.documentElement.style.setProperty("--bass-scale", "1");
    document.documentElement.style.setProperty("--bass-glow", ".32");
  });

  songProgress.addEventListener("input", function () {
    if (!mainSong.duration) return;
    mainSong.currentTime = (Number(songProgress.value) / 100) * mainSong.duration;
  });

  async function setupSongAudioGraph() {
    if (audioGraphReady) return;
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") await audioContext.resume();

    sourceNode = audioContext.createMediaElementSource(mainSong);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;

    sourceNode.connect(analyser);
    analyser.connect(audioContext.destination);
    audioGraphReady = true;
  }

  function startMusicReaction() {
    if (!analyser || reactionFrame) return;
    const bins = new Uint8Array(analyser.frequencyBinCount);

    function frame() {
      analyser.getByteFrequencyData(bins);

      // Low-frequency average (bass). Subtle on purpose.
      let sum = 0;
      const end = Math.min(18, bins.length);
      for (let i = 1; i < end; i++) sum += bins[i];
      const bass = sum / ((end - 1) * 255);

      const scale = 1 + bass * 0.008;
      const glow = 0.28 + bass * 0.72;

      document.documentElement.style.setProperty("--bass-scale", scale.toFixed(4));
      document.documentElement.style.setProperty("--bass-glow", glow.toFixed(3));

      reactionFrame = requestAnimationFrame(frame);
    }

    frame();
  }

  async function runCinematicPhrase(lines) {
    transitionCopy.className = "transition-copy";
    transitionCopy.innerHTML = "";

    lines.forEach(function (line) {
      const el = document.createElement("div");
      el.className = "transition-line";
      el.textContent = line;
      transitionCopy.appendChild(el);
    });

    const lineEls = Array.from(transitionCopy.querySelectorAll(".transition-line"));

    for (let i = 0; i < lineEls.length; i++) {
      lineEls[i].classList.add("show");
      await pause(720);
    }

    await pause(1000);
    transitionCopy.classList.add("fade-out");
    await pause(900);
  }

  function switchScene(from, to) {
    from.classList.remove("active");
    to.classList.add("active");
  }
});

function createStars(container, count, tone) {
  if (!container) return;
  for (let i = 0; i < count; i++) {
    const star = document.createElement("span");
    star.className = "star";

    const size = Math.random() * 2.7 + .7;
    star.style.width = size + "px";
    star.style.height = size + "px";
    star.style.left = (Math.random() * 100) + "%";
    star.style.top = (Math.random() * 100) + "%";
    star.style.animationDelay = (Math.random() * 3) + "s";
    star.style.animationDuration = (2.3 + Math.random() * 2.2) + "s";

    if (tone === "orange") {
      star.style.opacity = (.28 + Math.random() * .55).toFixed(2);
    }

    container.appendChild(star);
  }
}

function startAmbientSpaceSound(ctx) {
  if (!ctx) return null;

  const master = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();

  filter.type = "lowpass";
  filter.frequency.value = 520;
  filter.Q.value = .7;

  osc1.type = "sine";
  osc2.type = "triangle";
  osc1.frequency.value = 73.42;  // D2-ish
  osc2.frequency.value = 110.0;  // A2

  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 2.2);

  lfo.type = "sine";
  lfo.frequency.value = .11;
  lfoGain.gain.value = 0.009;
  lfo.connect(lfoGain);
  lfoGain.connect(master.gain);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(master);
  master.connect(ctx.destination);

  osc1.start();
  osc2.start();
  lfo.start();

  return {
    fadeOutAndStop: function (seconds) {
      const now = ctx.currentTime;
      const end = now + seconds;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
      master.gain.exponentialRampToValueAtTime(0.0001, end);
      setTimeout(function () {
        try { osc1.stop(); } catch (e) {}
        try { osc2.stop(); } catch (e) {}
        try { lfo.stop(); } catch (e) {}
        try { master.disconnect(); } catch (e) {}
      }, seconds * 1000 + 100);
    }
  };
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return mins + ":" + secs;
}

function pause(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}
