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
- Dependencies: `express`, `nodemailer`; lockfile is present.
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
- Package scope: app source, package manifests, public assets, and `media/`; exclude `.git`, `node_modules`, and local-only files.
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
- Current update: deploy the Pilates section and both Calendly embeds to the same existing web app; retain its subscription, runtime, configuration, and media.
- Current AZCLI validation: verify CLI authentication and existing target, syntax and local HTTP behavior, and deployment ZIP integrity. Infrastructure build, validate, what-if, Docker, and new-resource policy checks are not applicable to this code-only update.
- [x] Confirm authenticated Azure CLI subscription is `bernard` and target remains `olivialenssens` in resource group `olivia`.
- [x] Confirm the deployment ZIP contains required runtime files and is not accidentally bundling local dependencies, Git metadata, or deployment-plan artifacts.
- [x] Run local syntax, whitespace, and HTTP smoke checks for English and all five translated routes.
- [x] Verify project startup/build requirements; use local HTTP startup check because this project has no build or test script.
- [x] Container build: not applicable; the target is an existing Linux App Service and the project has no Dockerfile.
- [x] Policy, quota, and RBAC/IaC checks: not applicable; no Azure resources, policies, role assignments, or infrastructure are being changed.

## 7. Validation Proof
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
