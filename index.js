const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Shopify Config
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// Brevo Config
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'info@songkauf.de';
const SHOP_NAME = 'songkauf.de';

app.use(express.json());

// GraphQL helper
async function shopifyGraphQL(query, variables = {}) {
  const response = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  return await response.json();
}

// Get download link from variant metafield
async function getDownloadLink(variantId) {
  const query = `
    query getVariant($id: ID!) {
      productVariant(id: $id) {
        id
        title
        product {
          title
        }
        metafield(namespace: "custom", key: "download_link") {
          value
        }
      }
    }
  `;

  const result = await shopifyGraphQL(query, { id: variantId });
  return result.data?.productVariant;
}

// Send download email via Brevo
async function sendDownloadEmail(customerEmail, customerName, downloads) {
  // Build download list HTML
  let downloadListHtml = '';
  let downloadListText = '';

  for (const item of downloads) {
    downloadListHtml += `
      <tr>
        <td style="padding: 15px; border-bottom: 1px solid #eee;">
          <strong>${item.productTitle}</strong><br>
          <span style="color: #666;">${item.variantTitle}</span>
        </td>
        <td style="padding: 15px; border-bottom: 1px solid #eee; text-align: center;">
          <a href="${item.downloadLink}"
             style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Download
          </a>
        </td>
      </tr>
    `;
    downloadListText += `\n- ${item.productTitle} (${item.variantTitle}): ${item.downloadLink}`;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #000;">
        <img src="https://www.dropbox.com/scl/fi/782zd3vwnkksb0x03mmw1/songkauf-png.png?rlkey=g7k6828l41cuvxxpmwgyz0z9g&raw=1" alt="${SHOP_NAME}" style="max-width: 200px; height: auto;">
      </div>

      <div style="padding: 30px 0;">
        <h2 style="color: #000;">Dein Download ist bereit!</h2>

        <p>Hallo ${customerName || 'Kunde'},</p>

        <p>vielen Dank für deinen Einkauf! Hier sind deine Downloads:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f8f8f8;">
              <th style="padding: 15px; text-align: left;">Produkt</th>
              <th style="padding: 15px; text-align: center;">Download</th>
            </tr>
          </thead>
          <tbody>
            ${downloadListHtml}
          </tbody>
        </table>

        <p style="background-color: #f8f8f8; padding: 15px; border-radius: 5px;">
          <strong>Hinweis:</strong> Der Download-Link ist 30 Tage verfügbar, vergiss nicht deine Dateien herunterzuladen. Bei Problemen kontaktiere uns unter info@songkauf.de
        </p>
      </div>

      <div style="text-align: center; padding: 20px 0; border-top: 1px solid #eee; color: #666; font-size: 14px;">
        <p>Viel Spaß mit deinem Kauf!</p>
        <p><strong>${SHOP_NAME}</strong></p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
${SHOP_NAME}

Dein Download ist bereit!

Hallo ${customerName || 'Kunde'},

vielen Dank für deinen Einkauf! Hier sind deine Downloads:
${downloadListText}

Hinweis: Der Download-Link ist 30 Tage verfügbar, vergiss nicht deine Dateien herunterzuladen. Bei Problemen kontaktiere uns unter info@songkauf.de

Viel Spaß mit deinem Kauf!
${SHOP_NAME}
  `;

  // Send via Brevo API
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: SHOP_NAME,
        email: EMAIL_FROM
      },
      to: [{
        email: customerEmail,
        name: customerName || 'Kunde'
      }],
      subject: `Dein Download von ${SHOP_NAME}`,
      htmlContent: htmlContent,
      textContent: textContent
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || JSON.stringify(result));
  }

  return result;
}

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    message: 'Download Email App is active',
    store: SHOPIFY_STORE ? 'configured' : 'not configured',
    email: BREVO_API_KEY ? 'configured' : 'not configured'
  });
});

// Webhook: Order paid (works with multiple webhook topics)
app.post('/webhooks/orders-paid', async (req, res) => {
  console.log('\n>>> Received orders/paid webhook');
  res.status(200).send('OK');

  const order = req.body;

  // Skip if order is not paid (for orders/create webhook)
  if (order.financial_status && order.financial_status !== 'paid') {
    console.log(`Order not paid yet (status: ${order.financial_status}), skipping...`);
    return;
  }

  const customerEmail = order.email;
  const customerName = order.customer?.first_name || order.billing_address?.first_name || '';

  if (!customerEmail) {
    console.log('No customer email found');
    return;
  }

  console.log(`Processing order for: ${customerEmail}`);

  const downloads = [];

  // Process each line item
  for (const item of order.line_items || []) {
    const variantId = item.variant_id;

    if (!variantId) continue;

    console.log(`Checking variant ${variantId}...`);

    const variantGid = `gid://shopify/ProductVariant/${variantId}`;
    const variantData = await getDownloadLink(variantGid);

    if (variantData?.metafield?.value) {
      console.log(`Found download link for "${variantData.product.title} - ${variantData.title}"`);

      downloads.push({
        productTitle: variantData.product.title,
        variantTitle: variantData.title,
        downloadLink: variantData.metafield.value
      });
    } else {
      console.log(`No download link for variant ${variantId}`);
    }
  }

  // Send email if there are downloads
  if (downloads.length > 0) {
    try {
      console.log(`Sending email with ${downloads.length} download(s) to ${customerEmail}...`);
      await sendDownloadEmail(customerEmail, customerName, downloads);
      console.log('Email sent successfully!');
    } catch (error) {
      console.error('Error sending email:', error.message);
    }
  } else {
    console.log('No downloads found in this order');
  }
});

// Webhook: Orders Create (alternative endpoint)
app.post('/webhooks/orders-create', async (req, res) => {
  console.log('\n>>> Received orders/create webhook');
  res.status(200).send('OK');

  const order = req.body;

  // Only process paid orders
  if (order.financial_status !== 'paid') {
    console.log(`Order not paid yet (status: ${order.financial_status}), waiting for payment...`);
    return;
  }

  const customerEmail = order.email;
  const customerName = order.customer?.first_name || order.billing_address?.first_name || '';

  if (!customerEmail) {
    console.log('No customer email found');
    return;
  }

  console.log(`Processing order for: ${customerEmail}`);

  const downloads = [];

  for (const item of order.line_items || []) {
    const variantId = item.variant_id;
    if (!variantId) continue;

    console.log(`Checking variant ${variantId}...`);
    const variantGid = `gid://shopify/ProductVariant/${variantId}`;
    const variantData = await getDownloadLink(variantGid);

    if (variantData?.metafield?.value) {
      console.log(`Found download link for "${variantData.product.title} - ${variantData.title}"`);
      downloads.push({
        productTitle: variantData.product.title,
        variantTitle: variantData.title,
        downloadLink: variantData.metafield.value
      });
    }
  }

  if (downloads.length > 0) {
    try {
      console.log(`Sending email with ${downloads.length} download(s) to ${customerEmail}...`);
      await sendDownloadEmail(customerEmail, customerName, downloads);
      console.log('Email sent successfully!');
    } catch (error) {
      console.error('Error sending email:', error.message);
    }
  } else {
    console.log('No downloads found in this order');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║        Download Email App Started (Brevo)                  ║
╠════════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                               ║
║  Store: ${SHOPIFY_STORE || 'NOT CONFIGURED'}
║  Email: ${EMAIL_FROM}
║                                                            ║
║  Webhooks:                                                 ║
║  - POST /webhooks/orders-paid                              ║
║  - POST /webhooks/orders-create                            ║
║  Health:  GET /                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
