(function () {
  var w = window;
  var d = document;
  var STATE_KEY = "__a11yLinkAuditor";

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
    short: "gold",
    generic: "red",
    missing: "red",
  };

  var BADGES = {
    ok: "Link text",
    short: "Very short link text, confirm it is descriptive",
    generic: "Generic text out of context",
    missing: "No accessible name",
  };

  var QUOTED_KINDS = ["ok", "generic"];

  var GENERIC_NAMES = [
    "click here",
    "here",
    "read more",
    "more",
    "link",
    "more info",
    "learn more",
    "this link",
  ];

  var MIN_NAME_LENGTH = 4;
  var HIDDEN_SELECTOR = '[aria-hidden="true"]';
  var TEXT_NODE = 3;
  var ELEMENT_NODE = 1;
  var NOTE_ATTRIBUTE = "data-a11y-link-check-note";

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

  function byId(el, id) {
    var root = el.getRootNode();
    var found = root.getElementById ? root.getElementById(id) : null;
    return found || d.getElementById(id);
  }

  function textFrom(el) {
    return el ? normalize(el.textContent) : "";
  }

  function referencedText(el) {
    var ids = normalize(el.getAttribute("aria-labelledby"));
    if (!ids) {
      return "";
    }
    return normalize(
      ids
        .split(" ")
        .map(function (id) {
          return textFrom(byId(el, id));
        })
        .join(" "),
    );
  }

  function flatChildNodes(node) {
    if (node.tagName === SLOT_TAG && node.assignedNodes) {
      var assigned = node.assignedNodes({ flatten: true });
      if (assigned.length) {
        return assigned;
      }
    }
    return Array.prototype.slice.call(node.childNodes);
  }

  function visibleText(el) {
    var parts = [];

    function walk(node) {
      flatChildNodes(node).forEach(function (child) {
        if (child.nodeType === TEXT_NODE) {
          parts.push(child.nodeValue);
          return;
        }
        if (child.nodeType !== ELEMENT_NODE) {
          return;
        }
        if (child.matches(HIDDEN_SELECTOR)) {
          return;
        }
        if (child.shadowRoot) {
          walk(child.shadowRoot);
          return;
        }
        walk(child);
      });
    }

    walk(el.shadowRoot || el);
    return normalize(parts.join(" "));
  }

  function imageText(el) {
    var img = deepQuery("img[alt]", el)[0];
    return img ? normalize(img.getAttribute("alt")) : "";
  }

  function accessibleName(el) {
    return (
      referencedText(el) ||
      normalize(el.getAttribute("aria-label")) ||
      visibleText(el) ||
      imageText(el) ||
      normalize(el.getAttribute("title"))
    );
  }

  function classify(name) {
    if (!name) {
      return "missing";
    }
    if (GENERIC_NAMES.indexOf(name.toLowerCase()) !== -1) {
      return "generic";
    }
    if (name.length < MIN_NAME_LENGTH) {
      return "short";
    }
    return "ok";
  }

  function labelFor(kind, name) {
    if (QUOTED_KINDS.indexOf(kind) === -1) {
      return BADGES[kind];
    }
    return BADGES[kind] + ': "' + name + '"';
  }

  function makeBadge(kind, name) {
    var badge = d.createElement("span");

    badge.setAttribute("data-a11y-link-check", "badge");
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = labelFor(kind, name);
    badge.style.cssText = [
      "position:absolute",
      "top:0",
      "left:0",
      "transform:translateY(-100%)",
      "max-width:min(90vw, 24rem)",
      "padding:4px 8px",
      "border-radius:4px",
      "background:" + COLORS[LEVELS[kind]],
      "color:#fff",
      'font:500 16px/1.2 Arial, Helvetica, "Helvetica Neue", sans-serif',
      "z-index:2147483646",
      "pointer-events:none",
      "white-space: nowrap",
    ].join(";");
    return badge;
  }

  function mark(el) {
    var name = accessibleName(el);
    var kind = classify(name);
    var color = LEVELS[kind];
    var record = {
      el: el,
      outline: el.style.outline,
      offset: el.style.outlineOffset,
      position: el.style.position,
      badge: makeBadge(kind, name),
    };

    counts[color] += 1;
    el.style.outline = OUTLINES[color] + " " + COLORS[color];
    el.style.outlineOffset = OUTLINE_OFFSET;
    el.setAttribute(NOTE_ATTRIBUTE, labelFor(kind, name));
    if (getComputedStyle(el).position === "static") {
      el.style.position = "relative";
    }
    el.insertBefore(record.badge, el.firstChild);
    records.push(record);
  }

  function makeCountLine(color, word) {
    var line = d.createElement("p");
    var dot = d.createElement("span");

    line.style.cssText = "margin:0;padding:0;color:#fff";
    dot.textContent = "\u25cf";
    dot.style.cssText = "color:" + DOTS[color] + ";margin-right:6px";
    line.appendChild(dot);
    line.appendChild(d.createTextNode(counts[color] + " " + word));
    return line;
  }

  function makePanel() {
    var wrapper = d.createElement("div");
    var heading = d.createElement("strong");
    var close = d.createElement("button");

    wrapper.setAttribute("data-a11y-link-check", "panel");
    wrapper.setAttribute("role", "status");
    wrapper.style.cssText = [
      "position:fixed",
      "right:16px",
      "bottom:16px",
      "max-width:300px",
      "padding:12px 32px 12px 16px",
      "border-radius:6px",
      "background:#181720",
      "color:#e7eaed",
      'font:400 14px/1.5 Arial, Helvetica, "Helvetica Neue", sans-serif',
      "box-shadow:0 8px 24px rgba(0,0,0,0.35)",
      "z-index:2147483647",
    ].join(";");

    heading.textContent = "Link Accessibility Auditor";
    heading.style.cssText = "display:block;margin-bottom:4px;color:#fff";
    wrapper.appendChild(heading);

    wrapper.appendChild(makeCountLine("green", "correct"));
    wrapper.appendChild(makeCountLine("gold", "flagged"));
    wrapper.appendChild(makeCountLine("red", "incorrect"));

    close.type = "button";
    close.textContent = "\u00d7";
    close.setAttribute("aria-label", "Clear the link audit results");
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
      record.el.style.position = record.position;
      record.el.removeAttribute(NOTE_ATTRIBUTE);
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

  deepQuery("a").forEach(mark);

  panel = makePanel();
  d.body.appendChild(panel);
  w[STATE_KEY] = { clear: clear };
})();
