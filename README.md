# PenIsFun – Draw on Any Web Page

PenIsFun is a modern, high-performance browser extension that lets you draw, erase, write, and place annotations directly on top of any web page. Built with vector accuracy, it's perfect for quick markups, online teaching, code reviews, brainstorming sessions, or jotting down ideas.

## Key Features

*   **Vector-Based Drawing Engine**: Drawing data is saved as high-fidelity object vectors instead of raw raster bitmaps. This allows drawings to remain perfectly sharp and clear regardless of screen sizes, window resizing, or screen DPI changes.
*   **Encapsulated Shadow DOM Layout**: The toolbar is injected inside a Shadow DOM, completely isolating extension styles from the host page to prevent CSS leaking or page style overrides.
*   **Vibrant Glassmorphic UI**: Beautiful, modern translucent panel design supporting dark/light mode switches, drag-to-reposition capabilities, and collapsible minimization.
*   **Independent Brush Sizes**: The **Pen**, **Highlighter**, and **Eraser** all maintain their own separate size configurations and sliders.
*   **Comprehensive Annotation Toolkit**:
    *   **Pen**: Freehand sketching.
    *   **Highlighter**: Translucent markers utilizing off-screen buffer blending.
    *   **Eraser**: Clean pathway eraser.
    *   **Shapes**: Precise Line, Arrow, Rectangle, and Circle creators.
    *   **Text Label Overlay**: Click-to-type input box with dynamic text sizing based on line width.
*   **Control Center Options Console**:
    *   Manage and clear all saved drawing caches across hosts and paths.
    *   Configure custom keyboard shortcuts for all tools and actions with a dynamic key-combination recorder.
*   **Touch & Stylus Support**: Fully standardized pointer events ensure compatibility across desktops, tablets, and mobile styluses.
*   **Local Persistence & Sync**: Drawing data automatically persists locally per-page and updates in real-time across multiple matching browser tabs.

---

## Quick Start
1.  **Activate**: Click the extension icon in the toolbar or press `Ctrl + Shift + Q`.
2.  **Annotate**: Draw with the pen, highlight text, build shapes, or click to add text overlays.
3.  **Manage Settings**: Click the settings gear icon on the toolbar to customize keyboard shortcuts or clear saved caches.
4.  **Save/Restore**: Reloading a page or coming back later automatically restores your drawings.

---

## Keyboard Shortcuts Configuration

Default global keyboard combinations are configured out of the box, and can be customized within the Settings options page:

| Action / Tool | Default Keyboard Combination |
| --- | --- |
| **Pen Tool** | `Alt + 1` |
| **Highlighter Tool** | `Alt + 2` |
| **Eraser Tool** | `Alt + 3` |
| **Line Tool** | `Alt + 4` |
| **Arrow Tool** | `Alt + 5` |
| **Rectangle Tool** | `Alt + 6` |
| **Circle Tool** | `Alt + 7` |
| **Text Tool** | `Alt + 8` |
| **Undo Last Stroke** | `Ctrl + Z` |
| **Redo Next Stroke** | `Ctrl + Y` |
| **Clear All (Delete)** | `Ctrl + X` |

---

## Privacy Policy
*   **100% Local**: No external servers, API endpoints, or database storage are used.
*   **No Tracking**: Zero user diagnostics, analytics, or behavioral cookies.
*   **Browser Sandbox**: All drawing elements stay within `chrome.storage.local` on your local device.

---

## Thanks
Hope this tool is useful! Feel free to suggest more improvements or custom settings features.
