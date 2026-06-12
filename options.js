const DRAW_PREFIX = "drawImage:";
const siteList = document.getElementById("siteList");
const emptyState = document.getElementById("emptyState");
const statusEl = document.getElementById("status");
const clearAllBtn = document.getElementById("clearAll");
const resetShortcutsBtn = document.getElementById("resetShortcuts");
let cachedKeys = [];

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

const shortcutKeys = ["pen", "highlighter", "eraser", "line", "arrow", "rect", "circle", "text", "undo", "redo", "clear"];

document.addEventListener("DOMContentLoaded", () => {
  clearAllBtn.addEventListener("click", handleClearAll);
  siteList.addEventListener("click", handleEntryClick);
  
  if (resetShortcutsBtn) {
    resetShortcutsBtn.addEventListener("click", handleResetShortcuts);
  }

  setupShortcuts();
  refreshList();
  loadShortcuts();
});

function refreshList() {
  chrome.storage.local.get(null, (items) => {
    if (chrome.runtime && chrome.runtime.lastError) {
      showStatus("Unable to read saved drawings.", true);
      return;
    }
    const data = items || {};
    const entries = Object.keys(data)
      .filter((key) => key.startsWith(DRAW_PREFIX))
      .map((key) => formatEntry(key))
      .sort((a, b) => a.slug.localeCompare(b.slug));
    cachedKeys = entries.map((entry) => entry.key);
    render(entries);
  });
}

function formatEntry(key) {
  const slug = key.slice(DRAW_PREFIX.length);
  const slashIndex = slug.indexOf("/");
  const host = slashIndex >= 0 ? slug.slice(0, slashIndex) : slug;
  let path = slashIndex >= 0 ? slug.slice(slashIndex) : "/";
  if (!path.startsWith("/")) path = "/" + path;
  const href = host ? `https://${host}${path}` : "#";
  return { key, slug, host: host || "unknown", path, href };
}

function render(entries) {
  siteList.innerHTML = "";
  if (!entries.length) {
    emptyState.hidden = false;
    clearAllBtn.disabled = true;
    return;
  }
  emptyState.hidden = true;
  clearAllBtn.disabled = false;
  const fragment = document.createDocumentFragment();
  entries.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "entry";

    const info = document.createElement("div");
    info.className = "site-info";

    const link = document.createElement("a");
    link.href = entry.href;
    link.textContent = entry.host;
    link.target = "_blank";
    link.rel = "noreferrer noopener";

    const pathSpan = document.createElement("span");
    pathSpan.className = "path";
    pathSpan.textContent = entry.path;

    info.append(link, pathSpan);

    const removeBtn = document.createElement("button");
    removeBtn.className = "danger";
    removeBtn.type = "button";
    removeBtn.dataset.key = entry.key;
    removeBtn.dataset.label = `${entry.host}${entry.path}`;
    removeBtn.textContent = "Delete";

    li.append(info, removeBtn);
    fragment.append(li);
  });
  siteList.append(fragment);
}

function handleEntryClick(event) {
  const target = event.target.closest("button[data-key]");
  if (!target) return;
  const { key, label } = target.dataset;
  const labelText = label || "that page";
  target.disabled = true;
  const previousText = target.textContent;
  target.textContent = "Deleting…";
  chrome.storage.local.remove(key, () => {
    if (chrome.runtime && chrome.runtime.lastError) {
      showStatus("Failed to delete drawing.", true);
    } else {
      showStatus(`Removed drawing for ${labelText}.`, false);
    }
    target.textContent = previousText;
    target.disabled = false;
    refreshList();
  });
}

function handleClearAll() {
  if (!cachedKeys.length) return;
  const keys = [...cachedKeys];
  clearAllBtn.disabled = true;
  const previousText = clearAllBtn.textContent;
  clearAllBtn.textContent = "Clearing…";
  chrome.storage.local.remove(keys, () => {
    if (chrome.runtime && chrome.runtime.lastError) {
      showStatus("Failed to clear drawings.", true);
    } else {
      showStatus(`Cleared ${keys.length} saved drawing(s).`, false);
    }
    clearAllBtn.textContent = previousText;
    refreshList();
  });
}

function showStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", Boolean(isError));
  if (!message) return;
  clearTimeout(showStatus.timeoutId);
  showStatus.timeoutId = setTimeout(() => {
    statusEl.textContent = "";
    statusEl.classList.remove("error");
  }, 4000);
}

// === Shortcuts Management ===
function loadShortcuts() {
  chrome.storage.local.get(["drawShortcuts"], (result) => {
    const shortcuts = { ...defaultShortcuts, ...(result.drawShortcuts || {}) };
    shortcutKeys.forEach(key => {
      const input = document.getElementById(`shortcut-${key}`);
      if (input) {
        input.value = shortcuts[key];
      }
    });
  });
}

function handleResetShortcuts() {
  chrome.storage.local.set({ drawShortcuts: defaultShortcuts }, () => {
    showStatus("Reset keyboard shortcuts to defaults.", false);
    loadShortcuts();
  });
}

function setupShortcuts() {
  shortcutKeys.forEach(key => {
    const input = document.getElementById(`shortcut-${key}`);
    if (!input) return;

    input.addEventListener("focus", () => {
      input.value = "Press keys...";
    });

    input.addEventListener("blur", () => {
      loadShortcuts();
    });

    input.addEventListener("keydown", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const primaryKey = e.key;

      if (["Control", "Alt", "Shift", "Meta"].includes(primaryKey)) {
        return;
      }

      const modifiers = [];
      if (e.ctrlKey) modifiers.push("Ctrl");
      if (e.altKey) modifiers.push("Alt");
      if (e.shiftKey) modifiers.push("Shift");
      if (e.metaKey) modifiers.push("Meta");

      let cleanKey = primaryKey;
      if (primaryKey === " ") cleanKey = "Space";
      else if (primaryKey.length === 1) cleanKey = primaryKey.toUpperCase();

      const shortcutStr = [...modifiers, cleanKey].join("+");

      chrome.storage.local.get(["drawShortcuts"], (result) => {
        const current = result.drawShortcuts || {};
        current[key] = shortcutStr;
        chrome.storage.local.set({ drawShortcuts: current }, () => {
          showStatus("Updated keyboard shortcut.", false);
          input.blur();
        });
      });
    });
  });
}
