export const WEBSITE_INTAKE_SCRIPT = `(function () {
  var tag = document.currentScript;
  var key = tag && tag.getAttribute("data-key");
  if (!key) return;
  var endpoint = tag.src.replace(/script\\.js(\\?.*)?$/, "leads");
  var STORE = "balagan_utm";
  var LIFETIME = 30 * 24 * 60 * 60 * 1000;
  var TAGS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  var TRAP = "balagan_site";
  var manual = tag.getAttribute("data-mode") === "manual";

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE) || "null");
      if (saved && saved.at && Date.now() - saved.at < LIFETIME && saved.tags) return saved.tags;
    } catch (error) {}
    return {};
  }

  function remember() {
    var found = {};
    var query = new URLSearchParams(location.search);
    TAGS.forEach(function (name) {
      var value = query.get(name);
      if (value) found[name] = value;
    });
    if (!Object.keys(found).length) return load();
    try {
      localStorage.setItem(STORE, JSON.stringify({ at: Date.now(), tags: found }));
    } catch (error) {}
    return found;
  }

  var tags = remember();

  function identifier() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function listOf(fields) {
    var list = [];
    if (Array.isArray(fields)) {
      fields.forEach(function (field) {
        if (field && field.question && field.value) list.push({ question: String(field.question), value: String(field.value).slice(0, 2000) });
      });
    } else if (fields && typeof fields === "object") {
      Object.keys(fields).forEach(function (question) {
        var value = fields[question];
        if (value !== null && value !== undefined && String(value).trim()) list.push({ question: question, value: String(value).trim().slice(0, 2000) });
      });
    }
    return list;
  }

  function send(data) {
    var payload = { key: key, id: data.id || identifier(), page_url: location.href, referrer: document.referrer || "" };
    ["name", "phone", "email", "company", "hp"].forEach(function (field) {
      if (data[field]) payload[field] = data[field];
    });
    TAGS.forEach(function (name) {
      var value = data[name] || tags[name];
      if (value) payload[name] = value;
    });
    var fields = listOf(data.fields);
    if (fields.length) payload.fields = fields;
    try {
      return fetch(endpoint, {
        method: "POST",
        mode: "cors",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(payload)
      }).then(function () { return true; }, function () { return false; });
    } catch (error) {
      return Promise.resolve(false);
    }
  }

  function labelOf(input) {
    var label = "";
    if (input.labels && input.labels[0]) {
      var copy = input.labels[0].cloneNode(true);
      Array.prototype.forEach.call(copy.querySelectorAll("input,select,textarea"), function (control) { control.remove(); });
      label = copy.textContent.replace(/\\s+/g, " ");
    }
    return (label || input.getAttribute("placeholder") || input.name || "").trim().slice(0, 200);
  }

  function matches(input, pattern) {
    return pattern.test([input.name, input.id, input.getAttribute("placeholder"), input.getAttribute("autocomplete")].join(" "));
  }

  function read(form) {
    var data = { fields: [] };
    var contact = false;
    Array.prototype.forEach.call(form.elements, function (input) {
      var type = (input.type || "").toLowerCase();
      if (!input.name || input.disabled || ["password", "file", "submit", "button", "reset", "image"].indexOf(type) >= 0) return;
      if ((type === "checkbox" || type === "radio") && !input.checked) return;
      var value = String(input.value || "").trim();
      if (input.name === TRAP) {
        data.hp = value;
        return;
      }
      if (!value) return;
      if (TAGS.indexOf(input.name) >= 0) {
        data[input.name] = value;
        return;
      }
      if (type === "tel" || matches(input, /phone|tel|тел|whatsapp/i)) {
        data.phone = data.phone || value;
        contact = true;
      } else if (type === "email" || matches(input, /e-?mail|почт/i)) {
        data.email = data.email || value;
        contact = true;
      } else if (matches(input, /compan|organi[sz]ation|компан|организац/i)) {
        data.company = data.company || value;
      } else if (matches(input, /name|имя|фио/i) && !data.name) {
        data.name = value;
      } else {
        data.fields.push({ question: labelOf(input), value: value.slice(0, 2000) });
      }
    });
    return contact ? data : null;
  }

  function trap(form) {
    if (form.querySelector('[name="' + TRAP + '"]')) return;
    var input = document.createElement("input");
    input.type = "text";
    input.name = TRAP;
    input.tabIndex = -1;
    input.autocomplete = "off";
    input.setAttribute("aria-hidden", "true");
    input.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;opacity:0";
    form.appendChild(input);
  }

  function arm() {
    Array.prototype.forEach.call(document.forms, function (form) {
      if (form.getAttribute("data-balagan") !== "off") trap(form);
    });
  }

  if (!manual) {
    document.addEventListener("submit", function (event) {
      var form = event.target;
      if (!form || form.tagName !== "FORM" || form.getAttribute("data-balagan") === "off") return;
      var data = read(form);
      if (data) send(data);
    }, true);

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arm);
    else arm();
    if (window.MutationObserver) new MutationObserver(arm).observe(document.documentElement, { childList: true, subtree: true });
  }

  window.balagan = { lead: function (data) { return send(data || {}); } };
})();
`;
