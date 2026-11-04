# Azure Deployment Plan

## Status
Validated

## Objective
Deploy the existing Olivia Lenssens website to the Azure App Service web app `olivialenssens`.

## Requirements and assumptions
- Classification: Production — inferred from the existing custom-domain website.
- Scale and budget: Retain the current App Service plan; no scale or cost changes requested.
- Compliance/data residency: No additional requirements provided; preserve the existing West Europe location.
- Architecture preference: Update the specified existing app only. Do not create, replace, or reconfigure Azure resources.
- Planned content: Deploy the current repository version, including the multilingual pages and media assets.

## Workspace analysis
- Mode: Modify/deploy an existing Azure-hosted application.
- Component: Node.js 22 LTS / Express web application (`server.js`), with HTML/CSS/JS and media.
- Start command: `npm start` (`node server.js`); app honors `PORT`.
- Dependencies: `compression`, `express`, `nodemailer`; lockfile is present.
- Runtime modules: `server.js`, `seo.js`, and `analytics.js`; server-side SEO and Google Tag Manager consent rendering require all three.
- Build/deploy setting: `.deployment` enables `SCM_DO_BUILD_DURING_DEPLOYMENT=true`.
- IaC/AZD: No `azure.yaml` or IaC; not needed for updating the existing target.
- Local content size: `public/` 188 KB; `media/` approximately 423 MB.

## Azure Context
- Subscription: `bernard` (`c476af32-5c52-4fdb-8470-d089bf32a351`), currently selected Azure CLI subscription.
- Tenant: `acb88f02-5602-4f2d-afe0-79dc7acdb607`.
- Resource group: `olivia`.
- Location: `westeurope`.
- Web app: `olivialenssens`, Linux, Node `22-lts`, Basic SKU, Running.
- Hostnames: `olivia.lenssens.net`, `olivialenssens.azurewebsites.net`.
- Baseline: both public hostnames currently respond HTTP 200.
- Policy/quota: no resources will be provisioned, so no new resource quota check is required.

## Recipe and architecture
- Recipe: Azure CLI Zip Deploy to the existing Linux App Service.
- Rationale: deploy application files without creating or replacing infrastructure; existing remote build setting can install production dependencies from `package-lock.json`.
- Package scope: `server.js`, `seo.js`, `analytics.js`, package manifests, `.deployment`, public assets including `public/js/consent.js`, and `media/`; exclude `.git`, `node_modules`, tests, and local-only files.
- The 423 MB media directory makes upload size/time a deployment risk; measure the archive before upload and report if the package is impractical.

## Execution plan
- [x] Inspect the Express app and deployment/runtime requirements.
- [x] Confirm target app, subscription, resource group, region, runtime, and current availability.
- [x] Obtain authorization: user explicitly requested deployment; follow-up confirmation was unavailable, so proceed within that stated scope.
- [x] Validate project functionality and deployment package.
- [x] Invoke Azure validation workflow; completed with `Validated` status.
- [x] Deploy application package to the existing app.
- [x] Verify production root, locale pages, assets, and live availability.

## Risks and security
- Zip Deploy changes the running site and can restart the app; deployment may briefly affect availability.
- The deployment ZIP is approximately 422 MB (443 MB uncompressed) and may lengthen upload/deployment time.
- No infrastructure, app settings, credentials, or secrets will be changed.

## Local validation
- Node syntax checks and `git diff --check`: passed.
- Local HTTP smoke tests for `/`, `/fr/`, `/de/`, `/nl/`, `/et/`, and `/cs/`: all returned HTTP 200 with expected language and flag labels.
- Deployment package `.azure/deploy-package.zip` contained app, package manifests, public assets, and media; excluded `.git`, `node_modules`, and `.azure`. It was removed after successful deployment.

