function injectDrawing(tabId) {
  chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });
  chrome.scripting.insertCSS({
    target: { tabId },
    files: ["style.css"]
  });
}

chrome.action.onClicked.addListener((tab) => {
  injectDrawing(tab.id);
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-draw") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) injectDrawing(tabs[0].id);
    });
  }
});
