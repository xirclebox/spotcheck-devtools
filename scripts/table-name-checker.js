(function () {
  var w = window;
  var d = document;
  var STATE_KEY = "__a11yTableNameChecker";

  if (w[STATE_KEY]) {
    w[STATE_KEY].clear();
    return;
  }

  var COLORS = {
    pass: "#1a7d4f",
    attribute: "#8b6800",
    missing: "#be412a"
  };

  var OUTLINES = {
    pass: "5px solid",
    attribute: "6px dotted",
    missing: "5px dashed"
  };

  var OUTLINE_OFFSET = "3px";

  var DOTS = {
    pass: "#3fbf7f",
    attribute: "#e0b84f",
    missing: "#e06a4f",
    broken: "#e06a4f"
  };

  var BADGES = {
    missing: "No name"
  };

  var DESCRIPTION_BADGES = {
    described: "Described",
    broken: "Broken description"
  };

  var SOURCE_LABELS = {
    labelledby: "aria-labelledby",
    label: "aria-label",
    caption: "Caption",
    title: "Title"
  };

  var SOURCE_KINDS = {
    labelledby: "attribute",
    label: "attribute",
    caption: "pass",
    title: "attribute"
  };

  var TABLE_SELECTOR = "table, [role]";
  var TABLE_ROLES = ["table", "grid", "treegrid"];
  var PRESENTATION_ROLES = ["presentation", "none"];
  var GLOBAL_ATTRIBUTES = ["aria-label", "aria-labelledby", "aria-describedby"];
  var IGNORED_TAGS = ["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT"];
  var HIDDEN_SELECTOR = "[aria-hidden=\"true\"]";
  var ELEMENT_NODE = 1;
  var TEXT_NODE = 3;
  var MAX_NAME_LENGTH = 48;
  var ELLIPSIS = "…";
  var SEPARATOR = " · ";

  var records = [];
  var counts = { pass: 0, attribute: 0, missing: 0, broken: 0 };
  var panel = null;

  function normalize(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function tagOf(node) {
    return node.nodeName.toUpperCase();
  }

  function contentText(node, isRoot) {
    if (node.nodeType === TEXT_NODE) {
      return node.nodeValue;
    }
    if (node.nodeType !== ELEMENT_NODE || IGNORED_TAGS.indexOf(tagOf(node)) !== -1) {
      return "";
    }
    if (!isRoot && node.getAttribute("aria-hidden") === "true") {
      return "";
    }
    var label = normalize(node.getAttribute("aria-label"));
    if (label) {
      return " " + label + " ";
    }
    if (tagOf(node) === "IMG") {
      return " " + normalize(node.getAttribute("alt")) + " ";
    }
    return Array.prototype.slice
      .call(node.childNodes)
      .map(function (child) {
        return contentText(child, false);
      })
      .join("");
  }

  function textFrom(el) {
    return el ? normalize(contentText(el, true)) : "";
  }

  function truncate(text) {
    if (text.length <= MAX_NAME_LENGTH) {
      return text;
    }
    return text.slice(0, MAX_NAME_LENGTH - 1).trim() + ELLIPSIS;
  }

  function roleOf(el) {
    return normalize(el.getAttribute("role")).toLowerCase().split(" ")[0];
  }

  function hasGlobalAttribute(el) {
    return GLOBAL_ATTRIBUTES.some(function (attribute) {
      return !!normalize(el.getAttribute(attribute));
    });
  }

  function isTable(el) {
    var role = roleOf(el);
    if (tagOf(el) !== "TABLE") {
      return TABLE_ROLES.indexOf(role) !== -1;
    }
    if (PRESENTATION_ROLES.indexOf(role) !== -1) {
      return hasGlobalAttribute(el);
    }
    return !role || TABLE_ROLES.indexOf(role) !== -1;
  }

  function isHidden(el) {
    if (el.closest && el.closest(HIDDEN_SELECTOR)) {
      return true;
    }
    for (var node = el; node && node.nodeType === ELEMENT_NODE; node = node.parentNode) {
      if (w.getComputedStyle(node).display === "none") {
        return true;
      }
    }
    return w.getComputedStyle(el).visibility === "hidden";
  }

  function referencedText(el, attribute) {
    var ids = normalize(el.getAttribute(attribute));
    if (!ids) {
      return "";
    }
    return normalize(
      ids
        .split(" ")
        .map(function (id) {
          var target = d.getElementById(id);
          if (!target) {
            return "";
          }
          return textFrom(target);
        })
        .join(" ")
    );
  }

  function captionText(el) {
    return el.caption ? textFrom(el.caption) : "";
  }

  function nameFor(el) {
    var candidates = [
      { source: "labelledby", text: referencedText(el, "aria-labelledby") },
      { source: "label", text: normalize(el.getAttribute("aria-label")) },
      { source: "caption", text: captionText(el) },
      { source: "title", text: normalize(el.getAttribute("title")) }
    ];
    for (var i = 0; i < candidates.length; i += 1) {
      if (candidates[i].text) {
        return candidates[i];
      }
    }
    return null;
  }

  function describe(el) {
    if (!normalize(el.getAttribute("aria-describedby"))) {
      return null;
    }
    return referencedText(el, "aria-describedby") ? "described" : "broken";
  }

  function classify(name, description) {
    if (name) {
      return SOURCE_KINDS[name.source];
    }
    return description === "described" ? "attribute" : "missing";
  }

  function badgeText(name, description) {
    var text = name
      ? SOURCE_LABELS[name.source] + ": " + truncate(name.text)
      : BADGES.missing;
    if (description) {
      text += SEPARATOR + DESCRIPTION_BADGES[description];
    }
    return text;
  }

  function makeBadge(kind, name, description) {
    var badge = d.createElement("span");
    badge.setAttribute("data-a11y-table-name-check", "badge");
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = badgeText(name, description);
    badge.style.cssText = [
      "display:inline-block",
      "width:fit-content",
      "justify-self:start",
      "margin:0 0 0 4px",
      "padding:4px 8px",
      "border-radius:4px",
      "background:" + COLORS[kind],
      "color:#fff",
      "font:500 16px/1.2 Arial, Helvetica, \"Helvetica Neue\", sans-serif",
      "vertical-align:middle",
      "position:relative",
      "z-index:2147483646"
    ].join(";");
    return badge;
  }

  function mark(el) {
    var name = nameFor(el);
    var description = describe(el);
    var kind = classify(name, description);
    var record = {
      el: el,
      outline: el.style.outline,
      offset: el.style.outlineOffset,
      badge: makeBadge(kind, name, description)
    };

    counts[kind] += 1;
    if (description === "broken") {
      counts.broken += 1;
    }
    el.style.outline = OUTLINES[kind] + " " + COLORS[kind];
    el.style.outlineOffset = OUTLINE_OFFSET;
    el.insertAdjacentElement("beforebegin", record.badge);
    records.push(record);
  }

  function makeCountLine(kind, word) {
    var line = d.createElement("p");
    var dot = d.createElement("span");

    line.style.cssText = "margin:0;padding:0";
    dot.textContent = "●";
    dot.style.cssText = "color:" + DOTS[kind] + ";margin-right:6px";
    line.appendChild(dot);
    line.appendChild(d.createTextNode(counts[kind] + " " + word));
    return line;
  }

  function makePanel() {
    var wrapper = d.createElement("div");
    var heading = d.createElement("strong");
    var close = d.createElement("button");

    wrapper.setAttribute("data-a11y-table-name-check", "panel");
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

    heading.textContent = "Table Name Checker";
    heading.style.cssText = "display:block;margin-bottom:4px";
    wrapper.appendChild(heading);

    wrapper.appendChild(makeCountLine("pass", "named by caption"));
    wrapper.appendChild(makeCountLine("attribute", "named or described by ARIA or title"));
    wrapper.appendChild(makeCountLine("missing", "no name"));
    wrapper.appendChild(makeCountLine("broken", "with a broken description"));

    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "Clear the table name check results");
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
    .call(d.querySelectorAll(TABLE_SELECTOR))
    .filter(function (el) {
      return isTable(el) && !isHidden(el);
    })
    .forEach(mark);

  panel = makePanel();
  d.body.appendChild(panel);
  w[STATE_KEY] = { clear: clear };
})();
