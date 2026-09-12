(function () {
  "use strict";

  var TOOLS = [
    {
      id: "landmark-visualizer",
      name: "Landmark Visualizer",
      ns: "__a11yLandmarkViz",
      file: "scripts/landmark-visualizer.js",
      desc: "Outlines every ARIA and HTML landmark region and flags ones missing an accessible name or duplicated.",
      linkName: "Landmark Visualizer WCAG criteria",
      link: "https://www.spotcheck.tools/landmark-visualizer#criteria-heading",
    },
    {
      id: "link-accessibility-auditor",
      name: "Link Accessibility Auditor",
      ns: "__a11yLinkAuditor",
      file: "scripts/link-accessibility-auditor.js",
      desc: "Checks every link for a real accessible name and flags generic text like \u201cclick here\u201d.",
      linkName: "Link Accessibility Auditor WCAG criteria",
      link: "https://www.spotcheck.tools/link-accessibility-auditor#criteria-heading",
    },
    {
      id: "heading-validator",
      name: "Heading Validator",
      ns: "__a11yHeadingOrder",
      file: "scripts/heading-validator.js",
      desc: "Walks the heading outline in document order and flags any level that skips ahead.",
      linkName: "Heading Validator WCAG criteria",
      link: "https://www.spotcheck.tools/heading-validator#criteria-heading",
    },
    {
      id: "list-identifier",
      name: "List Identifier",
      ns: "__a11yListIdentifier",
      file: "scripts/list-identifier.js",
      desc: "Flags empty lists, malformed markup, and list items that aren\u2019t inside a list at all.",
      linkName: "List Identifier WCAG criteria",
      link: "https://www.spotcheck.tools/list-identifier#criteria-heading",
    },
    {
      id: "tab-order-visualizer",
      name: "Tab Order Visualizer",
      ns: "__a11yTabOrder",
      file: "scripts/tab-order-visualizer.js",
      desc: "Numbers every focusable element in tab order and flags positive tabindex values.",
      linkName: "Tab Order Visualizer WCAG criteria",
      link: "https://www.spotcheck.tools/tab-order-visualizer#criteria-heading",
    },
    {
      id: "text-contrast-checker",
      name: "Text Contrast Checker",
      ns: "__a11yContrastChecker",
      file: "scripts/text-contrast-checker.js",
      desc: "Measures text contrast against its effective background and flags anything below WCAG AA minimum.",
      linkName: "Text Contrast Checker WCAG criteria",
      link: "https://www.spotcheck.tools/text-contrast-checker#criteria-heading",
    },
    {
      id: "alt-text-checker",
      name: "Alt Text Checker",
      ns: "__a11yImageAltChecker",
      file: "scripts/alt-text-checker.js",
      desc: "Checks every image for alt text and flags the ones missing it or marked incorrectly.",
      linkName: "Alt Text Checker WCAG criteria",
      link: "https://www.spotcheck.tools/alt-text-checker#criteria-heading",
    },
    {
      id: "input-label-checker",
      name: "Input Label Checker",
      ns: "__a11yInputLabelChecker",
      file: "scripts/input-label-checker.js",
      desc: "Outlines every input, select, and textarea on the page, then labels each one with how it gets its accessible name.",
      linkName: "Input Label Checker WCAG criteria",
      link: "https://www.spotcheck.tools/input-label-checker#criteria-heading",
    },
    {
      id: "target-size-checker",
      name: "Target Size Checker",
      ns: "__a11yTargetSizeChecker",
      file: "scripts/target-size-checker.js",
      desc: "Measures every clickable target and flags the ones under 24 by 24 that can\u2019t claim the spacing exception.",
      linkName: "Target Size Checker WCAG criteria",
      link: "https://www.spotcheck.tools/target-size-checker#criteria-heading",
    },
  ];

  var IS_DEVTOOLS = !!(
    typeof chrome !== "undefined" &&
    chrome.devtools &&
    chrome.devtools.inspectedWindow
  );

  var listEl = document.getElementById("tool-list");
  var statusEl = document.getElementById("status");
  var scriptCache = {};
  var toggleEls = {};

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.classList.toggle("status--error", !!isError);
  }

  function loadScript(tool) {
    if (scriptCache[tool.id]) {
      return Promise.resolve(scriptCache[tool.id]);
    }
    return fetch(chrome.runtime.getURL(tool.file))
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load " + tool.file);
        return res.text();
      })
      .then(function (text) {
        scriptCache[tool.id] = text;
        return text;
      });
  }

  function activeTabId() {
    if (IS_DEVTOOLS) {
      return Promise.resolve(chrome.devtools.inspectedWindow.tabId);
    }
    return chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(function (tabs) {
        if (!tabs.length || typeof tabs[0].id !== "number") {
          throw new Error("No active tab to inspect");
        }
        return tabs[0].id;
      });
  }

  function evalInInspectedWindow(code) {
    return new Promise(function (resolve, reject) {
      chrome.devtools.inspectedWindow.eval(
        code,
        function (result, exceptionInfo) {
          if (
            exceptionInfo &&
            (exceptionInfo.isException || exceptionInfo.isError)
          ) {
            reject(
              new Error(
                exceptionInfo.value ||
                  exceptionInfo.description ||
                  "Script error",
              ),
            );
            return;
          }
          resolve(result);
        },
      );
    });
  }

  function injectFile(tool) {
    return activeTabId().then(function (tabId) {
      return chrome.scripting.executeScript({
        target: { tabId: tabId, allFrames: false },
        world: "MAIN",
        files: [tool.file],
      });
    });
  }

  function injectProbe(tool) {
    return activeTabId()
      .then(function (tabId) {
        return chrome.scripting.executeScript({
          target: { tabId: tabId, allFrames: false },
          world: "MAIN",
          func: function (ns) {
            return !!window[ns];
          },
          args: [tool.ns],
        });
      })
      .then(function (results) {
        return !!(results && results[0] && results[0].result);
      });
  }

  function runTool(tool) {
    if (IS_DEVTOOLS) {
      return loadScript(tool).then(function (code) {
        return evalInInspectedWindow(code);
      });
    }
    return injectFile(tool);
  }

  function queryActive(tool) {
    if (IS_DEVTOOLS) {
      return evalInInspectedWindow("!!window['" + tool.ns + "']").catch(
        function () {
          return false;
        },
      );
    }
    return injectProbe(tool).catch(function () {
      return false;
    });
  }

  function setToggleUI(tool, isOn) {
    var els = toggleEls[tool.id];
    if (!els) return;
    els.input.checked = !!isOn;
    els.state.classList.toggle("tool-list__state--on", !!isOn);
    els.state.classList.toggle("tool-list__state--off", !isOn);
  }

  function refreshAll() {
    TOOLS.forEach(function (tool) {
      queryActive(tool).then(function (isOn) {
        setToggleUI(tool, isOn);
      });
    });
  }

  function handleToggle(tool) {
    var els = toggleEls[tool.id];
    els.input.disabled = true;

    setStatus("");

    runTool(tool)
      .then(function () {
        return queryActive(tool);
      })
      .then(function (isOn) {
        setToggleUI(tool, isOn);
      })
      .catch(function (err) {
        queryActive(tool).then(function (isOn) {
          setToggleUI(tool, isOn);
        });
        setStatus(
          "Couldn\u2019t run " + tool.name + " on this page: " + err.message,
          true,
        );
      })
      .then(function () {
        els.input.disabled = false;
      });
  }

  function buildList() {
    TOOLS.forEach(function (tool) {
      var li = document.createElement("li");
      li.className = "tool-list__item";

      var body = document.createElement("div");
      body.className = "tool-list__body";

      var name = document.createElement("span");
      name.className = "tool-list__name";
      name.id = "tool-name-" + tool.id;
      name.textContent = tool.name;

      var desc = document.createElement("p");
      desc.className = "tool-list__desc";
      desc.textContent = tool.desc;

      var link = document.createElement("a");
      link.className = "tool-list__link";
      link.textContent = tool.linkName;
      link.setAttribute("href", tool.link);
      link.setAttribute("target", "_blank");

      var state = document.createElement("span");
      state.className = "tool-list__state tool-list__state--off";

      body.appendChild(name);
      body.appendChild(desc);
      body.appendChild(link);
      body.appendChild(state);

      var label = document.createElement("label");
      label.className = "toggle";

      var input = document.createElement("input");
      input.type = "checkbox";
      input.className = "toggle__input";
      input.setAttribute("aria-labelledby", name.id);

      var track = document.createElement("span");
      track.className = "toggle__track";
      track.setAttribute("aria-hidden", "true");
      var thumb = document.createElement("span");
      thumb.className = "toggle__thumb";
      track.appendChild(thumb);

      label.appendChild(input);
      label.appendChild(track);

      li.appendChild(body);
      li.appendChild(label);
      listEl.appendChild(li);

      toggleEls[tool.id] = { input: input, state: state };

      input.addEventListener("change", function () {
        handleToggle(tool);
      });
    });
  }

  function stampVersion() {
    var badge = document.querySelector(".version__badge");
    if (!badge || !chrome.runtime || !chrome.runtime.getManifest) return;
    badge.textContent = "v." + chrome.runtime.getManifest().version;
  }

  function applyContext() {
    document.body.classList.add("spotcheck", "panel");
    if (!IS_DEVTOOLS) {
      document.body.classList.add("panel--popup");
    }
  }

  function checkPageAccess() {
    if (IS_DEVTOOLS) return;
    activeTabId()
      .then(function (tabId) {
        return chrome.scripting.executeScript({
          target: { tabId: tabId, allFrames: false },
          world: "MAIN",
          func: function () {
            return true;
          },
        });
      })
      .catch(function () {
        setStatus(
          "This page can\u2019t be inspected. Open a regular http or https page and try again.",
          true,
        );
        TOOLS.forEach(function (tool) {
          if (toggleEls[tool.id]) {
            toggleEls[tool.id].input.disabled = true;
          }
        });
      });
  }

  applyContext();
  stampVersion();
  buildList();
  refreshAll();
  checkPageAccess();

  var pollInFlight = false;
  setInterval(function () {
    if (pollInFlight) return;
    pollInFlight = true;
    Promise.all(
      TOOLS.map(function (tool) {
        return queryActive(tool).then(function (isOn) {
          setToggleUI(tool, isOn);
        });
      }),
    ).then(function () {
      pollInFlight = false;
    });
  }, 1500);

  if (
    chrome.devtools &&
    chrome.devtools.network &&
    chrome.devtools.network.onNavigated
  ) {
    chrome.devtools.network.onNavigated.addListener(function () {
      refreshAll();
    });
  }
})();
