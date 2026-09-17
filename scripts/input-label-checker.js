(function () {
  var w = window;
  var d = document;
  var STATE_KEY = "__a11yInputLabelChecker";

  if (w[STATE_KEY]) {
    w[STATE_KEY].clear();
    return;
  }

  var COLORS = {
    explicit: "#1a7d4f",
    implicit: "#8b6800",
    missing: "#be412a",
  };

  var OUTLINES = {
    explicit: "5px solid",
    implicit: "6px dotted",
    missing: "5px dashed",
  };

  var OUTLINE_OFFSET = "3px";

  var DOTS = {
    explicit: "#3fbf7f",
    implicit: "#e0b84f",
    missing: "#e06a4f",
  };

  var BADGES = {
    explicit: "Explicit label",
    implicit: "Implicit label",
    missing: "No label",
  };

  var SKIP_TYPES = ["hidden", "submit", "reset", "button", "image"];

  var SLOT_TAG = "SLOT";

  var records = [];
  var counts = { explicit: 0, implicit: 0, missing: 0 };
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

  function labelsFor(el) {
    if (el.labels && el.labels.length) {
      return Array.prototype.slice.call(el.labels);
    }
    var found = [];
    if (el.id) {
      Array.prototype.slice
        .call(el.getRootNode().querySelectorAll("label"))
        .forEach(function (label) {
          if (label.getAttribute("for") === el.id) {
            found.push(label);
          }
        });
    }
    var wrapping = el.closest ? el.closest("label") : null;
    if (wrapping && found.indexOf(wrapping) === -1) {
      found.push(wrapping);
    }
    return found;
  }

  function ariaLabelledByText(el) {
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

  function classify(el) {
    var hasExplicit = false;
    var hasImplicit = false;

    labelsFor(el).forEach(function (label) {
      if (!textFrom(label)) {
        return;
      }
      if (el.id && label.getAttribute("for") === el.id) {
        hasExplicit = true;
      } else if (label.contains(el)) {
        hasImplicit = true;
      }
    });

    if (hasExplicit) {
      return "explicit";
    }
    if (hasImplicit) {
      return "implicit";
    }
    if (ariaLabelledByText(el)) {
      return "implicit";
    }
    if (normalize(el.getAttribute("aria-label"))) {
      return "implicit";
    }
    if (normalize(el.getAttribute("title"))) {
      return "implicit";
    }
    return "missing";
  }

  function makeBadge(kind) {
    var badge = d.createElement("span");
    badge.setAttribute("data-a11y-label-check", "badge");
    badge.textContent = BADGES[kind];
    badge.style.cssText = [
      "display:inline-block",
      "width:fit-content",
      "justify-self:start",
      "margin:0 0 0 4px",
      "padding:4px 8px",
      "border-radius:4px",
      "background:" + COLORS[kind],
      "color:#fff",
      'font:500 16px/1.2 Arial, Helvetica, "Helvetica Neue", sans-serif',
      "letter-spacing:0.04em",
      "vertical-align:middle",
      "position:relative",
      "z-index:2147483646",
    ].join(";");
    return badge;
  }

  function mark(el) {
    var kind = classify(el);
    var record = {
      el: el,
      outline: el.style.outline,
      offset: el.style.outlineOffset,
      badge: makeBadge(kind),
    };

    counts[kind] += 1;
    el.style.outline = OUTLINES[kind] + " " + COLORS[kind];
    el.style.outlineOffset = OUTLINE_OFFSET;
    el.insertAdjacentElement("afterend", record.badge);
    records.push(record);
  }

  function makeCountLine(kind, word) {
    var line = d.createElement("p");
    var dot = d.createElement("span");

    line.style.cssText = "margin:0;padding:0";
    dot.textContent = "\u25cf";
    dot.style.cssText = "color:" + DOTS[kind] + ";margin-right:6px";
    line.appendChild(dot);
    line.appendChild(d.createTextNode(counts[kind] + " " + word));
    return line;
  }

  function makePanel() {
    var wrapper = d.createElement("div");
    var heading = d.createElement("strong");
    var close = d.createElement("button");

    wrapper.setAttribute("data-a11y-label-check", "panel");
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

    heading.textContent = "Input Label Checker";
    heading.style.cssText = "display:block;margin-bottom:4px;color:#fff";
    wrapper.appendChild(heading);

    wrapper.appendChild(makeCountLine("explicit", "explicit"));
    wrapper.appendChild(makeCountLine("implicit", "implicit"));
    wrapper.appendChild(makeCountLine("missing", "no label"));

    close.type = "button";
    close.textContent = "\u00d7";
    close.setAttribute("aria-label", "Clear the label check results");
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

  deepQuery("input, select, textarea")
    .filter(function (el) {
      return SKIP_TYPES.indexOf(el.type) === -1;
    })
    .forEach(mark);

  panel = makePanel();
  d.body.appendChild(panel);
  w[STATE_KEY] = { clear: clear };
})();
