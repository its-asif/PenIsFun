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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openOptions") {
    chrome.runtime.openOptionsPage();
  }
});
