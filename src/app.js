// Demo-request form and click tracking. No dependencies.
(function () {
  var S = window.SITE || {};
  function track(name, data) {
    try {
      if (window.gtag) window.gtag("event", name, data || {});
      if (window.fbq) window.fbq("track", name === "generate_lead" ? "Lead" : "Contact", data || {});
      if (window.ttq) window.ttq.track(name === "generate_lead" ? "SubmitForm" : "Contact");
    } catch (e) {}
  }
  document.querySelectorAll("[data-cta]").forEach(function (el) {
    el.addEventListener("click", function () { track("cta_click", { cta: el.getAttribute("data-cta") }); });
  });

  var form = document.getElementById("demo-form");
  if (!form) return;
  var msg = document.getElementById("form-msg");
  function say(text, ok) { msg.textContent = text; msg.className = "form__msg " + (ok ? "is-ok" : "is-err"); }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = new FormData(form);
    if (f.get("website")) return; // spam trap
    var name = String(f.get("name") || "").trim();
    var outlet = String(f.get("outlet") || "").trim();
    var phone = String(f.get("phone") || "").replace(/[\s-]/g, "");
    if (name.length < 2) return say("Please enter your name.");
    if (outlet.length < 2) return say("Please enter your restaurant or café name.");
    if (!/^(\+94|0)\d{9}$/.test(phone)) return say("Please enter a valid Sri Lankan phone number, for example 077 123 4567.");

    var lines = ["Demo request for " + (S.name || "the POS"), "Name: " + name, "Outlet: " + outlet, "Phone: " + phone,
      "City: " + (f.get("city") || "-"), "Outlets: " + f.get("outlets")];
    var text = lines.join("\n");
    track("generate_lead", { outlets: f.get("outlets") });

    if (S.formEndpoint) {
      var btn = form.querySelector("button");
      btn.disabled = true;
      fetch(S.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name: name, outlet: outlet, phone: phone, city: f.get("city"), outlets: f.get("outlets") }) })
        .then(function (r) { if (!r.ok) throw new Error(); form.reset(); say("Thank you. We will call you within one working day.", true); })
        .catch(function () { say("We could not send your request. Please try again or message us on WhatsApp."); })
        .finally(function () { btn.disabled = false; });
    } else if (S.whatsapp) {
      window.open("https://wa.me/" + S.whatsapp + "?text=" + encodeURIComponent(text), "_blank", "noopener");
      say("WhatsApp is opening with your details. Press send to reach us.", true);
    } else if (S.email) {
      window.location.href = "mailto:" + S.email + "?subject=" + encodeURIComponent("Demo request: " + outlet) + "&body=" + encodeURIComponent(text);
      say("Your email app is opening with your details. Press send to reach us.", true);
    } else {
      say("Our contact details are being set up. Please check back shortly.");
    }
  });
})();
