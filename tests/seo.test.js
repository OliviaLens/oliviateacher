'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { once } = require('node:events');
const { messages, localeCodes } = require('../public/js/i18n');
const seo = require('../seo');
const app = require('../server');

const ROOT = path.join(__dirname, '..');
const LOCALES = Object.keys(localeCodes);
const pageUrl = locale => `${seo.SITE_URL}${seo.localePath(locale)}`;
const attr = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fileForUrl = url => {
    const urlPath = decodeURI(new URL(url, seo.SITE_URL).pathname);
    if (urlPath.startsWith('/portfolio-media/')) return path.join(ROOT, 'media/portfolio', urlPath.slice('/portfolio-media/'.length));
    if (urlPath.startsWith('/media/')) return path.join(ROOT, urlPath);
    return path.join(ROOT, 'public', urlPath);
};

let server;
let base;
test.before(async () => {
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const get = (urlPath, headers = {}) => fetch(base + urlPath, { headers, redirect: 'manual' });
const pages = {};
async function page(locale) {
    if (!pages[locale]) {
        const res = await get(seo.localePath(locale));
        assert.equal(res.status, 200, locale);
        pages[locale] = await res.text();
    }
    return pages[locale];
}

for (const locale of LOCALES) {
    test(`${locale}: language, canonical and hreflang are absolute and complete`, async () => {
        const html = await page(locale);
        assert.match(html, new RegExp(`<html lang="${localeCodes[locale]}">`));
        const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]+)">/g)].map(m => m[1]);
        assert.deepEqual(canonicals, [pageUrl(locale)]);
        const alternates = Object.fromEntries([...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map(m => [m[1], m[2]]));
        assert.deepEqual(alternates, {
            ...Object.fromEntries(LOCALES.map(code => [code, pageUrl(code)])),
            'x-default': pageUrl('en'),
        });
        assert.ok(html.includes(`<meta property="og:url" content="${pageUrl(locale)}">`));
    });

    test(`${locale}: title, description and social tags are translated in the served HTML`, async () => {
        const html = await page(locale);
        const t = messages[locale];
        assert.ok(html.includes(`<title data-i18n="meta.title">${t['meta.title']}</title>`));
        assert.ok(html.includes(`content="${attr(t['meta.description'])}"`), 'meta description');
        assert.ok(html.includes(`<meta property="og:title" data-i18n-content="meta.title" content="${attr(t['meta.title'])}">`));
        // Regression: the translation used to land in the data-i18n-content marker instead of content.
        assert.doesNotMatch(html, /data-i18n-content="(?!meta\.)/);
        assert.ok(t['meta.title'].length <= 65, `title length ${t['meta.title'].length}`);
        assert.ok(t['meta.description'].length <= 160, `description length ${t['meta.description'].length}`);
        const ogImage = html.match(/<meta property="og:image" content="([^"]+)">/)[1];
        assert.ok(ogImage.startsWith(`${seo.SITE_URL}/`), 'og:image is absolute');
        assert.ok(fs.existsSync(fileForUrl(ogImage)), 'og:image file exists');
    });

    test(`${locale}: every translated element is rendered on the server`, async () => {
        const html = await page(locale);
        const translate = key => messages[locale][key] || messages.en[key];
        for (const [, , key, content] of html.matchAll(/<(\w+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g)) {
            assert.equal(content, translate(key), key);
        }
        assert.ok(html.includes(`aria-current="page"`), 'current language marked in the footer');
    });

    test(`${locale}: structured data is valid JSON and matches the visible page`, async () => {
        const html = await page(locale);
        const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
        assert.equal(blocks.length, 1);
        const graph = JSON.parse(blocks[0][1])['@graph'];
        const byType = type => graph.find(node => node['@type'] === type);
        assert.equal(byType('WebSite').url, `${seo.SITE_URL}/`);
        assert.equal(byType('ProfilePage').url, pageUrl(locale));
        assert.equal(byType('ProfilePage').inLanguage, locale);
        const person = byType('Person');
        assert.equal(person.name, 'Olivia Lenssens');
        assert.equal(person.jobTitle, messages[locale]['schema.jobTitle']);
        assert.ok(fs.existsSync(fileForUrl(person.image)), 'person image exists');
        const visiblePrices = [...html.matchAll(/class="pilates-price">\s*CHF\s*(\d+)/g)].map(m => m[1]);
        const offeredPrices = person.makesOffer.filter(offer => offer.price).map(offer => offer.price);
        assert.deepEqual(visiblePrices, ['60', '25']);
        assert.deepEqual(offeredPrices, ['60', '500', '25', '200']);
        for (const offer of person.makesOffer) {
            assert.equal(offer['@type'], 'Offer');
            assert.ok(offer.itemOffered['@id']);
        }
        assert.doesNotMatch(JSON.stringify(graph), /<[a-z/]/i, 'no markup inside structured data');
    });
}

test('duplicate URLs redirect permanently to the canonical page', async () => {
    const cases = {
        '/index.html': '/',
        '/en': '/',
        '/en/': '/',
        '/fr': '/fr/',
        '/FR/': '/fr/',
        '/cs?ref=x': '/cs/?ref=x',
    };
    for (const [from, to] of Object.entries(cases)) {
        const res = await get(from);
        assert.equal(res.status, 301, from);
        assert.equal(new URL(res.headers.get('location'), base).pathname + new URL(res.headers.get('location'), base).search, to, from);
    }
    assert.equal((await get('/xx')).status, 404);
});

test('robots.txt points to the sitemap', async () => {
    const res = await get('/robots.txt');
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.match(body, /^User-agent: \*$/m);
    assert.ok(body.includes(`Sitemap: ${seo.SITE_URL}/sitemap.xml`));
    assert.doesNotMatch(body, /Disallow: \/\s*$/m);
});

test('sitemap lists every language with alternates and existing images', async () => {
    const res = await get('/sitemap.xml');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /xml/);
    const xml = await res.text();
    const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(m => m[1]);
    assert.deepEqual(urls.map(u => u.match(/<loc>([^<]+)<\/loc>/)[1]), LOCALES.map(pageUrl));
    for (const entry of urls) {
        assert.equal((entry.match(/<xhtml:link rel="alternate"/g) || []).length, LOCALES.length + 1);
        const images = [...entry.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map(m => m[1]);
        assert.ok(images.length >= 20, `only ${images.length} images`);
        for (const image of images) assert.ok(fs.existsSync(fileForUrl(image)), image);
    }
});

test('pages are compressed and revalidated; versioned assets are cached for a year', async () => {
    const html = await get('/', { 'accept-encoding': 'gzip' });
    assert.equal(html.headers.get('content-encoding'), 'gzip');
    assert.equal(html.headers.get('cache-control'), 'no-cache');
    const body = await html.text();
    for (const asset of ['/css/styles.css', '/js/i18n.js', '/js/main.js']) {
        const versioned = body.match(new RegExp(`"(${asset.replace(/\./g, '\\.')}\\?v=[0-9a-f]{10})"`))?.[1];
        assert.ok(versioned, `${asset} is versioned`);
        const res = await get(versioned);
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    }
    const media = await get('/portfolio-media/FullSizeRender-729x1024.jpeg');
    assert.match(media.headers.get('cache-control'), /max-age=2592000/);
});

test('hero, icons and figures are crawl-friendly', async () => {
    const html = await page('en');
    for (const [, url] of html.matchAll(/(\/portfolio-media\/[^\s",]+\.webp) \d+w/g)) {
        assert.ok(fs.existsSync(fileForUrl(url)), url);
    }
    assert.match(html, /<h1 class="hero-heading">[\s\S]*Lenssens[\s\S]*Ballet Teacher for Pre-Professional Students[\s\S]*<\/h1>/);
    assert.deepEqual([...html.matchAll(/class="stat-number"[^>]*>([^<]+)</g)].map(m => m[1]), ['10+', '+30', '3', '1']);
    for (const icon of ['/favicon.ico', '/icons/icon-192.png', '/icons/apple-touch-icon.png']) {
        assert.equal((await get(icon)).status, 200, icon);
    }
    assert.equal((html.match(/<main\b/g) || []).length, 1);
    assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'public/js/i18n.js'), 'utf8'), /createElement\('link'\)/, 'hreflang links are rendered by the server only');
});
