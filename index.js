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
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 344.37 73.87" style="max-width: 200px; height: auto;">
          <g>
            <path fill="#161615" d="M20.07,26.2c-.07-2.36-1.77-3.1-3.76-3.1s-3.54,1.18-3.54,2.73c0,2.21,1.99,3.32,7.67,4.8,9.74,2.58,12.91,6.49,12.91,12.47,0,8.56-7.38,13.95-16.68,13.95S.89,51.8,0,43.46h12.18c.37,2.58,2.21,3.76,4.65,3.76,2.14,0,4.28-1.25,4.28-3.17,0-2.29-1.4-3.47-7.53-5.39C3.25,35.49.52,31.44.52,26.64c0-8.12,7.6-13.36,15.87-13.36,8.85,0,15.13,4.87,15.72,12.91h-12.03Z"/>
            <path fill="#161615" d="M114.3,55.64v-22.73c0-5.53-1.92-8.12-6.42-8.12-4.94,0-7.01,2.73-7.01,8.26v22.58h-12.25V14.68h11.44v4.35h.15c2.58-4.21,6.2-5.76,11.14-5.76,7.38,0,15.2,4.13,15.2,16.23v26.12h-12.25Z"/>
            <path fill="#161615" d="M165.36,50.84c-1.84,3.91-6.42,6.12-11.44,6.12-11.95,0-20.59-9.22-20.59-21.55s8.78-22.06,20.59-22.06c5.31,0,9.37,1.99,11.36,5.17h.15v-3.84h12.25v36.6c0,5.53-.74,9.74-2.21,12.54-2.95,5.68-11,10.04-21.25,10.04-11.59,0-19.11-6.57-20.15-14.39h14.17c1.4,3.03,4.13,4.06,7.16,4.06,6.2,0,9.96-4.06,9.96-11.51v-1.18ZM165.43,35.35c0-5.98-4.06-10.55-10.04-10.55-5.46,0-9.81,4.57-9.81,10.18s3.91,10.55,9.81,10.55,10.04-4.28,10.04-10.18Z"/>
            <path fill="#161615" d="M210.81,55.64l-11.59-19.7h-.15v19.7h-12.25V1.03h12.25v28.48h.15l11.36-14.83h14.54l-15.42,18,14.98,22.95h-13.87Z"/>
            <path fill="#161615" d="M258.55,55.64v-4.43h-.15c-1.77,3.62-6.64,5.83-12.03,5.83-12.1,0-20.51-9.52-20.51-21.92s8.78-21.84,20.51-21.84c5.02,0,9.67,1.99,12.03,5.76h.15v-4.35h12.25v40.95h-12.25ZM258.55,35.12c0-5.76-4.65-10.4-10.4-10.4s-10.04,4.65-10.04,10.55,4.5,10.33,10.18,10.33,10.26-4.58,10.26-10.48Z"/>
            <path fill="#161615" d="M306.07,55.64v-4.35h-.15c-1.77,3.76-5.02,5.68-10.55,5.68-8.63,0-15.79-5.17-15.79-16.82V14.68h12.25v22.95c0,5.39,1.92,7.9,6.57,7.9s7.01-3.1,7.01-8.12V14.68h12.25v40.95h-11.58Z"/>
            <path fill="#161615" d="M326.95,55.64v-31.66h-4.58v-9.3h4.58v-1.7c0-6.79,2.66-12.99,15.72-12.99h1.7v9.22h-.44c-3.17,0-4.72.81-4.72,4.21v1.25h5.17v9.3h-5.17v31.66h-12.25Z"/>
          </g>
          <circle fill="#010201" cx="61.68" cy="34.46" r="21.81"/>
          <path fill="#fff" d="M63.06,21.56h0c-.2,0-.36.16-.36.36v12.88c.93.21,1.6,1.08,1.51,2.09-.09.91-.82,1.65-1.72,1.75-1.18.13-2.18-.79-2.18-1.94,0-.9.62-1.66,1.45-1.89v-12.92c0-.18-.15-.33-.33-.33h0c-.17,0-.31.13-.33.31-.49,6.17-6.75,14.2-6.75,14.2,2.23,2.7,3.66,7.54,3.66,7.54h8.48s1.43-4.84,3.66-7.54c0,0-6.24-8.01-6.75-14.18-.02-.19-.17-.33-.36-.33Z"/>
        </svg>
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
