(function () {
  "use strict";

  var STORAGE_KEY = "spotcheck:theme";
  var VALID = ["light", "dark", "system"];
  var DEFAULT = "system";
  var themePref = window.matchMedia("(prefers-color-scheme: dark)");

  function readStored() {
    var stored = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      stored = null;
    }
    return VALID.indexOf(stored) === -1 ? DEFAULT : stored;
  }

  var currentPref = readStored();

  function resolve(pref) {
    if (pref === "system") {
      return themePref.matches ? "dark" : "light";
    }
    return pref;
  }

  function applyResolved() {
    document.documentElement.setAttribute("data-theme", resolve(currentPref));
  }

  function setPref(pref) {
    if (VALID.indexOf(pref) === -1) {
      return;
    }
    currentPref = pref;
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch (e) {
      // jic Storage is unavailable, the choice still applies this session.
    }
    applyResolved();
  }

  applyResolved();

  function onSchemeChange() {
    if (currentPref === "system") {
      applyResolved();
    }
  }
  if (themePref.addEventListener) {
    themePref.addEventListener("change", onSchemeChange);
  } else if (themePref.addListener) {
    themePref.addListener(onSchemeChange);
  }

  function wireControls() {
    var radios = document.querySelectorAll('input[name="theme"]');
    Array.prototype.forEach.call(radios, function (radio) {
      radio.checked = radio.value === currentPref;
      radio.addEventListener("change", function () {
        if (radio.checked) {
          setPref(radio.value);
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireControls);
  } else {
    wireControls();
  }
})();
