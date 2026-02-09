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
  const start = new Date(startAt).toLocaleString('en-IN');
  const end = endAt ? new Date(endAt).toLocaleString('en-IN') : 'N/A';
  const issued = new Date(issuedAt).toLocaleString('en-IN');

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8"/>
      <title>Invoice ${invoiceId}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#111827}
        .card{max-width:760px;margin:24px auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px}
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
        <div class="row" style="align-items:center">
          <div style="display:flex;align-items:center;gap:10px">
            ${logoUrl ? `<img src="${logoUrl}" alt="${brand}" width="48" height="48" style="object-fit:contain"/>` : ''}
            <h2 style="margin:0">${brand} Subscription Invoice</h2>
          </div>
          <div class="muted">Invoice ID: <strong>${invoiceId}</strong><br/>Issued: ${issued}</div>
        </div>

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

      doc.fontSize(20).fillColor('#ff8200').text(`${brand} Subscription Invoice`, { align: 'left' });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#6b7280').text(`Invoice ID: ${invoiceId}`);
      doc.text(`Issued: ${new Date(issuedAt).toLocaleString('en-IN')}`);

      doc.moveDown();
      doc.fontSize(12).fillColor('#111827').text('Billed To');
      doc.fontSize(11).fillColor('#374151').text(companyName || companyEmail || '');
      if (companyEmail) doc.text(companyEmail);

      doc.moveDown();
      doc.fontSize(12).fillColor('#111827').text('Subscription');
      doc.fontSize(11).fillColor('#374151').text(`Plan: ${String(plan || '').toUpperCase()}`);
      doc.text(`Period: ${new Date(startAt).toLocaleDateString('en-IN')} - ${endAt ? new Date(endAt).toLocaleDateString('en-IN') : 'N/A'}`);

      doc.moveDown();
      doc.fontSize(12).fillColor('#111827').text('Amount');
      if (typeof amount === 'number') {
        doc.fontSize(12).fillColor('#ff8200').text(new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount));
      } else {
        doc.fontSize(12).fillColor('#ff8200').text('N/A');
      }

      doc.moveDown();
      doc.fontSize(10).fillColor('#6b7280').text('Disclaimer: This is a production-level application invoice. Subscriptions are non-refundable and non-transferable.', { width: 520 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoiceHtml, generateInvoicePdfBuffer };
