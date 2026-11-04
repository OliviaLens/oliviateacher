'use strict';

const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const seo = require('./seo');
const analytics = require('./analytics');

const app = express();
const PORT = process.env.PORT || 3000;

// Compress HTML, CSS, JS, JSON and XML (brotli or gzip); photos and videos are left as they are
app.use(compression());

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────
// Pages: one indexable URL per language
//   /      English (also x-default)
//   /fr/ /de/ /nl/ /et/ /cs/
// Duplicates (/index.html, /en, /fr without the slash, upper case) redirect permanently.
// ─────────────────────────────────────────────
function queryString(req) {
    const index = req.originalUrl.indexOf('?');
    return index === -1 ? '' : req.originalUrl.slice(index);
}

function sendPage(res, locale) {
    res.set('Cache-Control', 'no-cache');
    res.type('html').send(seo.getPage(locale));
}

app.get('/', (req, res) => sendPage(res, seo.DEFAULT_LOCALE));

app.get(['/index.html', '/en', '/en/'], (req, res) => res.redirect(301, `/${queryString(req)}`));

app.get('/:locale([a-zA-Z]{2})', (req, res, next) => {
    const locale = req.params.locale.toLowerCase();
    if (!seo.isLocale(locale)) return next();
    const canonicalPath = seo.localePath(locale);
    if (req.path !== canonicalPath) return res.redirect(301, `${canonicalPath}${queryString(req)}`);
    sendPage(res, locale);
});

app.get('/robots.txt', (req, res) => {
    res.set('Cache-Control', 'public, max-age=86400');
    res.type('text/plain').send(seo.robotsTxt());
});

app.get('/sitemap.xml', (req, res) => {
    res.set('Cache-Control', 'public, max-age=3600');
    res.type('application/xml').send(seo.sitemapXml());
});

// ─────────────────────────────────────────────
// Static files
// ─────────────────────────────────────────────
const ONE_YEAR = 'public, max-age=31536000, immutable';
const ONE_WEEK = 'public, max-age=604800';
const STATIC_IMAGE = /\.(?:png|jpe?g|webp|gif|ico|svg)$/i;

// CSS/JS are linked with a content hash (?v=…) by the page renderer, so those URLs never change.
app.use(express.static(path.join(__dirname, 'public'), {
    index: false,
    setHeaders(res, filePath) {
        if (res.req.query.v) res.setHeader('Cache-Control', ONE_YEAR);
        else if (STATIC_IMAGE.test(filePath)) res.setHeader('Cache-Control', ONE_WEEK);
    },
}));

// Serve portfolio media (photos & videos) from the previous website
app.use('/portfolio-media', express.static(path.join(__dirname, './media/portfolio'), { maxAge: '30d' }));

// Serve production-specific media folders (SwanLake, NutCracker, RomeoJuliet)
app.use('/media', express.static(path.join(__dirname, 'media'), { maxAge: '30d' }));

// ─────────────────────────────────────────────
// API: list media files in a sub-folder dynamically
// e.g. GET /api/media/SwanLake → { folder, files: ['/media/SwanLake/...'] }
// ─────────────────────────────────────────────
const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp)$/i;
const VIDEO_EXT = /\.(mp4|mov|webm|ogg)$/i;

app.get('/api/media/:folder', (req, res) => {
    // path.basename prevents path-traversal attacks
    const folder = path.basename(req.params.folder);
    const dir = path.join(__dirname, 'media', folder);

    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        return res.status(404).json({ error: 'Folder not found' });
    }

    const files = fs.readdirSync(dir)
        .filter(f => !f.startsWith('.') && (IMAGE_EXT.test(f) || VIDEO_EXT.test(f)));

    // Images first (alphabetically), then videos (alphabetically)
    files.sort((a, b) => {
        const aVid = VIDEO_EXT.test(a);
        const bVid = VIDEO_EXT.test(b);
        if (aVid !== bVid) return aVid ? 1 : -1;
        return a.localeCompare(b);
    });

    const urls = files.map(f => `/media/${folder}/${f}`);
    res.json({ folder, files: urls });
});

// ─────────────────────────────────────────────
// Contact / Lead-generation form handler
// ─────────────────────────────────────────────
app.post('/api/contact', async (req, res) => {
    const { name, email, phone, service, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ success: false, error: 'Missing required fields.' });
    }

    // Configure a transporter.  In production replace with real SMTP credentials
    // stored in environment variables.  For local development we use a test account.
    let transporter;
    try {
        // Create a nodemailer test account if no env credentials are provided
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.ethereal.email',
            port: Number(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER || testAccount.user,
                pass: process.env.SMTP_PASS || testAccount.pass,
            },
        });
    } catch (err) {
        console.error('Could not create transporter:', err);
        return res.status(500).json({ success: false, error: 'Mail service unavailable.' });
    }

    const serviceLabel = service || 'Not specified';

    const mailOptions = {
        from: `"${name}" <${email}>`,
        to: process.env.CONTACT_EMAIL || 'Olivia.Lenssens@gmail.com',
        subject: `New enquiry – ${serviceLabel}`,
        text: `
Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}
Service: ${serviceLabel}

Message:
${message}
    `,
        html: `
<h2 style="font-family:sans-serif;color:#432812;">New enquiry from your website</h2>
<table style="font-family:sans-serif;font-size:15px;border-collapse:collapse;">
  <tr><td style="padding:6px 16px 6px 0;font-weight:bold;">Name</td><td>${name}</td></tr>
  <tr><td style="padding:6px 16px 6px 0;font-weight:bold;">Email</td><td><a href="mailto:${email}">${email}</a></td></tr>
  <tr><td style="padding:6px 16px 6px 0;font-weight:bold;">Phone</td><td>${phone || 'Not provided'}</td></tr>
  <tr><td style="padding:6px 16px 6px 0;font-weight:bold;">Service</td><td>${serviceLabel}</td></tr>
</table>
<h3 style="font-family:sans-serif;color:#432812;margin-top:20px;">Message</h3>
<p style="font-family:sans-serif;line-height:1.6;">${message.replace(/\n/g, '<br>')}</p>
    `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        // In test/development mode, log the Ethereal preview URL
        if (!process.env.SMTP_HOST) {
            console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
        }
        return res.json({ success: true });
    } catch (err) {
        console.error('Error sending email:', err);
        return res.status(500).json({ success: false, error: 'Failed to send message.' });
    }
});

// Start server (skipped when the app is imported by the tests)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`\n✓ Olivia Lenssens – Ballet Teacher website`);
        console.log(`  Running at http://localhost:${PORT}`);
        console.log(`  Google Tag Manager: ${analytics.GTM_ID || 'off (set GTM_ID to switch it on)'}\n`);
    });
}

module.exports = app;