## All validation checks pass
- Current update: redeploy the current application with Google Tag Manager and its multilingual Consent Mode v2 banner, preserving SEO, Pilates content, and media. Retain the existing subscription, runtime, and configuration, including the configured `GTM_ID`.
- Current AZCLI validation: verify CLI authentication and existing target, syntax and local HTTP behavior, and deployment ZIP integrity. Infrastructure build, validate, what-if, Docker, and new-resource policy checks are not applicable to this code-only update.
- [x] Confirm authenticated Azure CLI subscription is `bernard` and target remains `olivialenssens` in resource group `olivia`.
- [x] Confirm the deployment ZIP contains required runtime files and is not accidentally bundling local dependencies, Git metadata, or deployment-plan artifacts.
- [x] Run local syntax, whitespace, and HTTP smoke checks for English and all five translated routes.
- [x] Verify project startup/build requirements; use local HTTP startup check because this project has no build or test script.
- [x] Container build: not applicable; the target is an existing Linux App Service and the project has no Dockerfile.
- [x] Policy, quota, and RBAC/IaC checks: not applicable; no Azure resources, policies, role assignments, or infrastructure are being changed.
- [x] Analytics release core validation: confirm CLI authentication, the existing target and analytics toggle; run all tests, syntax checks, HTTP startup checks, and deployment ZIP integrity checks.
- [x] Analytics release build verification: confirm directly served Node application starts and all locale/SEO routes work; no separate build stage exists.
- [x] Analytics release container, policy, and static RBAC checks: no Dockerfile, IaC, provisioning, runtime changes, or access-assignment changes apply.

## 7. Validation Proof
Google Tag Manager and consent release validated at `2026-11-04T15:31:25Z`.
- `npm test`: all 69 tests passed, including analytics disabled/enabled rendering, all consent translations, default consent, stored choices, SEO endpoints, canonical redirects, compression, and cache behavior.
- `node --check` passed for `server.js`, `seo.js`, `analytics.js`, and `public/js/main.js`, `public/js/i18n.js`, `public/js/consent.js`; `git diff --check` passed.
- Local HTTP startup with the existing production `GTM_ID` confirmed all six language routes return 200 with the configured container, translated consent banner, and versioned consent script. Inline consent execution confirmed analytics and advertising consent defaults are denied.
- Azure CLI confirmed subscription `bernard`, app `olivialenssens`, resource group `olivia`, West Europe, Running state, and `NODE|22-lts`. Both public hostnames returned HTTP 200 before deployment.
- Existing app configuration already includes a valid `GTM_ID`; this release preserves it. `.deployment` requests remote dependency installation. No Azure settings were changed.
- Explicit-file ZIP and `unzip -tq` passed: 57 files, approximately 422.8 MiB, including `analytics.js`, `seo.js`, and `public/js/consent.js`. Every archived file matches its local SHA-256; dependencies, Git metadata, tests, local notes, and `.DS_Store` are excluded.
- Archive SHA-256: `09001d9b487f7831a575bc410f0ab073f12eeafcd0ab8d3d77268ae048532b95`.
- No build stage, container, infrastructure, policy, quota, or static RBAC changes apply to this existing-app code-only redeployment.

Translated Pilates and photo update validated at `2026-10-29T09:59:46Z`.
- `node --test tests/pilates-i18n.test.js`: all 10 tests passed, including translation completeness, unchanged numeric details, course order, and studio image metadata.
- `node --check server.js`, `node --check public/js/i18n.js`, `node --check public/js/main.js`, and `git diff --check`: passed.
- Azure CLI confirmed the existing subscription, Running app `olivialenssens`, expected hostnames, and `NODE|22-lts`.
- `PORT=3196 node server.js` and HTTP checks confirmed all six locale routes return 200 with translated Pilates headings and image alt text, courses immediately after the introduction, no old session button, and both Calendly embeds. Studio photo returned 200 with JPEG content type.
- Explicit-file ZIP packaging and `unzip -tq`: passed; approximately 433 MiB, including `media/pilates/pilates_studio.jpeg`, without local dependencies, Git metadata, tests, or deployment notes.
- This directly served Node app has no build stage; startup/HTTP checks passed. No infrastructure, RBAC, policy, capacity, runtime, or app configuration changes are involved.

Pilates update validation completed at `2026-10-29T08:59:54Z`.
- Azure CLI `2.68.0`; `az account show` confirms the existing `bernard` subscription.
- `az webapp show` confirms `olivialenssens` in resource group `olivia` is Running, with the expected custom and Azure hostnames; `az webapp config show` confirms `NODE|22-lts`.
- `node --check server.js`, `node --check public/js/main.js`, `node --check public/js/i18n.js`, and `git diff --check`: passed.
- `PORT=3188 node server.js` plus HTTP smoke tests: all six locale routes returned HTTP 200 and contained the Pilates section and both booking embeds. CSS and both JavaScript assets returned HTTP 200.
- `zip` packaged explicit runtime files, `public/`, and `media/`; `unzip -tq` passed. Archive is approximately 432 MiB and excludes Git metadata, dependencies, local deployment artifacts, and `.DS_Store`.
- No build script or container exists; startup and HTTP tests verify this directly served Node application. No infrastructure, resource configuration, RBAC assignments, capacity, or policy changes are requested.

