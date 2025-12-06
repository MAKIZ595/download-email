const express = require('express');
const nodemailer = require('nodemailer');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Shopify Config
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// Email Config (Strato)
const EMAIL_HOST = 'smtp.strato.de';
const EMAIL_PORT = 465;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const SHOP_NAME = 'songkauf.de';

app.use(express.json());

// Email transporter
const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: true,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

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

// Send download email
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
        <h1 style="margin: 0; font-size: 24px;">${SHOP_NAME}</h1>
      </div>

      <div style="padding: 30px 0;">
        <h2 style="color: #000;">Dein Download ist bereit! 🎵</h2>

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
          <strong>Hinweis:</strong> Die Download-Links sind dauerhaft gültig. Bei Problemen kontaktiere uns unter ${EMAIL_USER}
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

Bei Problemen kontaktiere uns unter ${EMAIL_USER}

Viel Spaß mit deinem Kauf!
${SHOP_NAME}
  `;

  const mailOptions = {
    from: `"${SHOP_NAME}" <${EMAIL_USER}>`,
    to: customerEmail,
    subject: `Dein Download von ${SHOP_NAME} 🎵`,
    text: textContent,
    html: htmlContent
  };

  return await transporter.sendMail(mailOptions);
}

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    message: 'Download Email App is active',
    store: SHOPIFY_STORE ? 'configured' : 'not configured',
    email: EMAIL_USER ? 'configured' : 'not configured'
  });
});

// Webhook: Order paid
app.post('/webhooks/orders-paid', async (req, res) => {
  console.log('\n>>> Received orders/paid webhook');
  res.status(200).send('OK');

  const order = req.body;

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

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║        Download Email App Started                          ║
╠════════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                               ║
║  Store: ${SHOPIFY_STORE || 'NOT CONFIGURED'}
║  Email: ${EMAIL_USER || 'NOT CONFIGURED'}
║                                                            ║
║  Webhook: POST /webhooks/orders-paid                       ║
║  Health:  GET /                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
