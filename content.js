if (!document.getElementById("draw-canvas")) {
  // === Setup canvas ===
  const canvas = document.createElement("canvas");
  canvas.id = "draw-canvas";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  // === Off-screen canvas for Highlighter compositing ===
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");

  // === Vector Engine State ===
  let drawingElements = [];
  let legacyImage = null;

  function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw legacy raster background if present
    if (legacyImage && legacyImage.complete && legacyImage.naturalWidth > 0) {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1.0;
      ctx.drawImage(legacyImage, 0, 0);
    }

    // 2. Render vector elements in order
    drawingElements.forEach((element) => {
      ctx.beginPath();
      
      if (element.type === "pen") {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = element.color;
        ctx.lineWidth = element.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        
        const pts = element.points;
        if (pts && pts.length > 0) {
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
        }
      } else if (element.type === "highlighter") {
        // Render highlighter using off-screen buffer to preserve uniform opacity
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.beginPath();
        tempCtx.lineCap = "round";
        tempCtx.lineJoin = "round";
        tempCtx.strokeStyle = element.color;
        tempCtx.lineWidth = element.width;
        
        const pts = element.points;
        if (pts && pts.length > 0) {
          tempCtx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            tempCtx.lineTo(pts[i].x, pts[i].y);
          }
          tempCtx.stroke();
        }
        
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.4;
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.globalAlpha = 1.0;
      } else if (element.type === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.globalAlpha = 1.0;
        ctx.lineWidth = element.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        
        const pts = element.points;
        if (pts && pts.length > 0) {
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
        }
      } else if (element.type === "line") {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = element.color;
        ctx.lineWidth = element.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(element.sx, element.sy);
        ctx.lineTo(element.ex, element.ey);
        ctx.stroke();
      } else if (element.type === "arrow") {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = element.color;
        ctx.lineWidth = element.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        // Shaft
        ctx.moveTo(element.sx, element.sy);
        ctx.lineTo(element.ex, element.ey);
        ctx.stroke();
        
        // Arrowhead
        const angle = Math.atan2(element.ey - element.sy, element.ex - element.sx);
        const headLength = Math.max(10, element.width * 3);
        ctx.beginPath();
        ctx.moveTo(element.ex, element.ey);
        ctx.lineTo(element.ex - headLength * Math.cos(angle - Math.PI / 6), element.ey - headLength * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(element.ex, element.ey);
        ctx.lineTo(element.ex - headLength * Math.cos(angle + Math.PI / 6), element.ey - headLength * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      } else if (element.type === "rect") {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = element.color;
        ctx.lineWidth = element.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.rect(element.sx, element.sy, element.ex - element.sx, element.ey - element.sy);
        ctx.stroke();
      } else if (element.type === "circle") {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = element.color;
        ctx.lineWidth = element.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const rx = Math.abs(element.ex - element.sx) / 2;
        const ry = Math.abs(element.ey - element.sy) / 2;
        const cx = element.sx + (element.ex - element.sx) / 2;
        const cy = element.sy + (element.ey - element.sy) / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (element.type === "text") {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = element.color;
        ctx.font = `600 ${element.fontSize}px sans-serif`;
        ctx.textBaseline = "middle";
        ctx.fillText(element.text, element.x + 6, element.y);
      }
    });
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Sync tempCanvas size
    tempCanvas.width = window.innerWidth;
    tempCanvas.height = window.innerHeight;

    redrawCanvas();
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Load settings
  const rawSettings = localStorage.getItem("drawSettings");
  let settings = {
    penColor: "#ff0000",
    penWidth: 3,
    eraserSize: 10,
    highlighterSize: 15,
    currentTool: "pen",
    darkMode: false
  };
  try {
    if (rawSettings) {
      const parsed = JSON.parse(rawSettings);
      if (parsed) {
        // Migrate legacy erasing setting to currentTool
        if (parsed.erasing) {
          parsed.currentTool = "eraser";
          delete parsed.erasing;
        }
        settings = { ...settings, ...parsed };
      }
    }
  } catch (e) {
    // Ignore syntax errors
  }

  // === Drawing state ===
  let drawing = false;
  let penColor = settings.penColor;
  let penWidth = settings.penWidth;
  let eraserSize = settings.eraserSize;
  let highlighterSize = settings.highlighterSize || 15;
  let currentTool = settings.currentTool || "pen";
  let darkMode = settings.darkMode;
  let minimized = false;
  
  // Segment-drawing coordinates
  let lastX = 0;
  let lastY = 0;

  // Shape-drawing intermediate state
  let shapeStart = null;
  let cachedImageData = null;
  let currentElement = null;
  
  // Text-drawing active input element reference
  let activeTextInput = null;

  // Click tracking
  let startClickX = 0;
  let startClickY = 0;

  const drawingStorageKey = "drawImage:" + location.host + location.pathname;
  const storageAvailable = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;

  // === Shortcuts Configuration ===
  const defaultShortcuts = {
    pen: "Alt+1",
    highlighter: "Alt+2",
    eraser: "Alt+3",
    line: "Alt+4",
    arrow: "Alt+5",
    rect: "Alt+6",
    circle: "Alt+7",
    text: "Alt+8",
    undo: "Ctrl+Z",
    redo: "Ctrl+Y",
    clear: "Ctrl+X"
  };
  let shortcuts = { ...defaultShortcuts };

  if (storageAvailable) {
    chrome.storage.local.get(["drawShortcuts"], (result) => {
      if (result && result.drawShortcuts) {
        shortcuts = { ...defaultShortcuts, ...result.drawShortcuts };
      }
    });

    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && changes.drawShortcuts) {
          shortcuts = { ...defaultShortcuts, ...changes.drawShortcuts.newValue };
        }
      });
    }
  }

  function readLegacyDrawing() {
    try {
      return localStorage.getItem(drawingStorageKey);
    } catch (e) {
      return null;
    }
  }

  function loadDrawingData(callback) {
    if (!storageAvailable) {
      callback(readLegacyDrawing());
      return;
    }
    chrome.storage.local.get([drawingStorageKey], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        console.warn("Draw extension: unable to load drawing", chrome.runtime.lastError);
        callback(readLegacyDrawing());
        return;
      }
      const stored = result[drawingStorageKey];
      if (stored) {
        callback(stored);
      } else {
        const legacy = readLegacyDrawing();
        if (legacy) {
          chrome.storage.local.set({ [drawingStorageKey]: legacy }, () => {
            if (chrome.runtime && chrome.runtime.lastError) {
              console.warn("Draw extension: unable to migrate drawing", chrome.runtime.lastError);
            } else {
              try { localStorage.removeItem(drawingStorageKey); } catch (e) { /* ignore */ }
            }
          });
        }
        callback(legacy);
      }
    });
  }

  // === Undo stack (serialized states snapshots) ===
  const UNDO_LIMIT = 25;
  const undoStack = [];
  const redoStack = [];

  function pushUndoSnapshot() {
    try {
      const snapshot = JSON.stringify(drawingElements);
      undoStack.push(snapshot);
      if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    } catch (e) {
      // Ignore snapshot failures
    }
  }

  function pushRedoSnapshot() {
    try {
      const snapshot = JSON.stringify(drawingElements);
      redoStack.push(snapshot);
      if (redoStack.length > UNDO_LIMIT) redoStack.shift();
    } catch (e) {
      // Ignore snapshot failures
    }
  }

  function clearRedoStack() {
    redoStack.length = 0;
  }

  function undoLast() {
    if (undoStack.length === 0) return;
    pushRedoSnapshot();
    const prev = JSON.parse(undoStack.pop());
    drawingElements = prev;
    updateUndoRedoButtons();
    redrawCanvas();
    scheduleSave();
  }

  function redoNext() {
    if (redoStack.length === 0) return;
    pushUndoSnapshot();
    const next = JSON.parse(redoStack.pop());
    drawingElements = next;
    updateUndoRedoButtons();
    redrawCanvas();
    scheduleSave();
  }

  function saveDrawingData(dataURL) {
    if (!dataURL) return;
    if (storageAvailable) {
      chrome.storage.local.set({ [drawingStorageKey]: dataURL }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.warn("Draw extension: unable to save drawing", chrome.runtime.lastError);
        } else {
          try { localStorage.removeItem(drawingStorageKey); } catch (e) { /* ignore */ }
        }
      });
    } else {
      try {
        localStorage.setItem(drawingStorageKey, dataURL);
      } catch (e) {
        console.warn("Draw extension: unable to save drawing", e);
      }
    }
  }

  function removeDrawingData() {
    if (storageAvailable) {
      chrome.storage.local.remove(drawingStorageKey, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.warn("Draw extension: unable to remove drawing", chrome.runtime.lastError);
        }
      });
    }
    try {
      localStorage.removeItem(drawingStorageKey);
    } catch (e) {
      /* ignore */
    }
  }

  // === Shadow DOM Encapsulated Toolbar Container ===
  const host = document.createElement("div");
  host.id = "draw-toolbar-host";
  document.body.appendChild(host);
  const shadowRoot = host.attachShadow({ mode: "open" });

  const toolbar = document.createElement("div");
  toolbar.id = "draw-toolbar";
  shadowRoot.appendChild(toolbar);

  function saveSettings() {
    localStorage.setItem("drawSettings", JSON.stringify({
      penColor,
      penWidth,
      eraserSize,
      highlighterSize,
      currentTool,
      darkMode
    }));
  }

  // === Load saved drawing ===
  (function restoreDrawing() {
    loadDrawingData((storedData) => {
      if (!storedData) return;
      
      try {
        const parsed = JSON.parse(storedData);
        if (parsed && parsed.version === "vector-v1") {
          drawingElements = parsed.elements || [];
          if (parsed.legacyDataURL) {
            const img = new Image();
            img.onload = () => {
              legacyImage = img;
              redrawCanvas();
            };
            img.src = parsed.legacyDataURL;
          } else {
            redrawCanvas();
          }
          return;
        }
      } catch (e) {
        // Not JSON - legacy drawing format
      }

      // Load legacy drawing
      const img = new Image();
      img.onload = () => {
        legacyImage = img;
        redrawCanvas();
      };
      img.src = storedData;
    });
  })();

  // === Debounced save ===
  let saveTimeout;
  function scheduleSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      const serialized = JSON.stringify({
        version: "vector-v1",
        legacyDataURL: legacyImage ? legacyImage.src : null,
        elements: drawingElements
      });
      saveDrawingData(serialized);
    }, 400);
  }

  // === Premium Glassmorphic Styles ===
  const toolbarStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&display=swap');

    :host {
      all: initial;
    }

    #draw-toolbar {
      position: fixed;
      top: 20px;
      left: 25%;
      z-index: 999999;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(12px) saturate(180%);
      -webkit-backdrop-filter: blur(12px) saturate(180%);
      color: #f8fafc;
      padding: 8px 12px;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5), 
                  0 1px 1px 0 rgba(255, 255, 255, 0.05) inset;
      display: flex;
      gap: 8px;
      align-items: center;
      font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
      cursor: move;
      user-select: none;
      transition: background 0.3s, border-color 0.3s;
    }

    #draw-toolbar.dark {
      background: rgba(9, 9, 11, 0.92);
      border-color: rgba(255, 255, 255, 0.05);
    }

    #draw-toolbar.minimized {
      padding: 6px 8px;
    }

    #draw-toolbar button {
      padding: 6px 10px;
      font-size: 13px;
      font-weight: 500;
      background: rgba(255, 255, 255, 0.06);
      color: #f1f5f9;
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    #draw-toolbar button:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.1);
      transform: translateY(-1px);
    }

    #draw-toolbar button:active:not(:disabled) {
      transform: translateY(0);
      background: rgba(255, 255, 255, 0.04);
    }

    #draw-toolbar button:disabled {
      opacity: 0.25;
      cursor: not-allowed;
    }

    #draw-toolbar button.active {
      background: #10b981;
      color: white;
      border-color: rgba(255, 255, 255, 0.1);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    #draw-toolbar input[type="range"] {
      -webkit-appearance: none;
      appearance: none;
      width: 70px;
      background: rgba(255, 255, 255, 0.12);
      height: 4px;
      border-radius: 999px;
      outline: none;
      cursor: pointer;
    }

    #draw-toolbar input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #3b82f6;
      border: 1px solid rgba(255, 255, 255, 0.2);
      transition: transform 0.1s ease, background-color 0.2s;
    }

    #draw-toolbar input[type="range"]::-webkit-slider-thumb:hover {
      transform: scale(1.3);
      background: #60a5fa;
    }

    #draw-toolbar input[type="color"] {
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: none;
      padding: 0;
      cursor: pointer;
      background: none;
      outline: none;
    }

    #draw-toolbar input[type="color"]::-webkit-color-swatch-wrapper {
      padding: 0;
    }

    #draw-toolbar input[type="color"]::-webkit-color-swatch {
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    #draw-toolbar .panel {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    #draw-toolbar.minimized .panel {
      display: none;
    }

    #draw-toolbar .tools-group {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    #draw-toolbar.minimized .tools-group {
      display: none;
    }

    #draw-toolbar .divider {
      width: 1px;
      height: 20px;
      background: rgba(255, 255, 255, 0.15);
      margin: 0 4px;
    }

    #draw-toolbar.minimized .divider {
      margin: 0 2px;
    }

    #draw-toolbar .core {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    #draw-toolbar.minimized {
      gap: 4px;
    }

    #draw-toolbar label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #cbd5e1;
    }
  `;

  // === SVG Vector Icons ===
  const penSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
  const highlighterSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 11.5 6 6M16.5 7 11 12.5M20 5l-2.5-2.5-3.5 3.5 6 6Z"/><path d="m8.5 10-5.5 5.5V21h5.5l5.5-5.5Z"/></svg>`;
  const eraserSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21Z"/><path d="m22 21-11.75 0"/><path d="m14 11-4 4"/></svg>`;
  const lineSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="19" x2="19" y2="5"/></svg>`;
  const arrowSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="19 11 19 5 13 5"/></svg>`;
  const rectSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
  const circleSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;
  const textSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`;
  
  const trashSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
  const exitSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const undoSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`;
  const redoSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>`;
  const sunSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
  const moonSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
  
  const minimizeSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`;
  const expandSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;
  const settingsSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

  function fullToolbarHTML() {
    let minSize = 1;
    let maxSize = 30;
    let currentVal = penWidth;
    let labelTitle = `Pen size: ${penWidth}px`;

    if (currentTool === "eraser") {
      minSize = 5;
      maxSize = 100;
      currentVal = eraserSize;
      labelTitle = `Eraser size: ${eraserSize}px`;
    } else if (currentTool === "highlighter") {
      minSize = 5;
      maxSize = 50;
      currentVal = highlighterSize;
      labelTitle = `Highlighter size: ${highlighterSize}px`;
    }

    return `
      <style>
        ${toolbarStyles}
      </style>
      <div id="draw-toolbar" class="${darkMode ? 'dark' : ''}">
        <div class="panel">
          <label title="Color Picker">
            <input type="color" id="penColor" value="${penColor}">
          </label>
          <label title="${labelTitle}">
            <span style="font-size: 11px; margin-right: 2px;">↕️</span>
            <input type="range" id="toolSize" min="${minSize}" max="${maxSize}" value="${currentVal}">
          </label>
          <button id="darkmode" title="Toggle Theme">
            ${darkMode ? sunSvg : moonSvg}
          </button>
        </div>
        
        <div class="divider"></div>

        <div class="tools-group">
          <button id="tool-pen" class="${currentTool === 'pen' ? 'active' : ''}" title="Pen Tool">
            ${penSvg}
          </button>
          <button id="tool-highlighter" class="${currentTool === 'highlighter' ? 'active' : ''}" title="Highlighter Tool">
            ${highlighterSvg}
          </button>
          <button id="tool-eraser" class="${currentTool === 'eraser' ? 'active' : ''}" title="Eraser Tool">
            ${eraserSvg}
          </button>
          <button id="tool-line" class="${currentTool === 'line' ? 'active' : ''}" title="Straight Line Tool">
            ${lineSvg}
          </button>
          <button id="tool-arrow" class="${currentTool === 'arrow' ? 'active' : ''}" title="Arrow Annotation Tool">
            ${arrowSvg}
          </button>
          <button id="tool-rect" class="${currentTool === 'rect' ? 'active' : ''}" title="Rectangle Shape Tool">
            ${rectSvg}
          </button>
          <button id="tool-circle" class="${currentTool === 'circle' ? 'active' : ''}" title="Circle/Ellipse Shape Tool">
            ${circleSvg}
          </button>
          <button id="tool-text" class="${currentTool === 'text' ? 'active' : ''}" title="Text Annotation Tool">
            ${textSvg}
          </button>
        </div>

        <div class="divider"></div>

        <div class="core">
          <button id="undo" title="Undo">
            ${undoSvg}
          </button>
          <button id="redo" title="Redo">
            ${redoSvg}
          </button>
          <button id="clear" title="Clear Canvas">
            ${trashSvg}
          </button>
          <button id="settings" title="Settings (Keyboard Shortcuts & Saved Drawings)">
            ${settingsSvg}
          </button>
          <button id="exit" title="Exit Drawing">
            ${exitSvg}
          </button>
          <button id="minimize" title="Minimize">
            ${minimizeSvg}
          </button>
        </div>
      </div>`;
  }

  function miniToolbarHTML() {
    return `
      <style>
        ${toolbarStyles}
      </style>
      <div id="draw-toolbar" class="minimized ${darkMode ? 'dark' : ''}">
        <div class="core">
          <button id="tool-pen-mini" class="${currentTool === 'pen' ? 'active' : ''}" title="Pen Tool">
            ${penSvg}
          </button>
          <button id="tool-eraser-mini" class="${currentTool === 'eraser' ? 'active' : ''}" title="Eraser Tool">
            ${eraserSvg}
          </button>
          <div class="divider"></div>
          <button id="undo" title="Undo">
            ${undoSvg}
          </button>
          <button id="redo" title="Redo">
            ${redoSvg}
          </button>
          <button id="clear" title="Clear">
            ${trashSvg}
          </button>
          <button id="settings" title="Settings">
            ${settingsSvg}
          </button>
          <button id="exit" title="Exit">
            ${exitSvg}
          </button>
          <button id="minimize" title="Expand">
            ${expandSvg}
          </button>
        </div>
      </div>`;
  }

  function updateUndoRedoButtons() {
    const undoBtn = shadowRoot.getElementById("undo");
    const redoBtn = shadowRoot.getElementById("redo");
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
  }

  function renderToolbar() {
    toolbar.innerHTML = minimized ? miniToolbarHTML() : fullToolbarHTML();
    bindToolbarEvents();
  }

  function selectTool(tool) {
    if (activeTextInput) activeTextInput.blur();
    currentTool = tool;
    removeEraserCursor();
    saveSettings();
    renderToolbar();
  }

  function clearCanvas() {
    pushUndoSnapshot();
    clearRedoStack();
    drawingElements = [];
    legacyImage = null; // Clear migrated raster image
    updateUndoRedoButtons();
    redrawCanvas();
    removeDrawingData();
  }

  function bindToolbarEvents() {
    const minimizeBtn = shadowRoot.getElementById("minimize");
    const clearBtn = shadowRoot.getElementById("clear");
    const exitBtn = shadowRoot.getElementById("exit");
    const undoBtn = shadowRoot.getElementById("undo");
    const redoBtn = shadowRoot.getElementById("redo");
    const settingsBtn = shadowRoot.getElementById("settings");

    const colorInput = shadowRoot.getElementById("penColor");
    const sizeInput = shadowRoot.getElementById("toolSize");
    const darkModeBtn = shadowRoot.getElementById("darkmode");

    const penMini = shadowRoot.getElementById("tool-pen-mini");
    const eraserMini = shadowRoot.getElementById("tool-eraser-mini");

    if (colorInput) {
      colorInput.addEventListener("input", (e) => {
        penColor = e.target.value;
        saveSettings();
      });
    }
    if (sizeInput) {
      sizeInput.addEventListener("input", (e) => {
        const val = parseInt(e.target.value);
        if (currentTool === "eraser") {
          eraserSize = val;
          sizeInput.parentElement.setAttribute("title", `Eraser size: ${eraserSize}px`);
        } else if (currentTool === "highlighter") {
          highlighterSize = val;
          sizeInput.parentElement.setAttribute("title", `Highlighter size: ${highlighterSize}px`);
        } else {
          penWidth = val;
          sizeInput.parentElement.setAttribute("title", `Pen size: ${penWidth}px`);
        }
        saveSettings();
      });
    }
    if (darkModeBtn) {
      darkModeBtn.addEventListener("click", () => {
        darkMode = !darkMode;
        const tb = shadowRoot.getElementById("draw-toolbar");
        if (tb) tb.classList.toggle("dark", darkMode);
        saveSettings();
        renderToolbar();
      });
    }

    if (penMini) {
      penMini.addEventListener("click", () => {
        selectTool("pen");
      });
    }

    if (eraserMini) {
      eraserMini.addEventListener("click", () => {
        selectTool("eraser");
      });
    }

    // Bind tools group selection
    const tools = ["pen", "highlighter", "eraser", "line", "arrow", "rect", "circle", "text"];
    tools.forEach(tool => {
      const btn = shadowRoot.getElementById(`tool-${tool}`);
      if (btn) {
        btn.addEventListener("click", () => {
          selectTool(tool);
        });
      }
    });

    if (undoBtn) {
      undoBtn.addEventListener("click", () => {
        undoLast();
      });
    }

    if (redoBtn) {
      redoBtn.addEventListener("click", () => {
        redoNext();
      });
    }

    clearBtn.addEventListener("click", () => {
      clearCanvas();
    });

    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: "openOptions" });
        }
      });
    }

    exitBtn.addEventListener("click", () => {
      teardown();
      canvas.remove();
      host.remove();
      removeEraserCursor();
    });

    minimizeBtn.addEventListener("click", () => {
      const tb = shadowRoot.getElementById("draw-toolbar");
      if (!tb) return;
      const rect = tb.getBoundingClientRect();
      const right = rect.right;
      minimized = !minimized;
      renderToolbar();

      const newTb = shadowRoot.getElementById("draw-toolbar");
      if (newTb) {
        const newWidth = newTb.getBoundingClientRect().width;
        let newLeft = right - newWidth;
        if (newLeft < 0) newLeft = 0;
        newTb.style.left = newLeft + "px";
      }
    });

    updateUndoRedoButtons();
  }

  renderToolbar();

  // === Shape Drawing Helper ===
  function drawShape(sx, sy, ex, ey, tool) {
    ctx.beginPath();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;

    if (tool === "line") {
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    } else if (tool === "arrow") {
      // Shaft
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      
      // Arrowhead
      const angle = Math.atan2(ey - sy, ex - sx);
      const headLength = Math.max(10, penWidth * 3);
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - headLength * Math.cos(angle - Math.PI / 6), ey - headLength * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - headLength * Math.cos(angle + Math.PI / 6), ey - headLength * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    } else if (tool === "rect") {
      ctx.rect(sx, sy, ex - sx, ey - sy);
      ctx.stroke();
    } else if (tool === "circle") {
      const rx = Math.abs(ex - sx) / 2;
      const ry = Math.abs(ey - sy) / 2;
      const cx = sx + (ex - sx) / 2;
      const cy = sy + (ey - sy) / 2;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }

  // === Text Annotation Handler ===
  function spawnTextInput(x, y) {
    if (activeTextInput) {
      activeTextInput.blur(); // commit previous
    }

    const input = document.createElement("input");
    input.type = "text";
    input.style.position = "fixed";
    input.style.left = x + "px";
    const fontSize = Math.max(14, penWidth * 4);
    input.style.top = (y - fontSize / 2 - 4) + "px";
    input.style.color = penColor;
    input.style.fontSize = fontSize + "px";
    input.style.fontFamily = "sans-serif";
    input.style.fontWeight = "600";
    input.style.background = "rgba(15, 23, 42, 0.1)";
    input.style.backdropFilter = "blur(2px)";
    input.style.border = "1px dashed " + penColor;
    input.style.borderRadius = "4px";
    input.style.outline = "none";
    input.style.padding = "2px 6px";
    input.style.zIndex = "1000001";
    input.style.minWidth = "150px";

    document.body.appendChild(input);
    activeTextInput = input;

    setTimeout(() => input.focus(), 10);

    function commit() {
      const text = input.value.trim();
      if (text) {
        pushUndoSnapshot();
        clearRedoStack();
        updateUndoRedoButtons();
        
        drawingElements.push({
          type: "text",
          x: x,
          y: y,
          text: text,
          color: penColor,
          fontSize: fontSize
        });
        
        redrawCanvas();
        scheduleSave();
      }
      cleanup();
    }

    function cleanup() {
      input.remove();
      if (activeTextInput === input) {
        activeTextInput = null;
      }
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cleanup();
      }
    });

    input.addEventListener("blur", () => {
      commit();
    });
  }

  // === Drawing Logic (Pointer Events for Touch + Mouse) ===
  function startDraw(e) {
    if (e.target.closest("#draw-toolbar-host") || e.target === activeTextInput) return;
    
    // Commit active text input if clicking somewhere else
    if (activeTextInput) {
      activeTextInput.blur();
      return;
    }

    drawing = true;
    startClickX = e.clientX;
    startClickY = e.clientY;
    lastX = e.clientX;
    lastY = e.clientY;

    pushUndoSnapshot();
    clearRedoStack();
    updateUndoRedoButtons();

    const isShape = ["line", "arrow", "rect", "circle"].includes(currentTool);
    if (isShape) {
      currentElement = {
        type: currentTool,
        sx: e.clientX,
        sy: e.clientY,
        ex: e.clientX,
        ey: e.clientY,
        color: penColor,
        width: penWidth
      };
      cachedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } else if (currentTool === "highlighter") {
      currentElement = {
        type: "highlighter",
        points: [{ x: e.clientX, y: e.clientY }],
        color: penColor,
        width: highlighterSize
      };
      cachedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.beginPath();
      tempCtx.moveTo(e.clientX, e.clientY);
    } else if (currentTool === "pen") {
      currentElement = {
        type: "pen",
        points: [{ x: e.clientX, y: e.clientY }],
        color: penColor,
        width: penWidth
      };
    } else if (currentTool === "eraser") {
      currentElement = {
        type: "eraser",
        points: [{ x: e.clientX, y: e.clientY }],
        width: eraserSize
      };
    }
    updateCursor(e);
  }

  function draw(e) {
    updateCursor(e);
    if (!drawing || !currentElement) return;

    const isShape = ["line", "arrow", "rect", "circle"].includes(currentTool);
    if (isShape) {
      currentElement.ex = e.clientX;
      currentElement.ey = e.clientY;
      ctx.putImageData(cachedImageData, 0, 0);
      drawShape(currentElement.sx, currentElement.sy, currentElement.ex, currentElement.ey, currentTool);
    } else if (currentTool === "highlighter") {
      currentElement.points.push({ x: e.clientX, y: e.clientY });
      
      tempCtx.lineTo(e.clientX, e.clientY);
      tempCtx.lineCap = "round";
      tempCtx.lineJoin = "round";
      tempCtx.strokeStyle = penColor;
      tempCtx.lineWidth = highlighterSize;
      tempCtx.stroke();
      
      ctx.putImageData(cachedImageData, 0, 0);
      ctx.globalAlpha = 0.4;
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.globalAlpha = 1.0;
    } else if (currentTool === "pen") {
      currentElement.points.push({ x: e.clientX, y: e.clientY });
      
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(e.clientX, e.clientY);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1.0;
      ctx.stroke();
      
      lastX = e.clientX;
      lastY = e.clientY;
    } else if (currentTool === "eraser") {
      currentElement.points.push({ x: e.clientX, y: e.clientY });
      
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(e.clientX, e.clientY);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = eraserSize;
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1.0;
      ctx.stroke();

      lastX = e.clientX;
      lastY = e.clientY;
    }
  }

  function stopDraw(e) {
    if (!drawing) return;
    drawing = false;

    const dragDistance = Math.hypot(e.clientX - startClickX, e.clientY - startClickY);
    const isClick = dragDistance < 5;

    const isShape = ["line", "arrow", "rect", "circle"].includes(currentTool);
    if (isShape && currentElement) {
      currentElement.ex = e.clientX;
      currentElement.ey = e.clientY;
      drawingElements.push(currentElement);
      currentElement = null;
      cachedImageData = null;
      redrawCanvas();
      scheduleSave();
    } else if (currentTool === "highlighter" && currentElement) {
      drawingElements.push(currentElement);
      currentElement = null;
      cachedImageData = null;
      redrawCanvas();
      scheduleSave();
    } else if ((currentTool === "pen" || currentTool === "eraser") && currentElement) {
      if (currentElement.points.length === 1) {
        currentElement.points.push({ x: e.clientX, y: e.clientY });
      }
      drawingElements.push(currentElement);
      currentElement = null;
      redrawCanvas();
      scheduleSave();
    }

    if (currentTool === "text" && isClick) {
      // Remove the empty snapshot we pushed in startDraw
      undoStack.pop();
      updateUndoRedoButtons();
      spawnTextInput(e.clientX, e.clientY);
    }
  }

  function updateCursor(e) {
    if (currentTool === "eraser") {
      canvas.style.cursor = "none";
      showEraserCursor(e.clientX, e.clientY);
    } else if (currentTool === "text") {
      canvas.style.cursor = "text";
      removeEraserCursor();
    } else {
      canvas.style.cursor = "crosshair";
      removeEraserCursor();
    }
  }

  canvas.addEventListener("pointerdown", startDraw);
  canvas.addEventListener("pointermove", draw);
  canvas.addEventListener("pointerup", stopDraw);
  canvas.addEventListener("pointerleave", () => {
    stopDraw();
    removeEraserCursor();
  });
  canvas.addEventListener("pointercancel", () => {
    stopDraw();
    removeEraserCursor();
  });

  // === Eraser Hover Preview ===
  let cursorEl;
  function showEraserCursor(x, y) {
    if (!cursorEl) {
      cursorEl = document.createElement("div");
      cursorEl.style.position = "fixed";
      cursorEl.style.border = "1px solid rgba(255, 255, 255, 0.8)";
      cursorEl.style.boxShadow = "0 0 0 1px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(0, 0, 0, 0.3)";
      cursorEl.style.borderRadius = "50%";
      cursorEl.style.pointerEvents = "none";
      cursorEl.style.zIndex = "1000000";
      cursorEl.style.backgroundColor = "rgba(255, 255, 255, 0.15)";
      document.body.appendChild(cursorEl);
    }
    cursorEl.style.width = eraserSize + "px";
    cursorEl.style.height = eraserSize + "px";
    cursorEl.style.left = (x - eraserSize / 2) + "px";
    cursorEl.style.top = (y - eraserSize / 2) + "px";
  }

  // === Make Toolbar Draggable ===
  let isDragging = false, offsetX = 0, offsetY = 0;
  function toolbarMouseDown(e) {
    if (e.target.closest("button") || e.target.closest("input")) return;
    isDragging = true;
    const rect = toolbar.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
  }
  function toolbarMouseMove(e) {
    if (!isDragging) return;
    const tb = shadowRoot.getElementById("draw-toolbar");
    if (tb) {
      tb.style.left = (e.clientX - offsetX) + "px";
      tb.style.top = (e.clientY - offsetY) + "px";
    }
  }
  function toolbarMouseUp() {
    isDragging = false;
  }
  toolbar.addEventListener("mousedown", toolbarMouseDown);
  document.addEventListener("mousemove", toolbarMouseMove);
  document.addEventListener("mouseup", toolbarMouseUp);

  function matchShortcut(e, shortcutString) {
    if (!shortcutString) return false;
    
    const parts = shortcutString.split("+");
    const primaryPart = parts[parts.length - 1].toUpperCase();
    
    const wantsCtrl = parts.includes("Ctrl");
    const wantsAlt = parts.includes("Alt");
    const wantsShift = parts.includes("Shift");
    const wantsMeta = parts.includes("Meta");
    
    const hasCtrl = e.ctrlKey;
    const hasAlt = e.altKey;
    const hasShift = e.shiftKey;
    const hasMeta = e.metaKey;
    
    if (wantsCtrl !== hasCtrl) return false;
    if (wantsAlt !== hasAlt) return false;
    if (wantsShift !== hasShift) return false;
    if (wantsMeta !== hasMeta) return false;
    
    let primaryKey = e.key;
    if (primaryKey === " ") primaryKey = "Space";
    primaryKey = primaryKey.toUpperCase();
    
    return primaryKey === primaryPart;
  }

  // === Keyboard shortcuts ===
  function keydownHandler(e) {
    const ae = document.activeElement;
    if (ae && ((ae.tagName === "INPUT") || (ae.tagName === "TEXTAREA") || ae.isContentEditable)) {
      return;
    }
    
    if (matchShortcut(e, shortcuts.pen)) {
      e.preventDefault();
      e.stopPropagation();
      selectTool("pen");
    } else if (matchShortcut(e, shortcuts.highlighter)) {
      e.preventDefault();
      e.stopPropagation();
      selectTool("highlighter");
    } else if (matchShortcut(e, shortcuts.eraser)) {
      e.preventDefault();
      e.stopPropagation();
      selectTool("eraser");
    } else if (matchShortcut(e, shortcuts.line)) {
      e.preventDefault();
      e.stopPropagation();
      selectTool("line");
    } else if (matchShortcut(e, shortcuts.arrow)) {
      e.preventDefault();
      e.stopPropagation();
      selectTool("arrow");
    } else if (matchShortcut(e, shortcuts.rect)) {
      e.preventDefault();
      e.stopPropagation();
      selectTool("rect");
    } else if (matchShortcut(e, shortcuts.circle)) {
      e.preventDefault();
      e.stopPropagation();
      selectTool("circle");
    } else if (matchShortcut(e, shortcuts.text)) {
      e.preventDefault();
      e.stopPropagation();
      selectTool("text");
    } else if (matchShortcut(e, shortcuts.undo)) {
      e.preventDefault();
      e.stopPropagation();
      undoLast();
    } else if (matchShortcut(e, shortcuts.redo)) {
      e.preventDefault();
      e.stopPropagation();
      redoNext();
    } else if (matchShortcut(e, shortcuts.clear)) {
      e.preventDefault();
      e.stopPropagation();
      clearCanvas();
    }
  }

  function removeEraserCursor() {
    if (cursorEl) {
      cursorEl.remove();
      cursorEl = null;
    }
  }

  function teardown() {
    window.removeEventListener("resize", resizeCanvas);
    canvas.removeEventListener("pointerdown", startDraw);
    canvas.removeEventListener("pointermove", draw);
    canvas.removeEventListener("pointerup", stopDraw);
    toolbar.removeEventListener("mousedown", toolbarMouseDown);
    document.removeEventListener("mousemove", toolbarMouseMove);
    document.removeEventListener("mouseup", toolbarMouseUp);
    document.removeEventListener("keydown", keydownHandler, true);
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    if (activeTextInput) {
      activeTextInput.remove();
      activeTextInput = null;
    }
    drawing = false;
  }
  document.addEventListener("keydown", keydownHandler, true);
}
