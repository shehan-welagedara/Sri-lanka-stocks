// Zero-dependency static build: fills {{placeholders}} in src/*.html from
// site.config.json and writes the site to dist/. `--serve` also starts a
// local preview server.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";

const root = new URL(".", import.meta.url).pathname;
const cfg = JSON.parse(readFileSync(join(root, "site.config.json"), "utf8"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const wa = cfg.contact.whatsapp.replace(/\D/g, "");
const waLink = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(`Hi, I'd like a demo of ${cfg.brand.name} for my restaurant.`)}` : "#demo";

const pricingHtml = !cfg.pricing.show ? "" : `
<section id="pricing" class="section">
  <div class="wrap">
    <p class="eyebrow">Pricing</p>
    <h2>Simple monthly pricing per outlet</h2>
    <div class="plans">
      ${cfg.pricing.plans.map((p) => `
      <article class="plan${p.highlight ? " plan--hi" : ""}">
        ${p.highlight ? '<span class="plan__tag">Most popular</span>' : ""}
        <h3>${esc(p.name)}</h3>
        <p class="plan__for">${esc(p.for)}</p>
        <p class="plan__price"><span>Rs</span> ${esc(p.price)}<small> / month</small></p>
        <p class="plan__setup">One-time setup Rs ${esc(p.setup)}</p>
        <ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
        <a class="btn ${p.highlight ? "btn--primary" : "btn--ghost"}" href="#demo" data-cta="plan-${esc(p.name.toLowerCase().replace(/\W+/g, "-"))}">Book a demo</a>
      </article>`).join("")}
    </div>
    <p class="fine">${esc(cfg.pricing.note)}</p>
  </div>
</section>`;

const faqHtml = cfg.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n");
const faqJson = JSON.stringify({
  "@context": "https://schema.org", "@type": "FAQPage",
  mainEntity: cfg.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
});

const t = cfg.tracking;
const trackingHtml = [
  t.googleTagId && `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(t.googleTagId)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","${esc(t.googleTagId)}");</script>`,
  t.metaPixelId && `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");fbq("init","${esc(t.metaPixelId)}");fbq("track","PageView");</script>`,
  t.tiktokPixelId && `<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat([].slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var n=d.createElement("script");n.async=!0;n.src="https://analytics.tiktok.com/i18n/pixel/events.js?sdkid="+e+"&lib="+t;d.head.appendChild(n)};ttq.load("${esc(t.tiktokPixelId)}");ttq.page()}(window,document,"ttq");</script>`,
].filter(Boolean).join("\n");

const vars = {
  "brand.name": esc(cfg.brand.name), "brand.company": esc(cfg.brand.company), "brand.tagline": esc(cfg.brand.tagline), "brand.year": esc(cfg.brand.year),
  "brand.initial": esc(cfg.brand.name.trim()[0] || "P"),
  "site.url": esc(cfg.site.url.replace(/\/$/, "")), "site.description": esc(cfg.site.description),
  "contact.city": esc(cfg.contact.city), "contact.email": esc(cfg.contact.email), "contact.phoneDisplay": esc(cfg.contact.phoneDisplay),
  waLink: esc(waLink), pricingHtml, faqHtml, faqJson, trackingHtml,
  pricingNav: cfg.pricing.show ? '<a href="#pricing">Pricing</a>' : "",
  clientConfig: JSON.stringify({ name: cfg.brand.name, whatsapp: wa, email: cfg.contact.email, formEndpoint: cfg.contact.formEndpoint }).replace(/</g, "\\u003c"),
  emailRow: cfg.contact.email ? `<a href="mailto:${esc(cfg.contact.email)}">${esc(cfg.contact.email)}</a>` : "",
  phoneRow: cfg.contact.phoneDisplay ? `<span>${esc(cfg.contact.phoneDisplay)}</span>` : "",
};

function build() {
  const dist = join(root, "dist");
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });
  cpSync(join(root, "src"), dist, { recursive: true });
  const partial = (name) => readFileSync(join(root, "src", "_partials", name), "utf8");
  for (const file of readdirSync(dist).filter((f) => f.endsWith(".html"))) {
    let html = readFileSync(join(dist, file), "utf8").replace(/\{\{>\s*([\w.-]+)\s*\}\}/g, (_, n) => partial(n));
    html = html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => {
      if (!(k in vars)) throw new Error(`Unknown placeholder ${m} in ${file}`);
      return vars[k];
    });
    writeFileSync(join(dist, file), html);
  }
  rmSync(join(dist, "_partials"), { recursive: true, force: true });
  writeFileSync(join(dist, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${cfg.site.url.replace(/\/$/, "")}/sitemap.xml\n`);
  writeFileSync(join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${["", "/privacy", "/terms"].map((p) => `<url><loc>${cfg.site.url.replace(/\/$/, "")}${p}</loc></url>`).join("")}</urlset>\n`);
  console.log(`Built ${cfg.brand.name} site -> dist/`);
}

build();

if (process.argv.includes("--serve")) {
  const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".xml": "application/xml", ".txt": "text/plain" };
  const port = Number(process.env.PORT) || 4000;
  createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.includes("..")) { res.writeHead(400).end(); return; }
    let file = join(root, "dist", p);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file) && existsSync(file + ".html")) file += ".html";
    if (!existsSync(file)) { res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found"); return; }
    res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" }).end(readFileSync(file));
  }).listen(port, () => console.log(`Preview: http://localhost:${port}`));
}
