(function () {
  var w = window;
  var d = document;
  var STATE_KEY = "__a11yContrastChecker";

  if (w[STATE_KEY]) {
    w[STATE_KEY].clear();
    return;
  }

  var COLORS = {
    green: "#1a7d4f",
    gold: "#8b6800",
    red: "#be412a"
  };

  var OUTLINES = {
    green: "5px solid",
    gold: "6px dotted",
    red: "5px dashed"
  };

  var OUTLINE_OFFSET = "3px";

  var DOTS = {
    green: "#3fbf7f",
    gold: "#e0b84f",
    red: "#e06a4f"
  };

  var LEVELS = {
    aaa: "green",
    aa: "gold",
    fail: "red"
  };

  var BADGES = {
    aaa: "passes AAA",
    aa: "passes AA, not AAA",
    fail: "fails AA"
  };

  var THRESHOLDS = {
    large: { aa: 3, aaa: 4.5 },
    normal: { aa: 4.5, aaa: 7 }
  };

  var LARGE_TEXT_SIZE = 24;
  var LARGE_BOLD_SIZE = 18.66;
  var BOLD_WEIGHT = 700;
  var DEFAULT_WEIGHT = 400;
  var RATIO_DECIMALS = 2;
  var TEXT_NODE = 3;
  var TEXT_SELECTOR = "body *";
  var COLOR_PATTERN = /rgba?\(([^)]+)\)/;
  var COLOR_SEPARATOR = /[\s,\/]+/;
  var WHITE = { r: 255, g: 255, b: 255, a: 1 };

  var records = [];
  var counts = { green: 0, gold: 0, red: 0 };
  var panel = null;

  function normalize(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function toAlpha(part) {
    var value = parseFloat(part);
    if (isNaN(value)) {
      return 1;
    }
    return part.indexOf("%") === -1 ? value : value / 100;
  }

  function parseColor(value) {
    var match = String(value).match(COLOR_PATTERN);
    if (!match) {
      return null;
    }
    var parts = match[1].split(COLOR_SEPARATOR).filter(function (part) {
      return part.length > 0;
    });
    if (parts.length < 3) {
      return null;
    }
    return {
      r: parseFloat(parts[0]),
      g: parseFloat(parts[1]),
      b: parseFloat(parts[2]),
      a: parts.length > 3 ? toAlpha(parts[3]) : 1
    };
  }

  function withAlpha(color, alpha) {
    return { r: color.r, g: color.g, b: color.b, a: alpha };
  }

  function blend(top, bottom) {
    var alpha = top.a + bottom.a * (1 - top.a);
    if (!alpha) {
      return { r: 0, g: 0, b: 0, a: 0 };
    }
    function channel(key) {
      return (top[key] * top.a + bottom[key] * bottom.a * (1 - top.a)) / alpha;
    }
    return { r: channel("r"), g: channel("g"), b: channel("b"), a: alpha };
  }

  function opacityOf(el) {
    var value = parseFloat(getComputedStyle(el).opacity);
    return isNaN(value) ? 1 : value;
  }

  function ancestorsOf(el) {
    var chain = [];
    var node = el;
    while (node) {
      chain.push(node);
      node = node.parentElement;
    }
    return chain.reverse();
  }

  function backdropOf(el) {
    var backdrop = WHITE;
    var opacity = 1;

    ancestorsOf(el).forEach(function (node) {
      opacity *= opacityOf(node);
      var background = parseColor(getComputedStyle(node).backgroundColor);
      if (background && background.a > 0) {
        backdrop = blend(withAlpha(background, background.a * opacity), backdrop);
      }
    });
    return { color: backdrop, opacity: opacity };
  }

  function channelLuminance(value) {
    var channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  }

  function relativeLuminance(color) {
    return (
      0.2126 * channelLuminance(color.r) +
      0.7152 * channelLuminance(color.g) +
      0.0722 * channelLuminance(color.b)
    );
  }

  function contrastRatio(first, second) {
    var a = relativeLuminance(first) + 0.05;
    var b = relativeLuminance(second) + 0.05;
    return a > b ? a / b : b / a;
  }

  function isLargeText(style) {
    var size = parseFloat(style.fontSize);
    var weight = parseInt(style.fontWeight, 10) || DEFAULT_WEIGHT;
    return size >= LARGE_TEXT_SIZE || (size >= LARGE_BOLD_SIZE && weight >= BOLD_WEIGHT);
  }

  function hasOwnText(el) {
    return Array.prototype.some.call(el.childNodes, function (node) {
      return node.nodeType === TEXT_NODE && normalize(node.textContent);
    });
  }

  function isRendered(el) {
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function classify(ratio, large) {
    var limits = large ? THRESHOLDS.large : THRESHOLDS.normal;
    if (ratio < limits.aa) {
      return "fail";
    }
    if (ratio < limits.aaa) {
      return "aa";
    }
    return "aaa";
  }

  function labelFor(kind, ratio, hasOpacity) {
    var text = kind === "fail" && hasOpacity ? "opacity " + BADGES[kind] : BADGES[kind];
    return ratio.toFixed(RATIO_DECIMALS) + ":1, " + text;
  }

  function makeBadge(kind, ratio, hasOpacity) {
    var badge = d.createElement("span");

    badge.setAttribute("data-a11y-contrast-check", "badge");
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = labelFor(kind, ratio, hasOpacity);
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
      "font:500 16px/1.2 Arial, Helvetica, \"Helvetica Neue\", sans-serif",
      "pointer-events:none",
      "white-space:nowrap",
      "z-index:2147483646"
    ].join(";");
    return badge;
  }

  function mark(el, kind, ratio) {
    var color = LEVELS[kind];
    var hasOpacity = opacityOf(el) < 1;
    var record = {
      el: el,
      outline: el.style.outline,
      offset: el.style.outlineOffset,
      position: el.style.position,
      opacity: el.style.opacity,
      badge: makeBadge(kind, ratio, hasOpacity)
    };

    counts[color] += 1;
    el.style.outline = OUTLINES[color] + " " + COLORS[color];
    el.style.outlineOffset = OUTLINE_OFFSET;
    if (getComputedStyle(el).position === "static") {
      el.style.position = "relative";
    }
    if (hasOpacity) {
      el.style.opacity = "1";
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

    wrapper.setAttribute("data-a11y-contrast-check", "panel");
    wrapper.setAttribute("role", "status");
    wrapper.style.cssText = [
      "position:fixed",
      "right:16px",
      "bottom:16px",
      "max-width:300px",
      "padding:12px 32px 12px 16px",
      "border-radius:6px",
      "background:#1b2430",
      "color:#e7eaed",
      "font:400 14px/1.5 Arial, Helvetica, \"Helvetica Neue\", sans-serif",
      "box-shadow:0 8px 24px rgba(0,0,0,0.35)",
      "z-index:2147483647"
    ].join(";");

    heading.textContent = "Text Contrast Checker";
    heading.style.cssText = "display:block;margin-bottom:4px;color:#fff"
    wrapper.appendChild(heading);

    wrapper.appendChild(makeCountLine("green", "AAA"));
    wrapper.appendChild(makeCountLine("gold", "AA only"));
    wrapper.appendChild(makeCountLine("red", "fail"));

    close.type = "button";
    close.textContent = "\u00d7";
    close.setAttribute("aria-label", "Clear the contrast results");
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
      record.el.style.position = record.position;
      record.el.style.opacity = record.opacity;
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
    .call(d.querySelectorAll(TEXT_SELECTOR))
    .filter(function (el) {
      return hasOwnText(el) && isRendered(el);
    })
    .forEach(function (el) {
      var style = getComputedStyle(el);
      var foreground = parseColor(style.color);
      if (!foreground) {
        return;
      }
      var backdrop = backdropOf(el);
      var alpha = foreground.a * backdrop.opacity;
      if (!alpha) {
        return;
      }
      var painted = blend(withAlpha(foreground, alpha), backdrop.color);
      var ratio = contrastRatio(painted, backdrop.color);
      var kind = classify(ratio, isLargeText(style));
      mark(el, kind, ratio);
    });

  panel = makePanel();
  d.body.appendChild(panel);
  w[STATE_KEY] = { clear: clear };
})();
