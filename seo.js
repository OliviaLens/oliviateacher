'use strict';

/*
 * Server-side SEO for the one-page site.
 *
 * - Renders one fully translated, indexable HTML page per language.
 * - Adds absolute canonical + hreflang links, Open Graph / Twitter tags and
 *   JSON-LD structured data, all built from the same translations the page shows.
 * - Generates robots.txt and an XML sitemap (with hreflang alternates and gallery images).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { messages, localeCodes } = require('./public/js/i18n');
const analytics = require('./analytics');

const SITE_URL = (process.env.SITE_URL || 'https://olivia.lenssens.net').replace(/\/+$/, '');
const SITE_NAME = 'Olivia Lenssens';
const DEFAULT_LOCALE = 'en';
const LOCALES = Object.keys(localeCodes);

// Open Graph wants language_TERRITORY. hreflang deliberately uses the plain language code
// (fr, de, …) so that French speakers in France or Belgium also match the French page.
const OG_LOCALES = { en: 'en_GB', fr: 'fr_CH', de: 'de_CH', nl: 'nl_BE', et: 'et_EE', cs: 'cs_CZ' };

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const MEDIA_DIR = path.join(ROOT, 'media');
const TEMPLATE_PATH = path.join(PUBLIC_DIR, 'index.html');
const VERSIONED_ASSETS = ['/css/styles.css', '/js/i18n.js', '/js/main.js', '/js/consent.js'];
const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;

const SHARE_IMAGE = { path: '/images/og-olivia-lenssens.jpg', width: 1200, height: 630 };
const PROFILE_IMAGE = '/portfolio-media/FullSizeRender-729x1024.jpeg';
const LAUSANNE = { '@type': 'City', name: 'Lausanne' };
const LAUSANNE_ADDRESS = {
    '@type': 'PostalAddress',
    addressLocality: 'Lausanne',
    addressRegion: 'VD',
    addressCountry: 'CH',
};

const localePath = locale => (locale === DEFAULT_LOCALE ? '/' : `/${locale}/`);
const absoluteUrl = urlPath => `${SITE_URL}${urlPath}`;
const isLocale = value => LOCALES.includes(value);

function translator(locale) {
    const dictionary = messages[locale] || messages[DEFAULT_LOCALE];
    return key => dictionary[key] || messages[DEFAULT_LOCALE][key] || key;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Translations carry a little inline markup (<em>, <br>, &amp;); strip it for text-only uses.
function toPlainText(html) {
    return String(html)
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&(?:ensp|emsp|nbsp);/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&(?:apos|#39);/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

// ─────────────────────────────────────────────
// Asset versions (cache busting) — content hash, recomputed when a file changes
// ─────────────────────────────────────────────
const versionCache = new Map();

function assetVersion(urlPath) {
    const filePath = path.join(PUBLIC_DIR, urlPath);
    const { mtimeMs, size } = fs.statSync(filePath);
    const cached = versionCache.get(filePath);
    if (cached && cached.mtimeMs === mtimeMs && cached.size === size) return cached.version;
    const version = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').slice(0, 10);
    versionCache.set(filePath, { mtimeMs, size, version });
    return version;
}

// ─────────────────────────────────────────────
// Page rendering
// ─────────────────────────────────────────────
// Matches a real attribute, never the tail of a marker such as data-i18n-content="…".
const attributePattern = name => new RegExp(`(?<![\\w-])${name}="[^"]*"`);

function translateTemplate(template, locale) {
    const translate = translator(locale);
    let html = template;

    html = html.replace(/(<([a-z][\w:-]*)\b(?=[^>]*\bdata-i18n="([^"]+)")[^>]*>)[\s\S]*?(<\/\2>)/gi,
        (_match, openingTag, _tagName, key, closingTag) => `${openingTag}${translate(key)}${closingTag}`);

    [
        ['content', 'content'],
        ['aria', 'aria-label'],
        ['alt', 'alt'],
        ['placeholder', 'placeholder'],
        ['title', 'title'],
    ].forEach(([markerName, attributeName]) => {
        const markerAttribute = `data-i18n-${markerName}`;
        html = html.replace(/<[^>]+>/g, tag => {
            const key = tag.match(new RegExp(`\\b${markerAttribute}="([^"]+)"`))?.[1];
            if (!key) return tag;
            return tag.replace(attributePattern(attributeName), `${attributeName}="${escapeHtml(translate(key))}"`);
        });
    });

    return html.replace('<html lang="en">', `<html lang="${localeCodes[locale]}">`);
}

function pilatesOffers(template, translate) {
    // Prices come from the page itself so the structured data can never disagree with it.
    const [privatePrice, groupPrice] = [...template.matchAll(/class="pilates-price">\s*CHF\s*(\d+)/g)].map(match => match[1]);
    const packagePrice = key => toPlainText(translate(key)).match(/CHF\s*(\d+)/)?.[1];
    return {
        private: [
            privatePrice && { price: privatePrice, description: `CHF ${privatePrice} ${toPlainText(translate('pilates.private.unit'))}` },
            packagePrice('pilates.private.package') && { price: packagePrice('pilates.private.package'), description: toPlainText(translate('pilates.private.package')) },
        ].filter(Boolean),
        group: [
            groupPrice && { price: groupPrice, description: `CHF ${groupPrice} ${toPlainText(translate('pilates.group.unit'))}` },
            packagePrice('pilates.group.package') && { price: packagePrice('pilates.group.package'), description: toPlainText(translate('pilates.group.package')) },
        ].filter(Boolean),
    };
}

function structuredData(locale, template) {
    const translate = translator(locale);
    const text = key => toPlainText(translate(key));
    const pageUrl = absoluteUrl(localePath(locale));
    const ids = {
        website: `${SITE_URL}/#website`,
        person: `${SITE_URL}/#person`,
        page: `${pageUrl}#webpage`,
    };
    const email = template.match(/href="mailto:([^"?]+)"/)?.[1];
    const heroImage = template.match(/<img\b[^>]*class="hero-image"[^>]*\bsrc="([^"]+)"/)?.[1];
    const prices = pilatesOffers(template, translate);

    const service = (slug, titleKey, bodyKey, extra = {}) => ({
        '@type': 'Service',
        '@id': `${pageUrl}#service-${slug}`,
        name: text(titleKey),
        description: text(bodyKey),
        provider: { '@id': ids.person },
        ...extra,
    });
    const offersFor = (serviceNode, priced = []) => (priced.length ? priced : [{}]).map((offer, index) => ({
        '@type': 'Offer',
        itemOffered: index === 0 ? serviceNode : { '@id': serviceNode['@id'] },
        ...(offer.price ? { price: offer.price, priceCurrency: 'CHF', description: offer.description } : {}),
    }));

    const person = {
        '@type': 'Person',
        '@id': ids.person,
        name: SITE_NAME,
        url: absoluteUrl('/'),
        image: absoluteUrl(PROFILE_IMAGE),
        jobTitle: text('schema.jobTitle'),
        description: text('meta.description'),
        ...(email ? { email: `mailto:${email}` } : {}),
        address: LAUSANNE_ADDRESS,
        worksFor: {
            '@type': 'Organization',
            name: 'AFJD – Association pour la Formation des Jeunes Danseurs',
            address: LAUSANNE_ADDRESS,
        },
        alumniOf: [
            {
                '@type': 'EducationalOrganization',
                name: 'Royal Ballet School of Antwerp',
                address: { '@type': 'PostalAddress', addressLocality: 'Antwerp', addressCountry: 'BE' },
            },
            {
                '@type': 'EducationalOrganization',
                name: 'Centre National de la Danse',
                address: { '@type': 'PostalAddress', addressLocality: 'Pantin', addressCountry: 'FR' },
            },
        ],
        hasCredential: [
            {
                '@type': 'EducationalOccupationalCredential',
                name: 'Diplôme d’État de Professeur de Danse Classique',
                credentialCategory: 'diploma',
                recognizedBy: { '@type': 'GovernmentOrganization', name: 'Ministère de la Culture (France)' },
            },
            {
                '@type': 'EducationalOccupationalCredential',
                name: text('cv.certificate'),
                credentialCategory: 'certificate',
            },
        ],
        award: text('cv.awardTitle'),
        knowsLanguage: ['en', 'fr'],
        makesOffer: [
            ...offersFor(service('ballet-pre-professional', 'services.prepro.title', 'services.prepro.body', { serviceType: 'Ballet classes', areaServed: LAUSANNE })),
            ...offersFor(service('ballet-private', 'services.private.title', 'services.private.body', { serviceType: 'Ballet classes', areaServed: LAUSANNE })),
            ...offersFor(service('conditioning', 'services.conditioning.title', 'services.conditioning.body', { areaServed: LAUSANNE })),
            ...offersFor(service('choreography', 'services.choreography.title', 'services.choreography.body', { serviceType: 'Choreography' })),
            ...offersFor(service('pilates-private', 'pilates.private.title', 'pilates.private.body', { serviceType: 'Online Pilates' }), prices.private),
            ...offersFor(service('pilates-group', 'pilates.group.title', 'pilates.group.body', { serviceType: 'Online Pilates' }), prices.group),
        ],
    };

    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'WebSite',
                '@id': ids.website,
                url: absoluteUrl('/'),
                name: SITE_NAME,
                inLanguage: LOCALES,
                publisher: { '@id': ids.person },
            },
            {
                '@type': 'ProfilePage',
                '@id': ids.page,
                url: pageUrl,
                name: text('meta.title'),
                description: text('meta.description'),
                inLanguage: locale,
                isPartOf: { '@id': ids.website },
                mainEntity: { '@id': ids.person },
                ...(heroImage ? { primaryImageOfPage: { '@type': 'ImageObject', url: absoluteUrl(heroImage) } } : {}),
            },
            person,
        ],
    };
}

function headTags(locale, template) {
    const translate = translator(locale);
    const pageUrl = absoluteUrl(localePath(locale));
    const jsonLd = JSON.stringify(structuredData(locale, template)).replace(/</g, '\\u003c');
    return [
        `<link rel="canonical" href="${pageUrl}">`,
        ...LOCALES.map(code => `<link rel="alternate" hreflang="${code}" href="${absoluteUrl(localePath(code))}">`),
        `<link rel="alternate" hreflang="x-default" href="${absoluteUrl(localePath(DEFAULT_LOCALE))}">`,
        `<meta property="og:url" content="${pageUrl}">`,
        `<meta property="og:locale" content="${OG_LOCALES[locale]}">`,
        ...LOCALES.filter(code => code !== locale).map(code => `<meta property="og:locale:alternate" content="${OG_LOCALES[code]}">`),
        `<meta property="og:image" content="${absoluteUrl(SHARE_IMAGE.path)}">`,
        `<meta property="og:image:width" content="${SHARE_IMAGE.width}">`,
        `<meta property="og:image:height" content="${SHARE_IMAGE.height}">`,
        `<meta property="og:image:alt" content="${escapeHtml(toPlainText(translate('hero.image')))}">`,
        '<meta name="twitter:card" content="summary_large_image">',
        `<script type="application/ld+json">${jsonLd}</script>`,
    ].join('\n    ');
}

function renderPage(locale, { gtmId = analytics.GTM_ID } = {}) {
    const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    let html = translateTemplate(template, locale);

    // Long-cacheable, content-hashed asset URLs.
    VERSIONED_ASSETS.forEach(asset => {
        html = html.split(`"${asset}"`).join(`"${asset}?v=${assetVersion(asset)}"`);
    });

    // Mark the current language in the footer language links.
    html = html.replace(`<a href="${localePath(locale)}" hreflang="${locale}"`, `<a href="${localePath(locale)}" hreflang="${locale}" aria-current="page"`);

    const tags = headTags(locale, template);
    html = html.includes('<!-- seo:head -->')
        ? html.replace('<!-- seo:head -->', tags)
        : html.replace('</head>', `    ${tags}\n</head>`);

    // Google Tag Manager, consent defaults and the cookie banner (only when GTM_ID is set).
    return analytics.applyTagManager(html, locale, gtmId);
}

// Rendered pages are cached until the template or one of the versioned assets changes.
let pageCache = { key: '', pages: {} };

function getPage(locale) {
    const key = [TEMPLATE_PATH, ...VERSIONED_ASSETS.map(asset => path.join(PUBLIC_DIR, asset))]
        .map(file => fs.statSync(file).mtimeMs)
        .join(':');
    if (pageCache.key !== key) pageCache = { key, pages: {} };
    if (!pageCache.pages[locale]) pageCache.pages[locale] = renderPage(locale);
    return pageCache.pages[locale];
}

// ─────────────────────────────────────────────
// robots.txt and sitemap.xml
// ─────────────────────────────────────────────
function robotsTxt() {
    return ['User-agent: *', 'Allow: /', '', `Sitemap: ${absoluteUrl('/sitemap.xml')}`, ''].join('\n');
}

function sitemapImages(template) {
    const pageImages = [...template.matchAll(/<img\b[^>]*\bsrc="(\/[^"]+)"/g)].map(match => match[1]);
    const galleryImages = [...template.matchAll(/data-media-folder="([^"]+)"/g)]
        .map(match => path.basename(match[1]))
        .flatMap(folder => {
            const dir = path.join(MEDIA_DIR, folder);
            if (!fs.existsSync(dir)) return [];
            return fs.readdirSync(dir)
                .filter(file => !file.startsWith('.') && IMAGE_EXT.test(file))
                .sort()
                .map(file => `/media/${folder}/${file}`);
        });
    return [...new Set([...pageImages, ...galleryImages])].map(imagePath => absoluteUrl(encodeURI(imagePath)));
}

function sitemapXml() {
    const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const images = sitemapImages(template);
    const alternates = [
        ...LOCALES.map(code => `    <xhtml:link rel="alternate" hreflang="${code}" href="${escapeHtml(absoluteUrl(localePath(code)))}"/>`),
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeHtml(absoluteUrl(localePath(DEFAULT_LOCALE)))}"/>`,
    ].join('\n');
    const urls = LOCALES.map(locale => [
        '  <url>',
        `    <loc>${escapeHtml(absoluteUrl(localePath(locale)))}</loc>`,
        alternates,
        ...images.map(image => `    <image:image><image:loc>${escapeHtml(image)}</image:loc></image:image>`),
        '  </url>',
    ].join('\n'));
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml"',
        '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
        ...urls,
        '</urlset>',
        '',
    ].join('\n');
}

module.exports = {
    SITE_URL,
    DEFAULT_LOCALE,
    LOCALES,
    isLocale,
    localePath,
    getPage,
    renderPage,
    structuredData,
    robotsTxt,
    sitemapXml,
    toPlainText,
};
