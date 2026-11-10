'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { messages, localeCodes } = require('../public/js/i18n');
const analytics = require('../analytics');
const seo = require('../seo');

const ROOT = path.join(__dirname, '..');
const LOCALES = Object.keys(localeCodes);
const GTM = 'GTM-TEST123';
const DAY = 864e5;
const CONSENT_KEYS = [
    'consent.title', 'consent.body', 'consent.accept', 'consent.reject', 'consent.customize', 'consent.save',
    'consent.necessary', 'consent.necessaryText', 'consent.analytics', 'consent.analyticsText',
    'consent.marketing', 'consent.marketingText', 'consent.settings',
];
const plain = value => JSON.parse(JSON.stringify(value)); // objects made inside the VM have other prototypes

// Runs the inline <head> consent script the way a browser would, with a given cookie header.
function runConsentScript(html, cookie = '') {
    const script = html.match(/<script>\s*(window\.dataLayer = window\.dataLayer[\s\S]*?)<\/script>/)[1];
    const attributes = {};
    const context = vm.createContext({
        document: { cookie, documentElement: { setAttribute: (name, value) => { attributes[name] = value; } } },
    });
    context.window = context;
    vm.runInContext(script, context);
    const isArguments = entry => Object.prototype.toString.call(entry) === '[object Arguments]';
    const dataLayer = plain(context.dataLayer.map(entry => (isArguments(entry) ? Array.from(entry) : entry)));
    const commands = name => dataLayer.filter(entry => Array.isArray(entry) && entry[0] === 'consent' && entry[1] === name).map(entry => entry[2]);
    return { dataLayer, attributes, consent: context.siteConsent, defaults: commands('default'), updates: commands('update') };
}

const cookieFor = choice => `${analytics.CONSENT.cookie}=${encodeURIComponent(JSON.stringify(choice))}`;

test('GTM_ID is validated and normalised', () => {
    assert.equal(analytics.containerId(' gtm-abc1234 '), 'GTM-ABC1234');
    assert.equal(analytics.containerId(''), '');
    assert.equal(analytics.containerId(undefined), '');
    const warn = console.warn;
    console.warn = () => {};
    try {
        assert.equal(analytics.containerId('G-ABC1234567'), '', 'a GA4 measurement ID is not a container ID');
        assert.equal(analytics.containerId("GTM-1');alert(1)//"), '');
    } finally {
        console.warn = warn;
    }
});

for (const locale of LOCALES) {
    test(`${locale}: without GTM_ID the page has no tag, consent script or banner`, () => {
        const html = seo.renderPage(locale, { gtmId: '' });
        for (const trace of ['googletagmanager', 'siteConsent', 'data-consent', 'consentBanner', 'consent.js', 'gtm:head', 'consent:start', 'consent:end']) {
            assert.ok(!html.includes(trace), trace);
        }
    });

    test(`${locale}: with GTM_ID the consent defaults come first, then the container`, () => {
        const html = seo.renderPage(locale, { gtmId: GTM });
        const head = html.slice(0, html.indexOf('</head>'));
        const order = [
            head.indexOf('<meta charset="UTF-8">'),
            head.indexOf('<meta name="viewport"'),
            head.indexOf("gtag('consent', 'default'"),
            head.indexOf("'https://www.googletagmanager.com/gtm.js?id='"),
            head.indexOf('<title'),
        ];
        assert.ok(order.every(index => index >= 0), `all present: ${order}`);
        assert.deepEqual([...order].sort((a, b) => a - b), order, 'charset, viewport, consent defaults, container, title');
        assert.equal(html.split(GTM).length - 1, 1, 'container ID appears once');
        assert.ok(!html.includes('ns.html'), 'no <noscript> container: no consent possible without JavaScript');
        assert.ok(head.includes(`dataLayer.push({ page_language: '${locale}' });`));
        assert.ok(!html.includes('gtm:head') && !html.includes('consent:start') && !html.includes('consent:end'), 'markers removed');
    });

    test(`${locale}: cookie banner and footer link are rendered in the page language`, () => {
        const html = seo.renderPage(locale, { gtmId: GTM });
        const t = messages[locale];
        assert.equal((html.match(/<section id="consentBanner"/g) || []).length, 1);
        for (const key of CONSENT_KEYS.filter(key => key !== 'consent.settings')) {
            assert.match(html, new RegExp(`data-i18n="${key.replace('.', '\\.')}"[^>]*>${t[key].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<`), key);
        }
        assert.match(html, new RegExp(`data-consent-open\\s+aria-controls="consentBanner"\\s+data-i18n="consent.settings">${t['consent.settings'].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</button>`));
        assert.ok(t['consent.body'].includes(t['consent.settings']), 'the banner names the footer link the visitor will see');
        assert.match(html, /<script src="\/js\/consent\.js\?v=[0-9a-f]{10}" defer><\/script>/);
        assert.ok(html.indexOf('id="chatbot"') < html.indexOf('id="consentBanner"'), 'banner comes after the chat widget');
    });

    test(`${locale}: every consent string is translated`, () => {
        for (const key of CONSENT_KEYS) {
            assert.equal(typeof messages[locale][key], 'string', key);
            assert.ok(messages[locale][key].trim(), key);
        }
        if (locale !== 'en') {
            for (const key of ['consent.title', 'consent.body', 'consent.accept', 'consent.reject', 'consent.save', 'consent.settings']) {
                assert.notEqual(messages[locale][key], messages.en[key], `${key}: English fallback`);
            }
        }
    });
}

