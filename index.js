const express = require('express');
const fetch = require('node-fetch');
const PDFDocument = require('pdfkit');

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

// ============================================
// LICENSE TEMPLATES
// ============================================

const LICENSE_WITHOUT_BEAT = `Lizenzvereinbarung für den Erwerb eines Songtexts (Nutzungsrechte)

Mit dem Kauf eines Songtexts erhält der Käufer die nachfolgend beschriebenen Nutzungsrechte. Die Urheberrechte verbleiben stets beim ursprünglichen Autor.

1. Umfang der Nutzungsrechte
Der Käufer erhält eine exklusive Lizenz zur Nutzung des erworbenen Songtexts.
Die Lizenz umfasst insbesondere folgende Rechte:
• Verwendung des Songtexts für eigene musikalische Werke (Aufnahmen, Releases, Performances).
• Kommerzielle Nutzung des daraus entstehenden Songs, einschließlich Streaming, Download, Verkauf und öffentlicher Aufführung.
• Anpassung und Bearbeitung des Textes, soweit dies für das musikalische Werk erforderlich ist.

2. Nicht gestattet
Ohne ausdrückliche, schriftliche Zustimmung des Autors ist es nicht erlaubt:
• Den Songtext weiterzuverkaufen, weiterzugeben oder als eigenes Werk zu veröffentlichen, ohne ein musikalisches Endprodukt daraus zu erstellen.
• Den Songtext mehrfach zu vervielfältigen oder zu lizenzieren, um andere Künstler damit auszustatten.
• Die Autorenschaft des ursprünglichen Urhebers zu verschweigen, wenn eine Anmeldung bei Verwertungsgesellschaften (z. B. GEMA) erfolgt.

3. Urheberrecht / GEMA
Der ursprüngliche Autor des Songtexts bleibt verpflichtend als Songwriter bei der GEMA (oder anderen Verwertungsgesellschaften) eingetragen, sofern das Werk dort angemeldet wird.
Eine vollständige Übertragung der Urheberrechte findet nicht statt.
Die vollständigen Angaben zu den bei der GEMA einzutragenden Urhebern befinden sich in der beigefügten Downloaddatei.

4. Digitaler Download & Widerruf
Da es sich um ein digitales Produkt handelt, erlischt das Widerrufsrecht, sobald der Käufer den Download begonnen hat.
Der Käufer muss diesem vor dem Kauf ausdrücklich zustimmen.`;

const LICENSE_WITH_BEAT = `Lizenzvereinbarung für den Erwerb eines exklusiven Songtexts inkl. nicht-exklusivem Beat

Mit dem Kauf dieses Produkts erhält der Käufer die nachfolgend beschriebenen Nutzungsrechte am Songtext (exklusiv) sowie am enthaltenen Beat (nicht-exklusiv).

Die Urheberrechte verbleiben vollständig bei den jeweiligen Erstellern.

1. Umfang der Nutzungsrechte

Songtext (exklusive Lizenz)
Der Käufer erhält eine exklusive, zeitlich unbeschränkte Lizenz zur Nutzung des erworbenen Songtexts.
Die Lizenz umfasst:
• Nutzung des Songtexts zur Erstellung eines eigenen musikalischen Werkes.
• Bearbeitung und inhaltliche Anpassung, soweit für das musikalische Projekt erforderlich.
• Volle kommerzielle Nutzung des entstehenden Songs (Streaming, Verkauf, Download, Aufführungen, Monetarisierung).
• Der Songtext wird nach dem Kauf nicht mehr an andere Personen verkauft oder weitergegeben.
• Exklusivität bezieht sich auf die Nutzung, nicht auf die Urheberrechte.

Beat (nicht-exklusiv)
Der Käufer erhält eine nicht-exklusive Lizenz zur Nutzung des beigefügten Beats ausschließlich im Zusammenhang mit dem erworbenen Songtext.
Die Lizenz umfasst:
• Nutzung des Beats für Aufnahmen, Veröffentlichungen und kommerzielle Nutzung.
• Der Beat wird weiterhin an andere Künstler verkauft und bleibt nicht-exklusiv.
• Der Beat-Name muss nicht erwähnt werden.

2. Nicht gestattet
Ohne vorherige schriftliche Zustimmung der Urheber ist es nicht erlaubt:
• Den Songtext oder den Beat einzeln weiterzuverkaufen oder ohne eigenes musikalisches Endprodukt zu veröffentlichen.
• Unterlizenzen zu vergeben oder das Material an Dritte weiterzugeben.
• Den Beat isoliert (ohne den eigenen Song) zu veröffentlichen.
• Die Urheber bei der Anmeldung des Werkes zu einer Verwertungsgesellschaft (z. B. GEMA) zu verschweigen.

3. Urheberrecht / GEMA
Der ursprüngliche Songwriter bleibt verpflichtend als Urheber bei einer möglichen GEMA-Anmeldung eingetragen.
Der Beat-Produzent bleibt ebenfalls als Urheber seines Beats einzutragen.
Es findet keine Übertragung des Urheberrechts statt – lediglich Nutzungsrechte werden eingeräumt.
Die vollständigen Angaben zu den bei der GEMA einzutragenden Urhebern befinden sich in der beigefügten Downloaddatei.

4. Exklusivität
Der Songtext wird ab dem Kauf sofort aus dem Verkauf genommen und nicht erneut an andere Kunden verkauft.
Der Beat bleibt nicht-exklusiv und kann weiterhin von anderen Künstlern erworben oder genutzt werden.

5. Digitaler Download & Widerruf
Da es sich um digitale Inhalte handelt, erlischt das Widerrufsrecht unmittelbar mit Beginn des Downloads.
Der Käufer muss dem vor dem Kauf ausdrücklich zustimmen.`;

