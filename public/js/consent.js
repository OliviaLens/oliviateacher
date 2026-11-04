/* Olivia Lenssens – cookie banner for Google Tag Manager | consent.js
 *
 * Loaded only when Tag Manager is on. The consent defaults (statistics and advertising denied)
 * and the restore of a stored choice run inline in <head>, before Tag Manager loads (analytics.js).
 * This file runs the banner: it stores the visitor's choice in a first-party cookie, updates
 * Google Consent Mode and tells Tag Manager with a "consent_update" event.
 */
(function () {
    'use strict';

    const consent = window.siteConsent;
    const banner = document.getElementById('consentBanner');
    if (!consent || !banner || typeof window.gtag !== 'function') return;

    const options = document.getElementById('consentOptions');
    const boxes = {
        analytics: document.getElementById('consentAnalytics'),
        marketing: document.getElementById('consentMarketing'),
    };
    const button = action => banner.querySelector(`[data-consent-action="${action}"]`);
    let returnFocusTo = null;

    function showOptions(show) {
        const choice = consent.choice || {};
        boxes.analytics.checked = Boolean(choice.analytics);
        boxes.marketing.checked = Boolean(choice.marketing);
        options.hidden = !show;
        button('save').hidden = !show;
        button('customize').hidden = show;
        button('customize').setAttribute('aria-expanded', String(show));
    }

    function close() {
        banner.classList.remove('is-open');
        showOptions(false);
        if (returnFocusTo) returnFocusTo.focus();
        returnFocusTo = null;
    }

    function save(analytics, marketing) {
        const choice = { v: consent.version, analytics, marketing, ts: Date.now() };
        const secure = location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${consent.cookie}=${encodeURIComponent(JSON.stringify(choice))}; Max-Age=${consent.maxAgeDays * 86400}; Path=/; SameSite=Lax${secure}`;
        consent.choice = choice;

        window.gtag('consent', 'update', consent.states(choice));
        window.dataLayer.push({
            event: 'consent_update',
            consent_analytics: analytics ? 'granted' : 'denied',
            consent_marketing: marketing ? 'granted' : 'denied',
        });

        document.documentElement.setAttribute('data-consent', 'set');
        close();
    }

    banner.addEventListener('click', (event) => {
        const action = event.target.closest('[data-consent-action]')?.dataset.consentAction;
        if (action === 'accept') save(true, true);
        else if (action === 'reject') save(false, false);
        else if (action === 'save') save(boxes.analytics.checked, boxes.marketing.checked);
        else if (action === 'customize') {
            showOptions(true);
            boxes.analytics.focus();
        }
    });

    // Escape closes the banner only when it was reopened; a first-time visitor still has to choose.
    banner.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && consent.choice && banner.classList.contains('is-open')) close();
    });

    // "Cookie settings" in the footer reopens the banner with the current choice ticked.
    document.querySelectorAll('[data-consent-open]').forEach((link) => {
        link.addEventListener('click', () => {
            returnFocusTo = link;
            showOptions(true);
            banner.classList.add('is-open');
            banner.focus();
        });
    });
})();