test('first visit: everything that stores data is denied and the banner is pending', () => {
    const run = runConsentScript(seo.renderPage('en', { gtmId: GTM }));
    assert.deepEqual(run.defaults, [{
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        personalization_storage: 'denied',
        functionality_storage: 'granted',
        security_storage: 'granted',
    }]);
    assert.deepEqual(run.updates, []);
    assert.ok(run.dataLayer.some(entry => entry[0] === 'set' && entry[1] === 'ads_data_redaction' && entry[2] === true));
    assert.deepEqual(run.dataLayer.at(-1), { page_language: 'en' });
    assert.equal(run.attributes['data-consent'], 'pending');
    assert.equal(run.consent.choice, null);
});

test('returning visitor: the stored choice is applied before Tag Manager loads', () => {
    const html = seo.renderPage('de', { gtmId: GTM });
    const now = Date.now();

    const statisticsOnly = runConsentScript(html, `other=1; ${cookieFor({ v: 1, analytics: true, marketing: false, ts: now - DAY })}; last=2`);
    assert.deepEqual(statisticsOnly.updates, [{
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        personalization_storage: 'denied',
    }]);
    assert.equal(statisticsOnly.attributes['data-consent'], 'set');
    assert.equal(plain(statisticsOnly.consent.choice).analytics, true);

    const everything = runConsentScript(html, cookieFor({ v: 1, analytics: true, marketing: true, ts: now }));
    assert.ok(Object.values(everything.updates[0]).every(state => state === 'granted'));
    // The default always comes first, the update after it.
    assert.ok(everything.dataLayer.findIndex(e => e[1] === 'default') < everything.dataLayer.findIndex(e => e[1] === 'update'));
});

test('expired, outdated, malformed or look-alike cookies ask again', () => {
    const html = seo.renderPage('nl', { gtmId: GTM });
    const cases = {
        expired: cookieFor({ v: 1, analytics: true, marketing: true, ts: Date.now() - 181 * DAY }),
        'old version': cookieFor({ v: 0, analytics: true, marketing: true, ts: Date.now() }),
        'no timestamp': cookieFor({ v: 1, analytics: true, marketing: true }),
        malformed: `${analytics.CONSENT.cookie}=%7Bnot-json`,
        'look-alike name': `x${cookieFor({ v: 1, analytics: true, marketing: true, ts: Date.now() })}`,
    };
    for (const [name, cookie] of Object.entries(cases)) {
        const run = runConsentScript(html, cookie);
        assert.deepEqual(run.updates, [], name);
        assert.equal(run.attributes['data-consent'], 'pending', name);
    }
});

test('Calendly embeds can report bookings to the page', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
    const frames = [...html.matchAll(/<iframe\s+src="(https:\/\/calendly\.com\/[^"]+)"/g)].map(m => new URL(m[1].replace(/&amp;/g, '&')));
    assert.equal(frames.length, 2);
    for (const url of frames) {
        assert.equal(url.searchParams.get('embed_type'), 'Inline');
        assert.equal(url.searchParams.get('embed_domain'), new URL(seo.SITE_URL).hostname);
    }
});

test('analytics events never carry what the visitor typed', () => {
    const main = fs.readFileSync(path.join(ROOT, 'public/js/main.js'), 'utf8');
    const calls = [...main.matchAll(/track\('([a-z_]+)'[^;]*\);/g)];
    assert.deepEqual(calls.map(m => m[1]).sort(), ['booking_open', 'gallery_open', 'generate_lead']);
    for (const [call] of calls) assert.doesNotMatch(call, /\b(?:name|email|phone|message)\b/, call);
    assert.match(main, /'calendly\.event_scheduled', 'booking_scheduled'/);
    assert.match(main, /event\.origin !== 'https:\/\/calendly\.com'/);
});
