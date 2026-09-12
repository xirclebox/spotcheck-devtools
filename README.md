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

---

## ActiveTab justification

SpotCheck only ever inspects the one page the user is actively working on, and only after an explicit action. When the user clicks the toolbar icon or toggles a test in the DevTools panel, activeTab grants temporary access to that single tab so the selected check can read the rendered DOM, which means headings, landmarks, lists, link text, alt attributes, form control labels, computed colors, and rendered target sizes, and draw its overlay highlights on top of the page. Access is scoped to that tab and ends when the user navigates away or closes it. The extension declares no host permissions, runs no background or persistent content scripts, and reads nothing until the user turns a test on.

## Scripting justification

The accessibility checks have to execute inside the page context because they depend on the live DOM and its computed styles. Measuring rendered target sizes, resolving the effective background behind text to calculate a contrast ratio, walking the heading outline in document order, and determining how a form control derives its accessible name are all things that cannot be evaluated from outside the page. The scripting permission injects the relevant check script into the active tab when the user toggles a test on, and the same toggle removes the overlays when switched off. Every injected script is bundled in the extension package and referenced by filename in chrome.scripting.executeScript. No code is fetched from a remote server or evaluated from a string at runtime. The scripts read the page and overlay visual annotations on it. They do not alter the site's underlying content, submit forms, or transmit anything anywhere. Results render locally in the extension UI, and the extension collects no user data and makes no network requests.
