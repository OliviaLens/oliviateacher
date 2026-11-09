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

### GitHub Actions

[Deploy to Azure App Service](.github/workflows/deploy-azure.yml) runs on every push to `main`, or manually from the repository's Actions tab on `main`. It installs dependencies with Node.js 22, runs `npm test`, and ZIP-deploys the runtime files, `public/`, and `media/` to the existing `olivialenssens` app in resource group `olivia`. Tests and local dependencies are excluded from the package; Azure installs production dependencies using `.deployment`. No infrastructure or app settings are changed.

Deployments are serialized without cancelling an active deployment. After deployment, the workflow checks all six language pages on both public hostnames and compares the deployed CSS/JavaScript with the checked-out files. A failed test, deployment, or live check fails the workflow.

#### One-time passwordless Azure authentication setup

An Azure administrator must run the following once with Azure CLI and GitHub CLI authenticated. This creates a dedicated Microsoft Entra application and service principal, trusts **only this repository's `main` branch**, and grants **Website Contributor only on this App Service**, not the resource group or subscription. No client secret or publish profile is needed. Do not repeat these creation commands if the identity already exists.

```bash
set -euo pipefail

SUBSCRIPTION_ID=c476af32-5c52-4fdb-8470-d089bf32a351
TENANT_ID=acb88f02-5602-4f2d-afe0-79dc7acdb607
APP_SCOPE="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/olivia/providers/Microsoft.Web/sites/olivialenssens"

az login --tenant "$TENANT_ID"
az account set --subscription "$SUBSCRIPTION_ID"

CLIENT_ID=$(az ad app create \
  --display-name oliviateacher-github-main \
  --query appId --output tsv)
PRINCIPAL_ID=$(az ad sp create --id "$CLIENT_ID" --query id --output tsv)

az ad app federated-credential create --id "$CLIENT_ID" --parameters '{
  "name": "github-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:OliviaLens/oliviateacher:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}'

az role assignment create \
  --assignee-object-id "$PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Website Contributor" \
  --scope "$APP_SCOPE"

gh variable set AZURE_CLIENT_ID --body "$CLIENT_ID" --repo OliviaLens/oliviateacher
gh variable set AZURE_TENANT_ID --body "$TENANT_ID" --repo OliviaLens/oliviateacher
gh variable set AZURE_SUBSCRIPTION_ID --body "$SUBSCRIPTION_ID" --repo OliviaLens/oliviateacher
```

These are non-secret repository **Actions variables** (Settings > Secrets and variables > Actions > Variables). Allow a few minutes for Azure permissions to propagate. Ensure GitHub Actions is enabled, then push the workflow to `main` to deploy. Missing variables produce an explicit setup error before deployment.

The workflow deliberately does not use a GitHub environment: adding one changes the OIDC subject and requires updating the federated credential. Restrict who can push or merge to `main`, since that branch is authorized to deploy production.
