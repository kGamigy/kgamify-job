// Simple HTML invoice generator for subscriptions
// Includes legal disclaimers: non-refundable, non-transferable

function formatAmount(amount, currency = 'INR') {
  if (typeof amount !== 'number') return '';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);
}

function generateInvoiceHtml({
  invoiceId,
  brand = 'kGamify',
  logoUrl,
  companyName,
  companyEmail,
  plan,
  amount,
  currency = 'INR',
  startAt,
  endAt,
  issuedAt = new Date(),
  notes
}) {
  const amountStr = formatAmount(amount, currency);
  const start = new Date(startAt).toLocaleDateString('en-GB');
  const end = endAt ? new Date(endAt).toLocaleDateString('en-GB') : 'N/A';
  const issued = new Date(issuedAt).toLocaleDateString('en-GB');

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8"/>
      <title>Invoice ${invoiceId}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#111827;background:#f8fafc}
        .card{max-width:760px;margin:24px auto;padding:0;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;overflow:hidden}
        .header{background:linear-gradient(135deg,#1f2937,#111827);color:#fff;padding:22px 24px}
        .header h2{margin:0;color:#fff}
        .header .sub{color:#fbbf24;font-size:12px;margin-top:6px}
        .content{padding:24px}
        .muted{color:#6b7280}
        .row{display:flex;justify-content:space-between;gap:12px}
        .badge{display:inline-block;background:#ffedd5;color:#9a3412;border:1px solid #fdba74;border-radius:999px;padding:2px 10px;font-weight:600}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #e5e7eb;padding:10px;text-align:left}
        .disclaimer{margin-top:18px;font-size:12px;color:#6b7280;line-height:1.5}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="row" style="align-items:center">
            <div style="display:flex;align-items:center;gap:10px">
              ${logoUrl ? `<img src="${logoUrl}" alt="${brand}" width="48" height="48" style="object-fit:contain"/>` : ''}
              <h2>${brand} Subscription Invoice</h2>
            </div>
            <div class="muted" style="color:#e5e7eb">Invoice ID: <strong>${invoiceId}</strong><br/>Issued: ${issued}</div>
          </div>
          <div class="sub">Thank you for your payment</div>
        </div>
        <div class="content">

        <div class="row" style="margin-top:16px">
          <div>
            <div class="muted">Billed To</div>
            <div style="font-weight:600">${companyName || companyEmail}</div>
            <div class="muted">${companyEmail || ''}</div>
          </div>
          <div>
            <div class="muted">Subscription</div>
            <div><span class="badge">${plan.toUpperCase()}</span></div>
            <div class="muted">Period: ${start} → ${end}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr><th>Description</th><th>Amount</th></tr>
          </thead>
          <tbody>
            <tr><td>${brand} ${plan} plan (30 days)</td><td>${amountStr}</td></tr>
          </tbody>
          <tfoot>
            <tr><th>Total</th><th>${amountStr}</th></tr>
          </tfoot>
        </table>

        ${notes ? `<div style="margin-top:12px">${notes}</div>` : ''}

        <div class="disclaimer">
          <strong>Legal & Refunds</strong><br/>
          1) This subscription is <strong>non-refundable</strong> once activated.<br/>
          2) Money refund is generally <strong>not possible</strong>; exceptions may apply only if required by law.<br/>
          3) Subscriptions are <strong>non-transferable</strong> between companies.
        </div>
        </div>
      </div>
    </body>
  </html>`;
}
const PDFDocument = require('pdfkit');

function generateInvoicePdfBuffer({
  invoiceId,
  brand = 'kGamify',
  companyName,
  companyEmail,
  plan,
  amount,
  currency = 'INR',
  startAt,
  endAt,
  issuedAt = new Date()
}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];
      doc.on('data', (d) => chunks.push(d));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Header band
      doc.rect(0, 0, doc.page.width, 110).fill('#1f2937');
      doc.fillColor('#ffffff').fontSize(22).text(`${brand} Subscription Invoice`, 40, 36);
      doc.fillColor('#fbbf24').fontSize(10).text('Thank you for your payment', 40, 66);
      doc.rect(0, 110, doc.page.width, 6).fill('#ff8200');

      doc.fillColor('#111827');
      doc.fontSize(10).fillColor('#6b7280').text(`Invoice ID: ${invoiceId}`, 40, 130);
      doc.text(`Issued: ${new Date(issuedAt).toLocaleDateString('en-GB')}`);

      doc.moveDown(1.5);
      doc.fontSize(12).fillColor('#111827').text('Billed To');
      doc.fontSize(11).fillColor('#374151').text(companyName || companyEmail || '');
      if (companyEmail) doc.text(companyEmail);

      doc.moveDown(1.2);
      doc.fontSize(12).fillColor('#111827').text('Subscription');
      doc.fontSize(11).fillColor('#374151').text(`Plan: ${String(plan || '').toUpperCase()}`);
      doc.text(`Period: ${new Date(startAt).toLocaleDateString('en-GB')} - ${endAt ? new Date(endAt).toLocaleDateString('en-GB') : 'N/A'}`);

      doc.moveDown(1.2);
      doc.fontSize(12).fillColor('#111827').text('Amount');
      if (typeof amount === 'number') {
        doc.fontSize(12).fillColor('#ff8200').text(new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount));
      } else {
        doc.fontSize(12).fillColor('#ff8200').text('N/A');
      }

      // Table styling
      doc.moveDown(1.4);
      const tableTop = doc.y;
      doc.rect(40, tableTop, 520, 22).fill('#fff7ed');
      doc.fillColor('#9a3412').fontSize(11).text('Description', 50, tableTop + 6);
      doc.text('Amount', 420, tableTop + 6);
      const rowTop = tableTop + 22;
      doc.rect(40, rowTop, 520, 32).stroke('#e5e7eb');
      doc.fillColor('#111827').fontSize(11).text(`${brand} ${plan} plan (30 days)`, 50, rowTop + 9);
      const amountLabel = typeof amount === 'number'
        ? new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount)
        : 'N/A';
      doc.text(amountLabel, 420, rowTop + 9);

      doc.moveDown(3);
      doc.fontSize(10).fillColor('#6b7280').text('Disclaimer: Subscriptions are non-refundable and non-transferable.', { width: 520 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoiceHtml, generateInvoicePdfBuffer };