Validation completed at `2026-10-06T13:55:29Z`.
- `az account show`: confirmed subscription `bernard` (`c476af32-5c52-4fdb-8470-d089bf32a351`).
- `az webapp show --name olivialenssens --resource-group olivia`: target exists, is Running in West Europe, and has the expected custom/Azure hostnames.
- `az webapp config show`: confirms `NODE|22-lts`.
- `node --check server.js`, `node --check public/js/i18n.js`, `node --check public/js/main.js`: passed.
- `git diff --check`: passed.
- `PORT=3199 npm start` plus HTTP smoke requests: root and `/fr/`, `/de/`, `/nl/`, `/et/`, `/cs/` all returned HTTP 200 and their expected HTML `lang`.
- `python3` ZIP audit and `unzip -tq .azure/deploy-package.zip`: archive is valid; required app files and media are present; `.git`, `node_modules`, `.azure`, and `.DS_Store` are absent.
- Static RBAC/IaC review: not applicable; this deployment changes no infrastructure or access assignments.
- Azure resource provisioning/policy/quota checks: not applicable; deployment targets an existing App Service and provisions no resources.

## Deployment Proof
- Google Tag Manager and consent release redeployed and verified at `2026-11-04T15:37:41Z`. Deployment `96a28a44-b8af-404b-ae7d-9aeb77ca85bf` reported `RuntimeSuccessful`, one successful instance, zero failed instances, and no deployment errors.
- Used `az webapp deploy --type zip --clean false` against the existing, explicitly specified subscription, app, and resource group. No infrastructure, runtime, app settings, or access assignments were changed; the existing `GTM_ID` is preserved.
- Both `https://olivia.lenssens.net` and `https://olivialenssens.azurewebsites.net` passed 23 endpoint checks each. All six localized HTML responses and seven CSS/JavaScript/image responses matched the current local release's SHA-256 hashes, including the consent script.
- Verified the configured GTM container, translated consent banners, denied-by-default analytics and advertising consent before container loading, valid structured data, canonical URLs/redirects, robots.txt, all six sitemap URLs, compression, cache headers, gallery API, media, and unknown-locale 404.
- App Service remains Running in West Europe on `NODE|22-lts`. Live RBAC verification is not applicable: no Azure resources or access assignments were provisioned or changed. The temporary deployment ZIP was removed after verification.

- Translated Pilates, reordered course options, and studio photo deployed and verified at `2026-10-29T10:05:10Z`. Deployment `6fe59c35-4706-420f-8335-fd82d87e24e6` reported `RuntimeSuccessful`, one successful instance and zero failed instances.
- Both public hostnames returned HTTP 200 on all six language routes. Localized Pilates strings and image alt text, course placement immediately after the introduction, removal of the old session button, and both Calendly embeds were verified.
- Root HTML, CSS/JavaScript, and studio JPEG matched local SHA-256 hashes on both hostnames. App remains Running; no Azure configuration or infrastructure was changed.
- Production browser verification on the French route confirmed the translated heading, loaded studio image, correct course placement, and both live 45-minute Calendly calendars. No booking was submitted.

- Pilates update deployed and verified at `2026-10-29T09:06:49Z` using `az webapp deploy --type zip` to `olivialenssens` in resource group `olivia`. Azure reported build successful, site started successfully, and deployment completed successfully.
- Both `https://olivia.lenssens.net` and `https://olivialenssens.azurewebsites.net` returned HTTP 200 on all six language routes, with the Pilates navigation item, supplied prices, and both Calendly embeds.
- Live root HTML and CSS/JavaScript assets match local SHA-256 hashes on both hostnames; portfolio media remains available. App Service state is Running.
- Browser verification on the production custom domain opened both embedded calendars and confirmed the private and group event titles and their 45-minute durations. No booking was submitted.
- No infrastructure, runtime, app settings, or access assignments were changed.

- Deployed at `2026-10-06T14:01:19Z` to existing app `olivialenssens`; Azure CLI reported `RuntimeSuccessful`, 1 successful instance, and no failed instances.
- App Service remains Running in West Europe.
- Both `https://olivia.lenssens.net` and `https://olivialenssens.azurewebsites.net` returned HTTP 200 for `/`, `/fr/`, `/de/`, `/nl/`, `/et/`, and `/cs/`; rendered language tags, localized titles, and corresponding flag labels were verified.
- Live CSS, localization JavaScript, and a portfolio image each returned HTTP 200.
- Post-deployment `git diff --check`: passed.
