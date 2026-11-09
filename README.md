# Olivia Lenssens – Ballet Teacher Website

The website of Olivia Lenssens, ballet teacher for pre-professional students in Lausanne. It is a multilingual, one-page site served by a small Node.js / Express app.

Live site: https://olivia.lenssens.net

## Features

- One fully translated page per language (English, French, German, Dutch, Estonian, Czech), with `hreflang` links, canonical URLs, Open Graph / Twitter tags and JSON-LD structured data.
- Server-side rendered SEO: `robots.txt` and `sitemap.xml` are generated at runtime.
- Photo and video galleries (ballet productions, Pilates, portfolio) loaded dynamically from the `media/` folder.
- Contact / lead-generation form that sends email via SMTP.
- Google Tag Manager and GA4 with a Consent Mode v2 consent banner.

## Project structure

| Path | Purpose |
| ---- | ------- |
| `server.js` | Express server: routes, static files, media API, contact form |
| `seo.js` | Server-side page rendering, SEO tags, `robots.txt` and sitemap |
| `analytics.js` | Google Tag Manager snippet and consent handling |
| `public/` | `index.html`, `css/styles.css`, `js/` (i18n, main, consent), icons and images |
| `media/` | Gallery photos and videos, grouped by folder (`SwanLake`, `NutCracker`, `RomeoJuliet`, `pilates`, `portfolio`) |
| `tests/` | Node test runner tests for i18n, SEO and GTM |
| `.azure/` | Azure deployment plan and validation status |

## Requirements

- Node.js 22 LTS (matches the Azure App Service runtime)
- npm

## Getting started

```bash
npm install
npm start
```

The site is then available at http://localhost:3000.

For development with automatic restarts:

```bash
npm run dev
```

## Configuration

All settings are optional. They are read from environment variables.

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `PORT` | `3000` | Port the server listens on |
| `SITE_URL` | `https://olivia.lenssens.net` | Public base URL used for canonical links, hreflang, sitemap and Open Graph tags |
| `GTM_ID` | none | Google Tag Manager container ID used by `analytics.js` |
| `SMTP_HOST` | `smtp.ethereal.email` (test account) | SMTP server for the contact form |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | Ethereal test user | SMTP username |
| `SMTP_PASS` | Ethereal test password | SMTP password |
| `CONTACT_EMAIL` | `Olivia.Lenssens@gmail.com` | Recipient of contact form messages |

If `SMTP_HOST` is not set, the contact form uses a temporary Ethereal test account and logs a preview URL to the console instead of sending a real email.

## API

| Method | Route | Description |
| ------ | ----- | ----------- |
| `GET` | `/api/media/:folder` | Lists the image and video files in `media/:folder` (images first, then videos) |
| `POST` | `/api/contact` | Sends a contact form message. Accepts JSON or URL-encoded form data |
| `GET` | `/robots.txt` | Generated robots file |
| `GET` | `/sitemap.xml` | Generated sitemap with language alternates and gallery images |

## Testing

```bash
npm test
```

This runs the Node.js built-in test runner over `tests/*.test.js`.

## Deployment

The site is deployed to the Azure App Service `olivialenssens` (Linux, Node 22 LTS) in West Europe. `.deployment` enables `SCM_DO_BUILD_DURING_DEPLOYMENT`, so Azure installs production dependencies from `package-lock.json` during deployment.

See [.azure/deployment-plan.md](.azure/deployment-plan.md) for the deployment plan and history.

Because `media/` is large (several hundred MB), uploads are slow. Keep this in mind when deploying.
