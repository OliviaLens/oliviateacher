'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { messages, localeCodes } = require('../public/js/i18n');

const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const section = html.match(/<section id="pilates"[\s\S]*?<\/section>/)[0];
const keys = Object.keys(messages.en).filter(key => key.startsWith('pilates.'));
const markers = [...section.matchAll(/data-i18n(?:-title|-alt)?="([^"]+)"/g)].map(match => match[1]);
const normalize = text => text.replace(/\s+/g, ' ').trim();

test('every Pilates translation is wired into the page', () => {
    assert.deepEqual([...new Set(markers)].sort(), [...keys].sort());
    assert.doesNotMatch(section, /\blang=/);
});

test('course options replace the session button immediately after the introduction', () => {
    assert.match(section, /<\/header>\s*<div class="pilates-block" id="pilates-courses">/);
    assert.doesNotMatch(section, /data-i18n="pilates.choose"/);
    assert.equal((section.match(/id="pilates-courses"/g) || []).length, 1);
    assert.equal((section.match(/class="pilates-course"/g) || []).length, 2);
    assert.equal((section.match(/<iframe /g) || []).length, 2);
    assert.ok(section.indexOf('id="pilates-courses"') < section.indexOf('data-i18n="pilates.benefits.title"'));
});

test('English fallback content matches the translation dictionary', () => {
    for (const [, tag, key, content] of section.matchAll(/<(\w+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g)) {
        assert.equal(normalize(content), messages.en[key], `${tag}: ${key}`);
    }
    for (const [, title, key] of section.matchAll(/title="([^"]+)"\s+data-i18n-title="([^"]+)"/g)) {
        assert.equal(title, messages.en[key], key);
    }
});

test('studio image is in the introduction with dimensions and translated alt text', () => {
    const header = section.match(/<header\b[\s\S]*?<\/header>/)[0];
    assert.match(header, /src="\/media\/pilates\/pilates_studio.jpeg"/);
    assert.match(header, /width="1082" height="586"/);
    assert.match(header, /data-i18n-alt="pilates.image"/);
    assert.ok(header.includes(`alt="${messages.en['pilates.image']}"`));
    assert.ok(fs.existsSync(path.join(__dirname, '../media/pilates/pilates_studio.jpeg')));
});

for (const locale of Object.keys(localeCodes)) {
    test(`${locale}: all Pilates strings are translated without losing markup or numbers`, () => {
        assert.equal(messages[locale]['nav.pilates'], 'Pilates');
        assert.deepEqual(Object.keys(messages[locale]).filter(key => key.startsWith('pilates.')).sort(), [...keys].sort());
        for (const key of keys) {
            const value = messages[locale][key];
            assert.equal(typeof value, 'string', key);
            assert.ok(value.trim(), key);
            assert.deepEqual(value.match(/<[^>]+>/g), messages.en[key].match(/<[^>]+>/g), `${key}: markup`);
            assert.deepEqual(value.match(/\d+/g), messages.en[key].match(/\d+/g), `${key}: numbers`);
            if (locale !== 'en') assert.notEqual(value, messages.en[key], `${key}: English fallback`);
        }
    });
}
