/**
 * server.js — Amazon Product Advertising API 5.0 backend
 *
 * SETUP:
 *   1. npm install express cors axios crypto
 *   2. Imposta le variabili d'ambiente (o sostituisci direttamente qui sotto):
 *        ACCESS_KEY   → chiave di accesso Amazon Associates
 *        SECRET_KEY   → chiave segreta Amazon Associates
 *        PARTNER_TAG  → il tuo tag affiliato (es. mystore-21)
 *   3. node server.js
 *
 * Il frontend index.html chiamerà: GET http://localhost:3000/product?asin=XXXXXXXXXX
 */

const express = require('express');
const cors    = require('cors');
const crypto  = require('crypto');
const axios   = require('axios');

const app = express();
app.use(cors());

// ─── CREDENZIALI ───────────────────────────────────────────────────────────────
const ACCESS_KEY  = process.env.ACCESS_KEY  || 'AKPAO45AGD1773786403';
const SECRET_KEY  = process.env.SECRET_KEY  || '6qUBf6ZzA/TBUzmUc70kxxvlGi50jBoDQx/D4a+8';
const PARTNER_TAG = process.env.PARTNER_TAG || 'pato666-21';

// Marketplace — cambia in base al paese:
//   amazon.it  → webservices.amazon.it  / eu-west-1
//   amazon.com → webservices.amazon.com / us-east-1
const HOST   = 'webservices.amazon.it';
const REGION = 'eu-west-1';
const PATH   = '/paapi5/getitems';
// ──────────────────────────────────────────────────────────────────────────────

// ── 🔍 Estrazione ASIN da URL o input ─────────────────────
function extractAsin(input) {
  if (!input) return null;

  const trimmed = input.trim();

  // Caso 1: è già un ASIN
  if (/^[A-Z0-9]{10}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // Caso 2: URL Amazon con /dp/
  let match = trimmed.match(/\/dp\/([A-Z0-9]{10})/i);

  // Caso 3: URL con /gp/product/
  if (!match) {
    match = trimmed.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  }

  return match ? match[1].toUpperCase() : null;
}
// ─────────────────────────────────────────────────────────

// ── Funzioni di firma AWS Signature V4 ────────────────────────────────────────

function hmac(key, data, encoding) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest(encoding);
}

function hash(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function getSignatureKey(key, dateStamp, region, service) {
  const kDate    = hmac('AWS4' + key, dateStamp);
  const kRegion  = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSign    = hmac(kService, 'aws4_request');
  return kSign;
}

function isoDate() {
  return new Date().toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
}

function buildSignedRequest(payload) {
  const service        = 'ProductAdvertisingAPI';
  const amzDate        = isoDate();
  const dateStamp      = amzDate.slice(0, 8);
  const payloadStr     = JSON.stringify(payload);
  const payloadHash    = hash(payloadStr);
  const contentType    = 'application/json; charset=utf-8';
  const amzTarget      = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems';

  const canonicalHeaders =
    `content-encoding:amz-sdk-request\n` +
    `content-type:${contentType}\n` +
    `host:${HOST}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${amzTarget}\n`;

  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';

  const canonicalRequest = [
    'POST',
    PATH,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope  = `${dateStamp}/${REGION}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    hash(canonicalRequest),
  ].join('\n');

  const signingKey  = getSignatureKey(SECRET_KEY, dateStamp, REGION, service);
  const signature   = hmac(signingKey, stringToSign, 'hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: `https://${HOST}${PATH}`,
    headers: {
      'content-encoding': 'amz-sdk-request',
      'content-type':     contentType,
      'host':             HOST,
      'x-amz-date':       amzDate,
      'x-amz-target':     amzTarget,
      'Authorization':    authorization,
    },
    body: payloadStr,
  };
}

// ── Endpoint principale ───────────────────────────────────────────────────────

app.get('/product', async (req, res) => {
  const { asin } = req.query;

  if (!asin || !/^[A-Z0-9]{10}$/i.test(asin)) {
    return res.status(400).json({ error: 'ASIN non valido.' });
  }

  // Payload PA API 5.0 — GetItems
  const payload = {
    ItemIds:    [asin.toUpperCase()],
    PartnerTag: PARTNER_TAG,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.it',
    Resources: [
      'ItemInfo.Title',
      'Offers.Listings.Price',
      'Offers.Listings.Availability.Message',
      'Images.Primary.Medium',
    ],
  };

  try {
    const req2 = buildSignedRequest(payload);

    const response = await axios.post(req2.url, req2.body, {
      headers: req2.headers,
      timeout: 10000,
    });

    const items = response.data?.ItemsResult?.Items;

    if (!items || items.length === 0) {
      return res.status(404).json({ error: 'Prodotto non trovato o non disponibile tramite PA API.' });
    }

    const item    = items[0];
    const title   = item?.ItemInfo?.Title?.DisplayValue || null;
    const image   = item?.Images?.Primary?.Medium?.URL  || null;
    const listing = item?.Offers?.Listings?.[0];
    const price   = listing?.Price?.DisplayAmount        || null;
    const currency = listing?.Price?.Currency            || null;
    const availMsg = listing?.Availability?.Message      || 'Disponibilità sconosciuta';
    const available = availMsg.toLowerCase().includes('disponibile') ||
                      availMsg.toLowerCase().includes('in stock');

    return res.json({ title, image, price, currency, availability: availMsg, available });

  } catch (err) {
    const errData = err.response?.data;
    const msg = errData?.__type
      ? `Errore PA API: ${errData.__type} — ${errData.Errors?.[0]?.Message || ''}`
      : 'Errore durante la chiamata all\'API Amazon.';

    console.error('PA API error:', errData || err.message);
    return res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅  Server PA API in ascolto su http://localhost:${PORT}`);
  console.log(`    GET http://localhost:${PORT}/product?asin=B08N5WRWNW`);
});
