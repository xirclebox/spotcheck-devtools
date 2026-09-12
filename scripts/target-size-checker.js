(function () {
  var w = window;
  var d = document;
  var STATE_KEY = "__a11yTargetSizeChecker";

  if (w[STATE_KEY]) {
    w[STATE_KEY].clear();
    return;
  }

  var MIN_SIZE = 24;
  var ENHANCED_SIZE = 44;
  var SPACING_RADIUS = 12;
  var LABEL_GAP = 24;

  var COLORS = {
    green: "#1a7d4f",
    gold: "#8b6800",
    red: "#be412a",
    grey: "#4a5464",
  };

  var OUTLINES = {
    green: "5px solid",
    gold: "6px dotted",
    red: "6px dashed",
    grey: "3px dotted",
  };

  var OUTLINE_OFFSET = "3px";

  var DOTS = {
    green: "#3fbf7f",
    gold: "#e0b84f",
    red: "#e06a4f",
    grey: "#9aa4b2",
  };

  var LEVELS = {
    enhanced: "green",
    minimum: "gold",
    spacing: "gold",
    small: "red",
    inline: "grey",
  };

  var BADGES = {
    enhanced: "Meets 2.5.5 Enhanced",
    minimum: "Meets 2.5.8 Minimum",
    spacing: "Under 24, spacing exception",
    small: "Under 24 by 24",
    inline: "Inline in text, exempt",
  };

  var SELECTOR = [
    "a[href]",
    "area[href]",
    "button",
    "input:not([type=hidden])",
    "select",
    "textarea",
    "summary",
    "audio[controls]",
    "video[controls]",
    "[tabindex]:not([tabindex^='-'])",
    "[role=button]",
    "[role=link]",
    "[role=checkbox]",
    "[role=radio]",
    "[role=switch]",
    "[role=tab]",
    "[role=menuitem]",
    "[role=menuitemcheckbox]",
    "[role=menuitemradio]",
    "[role=option]",
    "[role=slider]",
    "[role=spinbutton]",
    "[role=treeitem]",
  ].join(",");

  var records = [];
  var counts = { green: 0, gold: 0, red: 0, grey: 0 };
  var panel = null;

  function normalize(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function isOperable(el) {
    if (el.disabled) {
      return false;
    }
    if (el.getAttribute("aria-disabled") === "true") {
      return false;
    }
    if (el.closest("[inert]")) {
      return false;
    }
    var style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isNested(el, lookup) {
    var parent = el.parentElement;
    while (parent) {
      if (lookup.has(parent)) {
        return true;
      }
      parent = parent.parentElement;
    }
    return false;
  }

  function union(a, b) {
    var left = Math.min(a.left, b.left);
    var top = Math.min(a.top, b.top);
    var right = Math.max(a.right, b.right);
    var bottom = Math.max(a.bottom, b.bottom);
    return {
      left: left,
      top: top,
      right: right,
      bottom: bottom,
      width: right - left,
      height: bottom - top,
    };
  }

  function isAdjacent(a, b) {
    var gapX = Math.max(a.left - b.right, b.left - a.right);
    var gapY = Math.max(a.top - b.bottom, b.top - a.bottom);
    return gapX < LABEL_GAP && gapY < LABEL_GAP;
  }

  function labelRect(el) {
    var type = (el.getAttribute("type") || "").toLowerCase();
    if (el.tagName !== "INPUT" || (type !== "checkbox" && type !== "radio")) {
      return null;
    }
    var label = el.labels && el.labels.length ? el.labels[0] : null;
    if (!label) {
      return null;
    }
    var rect = label.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return null;
    }
    return rect;
  }

  function targetRect(el) {
    var rect = el.getBoundingClientRect();
    var label = labelRect(el);
    if (label && isAdjacent(rect, label)) {
      return union(rect, label);
    }
    return rect;
  }

  function isInlineTarget(el) {
    if (getComputedStyle(el).display !== "inline") {
      return false;
    }
    var parent = el.parentNode;
    if (!parent) {
      return false;
    }
    var nodes = parent.childNodes;
    var text = "";
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      if (nodes[i] !== el && nodes[i].nodeType === 3) {
        text += nodes[i].nodeValue;
      }
    }
    return normalize(text).length > 0;
  }

  function center(rect) {
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  function circleHitsRect(point, radius, rect) {
    var nearestX = Math.max(rect.left, Math.min(point.x, rect.right));
    var nearestY = Math.max(rect.top, Math.min(point.y, rect.bottom));
    var dx = point.x - nearestX;
    var dy = point.y - nearestY;
    return dx * dx + dy * dy < radius * radius;
  }

  function passesSpacing(item, items) {
    var point = center(item.rect);
    var i;
    var other;
    var otherPoint;
    var dx;
    var dy;

    for (i = 0; i < items.length; i += 1) {
      other = items[i];
      if (other === item) {
        continue;
      }
      if (other.undersized) {
        otherPoint = center(other.rect);
        dx = point.x - otherPoint.x;
        dy = point.y - otherPoint.y;
        if (dx * dx + dy * dy < MIN_SIZE * MIN_SIZE) {
          return false;
        }
      } else if (circleHitsRect(point, SPACING_RADIUS, other.rect)) {
        return false;
      }
    }
    return true;
  }

  function classify(item, items) {
    if (item.rect.width >= ENHANCED_SIZE && item.rect.height >= ENHANCED_SIZE) {
      return "enhanced";
    }
    if (isInlineTarget(item.el)) {
      return "inline";
    }
    if (item.rect.width >= MIN_SIZE && item.rect.height >= MIN_SIZE) {
      return "minimum";
    }
    return passesSpacing(item, items) ? "spacing" : "small";
  }

  function labelFor(item, kind) {
    var size =
      Math.round(item.rect.width) + "\u00d7" + Math.round(item.rect.height);
    return size + " \u00b7 " + BADGES[kind];
  }

  function makeBadge(item, kind) {
    var level = LEVELS[kind];
    var badge = d.createElement("div");

    badge.setAttribute("data-a11y-target-size", "badge");
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = labelFor(item, kind);
    badge.style.cssText = [
      "position:absolute",
      "width:fit-content",
      "max-width:min(90vw, 24rem)",
      "padding:2px 6px",
      "border-radius:4px",
      "background:" + COLORS[level],
      "color:#fff",
      'font:500 13px/1.3 Arial, Helvetica, "Helvetica Neue", sans-serif',
      "pointer-events:none",
      "z-index:2147483646",
    ].join(";");
    return badge;
  }

  function placeBadge(item, badge) {
    var badgeRect = badge.getBoundingClientRect();

    badge.style.top = item.rect.top + w.scrollY - badgeRect.height - 4 + "px";
    badge.style.left = item.rect.left + w.scrollX + "px";
  }

  function mark(item, items) {
    var kind = classify(item, items);
    var level = LEVELS[kind];
    var el = item.el;
    var record = {
      el: el,
      outline: el.style.outline,
      offset: el.style.outlineOffset,
      badge: makeBadge(item, kind),
    };

    counts[level] += 1;
    el.style.outline = OUTLINES[level] + " " + COLORS[level];
    el.style.outlineOffset = OUTLINE_OFFSET;
    d.body.appendChild(record.badge);
    placeBadge(item, record.badge);
    records.push(record);
  }

  function makeCountLine(level, word) {
    var line = d.createElement("p");
    var dot = d.createElement("span");

    line.style.cssText = "margin:0;padding:0";
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

    wrapper.setAttribute("data-a11y-target-size", "panel");
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

    heading.textContent = "Target Size Checker";
    heading.style.cssText = "display:block;margin-bottom:4px";
    wrapper.appendChild(heading);

    wrapper.appendChild(makeCountLine("green", "meet 44 by 44"));
    wrapper.appendChild(makeCountLine("gold", "meet 24 by 24"));
    wrapper.appendChild(makeCountLine("red", "under 24 by 24"));
    wrapper.appendChild(makeCountLine("grey", "inline, exempt"));

    close.type = "button";
    close.textContent = "\u00d7";
    close.setAttribute("aria-label", "Clear the target size check results");
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

  var elements = Array.prototype.slice
    .call(d.querySelectorAll(SELECTOR))
    .filter(isOperable);

  var lookup = new WeakSet(elements);

  var items = elements
    .filter(function (el) {
      return !isNested(el, lookup);
    })
    .map(function (el) {
      var rect = targetRect(el);
      return {
        el: el,
        rect: rect,
        undersized: rect.width < MIN_SIZE || rect.height < MIN_SIZE,
      };
    });

  items.forEach(function (item) {
    mark(item, items);
  });

  panel = makePanel();
  d.body.appendChild(panel);
  w[STATE_KEY] = { clear: clear };
})();
