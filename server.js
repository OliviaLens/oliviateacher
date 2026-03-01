'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve portfolio media (photos & videos) from the previous website
app.use(
    '/portfolio-media',
    express.static(
        path.join(__dirname, './media/portfolio')
    )
);

// Serve production-specific media folders (SwanLake, NutCracker, RomeoJuliet)
app.use('/media', express.static(path.join(__dirname, 'media')));

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

// Start server
app.listen(PORT, () => {
    console.log(`\n✓ Olivia Lenssens – Ballet Teacher website`);
    console.log(`  Running at http://localhost:${PORT}\n`);
});
