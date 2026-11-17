# Business website

Public marketing website for the POS and back-office product (**Enkira**). A static site with no dependencies: one page, a privacy policy and website terms.

## Change the name, contact details or prices

Everything brand-specific is in **`site.config.json`**:

| Key | What it controls |
| --- | --- |
| `brand.name`, `brand.company`, `brand.tagline` | The name everywhere on the site, page titles and the footer |
| `site.url` | Your domain, used for search engines and link previews |
| `contact.whatsapp` | WhatsApp number in international format, e.g. `94771234567`. Turns on the WhatsApp buttons |
| `contact.email`, `contact.phoneDisplay`, `contact.city` | Footer and legal pages |
| `contact.formEndpoint` | Optional URL that receives demo requests as JSON (a form service or your own function) |
| `tracking.metaPixelId`, `googleTagId`, `tiktokPixelId` | Advert tracking. Leave empty until the ad accounts exist |
| `pricing.show`, `pricing.plans` | Show or hide prices, and the plans |
| `faq` | Questions and answers |

Renaming the brand is a one-line change to `brand.name`, then rebuild.

**How demo requests reach you:** if `formEndpoint` is set, the form posts there. Otherwise it opens WhatsApp with the details filled in, or falls back to email. Until one of the three is set the form tells visitors that contact details are being set up.

## Build and preview

```bash
npm run build     # writes the site to dist/
npm run dev       # builds and serves http://localhost:4000
```

Requires Node.js 18 or later. Nothing to install.

## Publish

The `dist/` folder is a complete static site and can be hosted anywhere.

**Firebase Hosting** (config included):

```bash
npm run build
npx firebase-tools deploy --only hosting --project YOUR_PROJECT_ID
```

Then connect your domain under Hosting → Add custom domain.

## Before running adverts

1. Set `brand.name`, `site.url` and at least `contact.whatsapp`.
2. Confirm the prices in `pricing.plans`, or set `pricing.show` to `false`.
3. Have the privacy policy and terms reviewed, and add your company details.
4. Add the tracking IDs once the ad accounts are created.

## Layout

`site.config.json` settings · `build.mjs` build and preview server · `src/index.html` the page · `src/privacy.html`, `src/terms.html` legal pages · `src/_partials/` shared head, header and footer · `src/styles.css` · `src/app.js` form and click tracking · `src/img/` product screenshots (fictional sample data) · `brand/` the brand pack: logo files, social images, colour and type tokens, and `brand/guidelines.html`.

The earlier stock-market prototype that lived in this repository was removed; it remains in the git history at commit `4905889`.
