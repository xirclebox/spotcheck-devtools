(function () {
  var w = window;
  var d = document;
  var STATE_KEY = "__a11yImageAltChecker";

  if (w[STATE_KEY]) {
    w[STATE_KEY].clear();
    return;
  }

  var COLORS = {
    green: "#1a7d4f",
    gold: "#8b6800",
    red: "#be412a",
  };

  var OUTLINES = {
    green: "5px solid",
    gold: "6px dotted",
    red: "5px dashed",
  };

  var OUTLINE_OFFSET = "3px";

  var DOTS = {
    green: "#3fbf7f",
    gold: "#e0b84f",
    red: "#e06a4f",
  };

  var LEVELS = {
    ok: "green",
    decorative: "green",
    filename: "gold",
    redundant: "gold",
    missing: "red",
  };

  var BADGES = {
    ok: "Alt text",
    decorative: "Decorative (empty alt)",
    filename: "Alt text looks like a filename",
    redundant: "Redundant phrase in alt text",
    missing: "No alt attribute",
  };

  var QUOTED_KINDS = ["ok", "filename", "redundant"];

  var FILENAME_PATTERNS = [
    /\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff?)$/i,
    /^(img|image|dsc|photo|screenshot)[-_ ]?\d/i,
  ];

  var REDUNDANT_PATTERN = /^(image|photo|picture|graphic|icon)\s+of\b/i;

  var SLOT_TAG = "SLOT";

  var records = [];
  var counts = { green: 0, gold: 0, red: 0 };
  var panel = null;

  function normalize(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function flatChildren(node) {
    if (node.tagName === SLOT_TAG && node.assignedElements) {
      var assigned = node.assignedElements({ flatten: true });
      if (assigned.length) {
        return assigned;
      }
    }
    return Array.prototype.slice.call(node.children);
  }

  function deepQuery(selector, root) {
    var found = [];
    var seen = new WeakSet();

    function walk(node) {
      flatChildren(node).forEach(function (el) {
        if (seen.has(el)) {
          return;
        }
        seen.add(el);
        if (el.matches(selector)) {
          found.push(el);
        }
        if (el.shadowRoot) {
          walk(el.shadowRoot);
          return;
        }
        walk(el);
      });
    }

    walk(root || d.body);
    return found;
  }

  function isVisible(el) {
    var style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function looksLikeFilename(alt) {
    var trimmed = alt.trim();
    return FILENAME_PATTERNS.some(function (pattern) {
      return pattern.test(trimmed);
    });
  }

  function classify(el) {
    if (!el.hasAttribute("alt")) {
      return "missing";
    }
    var alt = el.getAttribute("alt");
    if (!alt.trim()) {
      return "decorative";
    }
    if (looksLikeFilename(alt)) {
      return "filename";
    }
    if (REDUNDANT_PATTERN.test(alt.trim())) {
      return "redundant";
    }
    return "ok";
  }

  function labelFor(el, kind) {
    if (QUOTED_KINDS.indexOf(kind) === -1) {
      return BADGES[kind];
    }
    return BADGES[kind] + ': "' + normalize(el.getAttribute("alt")) + '"';
  }

  function makeBadge(el, kind) {
    var level = LEVELS[kind];
    var badge = d.createElement("div");

    badge.setAttribute("data-a11y-alt-check", "badge");
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = labelFor(el, kind);
    badge.style.cssText = [
      "position:absolute",
      "width:fit-content",
      "max-width:min(90vw, 24rem)",
      "padding:4px 8px",
      "border-radius:4px",
      "background:" + COLORS[level],
      "color:#fff",
      'font:500 16px/1.2 Arial, Helvetica, "Helvetica Neue", sans-serif',
      "pointer-events:none",
      "z-index:2147483646",
    ].join(";");
    return badge;
  }

  function placeBadge(el, badge) {
    var rect = el.getBoundingClientRect();
    var badgeRect = badge.getBoundingClientRect();

    badge.style.top = rect.top + w.scrollY - badgeRect.height + "px";
    badge.style.left = rect.left + w.scrollX + "px";
  }

  function mark(el) {
    var kind = classify(el);
    var level = LEVELS[kind];
    var record = {
      el: el,
      outline: el.style.outline,
      offset: el.style.outlineOffset,
      badge: makeBadge(el, kind),
    };

    counts[level] += 1;
    el.style.outline = OUTLINES[level] + " " + COLORS[level];
    el.style.outlineOffset = OUTLINE_OFFSET;
    d.body.appendChild(record.badge);
    placeBadge(el, record.badge);
    records.push(record);
  }

  function makeCountLine(level, word) {
    var line = d.createElement("p");
    var dot = d.createElement("span");

    line.style.cssText = "margin:0;padding:0;color:#fff";
    dot.textContent = "\u25cf";
    dot.style.cssText = "color:" + DOTS[level] + ";margin-right:6px";
    line.appendChild(dot);
    line.appendChild(d.createTextNode(counts[level] + " " + word));
    return line;
  }

  function makePanel() {
    var wrapper = d.createElement("div");
    var heading = d.createElement("strong");
    var close = d.createElement("button");

    wrapper.setAttribute("data-a11y-alt-check", "panel");
    wrapper.setAttribute("role", "status");
    wrapper.style.cssText = [
      "position:fixed",
      "right:16px",
      "bottom:16px",
      "max-width:260px",
      "padding:12px 32px 12px 16px",
      "border-radius:6px",
      "background:#181720",
      "color:#e7eaed",
      'font:400 14px/1.5 Arial, Helvetica, "Helvetica Neue", sans-serif',
      "box-shadow:0 8px 24px rgba(0,0,0,0.35)",
      "z-index:2147483647",
    ].join(";");

    heading.textContent = "Image Alt Text Checker";
    heading.style.cssText = "display:block;margin-bottom:4px;color:#fff";
    wrapper.appendChild(heading);

    wrapper.appendChild(makeCountLine("green", "correct"));
    wrapper.appendChild(makeCountLine("gold", "flagged"));
    wrapper.appendChild(makeCountLine("red", "incorrect"));

    close.type = "button";
    close.textContent = "\u00d7";
    close.setAttribute("aria-label", "Clear the alt text check results");
    close.style.cssText = [
      "position:absolute",
      "top:6px",
      "right:6px",
      "width:24px",
      "height:24px",
      "padding:2px 6px",
      "border:none",
      "background:transparent",
      "color:#e7eaed",
      'font:16px/1 Arial, Helvetica, "Helvetica Neue", sans-serif',
      "cursor:pointer",
    ].join(";");
    close.addEventListener("click", clear);
    wrapper.appendChild(close);

    return wrapper;
  }

  function clear() {
    records.forEach(function (record) {
      record.el.style.outline = record.outline;
      record.el.style.outlineOffset = record.offset;
      if (!normalize(record.el.getAttribute("style"))) {
        record.el.removeAttribute("style");
      }
      if (record.badge.parentNode) {
        record.badge.parentNode.removeChild(record.badge);
      }
    });
    records = [];
    if (panel && panel.parentNode) {
      panel.parentNode.removeChild(panel);
    }
    panel = null;
    delete w[STATE_KEY];
  }

  deepQuery("img").filter(isVisible).forEach(mark);

  panel = makePanel();
  d.body.appendChild(panel);
  w[STATE_KEY] = { clear: clear };
})();
