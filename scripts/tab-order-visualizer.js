(function () {
  var w = window;
  var d = document;
  var STATE_KEY = "__a11yTabOrder";

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
    natural: "green",
    positive: "red"
  };

  var NOTE_PREFIX = "tabindex=";
  var NOTE_SUFFIX = ", positive tabindex";

  var FOCUSABLE_SELECTOR =
    "a[href],button,input,select,textarea,details,[tabindex],[contenteditable=\"true\"]";
  var REPLACED_TAGS = { INPUT: 1, TEXTAREA: 1, SELECT: 1, IMG: 1 };
  var HIDDEN_INPUT_TYPE = "hidden";
  var COUNTER_SIZE = 24;
  var COUNTER_OFFSET = 12;

  var records = [];
  var counts = { green: 0, red: 0 };
  var panel = null;

  function normalize(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function isVisible(el) {
    var style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isFocusable(el) {
    if (el.hasAttribute("disabled")) {
      return false;
    }
    if (el.tabIndex < 0) {
      return false;
    }
    if (el.tagName === "INPUT" && el.type === HIDDEN_INPUT_TYPE) {
      return false;
    }
    return isVisible(el);
  }

  function isReplaced(el) {
    return !!REPLACED_TAGS[el.tagName];
  }

  function classify(el) {
    return el.tabIndex > 0 ? "positive" : "natural";
  }

  function tabOrder(elements) {
    var positive = elements
      .filter(function (el) {
        return el.tabIndex > 0;
      })
      .sort(function (a, b) {
        return a.tabIndex - b.tabIndex;
      });
    var natural = elements.filter(function (el) {
      return el.tabIndex <= 0;
    });
    return positive.concat(natural);
  }

  function makeCounter(kind, order) {
    var counter = d.createElement("span");

    counter.setAttribute("data-a11y-tab-check", "counter");
    counter.setAttribute("aria-hidden", "true");
    counter.textContent = order;
    counter.style.cssText = [
      "position:absolute",
      "top:-" + COUNTER_OFFSET + "px",
      "left:-" + COUNTER_OFFSET + "px",
      "min-width:" + COUNTER_SIZE + "px",
      "height:" + COUNTER_SIZE + "px",
      "border-radius:50%",
      "background:" + COLORS[LEVELS[kind]],
      "color:#fff",
      "font:700 16px/" + COUNTER_SIZE + "px Arial, Helvetica, \"Helvetica Neue\", sans-serif",
      "text-align:center",
      "pointer-events:none",
      "z-index:2147483646"
    ].join(";");
    return counter;
  }

  function makeNote(kind, el) {
    var note = d.createElement("span");

    note.setAttribute("data-a11y-tab-check", "note");
    note.setAttribute("aria-hidden", "true");
    note.textContent = NOTE_PREFIX + el.tabIndex + NOTE_SUFFIX;
    note.style.cssText = [
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
    return note;
  }

  function placeOnPage(el, badge, offset) {
    var rect = el.getBoundingClientRect();
    var badgeRect = badge.getBoundingClientRect();
    var top = offset ? rect.top - COUNTER_OFFSET : rect.top - badgeRect.height;
    var left = offset ? rect.left - COUNTER_OFFSET : rect.left;

    badge.style.transform = "none";
    badge.style.top = top + w.scrollY + "px";
    badge.style.left = left + w.scrollX + "px";
  }

  function attachCounter(el, counter) {
    if (!isReplaced(el)) {
      el.appendChild(counter);
      return;
    }
    d.body.appendChild(counter);
    placeOnPage(el, counter, true);
  }

  function attachNote(el, note) {
    if (!isReplaced(el)) {
      el.insertBefore(note, el.firstChild);
      return;
    }
    d.body.appendChild(note);
    placeOnPage(el, note, false);
  }

  function mark(el, order) {
    var kind = classify(el);
    var color = LEVELS[kind];
    var record = {
      el: el,
      outline: el.style.outline,
      offset: el.style.outlineOffset,
      position: el.style.position,
      counter: makeCounter(kind, order),
      note: kind === "positive" ? makeNote(kind, el) : null
    };

    counts[color] += 1;
    el.style.outline = OUTLINES[color] + " " + COLORS[color];
    el.style.outlineOffset = OUTLINE_OFFSET;
    if (getComputedStyle(el).position === "static") {
      el.style.position = "relative";
    }
    attachCounter(el, record.counter);
    if (record.note) {
      attachNote(el, record.note);
    }
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

    wrapper.setAttribute("data-a11y-tab-check", "panel");
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

    heading.textContent = "Tab Order Visualizer";
    heading.style.cssText = "display:block;margin-bottom:4px;color:#fff"
    wrapper.appendChild(heading);

    wrapper.appendChild(makeCountLine("green", "natural order"));
    wrapper.appendChild(makeCountLine("red", "positive tabindex"));

    close.type = "button";
    close.textContent = "\u00d7";
    close.setAttribute("aria-label", "Clear the tab order results");
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

  function removeBadge(badge) {
    if (badge && badge.parentNode) {
      badge.parentNode.removeChild(badge);
    }
  }

  function clear() {
    records.forEach(function (record) {
      record.el.style.outline = record.outline;
      record.el.style.outlineOffset = record.offset;
      record.el.style.position = record.position;
      if (!normalize(record.el.getAttribute("style"))) {
        record.el.removeAttribute("style");
      }
      removeBadge(record.counter);
      removeBadge(record.note);
    });
    records = [];
    if (panel && panel.parentNode) {
      panel.parentNode.removeChild(panel);
    }
    panel = null;
    delete w[STATE_KEY];
  }

  tabOrder(
    Array.prototype.filter.call(d.querySelectorAll(FOCUSABLE_SELECTOR), isFocusable)
  ).forEach(function (el, index) {
    mark(el, index + 1);
  });

  panel = makePanel();
  d.body.appendChild(panel);
  w[STATE_KEY] = { clear: clear };
})();