// ============================================
// PDF GENERATION
// ============================================

const LOGO_URL = 'https://www.dropbox.com/scl/fi/782zd3vwnkksb0x03mmw1/songkauf-png.png?rlkey=g7k6828l41cuvxxpmwgyz0z9g&raw=1';

// Fetch logo image as buffer
async function fetchLogoBuffer() {
  try {
    const response = await fetch(LOGO_URL);
    if (!response.ok) throw new Error('Failed to fetch logo');
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error fetching logo:', error.message);
    return null;
  }
}

async function generateLicensePDF(licenseData, logoBuffer) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Lizenz - ${licenseData.productName}`,
        Author: SHOP_NAME,
      }
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header with logo on the right
    const headerY = doc.y;

    // Logo on the right (if available)
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, 420, headerY, { width: 120 });
      } catch (e) {
        console.error('Error adding logo to PDF:', e.message);
      }
    }

    // Title on the left
    doc.fontSize(20).font('Helvetica-Bold').text(SHOP_NAME.toUpperCase(), 50, headerY, { width: 350 });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica').text('Lizenzurkunde', 50, doc.y, { width: 350 });
    doc.moveDown(2);

    // Horizontal line
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    // License info box
    doc.fontSize(11).font('Helvetica-Bold').text('Lizenzinformationen');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Lizenztyp: ${licenseData.licenseType}`);
    doc.text(`Produkt: ${licenseData.productName}`);
    doc.text(`Käufer: ${licenseData.customerName}`);
    doc.text(`E-Mail: ${licenseData.customerEmail}`);
    doc.text(`Kaufdatum: ${licenseData.purchaseDate}`);
    doc.text(`Bestellnummer: ${licenseData.orderNumber}`);
    doc.moveDown(1.5);

    // Horizontal line
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    // License text
    doc.fontSize(10).font('Helvetica');
    const licenseText = licenseData.licenseType === 'Mit Beat' ? LICENSE_WITH_BEAT : LICENSE_WITHOUT_BEAT;

    // Split text into paragraphs and render
    const paragraphs = licenseText.split('\n\n');
    for (const paragraph of paragraphs) {
      if (paragraph.trim()) {
        // Check if it's a header (numbered section)
        if (/^\d+\./.test(paragraph.trim())) {
          doc.moveDown(0.5);
          doc.font('Helvetica-Bold').text(paragraph.split('\n')[0]);
          doc.font('Helvetica');
          const rest = paragraph.split('\n').slice(1).join('\n');
          if (rest.trim()) {
            doc.text(rest);
          }
        } else {
          doc.text(paragraph);
        }
        doc.moveDown(0.5);
      }
    }

    // Footer
    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#666666');
    doc.text(`Diese Lizenz wurde automatisch erstellt am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE')}`, { align: 'center' });
    doc.text(`${SHOP_NAME} - Alle Rechte vorbehalten`, { align: 'center' });

    doc.end();
  });
}

// ============================================
// SHOPIFY GRAPHQL
// ============================================

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

// ============================================
// EMAIL SENDING WITH BREVO
// ============================================

