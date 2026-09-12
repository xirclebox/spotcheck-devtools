# SpotCheck DevTools

A browser extension for Chrome, Firefox, and Edge. It's a collection of tests that allow you to spot check common accessibility issues directly in the browser. Each one links to its related WCAG 2.2 success criteria.

Available tools:

• Landmark Visualizer:
Outlines every ARIA and HTML landmark region and flags ones missing an accessible name or duplicated.

• Link Accessibility Auditor:
Checks every link for a real accessible name and flags generic text like “click here”.

• Heading Validator:
Walks the heading outline in document order and flags any level that skips ahead.

• List Identifier:
Flags empty lists, malformed markup, and list items that aren’t inside a list at all.

• Tab Order Visualizer:
Numbers every focusable element in tab order and flags positive tabindex values.

• Text Contrast Checker:
Measures text contrast against its effective background and flags anything below WCAG AA minimum.

• Alt Text Checker:
Checks every image for alt text and flags the ones missing it or marked incorrectly.

• Input Label Checker:
Outlines every input, select, and textarea on the page, then labels each one with how it gets its accessible name.

• Target Size Checker:
Run this on any page to measure every clickable target, flag the ones under 24 by 24 CSS pixels, and show which ones clear the 44 by 44 enhanced threshold.

---

## How to open your browser's DevTools

1. Open DevTools with Keyboard Shortcut

- Windows/Linux: Press F12 or Ctrl + Shift + I
- macOS: Press Cmd + Option + I

2. Open DevTools from Browser Menu
   Browser menu --> More tools --> Developer tools

- Click the browser’s menu icon (⋮ or ☰)
- Select "More tools"
- Choose "Developer tools"

3. Open DevTools by Inspecting an Element

- Right‑click any part of the webpage to open the menu
- Select "Inspect" or "Inspect element" from the menu

4. Open DevTools via Command Menu : Chrome / Edge

- Press Ctrl + Shift + P (Windows/Linux) or Cmd + Shift + P (macOS)
- Type “DevTools” or the panel name (e.g., “Elements”, “Console”)

---

## Updates

- Added the ability to access the tools from the Browser Extension Bar : 09/12/2026
- Added the Target Size Checker : 08/21/2026
