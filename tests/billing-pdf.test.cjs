const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const { PDFDocument } = require('pdf-lib');
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, filename);
const { renderBillingPdf } = require('../lib/billing-pdf.ts');
const fixture = {
  title: 'Invoice', reference: 'SZI-TEST-0002', unit: 'SZ Pristine Cleaning', sandbox: true,
  metadata: [['Issue date', '23 Nov 2026'], ['Currency', 'ZAR']],
  customer: ['Customer name: Test Customer'], service: ['Move-out clean'],
  items: [{ description: 'Cleaning service', quantity: '1.00', unitPrice: 'R 5,00', total: 'R 5,00' }],
  totals: [['Invoice total', 'R 5,00'], ['Amount paid', 'R 5,00'], ['Balance due', 'R 0,00']],
  note: 'Paid in full', payments: [
    { method: 'EFT', amount: 'R 2,00', receivedAt: '23 Nov 2026, 22:19:00 SAST', reference: 'TEST-EFT-001' },
    { method: 'Apple Pay', amount: 'R 3,00', receivedAt: '23 Nov 2026, 23:13:31 SAST' },
  ],
};

test('mixed-payment invoice is one A4 page with readable payment details', async () => {
  const bytes = await renderBillingPdf(fixture);
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(pdf.getPages()[0].getWidth(), 595);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sz-invoice-pdf-'));
  try {
    const filename = path.join(dir, 'invoice.pdf'); fs.writeFileSync(filename, bytes);
    const result = spawnSync('pdftotext', [filename, '-'], { encoding: 'utf8' });
    if (result.error?.code === 'ENOENT') return;
    assert.equal(result.status, 0);
    for (const text of ['PAYMENT BREAKDOWN', 'EFT', 'Apple Pay', 'TEST-EFT-001', 'SAST', 'Paid in full', 'Balance due']) assert.ok(result.stdout.includes(text), text);
    assert.match(result.stdout, /R\s+2,00/); assert.match(result.stdout, /R\s+3,00/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('long payment history paginates and retains every payment', async () => {
  const payments = Array.from({ length: 40 }, (_, index) => ({ method: 'EFT', amount: 'R 1,00', receivedAt: '23 Nov 2026 SAST', reference: `BANK-REFERENCE-${index}` }));
  const bytes = await renderBillingPdf({ ...fixture, payments });
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() > 1);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sz-invoice-pages-'));
  try {
    const filename = path.join(dir, 'invoice.pdf'); fs.writeFileSync(filename, bytes);
    const result = spawnSync('pdftotext', [filename, '-'], { encoding: 'utf8' });
    if (result.error?.code === 'ENOENT') return;
    assert.equal(result.status, 0);
    for (const payment of payments) assert.ok(result.stdout.includes(payment.reference), payment.reference);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
// The fixture is also available for the local rendering review.
module.exports = { fixture };