async function sendDownloadEmail(customerEmail, customerName, customerFullName, downloads, orderNumber, orderDate) {
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
        <img src="https://www.dropbox.com/scl/fi/782zd3vwnkksb0x03mmw1/songkauf-png.png?rlkey=g7k6828l41cuvxxpmwgyz0z9g&raw=1" alt="SONGKAUF" style="max-width: 200px; height: auto; font-size: 28px; font-weight: bold; letter-spacing: 2px;">
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

        <p style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; border-left: 4px solid #0066cc;">
          <strong>📄 Lizenz:</strong> Im Anhang findest du deine persönliche Lizenzurkunde für jeden gekauften Songtext.
        </p>

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

Im Anhang findest du deine persönliche Lizenzurkunde für jeden gekauften Songtext.

Hinweis: Der Download-Link ist 30 Tage verfügbar, vergiss nicht deine Dateien herunterzuladen. Bei Problemen kontaktiere uns unter info@songkauf.de

Viel Spaß mit deinem Kauf!
${SHOP_NAME}
  `;

  // Generate license PDFs for each download
  const attachments = [];

  // Fetch logo once for all PDFs
  console.log('Fetching logo for license PDFs...');
  const logoBuffer = await fetchLogoBuffer();

  for (const item of downloads) {
    // Determine license type based on variant title
    const variantLower = item.variantTitle.toLowerCase();
    let licenseType = 'Ohne Beat';

    if (variantLower.includes('mit beat') || variantLower.includes('with beat')) {
      licenseType = 'Mit Beat';
    }

    console.log(`Generating ${licenseType} license for "${item.productTitle}"...`);

    const licenseData = {
      licenseType: licenseType,
      productName: item.productTitle,
      customerName: customerFullName,
      customerEmail: customerEmail,
      purchaseDate: orderDate,
      orderNumber: orderNumber
    };

    const pdfBuffer = await generateLicensePDF(licenseData, logoBuffer);

    // Create safe filename
    const safeProductName = item.productTitle.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '').replace(/\s+/g, '_');

    attachments.push({
      name: `Lizenz_${safeProductName}.pdf`,
      content: pdfBuffer.toString('base64')
    });
  }

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
        name: customerFullName || 'Kunde'
      }],
      subject: `Dein Download von ${SHOP_NAME}`,
      htmlContent: htmlContent,
      textContent: textContent,
      attachment: attachments
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || JSON.stringify(result));
  }

  return result;
}

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    message: 'Download Email App is active (Brevo + PDF License)',
    store: SHOPIFY_STORE ? 'configured' : 'not configured',
    email: BREVO_API_KEY ? 'configured' : 'not configured'
  });
});

// Webhook: Order paid
app.post('/webhooks/orders-paid', async (req, res) => {
  console.log('\n>>> Received orders/paid webhook');
  res.status(200).send('OK');

  const order = req.body;

  if (order.financial_status && order.financial_status !== 'paid') {
    console.log(`Order not paid yet (status: ${order.financial_status}), skipping...`);
    return;
  }

  const customerEmail = order.email;
  const customerFirstName = order.customer?.first_name || order.billing_address?.first_name || '';
  const customerLastName = order.customer?.last_name || order.billing_address?.last_name || '';
  const customerFullName = `${customerFirstName} ${customerLastName}`.trim() || 'Kunde';
  const orderNumber = order.order_number || order.name || 'N/A';
  const orderDate = new Date(order.created_at).toLocaleDateString('de-DE');

  if (!customerEmail) {
    console.log('No customer email found');
    return;
  }

  console.log(`Processing order #${orderNumber} for: ${customerEmail} (${customerFullName})`);

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
    } else {
      console.log(`No download link for variant ${variantId}`);
    }
  }

  if (downloads.length > 0) {
    try {
      console.log(`Sending email with ${downloads.length} download(s) and license PDF(s) to ${customerEmail}...`);
      await sendDownloadEmail(customerEmail, customerFirstName, customerFullName, downloads, orderNumber, orderDate);
      console.log('Email sent successfully with license attachments!');
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

  if (order.financial_status !== 'paid') {
    console.log(`Order not paid yet (status: ${order.financial_status}), waiting for payment...`);
    return;
  }

  const customerEmail = order.email;
  const customerFirstName = order.customer?.first_name || order.billing_address?.first_name || '';
  const customerLastName = order.customer?.last_name || order.billing_address?.last_name || '';
  const customerFullName = `${customerFirstName} ${customerLastName}`.trim() || 'Kunde';
  const orderNumber = order.order_number || order.name || 'N/A';
  const orderDate = new Date(order.created_at).toLocaleDateString('de-DE');

  if (!customerEmail) {
    console.log('No customer email found');
    return;
  }

  console.log(`Processing order #${orderNumber} for: ${customerEmail} (${customerFullName})`);

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
      console.log(`Sending email with ${downloads.length} download(s) and license PDF(s) to ${customerEmail}...`);
      await sendDownloadEmail(customerEmail, customerFirstName, customerFullName, downloads, orderNumber, orderDate);
      console.log('Email sent successfully with license attachments!');
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
║     Download Email App (Brevo + PDF License)               ║
╠════════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                               ║
║  Store: ${SHOPIFY_STORE || 'NOT CONFIGURED'}
║  Email: ${EMAIL_FROM}
║                                                            ║
║  Features:                                                 ║
║  - Automatic license PDF generation                        ║
║  - "Ohne Beat" / "Mit Beat" license types                  ║
║  - Buyer data included in license                          ║
║  - Logo in PDF header                                      ║
║                                                            ║
║  Webhooks:                                                 ║
║  - POST /webhooks/orders-paid                              ║
║  - POST /webhooks/orders-create                            ║
║  Health:  GET /                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
