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
    red: "#be412a",
  };

  var OUTLINES = {
    green: "5px solid",
    red: "5px dashed",
  };

  var OUTLINE_OFFSET = "3px";

  var DOTS = {
    green: "#3fbf7f",
    red: "#e06a4f",
  };

  var LEVELS = {
    natural: "green",
    positive: "red",
  };

  var NOTE_PREFIX = "tabindex=";
  var NOTE_SUFFIX = ", positive tabindex";
  var SHADOW_PREFIX = "inside ";
  var SHADOW_SUFFIX = " shadow DOM";
  var SLOT_PREFIX = "slotted into ";
  var NOTE_SEPARATOR = ", ";
  var TOTAL_WORD = "tab stop";
  var CLOSED_WORD = "closed shadow root";
  var CLOSED_SUFFIX = ", not inspectable";

  var FOCUSABLE_SELECTOR =
    'a[href],button,input,select,textarea,details,[tabindex],[contenteditable="true"]';
  var REPLACED_TAGS = { INPUT: 1, TEXTAREA: 1, SELECT: 1, IMG: 1 };
  var HIDDEN_INPUT_TYPE = "hidden";
  var SLOT_TAG = "SLOT";
  var COUNTER_SIZE = 24;
  var COUNTER_OFFSET = 12;

  var records = [];
  var counts = { green: 0, red: 0, closed: 0 };
  var panel = null;

  function plural(count, word) {
    return count + " " + word + (count === 1 ? "" : "s");
  }

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
    if (!el.matches(FOCUSABLE_SELECTOR)) {
      return false;
    }
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

  function isCustomElement(el) {
    return el.tagName.indexOf("-") !== -1;
  }

  function isClosedHost(el) {
    return (
      isCustomElement(el) &&
      !el.shadowRoot &&
      !el.children.length &&
      !!(w.customElements && w.customElements.get(el.localName))
    );
  }

  function classify(el) {
    return el.tabIndex > 0 ? "positive" : "natural";
  }

  function hostName(host) {
    return host ? host.localName : "";
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

  function collectScope(root, host, seen) {
    var entries = [];

    function walk(node) {
      flatChildren(node).forEach(function (el) {
        if (seen.indexOf(el) !== -1) {
          return;
        }
        seen.push(el);

        var entry = null;
        if (isFocusable(el)) {
          entry = { el: el, tabIndex: el.tabIndex, host: host, sub: null };
          entries.push(entry);
        }

        var shadow = el.shadowRoot;
        if (shadow) {
          var sub = tabOrder(collectScope(shadow, el, seen));
          if (shadow.delegatesFocus && entry && sub.length) {
            entries.splice(entries.indexOf(entry), 1);
            entry = null;
          }
          if (sub.length) {
            if (entry) {
              entry.sub = sub;
            } else {
              entries.push({
                el: null,
                tabIndex: el.tabIndex > 0 ? el.tabIndex : 0,
                host: host,
                sub: sub,
              });
            }
          }
          return;
        }

        if (isClosedHost(el)) {
          counts.closed += 1;
          return;
        }

        walk(el);
      });
    }

    walk(root);
    return entries;
  }

  function tabOrder(entries) {
    var positive = entries
      .filter(function (entry) {
        return entry.tabIndex > 0;
      })
      .sort(function (a, b) {
        return a.tabIndex - b.tabIndex;
      });
    var natural = entries.filter(function (entry) {
      return entry.tabIndex <= 0;
    });
    return positive.concat(natural);
  }

  function flatten(entries, list) {
    entries.forEach(function (entry) {
      if (entry.el) {
        list.push(entry);
      }
      if (entry.sub) {
        flatten(entry.sub, list);
      }
    });
    return list;
  }

  function noteText(entry) {
    var parts = [];
    if (entry.el.tabIndex > 0) {
      parts.push(NOTE_PREFIX + entry.el.tabIndex + NOTE_SUFFIX);
    }
    if (entry.host) {
      parts.push(
        entry.el.getRootNode() === entry.host.shadowRoot
          ? SHADOW_PREFIX + hostName(entry.host) + SHADOW_SUFFIX
          : SLOT_PREFIX + hostName(entry.host),
      );
    }
    return parts.join(NOTE_SEPARATOR);
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
      "font:700 16px/" +
        COUNTER_SIZE +
        'px Arial, Helvetica, "Helvetica Neue", sans-serif',
      "text-align:center",
      "pointer-events:none",
      "z-index:2147483646",
    ].join(";");
    return counter;
  }

  function makeNote(kind, text) {
    var note = d.createElement("span");

    note.setAttribute("data-a11y-tab-check", "note");
    note.setAttribute("aria-hidden", "true");
    note.textContent = text;
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
      'font:500 16px/1.2 Arial, Helvetica, "Helvetica Neue", sans-serif',
      "pointer-events:none",
      "white-space:nowrap",
      "z-index:2147483646",
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

  function mark(entry, order) {
    var el = entry.el;
    var kind = classify(el);
    var color = LEVELS[kind];
    var text = noteText(entry);
    var record = {
      el: el,
      outline: el.style.outline,
      offset: el.style.outlineOffset,
      position: el.style.position,
      counter: makeCounter(kind, order),
      note: text ? makeNote(kind, text) : null,
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

    line.style.cssText = "margin:0;padding:0;color:#fff";
    dot.textContent = "\u25cf";
    dot.style.cssText = "color:" + DOTS[color] + ";margin-right:6px";
    line.appendChild(dot);
    line.appendChild(d.createTextNode(counts[color] + " " + word));
    return line;
  }

  function makeTextLine(text) {
    var line = d.createElement("p");

    line.style.cssText = "margin:4px 0 0;padding:0";
    line.textContent = text;
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
      "background:#181720",
      "color:#e7eaed",
      'font:400 14px/1.5 Arial, Helvetica, "Helvetica Neue", sans-serif',
      "box-shadow:0 8px 24px rgba(0,0,0,0.35)",
      "z-index:2147483647",
    ].join(";");

    heading.textContent = "Tab Order Visualizer";
    heading.style.cssText = "display:block;margin-bottom:4px;color:#fff";
    wrapper.appendChild(heading);

    wrapper.appendChild(makeCountLine("green", "natural order"));
    wrapper.appendChild(makeCountLine("red", "positive tabindex"));

    wrapper.appendChild(
      makeTextLine(plural(counts.green + counts.red, TOTAL_WORD)),
    );

    if (counts.closed) {
      wrapper.appendChild(
        makeTextLine(plural(counts.closed, CLOSED_WORD) + CLOSED_SUFFIX),
      );
    }

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
      'font:16px/1 Arial, Helvetica, "Helvetica Neue", sans-serif',
      "cursor:pointer",
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

  flatten(tabOrder(collectScope(d.body, null, [])), []).forEach(
    function (entry, index) {
      mark(entry, index + 1);
    },
  );

  panel = makePanel();
  d.body.appendChild(panel);
  w[STATE_KEY] = { clear: clear };
})();
