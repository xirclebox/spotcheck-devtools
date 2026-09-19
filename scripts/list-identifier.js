(function () {
  var w = window;
  var d = document;
  var STATE_KEY = "__a11yListIdentifier";

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
    emptyItems: "gold",
    empty: "red",
    stray: "red",
    orphan: "red",
  };

  var BADGES = {
    ok: "items",
    emptyItems: "empty <li>",
    empty: "empty list",
    stray: "non-<li> content as a direct child",
    orphan: "not inside <ul>/<ol>/<menu>",
  };

  var COUNTED_KINDS = ["ok", "emptyItems"];

  var LIST_SELECTOR = "ul,ol";
  var ITEM_TAG = "LI";
  var IGNORED_CHILD_TAGS = { TEMPLATE: 1, SCRIPT: 1 };
  var LIST_PARENT_TAGS = { UL: 1, OL: 1, MENU: 1 };
  var TEXT_NODE = 3;

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

  function childrenOf(el) {
    var found = [];

    flatChildren(el).forEach(function (child) {
      if (child.tagName === SLOT_TAG) {
        found = found.concat(flatChildren(child));
        return;
      }
      found.push(child);
    });
    return found;
  }

  function itemsOf(list) {
    return childrenOf(list).filter(function (child) {
      return child.tagName === ITEM_TAG;
    });
  }

  function strayElements(list) {
    return childrenOf(list).filter(function (child) {
      return child.tagName !== ITEM_TAG && !IGNORED_CHILD_TAGS[child.tagName];
    });
  }

  function hasStrayText(list) {
    return Array.prototype.slice.call(list.childNodes).some(function (node) {
      return node.nodeType === TEXT_NODE && normalize(node.textContent);
    });
  }

  function emptyItems(items) {
    return items.filter(function (item) {
      return !normalize(item.textContent) && !item.children.length;
    });
  }

  function classifyList(list) {
    var items = itemsOf(list);

    if (!items.length) {
      return "empty";
    }
    if (strayElements(list).length || hasStrayText(list)) {
      return "stray";
    }
    if (emptyItems(items).length) {
      return "emptyItems";
    }
    return "ok";
  }

  function countFor(list, kind) {
    var items = itemsOf(list);
    return kind === "emptyItems" ? emptyItems(items).length : items.length;
  }

  function labelFor(el, kind, count) {
    var tag = el.tagName.toLowerCase();
    if (COUNTED_KINDS.indexOf(kind) === -1) {
      return tag + ": " + BADGES[kind];
    }
    return tag + ": " + count + " " + BADGES[kind];
  }

  function makeBadge(el, kind, count) {
    var badge = d.createElement("div");

    badge.setAttribute("data-a11y-list-check", "badge");
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = labelFor(el, kind, count);
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
      "white-space:nowrap",
    ].join(";");
    return badge;
  }

  function mark(el, kind, count) {
    var color = LEVELS[kind];
    var record = {
      el: el,
      outline: el.style.outline,
      offset: el.style.outlineOffset,
      position: el.style.position,
      badge: makeBadge(el, kind, count),
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

    wrapper.setAttribute("data-a11y-list-check", "panel");
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

    heading.textContent = "List Identifier";
    heading.style.cssText = "display:block;margin-bottom:4px;color:#fff";
    wrapper.appendChild(heading);

    wrapper.appendChild(makeCountLine("green", "correct"));
    wrapper.appendChild(makeCountLine("gold", "flagged"));
    wrapper.appendChild(makeCountLine("red", "incorrect"));

    close.type = "button";
    close.textContent = "\u00d7";
    close.setAttribute("aria-label", "Clear the list results");
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

  function isOrphanItem(item) {
    var parent = flatParentOf(item);
    return !parent || !LIST_PARENT_TAGS[parent.tagName];
  }

  deepQuery(LIST_SELECTOR).forEach(function (list) {
    var kind = classifyList(list);
    mark(list, kind, countFor(list, kind));
  });

  deepQuery(ITEM_TAG.toLowerCase())
    .filter(isOrphanItem)
    .forEach(function (item) {
      mark(item, "orphan", 0);
    });

  panel = makePanel();
  d.body.appendChild(panel);
  w[STATE_KEY] = { clear: clear };
})();
