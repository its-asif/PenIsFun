if (!document.getElementById("draw-canvas")) {
  // === Setup canvas ===
  const canvas = document.createElement("canvas");
  canvas.id = "draw-canvas";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Load settings
  const settings = JSON.parse(localStorage.getItem("drawSettings")) || {
    penColor: "#ff0000",
    penWidth: 3,
    eraserSize: 10,
    erasing: false,
    darkMode: false
  };

  // === Drawing state ===
  let drawing = false;
  let penColor = settings.penColor;
  let penWidth = settings.penWidth;
  let eraserSize = settings.eraserSize;
  let erasing = settings.erasing;
  let darkMode = settings.darkMode;
  let minimized = false; // not persisted (can be added later)
  const drawingStorageKey = "drawImage:" + location.host + location.pathname; // per-page persistence key

  // === Toolbar container ===
  const toolbar = document.createElement("div");
  toolbar.id = "draw-toolbar";
  if (darkMode) toolbar.classList.add("dark");
  document.body.appendChild(toolbar);

  function saveSettings() {
    localStorage.setItem("drawSettings", JSON.stringify({
      penColor,
      penWidth,
      eraserSize,
      erasing,
      darkMode
    }));
  }

  // === Load any saved drawing ===
  (function restoreDrawing() {
    const dataURL = localStorage.getItem(drawingStorageKey);
    if (dataURL) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,0,0);
      };
      img.src = dataURL;
    }
  })();

  // === Debounced save of drawing ===
  let saveTimeout;
  function scheduleSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      try {
        const dataURL = canvas.toDataURL("image/png");
        localStorage.setItem(drawingStorageKey, dataURL);
      } catch (e) {
        // Fail silently if toDataURL is blocked
        console.warn("Draw extension: unable to save drawing", e);
      }
    }, 400); // save 400ms after last stroke update
  }

  // === Toolbar Templates ===
  function fullToolbarHTML() {
    return `
      <div class="panel">
        <label>🎨 <input type="color" id="penColor" value="${penColor}"></label>
        <label>✏️ <input type="range" id="penWidth" min="1" max="20" value="${penWidth}" title="Pen Size"></label>
        <label>🧽 <input type="range" id="eraserSize" min="5" max="50" value="${eraserSize}" title="Eraser Size"></label>
        <button id="darkmode">${darkMode ? "☀️ Light" : "🌙 Dark"}</button>
      </div>
      <div class="core">
      <button id="pen" title="Pen">✏️ Pen</button>
      <button id="eraser" title="Eraser">${erasing ? "🧽 Erasing" : "🧽 Eraser"}</button>
      <button id="clear" title="Clear Canvas">🗑️ Clear</button>
      <button id="exit" title="Exit Drawing">❌ Exit</button>
      <button id="minimize" title="Minimize">🔽</button>
      </div>`;
  }

  function miniToolbarHTML() {
    return `
      <div class="core">
      <button id="pen" title="Pen">${erasing ? "✏️" : "✏️*"}</button>
      <button id="eraser" title="Eraser">${erasing ? "🧽*" : "🧽"}</button>
      <button id="clear" title="Clear">🗑️</button>
      <button id="exit" title="Exit">❌</button>
      <button id="minimize" title="Expand">🔼</button>
      </div>`;
  }

  function renderToolbar() {
    toolbar.innerHTML = minimized ? miniToolbarHTML() : fullToolbarHTML();
    bindToolbarEvents();
  }

  function bindToolbarEvents() {
    const penBtn = document.getElementById("pen");
    const eraserBtn = document.getElementById("eraser");
    const minimizeBtn = document.getElementById("minimize");
    const clearBtn = document.getElementById("clear");
    const exitBtn = document.getElementById("exit");
    const colorInput = document.getElementById("penColor");
    const penWidthInput = document.getElementById("penWidth");
    const eraserSizeInput = document.getElementById("eraserSize");
    const darkModeBtn = document.getElementById("darkmode");

    if (colorInput) colorInput.addEventListener("input", (e) => { penColor = e.target.value; saveSettings(); });
    if (penWidthInput) penWidthInput.addEventListener("input", (e) => { penWidth = parseInt(e.target.value); saveSettings(); });
    if (eraserSizeInput) eraserSizeInput.addEventListener("input", (e) => { eraserSize = parseInt(e.target.value); saveSettings(); });
    if (darkModeBtn) darkModeBtn.addEventListener("click", () => {
      darkMode = !darkMode;
      toolbar.classList.toggle("dark", darkMode);
      saveSettings();
      renderToolbar(); // Refresh labels
    });

    penBtn.addEventListener("click", () => {
      erasing = false;
      removeEraserCursor();
      saveSettings();
      renderToolbar();
    });

    eraserBtn.addEventListener("click", () => {
      erasing = !erasing;
      if (!erasing) removeEraserCursor();
      saveSettings();
      renderToolbar();
    });

    clearBtn.addEventListener("click", () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      localStorage.removeItem(drawingStorageKey);
    });

    exitBtn.addEventListener("click", () => {
      canvas.remove();
      toolbar.remove();
      removeEraserCursor();
    });

    minimizeBtn.addEventListener("click", () => {
      // Capture current right edge before changing layout
      const rect = toolbar.getBoundingClientRect();
      const right = rect.right;
      minimized = !minimized;
      renderToolbar();
      // After re-render, compute new width and adjust left so right edge stays put
      const newWidth = toolbar.getBoundingClientRect().width;
      let newLeft = right - newWidth;
      if (newLeft < 0) newLeft = 0; // Clamp so it doesn't go off-screen
      toolbar.style.left = newLeft + "px";
    });
  }

  renderToolbar();

  // === Drawing logic ===
  function startDraw(e) {
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(e.clientX, e.clientY);
  }

  function draw(e) {
    if (!drawing) return;
    ctx.lineTo(e.clientX, e.clientY);
    ctx.lineCap = "round";
    if (erasing) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = eraserSize;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
    }
    ctx.stroke();
    if (erasing) showEraserCursor(e.clientX, e.clientY); else removeEraserCursor();
    scheduleSave();
  }

  function stopDraw() {
    drawing = false;
    ctx.beginPath();
    scheduleSave();
  }

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDraw);
  canvas.addEventListener("mouseleave", stopDraw);

  // === Eraser Cursor ===
  let cursorEl;
  function showEraserCursor(x, y) {
    if (!cursorEl) {
      cursorEl = document.createElement("div");
      cursorEl.style.position = "fixed";
      cursorEl.style.border = "2px solid black";
      cursorEl.style.borderRadius = "50%";
      cursorEl.style.pointerEvents = "none";
      cursorEl.style.zIndex = "1000000";
      document.body.appendChild(cursorEl);
    }
    cursorEl.style.width = eraserSize + "px";
    cursorEl.style.height = eraserSize + "px";
    cursorEl.style.left = (x - eraserSize / 2) + "px";
    cursorEl.style.top = (y - eraserSize / 2) + "px";
  }
  function removeEraserCursor() {
    if (cursorEl) { cursorEl.remove(); cursorEl = null; }
  }

  // === Make Toolbar Draggable ===
  let isDragging = false, offsetX = 0, offsetY = 0;
  toolbar.addEventListener("mousedown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") return;
    isDragging = true;
    offsetX = e.clientX - toolbar.offsetLeft;
    offsetY = e.clientY - toolbar.offsetTop;
  });
  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      toolbar.style.left = (e.clientX - offsetX) + "px";
      toolbar.style.top = (e.clientY - offsetY) + "px";
    }
  });
  document.addEventListener("mouseup", () => { isDragging = false; });
}
