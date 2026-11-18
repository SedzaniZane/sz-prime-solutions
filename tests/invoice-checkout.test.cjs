const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function setup({ existingUrl = null, reserveError = null, attachError = null } = {}) {
  const calls = [];
  const client = {
    async rpc(name, args) {
      calls.push({ name, args });
      return name === 'reserve_invoice_checkout'
        ? { data: 'payment-1', error: reserveError }
        : { error: attachError };
    },
    from(table) {
      const query = { select() { return query; }, eq() { return query; }, async single() {
        return { data: table === 'payments'
          ? { id: 'payment-1', amount: '3.00', quotation_id: 'quote-1', service_request_id: 'request-1', checkout_url: existingUrl }
          : { quotation_number: 'SZQ-1' } };
      } };
      return query;
    },
  };
  const source = ts.transpileModule(fs.readFileSync('lib/invoice-checkout.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, process: { env: { YOCO_SECRET_KEY: 'sk_test_example' } }, require(name) {
    if (name === '@/utils/supabase/server') return { createClient: async () => client };
    if (name === './yoco') return { createYocoCheckout: async (args) => {
      calls.push({ name: 'yoco', args });
      return { id: 'checkout-1', amount: 300, redirectUrl: 'https://c.yoco.com/example', processingMode: 'test' };
    } };
    throw new Error(name);
  } });
  return { run: exports.invoiceCheckout, calls };
}

test('charges the reserved outstanding balance and attaches it before redirect', async () => {
  const { run, calls } = setup();
  assert.equal(await run('invoice-1', 'https://example.com'), 'https://c.yoco.com/example');
  const yoco = calls.find(c => c.name === 'yoco').args;
  assert.equal(yoco.amountCents, 300);
  assert.equal(yoco.idempotencyKey, 'sz-invoice-payment-1');
  assert.equal(yoco.successUrl, 'https://example.com/ops/invoices/invoice-1?payment_return=success');
  assert.equal(calls.at(-1).name, 'attach_invoice_checkout');
  assert.equal(calls.at(-1).args.p_amount_cents, 300);
});
test('reuses a pending checkout without another provider request', async () => {
  const { run, calls } = setup({ existingUrl: 'https://c.yoco.com/existing' });
  assert.equal(await run('invoice-1', 'https://example.com'), 'https://c.yoco.com/existing');
  assert.equal(calls.length, 1);
});
test('refuses checkout when database balance or environment validation fails', async () => {
  const { run, calls } = setup({ reserveError: { message: 'Invoice and Yoco environments do not match' } });
  await assert.rejects(run('invoice-1', 'https://example.com'), /environments/);
  assert.equal(calls.length, 1);
});
test('does not return a checkout URL if reservation attachment fails', async () => {
  const { run } = setup({ attachError: { message: 'Checkout does not match the reserved invoice balance' } });
  await assert.rejects(run('invoice-1', 'https://example.com'), /reserved invoice balance/);
});
