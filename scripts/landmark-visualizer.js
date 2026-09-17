(function () {
  var w = window;
  var d = document;
  var STATE_KEY = "__a11yLandmarkViz";

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
    ambiguous: "gold",
    duplicate: "red",
    nested: "red",
    unnamed: "red",
  };

  var BADGES = {
    duplicate: "duplicate",
    nested: "nested in same role",
    unnamed: "no accessible name, not exposed as landmark",
    ambiguous: "ambiguous, add aria-label",
  };

  var LANDMARK_SELECTOR = "header,nav,main,aside,footer,form,section,[role]";
  var SECTIONING_SELECTOR = "article,aside,main,nav,section";

  var LANDMARK_ROLES = {
    banner: 1,
    navigation: 1,
    main: 1,
    complementary: 1,
    contentinfo: 1,
    search: 1,
    form: 1,
    region: 1,
  };

  var TAG_ROLES = {
    HEADER: "banner",
    NAV: "navigation",
    MAIN: "main",
    ASIDE: "complementary",
    FOOTER: "contentinfo",
    FORM: "form",
    SECTION: "region",
  };

  var SCOPED_TAGS = { HEADER: 1, FOOTER: 1 };
  var NAME_REQUIRED_ROLES = { region: 1, form: 1 };

  var SLOT_TAG = "SLOT";

  var records = [];
  var counts = { green: 0, gold: 0, red: 0 };
  var byRole = {};
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

  function hostOf(node) {
    var root = node.getRootNode ? node.getRootNode() : null;
    return root && root.host ? root.host : null;
  }

  function flatParentOf(el) {
    if (el.assignedSlot) {
      return el.assignedSlot.parentElement || hostOf(el.assignedSlot);
    }
    if (el.parentElement) {
      return el.parentElement;
    }
    return hostOf(el);
  }

  function ancestorMatching(el, selector) {
    var node = flatParentOf(el);
    while (node) {
      if (node.matches(selector)) {
        return node;
      }
      node = flatParentOf(node);
    }
    return null;
  }

  function byId(el, id) {
    var root = el.getRootNode();
    var found = root.getElementById ? root.getElementById(id) : null;
    return found || d.getElementById(id);
  }

  function textFrom(el) {
    return el ? normalize(el.textContent) : "";
  }

  function roleOf(el) {
    var explicit = el.getAttribute("role");
    if (explicit && LANDMARK_ROLES[explicit]) {
      return explicit;
    }
    var byTag = TAG_ROLES[el.tagName];
    if (!byTag) {
      return null;
    }
    if (SCOPED_TAGS[el.tagName] && ancestorMatching(el, SECTIONING_SELECTOR)) {
      return null;
    }
    return byTag;
  }

  function accessibleName(el) {
    var ids = normalize(el.getAttribute("aria-labelledby"));
    if (ids) {
      var referenced = normalize(
        ids
          .split(" ")
          .map(function (id) {
            return textFrom(byId(el, id));
          })
          .join(" "),
      );
      if (referenced) {
        return referenced;
      }
    }
    return normalize(el.getAttribute("aria-label"));
  }

  function isNestedInSameRole(el, role) {
    var parent = ancestorMatching(el, LANDMARK_SELECTOR);
    return !!parent && roleOf(parent) === role;
  }

  function classify(el, role, name) {
    var group = byRole[role] || [];

    if (role === "main" && group.length > 1) {
      return "duplicate";
    }
    if (isNestedInSameRole(el, role)) {
      return "nested";
    }
    if (NAME_REQUIRED_ROLES[role] && !name) {
      return "unnamed";
    }
    if (group.length > 1 && !name) {
      return "ambiguous";
    }
    return "ok";
  }

  function labelFor(kind, role, name) {
    if (kind === "ok") {
      return name ? role + ": " + name : role;
    }
    return role + " (" + BADGES[kind] + ")";
  }

  function makeBadge(kind, role, name) {
    var badge = d.createElement("div");

    badge.setAttribute("data-a11y-landmark-check", "badge");
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = labelFor(kind, role, name);
    badge.style.cssText = [
      "position:absolute",
      "top:0",
      "left:0",
      "transform:translateY(-100%)",
      "width:fit-content",
      "max-width:min(90vw, 24rem)",
      "padding:4px 8px",
      "border-radius:4px",
      "background:" + COLORS[LEVELS[kind]],
      "color:#fff",
      'font:500 16px/1.2 Arial, Helvetica, "Helvetica Neue", sans-serif',
      "pointer-events:none",
      "z-index:2147483646",
    ].join(";");
    return badge;
  }

  function mark(el) {
    var role = roleOf(el);
    var name = accessibleName(el);
    var kind = classify(el, role, name);
    var color = LEVELS[kind];
    var record = {
      el: el,
      outline: el.style.outline,
      offset: el.style.outlineOffset,
      position: el.style.position,
      badge: makeBadge(kind, role, name),
    };

    counts[color] += 1;
    el.style.outline = OUTLINES[color] + " " + COLORS[color];
    el.style.outlineOffset = OUTLINE_OFFSET;
    if (getComputedStyle(el).position === "static") {
      el.style.position = "relative";
    }
    el.insertBefore(record.badge, el.firstChild);
    records.push(record);
  }

  function makeCountLine(color, word) {
    var line = d.createElement("p");
    var dot = d.createElement("span");

    line.style.cssText = "margin:0;padding:0";
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

    wrapper.setAttribute("data-a11y-landmark-check", "panel");
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

    heading.textContent = "Landmark Visualizer";
    heading.style.cssText = "display:block;margin-bottom:4px;color:#fff";
    wrapper.appendChild(heading);

    wrapper.appendChild(makeCountLine("green", "correct"));
    wrapper.appendChild(makeCountLine("gold", "flagged"));
    wrapper.appendChild(makeCountLine("red", "incorrect"));

    close.type = "button";
    close.textContent = "\u00d7";
    close.setAttribute("aria-label", "Clear the landmark results");
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

  var landmarks = deepQuery(LANDMARK_SELECTOR).filter(function (el) {
    return roleOf(el) !== null;
  });

  landmarks.forEach(function (el) {
    var role = roleOf(el);
    byRole[role] = byRole[role] || [];
    byRole[role].push(el);
  });

  landmarks.forEach(mark);

  panel = makePanel();
  d.body.appendChild(panel);
  w[STATE_KEY] = { clear: clear };
})();
