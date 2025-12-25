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
  let highlighting = false;
  const highlightUndoStack = [];
  const highlightRedoStack = [];
  let minimized = false; // not persisted (can be added later)
  const drawingStorageKey = "drawImage:" + location.host + location.pathname; // per-page persistence key

  // === Undo stack (dataURL snapshots) ===
  const UNDO_LIMIT = 25;
  const undoStack = [];
  const redoStack = [];

  function pushUndoSnapshot() {
    try {
      const dataURL = canvas.toDataURL("image/png");
      undoStack.push(dataURL);
      if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    } catch (e) {
      // Ignore snapshot failures (e.g., rare security restrictions)
    }
  }

  function pushRedoSnapshot() {
    try {
      const dataURL = canvas.toDataURL("image/png");
      redoStack.push(dataURL);
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
    // Save current for redo, then restore previous from undo
    pushRedoSnapshot();
    const prev = undoStack.pop();
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      scheduleSave();
    };
    img.src = prev;
  }

  function redoNext() {
    if (redoStack.length === 0) return;
    // Save current to undo, then apply redo snapshot
    pushUndoSnapshot();
    const next = redoStack.pop();
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      scheduleSave();
    };
    img.src = next;
  }

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
      </div>
      <div class="core">
      <button id="pen" title="Pen">${!erasing && !highlighting ? "✏️ Pen*" : "✏️ Pen"}</button>
      <button id="highlight" title="Highlight mode">${highlighting ? "🖍️ Highlight*" : "🖍️ Highlight"}</button>
      <button id="eraser" title="Eraser">${erasing ? "🧽 Erasing*" : "🧽 Eraser"}</button>
      <button id="clear" title="Clear Canvas">🗑️ Clear</button>
      <button id="exit" title="Exit Drawing">❌ Exit</button>
      <button id="minimize" title="Minimize">🔽</button>
      </div>`;
  }

  function miniToolbarHTML() {
    return `
      <div class="core">
      <button id="pen" title="Pen">${!erasing && !highlighting ? "✏️*" : "✏️"}</button>
      <button id="highlight" title="Highlight">${highlighting ? "🖍️*" : "🖍️"}</button>
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
    const highlightBtn = document.getElementById("highlight");
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
      highlighting = false;
      removeEraserCursor();
      setHighlightCursor(false);
      if (canvas) canvas.style.pointerEvents = "auto";
      saveSettings();
      renderToolbar();
    });

    eraserBtn.addEventListener("click", () => {
      erasing = !erasing;
      if (erasing) highlighting = false;
      if (!erasing) removeEraserCursor();
      saveSettings();
      renderToolbar();
    });

    if (highlightBtn) highlightBtn.addEventListener("click", () => {
      highlighting = !highlighting;
      if (highlighting) erasing = false;
      removeEraserCursor();
      setHighlightCursor(highlighting);
      if (canvas) canvas.style.pointerEvents = highlighting ? "none" : "auto";
      renderToolbar();
    });


    clearBtn.addEventListener("click", () => {
      pushUndoSnapshot();
      clearRedoStack();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      localStorage.removeItem(drawingStorageKey);
    });

    exitBtn.addEventListener("click", () => {
      canvas.remove();
      toolbar.remove();
      removeEraserCursor();
      // Reset highlight mode and cursor when exiting
      highlighting = false;
      setHighlightCursor(false);
      if (canvas) canvas.style.pointerEvents = "auto";
      document.removeEventListener("keydown", keydownHandler, true);
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
    if (highlighting) return; // don't draw in highlight mode
    // Snapshot before a new stroke so Ctrl+Z will revert this stroke
    pushUndoSnapshot();
    clearRedoStack();
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(e.clientX, e.clientY);
  }

  function draw(e) {
    if (!drawing || highlighting) return;
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

  // === Keyboard shortcuts ===
  function keydownHandler(e) {
    // Avoid interfering with typing in inputs/contenteditable
    const ae = document.activeElement;
    if (ae && ((ae.tagName === "INPUT") || (ae.tagName === "TEXTAREA") || ae.isContentEditable)) {
      return;
    }
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    // Undo: Ctrl+Z or Cmd+Z
    if ((isMac ? e.metaKey : e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      e.stopPropagation();
      // Try canvas undo first, else fallback to highlight undo
      if (undoStack.length > 0) {
        undoLast();
      } else if (highlightUndoStack.length > 0) {
        const last = highlightUndoStack.pop();
        const removed = [];
        last.forEach((span) => {
          if (span && span.isConnected) {
            removed.push(span);
            unwrapSpan(span);
          }
        });
        if (removed.length) highlightRedoStack.push(removed);
      }
      return;
    }
    // Redo: Ctrl+Y (Win/Linux) or Cmd+Shift+Z (macOS)
    if (!isMac && e.ctrlKey && !e.altKey && (e.key === "y" || e.key === "Y")) {
      e.preventDefault();
      e.stopPropagation();
      if (redoStack.length > 0) {
        redoNext();
      } else if (highlightRedoStack.length > 0) {
        // DOM redo for highlight not supported robustly yet
      }
      return;
    }
    if (isMac && e.metaKey && e.shiftKey && !e.altKey && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      e.stopPropagation();
      if (redoStack.length > 0) {
        redoNext();
      } else if (highlightRedoStack.length > 0) {
        // DOM redo for highlight not supported robustly yet
      }
      return;
    }
  }
  document.addEventListener("keydown", keydownHandler, true);

  // === Text Highlighting ===
  function applyHighlight(color) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const ranges = [];
    for (let i = 0; i < sel.rangeCount; i++) {
      ranges.push(sel.getRangeAt(i));
    }

    // Apply highlighting per range by wrapping only text nodes (single-line friendly)
    const createdSpans = [];
    ranges.forEach((range) => {
      const common = range.commonAncestorContainer;
      if (common && (canvas.contains(common) || toolbar.contains(common))) return;
      const spans = highlightRangeTextNodes(range, color);
      // Fallback: if nothing was highlighted and selection is within a single element/text, try endpoint-based wrapping
      if (spans.length === 0) {
        const fallback = highlightUsingSelectionEndpoints(range, color);
        if (fallback && fallback.length) spans.push(...fallback);
      }
      createdSpans.push(...spans);
    });
    // Clear selection after applying
    sel.removeAllRanges();
    if (createdSpans.length) {
      highlightUndoStack.push(createdSpans);
      highlightRedoStack.length = 0;
    }
  }

  // Wrap only selected text portions; span contains only text, no tags
  function highlightRangeTextNodes(range, color) {
    const spans = [];
    const root = range.commonAncestorContainer;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const bg = toAlpha(color, 0.35);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeType !== Node.TEXT_NODE) continue;
      if (!node.nodeValue || node.nodeValue.length === 0) continue;
      // Skip nodes inside existing highlights or UI
      if ((node.parentNode && node.parentNode.closest && node.parentNode.closest('span.draw-highlight')) ||
          canvas.contains(node) || toolbar.contains(node)) {
        continue;
      }
      // Intersection check
      let intersects = false;
      if (typeof range.intersectsNode === 'function') {
        try { intersects = range.intersectsNode(node); } catch (_) { intersects = false; }
      }
      if (!intersects) {
        const nodeRange = document.createRange();
        nodeRange.selectNodeContents(node);
        const endsBeforeNodeStarts = range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0;
        const startsAfterNodeEnds = range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0;
        intersects = !(endsBeforeNodeStarts || startsAfterNodeEnds);
      }
      if (!intersects) continue;

      const start = range.startContainer === node ? range.startOffset : 0;
      const end = range.endContainer === node ? range.endOffset : node.length;
      if (start >= end) continue;

      // Isolate selected segment with splits
      let segment = node;
      if (end < segment.length) segment = segment.splitText(end);
      let selected = segment;
      if (start > 0) selected = selected.splitText(start);

      // Create span that wraps only the selected text node
      const span = document.createElement('span');
      span.style.setProperty('background-color', bg, 'important');
      span.style.setProperty('display', 'inline', 'important');
      span.style.padding = "0.05em 0";
      span.style.borderRadius = "2px";
      span.style.boxDecorationBreak = "clone";
      span.className = 'draw-highlight';
      selected.parentNode.insertBefore(span, selected);
      span.appendChild(selected);
      spans.push(span);
    }
    return spans;
  }

  // Fallback highlighter that operates directly on selection endpoints when within one element
  function highlightUsingSelectionEndpoints(range, color) {
    const spans = [];
    const bg = toAlpha(color, 0.35);
    const startNode = range.startContainer;
    const endNode = range.endContainer;
    if (startNode === endNode && startNode && startNode.nodeType === Node.TEXT_NODE) {
      const node = startNode;
      const start = range.startOffset;
      const end = range.endOffset;
      if (start < end) {
        let segment = node;
        if (end < segment.length) segment = segment.splitText(end);
        let selected = segment;
        if (start > 0) selected = selected.splitText(start);
        const span = document.createElement('span');
        span.style.setProperty('background-color', bg, 'important');
        span.style.setProperty('display', 'inline', 'important');
        span.style.padding = "0.05em 0";
        span.style.borderRadius = "2px";
        span.style.boxDecorationBreak = "clone";
        span.className = 'draw-highlight';
        selected.parentNode.insertBefore(span, selected);
        span.appendChild(selected);
        spans.push(span);
      }
    }
    return spans;
  }

  function toAlpha(hex, alpha) {
    // Expect hex like #rrggbb from <input type="color">
    if (typeof hex !== "string" || !/^#?[0-9a-fA-F]{6}$/.test(hex)) {
      // Fallback: return rgba with default yellow tint
      return `rgba(255, 255, 0, ${alpha})`;
    }
    const h = hex.startsWith('#') ? hex.slice(1) : hex;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Apply highlight automatically on mouseup after selection, to avoid interrupting drag selection
  let isMouseDownForSelection = false;
  document.addEventListener("mousedown", (e) => {
    if (!highlighting) return;
    if (e.button !== 0) return; // only left-click selections
    const t = e.target;
    if (t && (toolbar.contains(t) || canvas.contains(t))) return;
    isMouseDownForSelection = true;
  }, true);
  document.addEventListener("mouseup", (e) => {
    if (!highlighting) return;
    if (!isMouseDownForSelection) return;
    isMouseDownForSelection = false;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const t = e.target;
    if (t && (toolbar.contains(t) || canvas.contains(t))) return;
    const range = sel.getRangeAt(0);
    const common = range.commonAncestorContainer;
    if (common && (canvas.contains(common) || toolbar.contains(common))) return;
    applyHighlight(penColor);
  }, true);

  function setHighlightCursor(active) {
    try {
      document.body.style.cursor = active ? "text" : "";
    } catch (_) {}
  }

  function unwrapSpan(span) {
    const parent = span.parentNode;
    if (!parent) return;
    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
  }

  // In eraser mode, clicking a highlighted span removes the highlight
  document.addEventListener("click", (e) => {
    if (!erasing) return;
    const target = e.target;
    if (!target || toolbar.contains(target) || canvas.contains(target)) return;
    const span = target.closest && target.closest('span.draw-highlight');
    if (span) {
      e.preventDefault();
      e.stopPropagation();
      highlightUndoStack.push([span]);
      highlightRedoStack.length = 0;
      unwrapSpan(span);
      const sel = window.getSelection();
      if (sel) sel.removeAllRanges();
    }
  }, true);
}
