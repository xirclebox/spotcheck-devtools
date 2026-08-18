(function () {
  var w = window;
  var d = document;
  var STATE_KEY = "__a11yHeadingOrder";

  if (w[STATE_KEY]) {
    w[STATE_KEY].clear();
    return;
  }

  var COLORS = {
    green: "#1a7d4f",
    red: "#be412a"
  };

  var OUTLINES = {
    green: "5px solid",
    red: "5px dashed"
  };

  var OUTLINE_OFFSET = "3px";

  var DOTS = {
    green: "#3fbf7f",
    red: "#e06a4f"
  };

  var LEVELS = {
    ok: "green",
    empty: "red",
    multiple: "red",
    skipped: "red"
  };

  var BADGES = {
    ok: "Pass",
    empty: "Empty heading",
    multiple: "Multiple top-level headings",
    skipped: "Skipped from"
  };

  var HEADING_SELECTOR = "h1,h2,h3,h4,h5,h6,[role=\"heading\"]";
  var TAG_PATTERN = /^H([1-6])$/;
  var DEFAULT_ARIA_LEVEL = 2;

  var records = [];
  var counts = { green: 0, red: 0 };
  var lastGoodLevel = 0;
  var seenTopLevel = false;
  var panel = null;

  function normalize(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function levelOf(el) {
    if (el.getAttribute("role") === "heading") {
      var ariaLevel = parseInt(el.getAttribute("aria-level"), 10);
      return isNaN(ariaLevel) ? DEFAULT_ARIA_LEVEL : ariaLevel;
    }
    var match = el.tagName.match(TAG_PATTERN);
    return match ? parseInt(match[1], 10) : null;
  }

  function classify(el, level) {
    if (!normalize(el.textContent)) {
      return "empty";
    }
    if (level === 1) {
      if (seenTopLevel) {
        lastGoodLevel = 1;
        return "multiple";
      }
      seenTopLevel = true;
      lastGoodLevel = 1;
      return "ok";
    }
    if (level > lastGoodLevel + 1) {
      return "skipped";
    }
    lastGoodLevel = level;
    return "ok";
  }

  function labelFor(kind, level) {
    var label = "H" + level + ": " + BADGES[kind];
    if (kind === "skipped") {
      return label + " H" + lastGoodLevel;
    }
    return label;
  }

  function makeBadge(kind, level) {
    var badge = d.createElement("span");

    badge.setAttribute("data-a11y-heading-check", "badge");
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = labelFor(kind, level);
    badge.style.cssText = [
      "display:inline-block",
      "width:fit-content",
      "justify-self:start",
      "margin:0 0 0 4px",
      "padding:4px 8px",
      "border-radius:4px",
      "background:" + COLORS[LEVELS[kind]],
      "color:#fff",
      "font:500 16px/1.2 Arial, Helvetica, \"Helvetica Neue\", sans-serif",
      "vertical-align:middle",
      "position:relative",
      "z-index:2147483646"
    ].join(";");
    return badge;
  }

  function mark(el) {
    var level = levelOf(el);
    var kind = classify(el, level);
    var color = LEVELS[kind];
    var record = {
      el: el,
      outline: el.style.outline,
      offset: el.style.outlineOffset,
      badge: makeBadge(kind, level)
    };

    counts[color] += 1;
    el.style.outline = OUTLINES[color] + " " + COLORS[color];
    el.style.outlineOffset = OUTLINE_OFFSET;
    el.appendChild(record.badge);
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

    wrapper.setAttribute("data-a11y-heading-check", "panel");
    wrapper.setAttribute("role", "status");
    wrapper.style.cssText = [
      "position:fixed",
      "right:16px",
      "bottom:16px",
      "max-width:260px",
      "padding:12px 32px 12px 16px",
      "border-radius:6px",
      "background:#1b2430",
      "color:#e7eaed",
      "font:400 14px/1.5 Arial, Helvetica, \"Helvetica Neue\", sans-serif",
      "box-shadow:0 8px 24px rgba(0,0,0,0.35)",
      "z-index:2147483647"
    ].join(";");

    heading.textContent = "Heading Hierarchy Validator";
    heading.style.cssText = "display:block;margin-bottom:4px;color:#fff"
    wrapper.appendChild(heading);

    wrapper.appendChild(makeCountLine("green", "passed"));
    wrapper.appendChild(makeCountLine("red", "failed"));

    close.type = "button";
    close.textContent = "\u00d7";
    close.setAttribute("aria-label", "Clear the heading order results");
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
      "font:16px/1 Arial, Helvetica, \"Helvetica Neue\", sans-serif",
      "cursor:pointer"
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

  Array.prototype.slice
    .call(d.querySelectorAll(HEADING_SELECTOR))
    .filter(function (el) {
      return levelOf(el) !== null;
    })
    .forEach(mark);

  panel = makePanel();
  d.body.appendChild(panel);
  w[STATE_KEY] = { clear: clear };
})();
