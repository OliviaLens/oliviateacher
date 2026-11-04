'use strict';

/*
 * Google Tag Manager with Google Consent Mode v2.
 *
 * Switched on by the GTM_ID environment variable (Azure App Service → Configuration →
 * Application settings), e.g. GTM_ID=GTM-ABC1234. Without it the pages carry no tag, no cookie
 * banner and no cookie-settings link, so local development and the tests send nothing to Google.
 *
 * Consent: storage for statistics and advertising is denied until the visitor chooses in the
 * cookie banner (public/js/consent.js). A stored choice is applied inline, before the container
 * loads, so a returning visitor's first hit already carries the right consent state.
 *
 * The <noscript> part of Google's snippet is left out on purpose: visitors without JavaScript
 * cannot give consent, and Google Analytics does not run without JavaScript anyway.
 */

const GTM_ID_PATTERN = /^GTM-[A-Z0-9]{4,12}$/;

const CONSENT = {
    cookie: 'ol_consent',
    version: 1,
    maxAgeDays: 180, // ask again after six months
};

function containerId(value) {
    const id = String(value || '').trim().toUpperCase();
    if (!id) return '';
    if (GTM_ID_PATTERN.test(id)) return id;
    console.warn(`GTM_ID "${value}" is not a Tag Manager container ID (GTM-XXXXXXX); Tag Manager stays off.`);
    return '';
}

const GTM_ID = containerId(process.env.GTM_ID);

// Runs before Tag Manager loads. ES5 on purpose: a syntax error here would leave the tags without
// consent defaults. Exposes window.siteConsent for the banner script.
function consentScript(locale) {
    return `<script>
        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        window.siteConsent = (function () {
            var COOKIE = '${CONSENT.cookie}', VERSION = ${CONSENT.version}, MAX_AGE_DAYS = ${CONSENT.maxAgeDays};
            function states(choice) {
                var statistics = choice && choice.analytics ? 'granted' : 'denied';
                var marketing = choice && choice.marketing ? 'granted' : 'denied';
                return {
                    analytics_storage: statistics,
                    ad_storage: marketing,
                    ad_user_data: marketing,
                    ad_personalization: marketing,
                    personalization_storage: marketing
                };
            }
            var choice = null;
            try {
                var match = document.cookie.match(/(?:^|;\\s*)${CONSENT.cookie}=([^;]+)/);
                choice = match ? JSON.parse(decodeURIComponent(match[1])) : null;
            } catch (error) { choice = null; }
            if (!choice || choice.v !== VERSION || !(Date.now() - choice.ts < MAX_AGE_DAYS * 864e5)) choice = null;

            var defaults = states(null);
            defaults.functionality_storage = 'granted';
            defaults.security_storage = 'granted';
            gtag('consent', 'default', defaults);
            gtag('set', 'ads_data_redaction', true);
            if (choice) gtag('consent', 'update', states(choice));
            document.documentElement.setAttribute('data-consent', choice ? 'set' : 'pending');
            return { cookie: COOKIE, version: VERSION, maxAgeDays: MAX_AGE_DAYS, choice: choice, states: states };
        })();
        dataLayer.push({ page_language: '${locale}' });
    </script>`;
}

// Google's container snippet, unchanged apart from the ID.
function containerScript(gtmId) {
    return `<!-- Google Tag Manager -->
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${gtmId}');</script>
    <!-- End Google Tag Manager -->`;
}

const HEAD_MARKER = /[ \t]*<!-- gtm:head\b[\s\S]*?-->\n?/;
const CONSENT_BLOCK = /[ \t]*<!-- consent:start -->[\s\S]*?<!-- consent:end -->\n?/g;
const CONSENT_MARKER = /[ \t]*<!-- consent:(?:start|end) -->\n?/g;

/**
 * Puts Tag Manager into a rendered page, or removes every trace of it when there is no container ID.
 * The template marks the places with <!-- gtm:head --> and <!-- consent:start/end --> comments.
 */
function applyTagManager(html, locale, gtmId = GTM_ID) {
    if (!gtmId) return html.replace(HEAD_MARKER, '').replace(CONSENT_BLOCK, '');
    const snippet = `    ${consentScript(locale)}\n    ${containerScript(gtmId)}\n`;
    return html.replace(HEAD_MARKER, () => snippet).replace(CONSENT_MARKER, '');
}

module.exports = {
    GTM_ID,
    CONSENT,
    containerId,
    applyTagManager,
};
