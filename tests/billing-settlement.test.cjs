const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/billing-settlement.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: api });
const payment = (amount, mode = 'test', status = 'paid', currency = 'ZAR') => ({ amount, currency, status, metadata: { processing_mode: mode } });
const quote = { total: 5, currency: 'ZAR', status: 'draft', approval_status: 'accepted' };

test('mixed EFT and Yoco payments settle one invoice', () => {
  const result = api.billingSettlement('5.00', 'ZAR', 'test', [payment('2.00'), payment('3.00')]);
  assert.equal(result.paidCents, 500);
  assert.equal(result.balanceCents, 0);
  assert.equal(result.status, 'Paid');
  assert.equal(api.quotationStatus(quote, 'test', [payment(2), payment(3)]), 'Paid');
});
test('partial EFT has the same status on quotations and invoices', () => {
  assert.equal(api.billingSettlement(5, 'ZAR', 'test', [payment(2)]).balanceCents, 300);
  assert.equal(api.quotationStatus(quote, 'test', [payment(2)]), 'Partially paid');
});
test('sandbox, foreign currency and unsettled records cannot settle a live invoice', () => {
  const records = [payment(5), payment(5, 'live', 'pending'), payment(5, 'live', 'voided'), payment(5, 'live', 'paid', 'USD')];
  assert.equal(api.billingSettlement(5, 'ZAR', 'live', records).paidCents, 0);
  assert.equal(api.billingSettlement(5, 'ZAR', null, records).paidCents, 0);
});
test('zero total is not described as a received payment', () => {
  assert.equal(api.billingSettlement(0, 'ZAR', 'test', []).status, 'No payment due');
  assert.equal(api.quotationStatus({ ...quote, total: 0 }, 'test', []), 'No payment due');
});
test('cent rounding and payment labels remain readable', () => {
  assert.equal(api.billingSettlement(.3, 'ZAR', 'test', [payment(.1), payment(.2)]).balanceCents, 0);
  assert.equal(api.paymentMethodLabel('eft'), 'EFT');
  assert.equal(api.paymentMethodLabel('apple_pay'), 'Apple Pay');
  assert.equal(api.paymentMethodLabel(null, 'yoco'), 'Yoco');
});
test('approval and draft states apply only before settlement', () => {
  assert.equal(api.quotationStatus(quote, 'test', []), 'Awaiting payment');
  assert.equal(api.quotationStatus({ ...quote, approval_status: 'declined' }, 'test', []), 'Declined');
  assert.equal(api.quotationStatus({ ...quote, approval_status: 'not_requested' }, 'test', []), 'Draft');
});
