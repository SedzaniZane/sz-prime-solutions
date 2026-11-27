const {test} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/payment-security.ts','utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop:true},
}).outputText, {exports:api,require,Buffer,Headers,URL});
const now=1795786320000, secret='whsec_'+Buffer.from('test-signing-key').toString('base64');
function signed(body,seconds=String(now/1000)) {
  const signature=crypto.createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`event-1.${seconds}.${body}`).digest('base64');
  return new Headers({'webhook-id':'event-1','webhook-timestamp':seconds,'webhook-signature':'v1,'+signature});
}
const event=()=>({id:'event-1',type:'payment.succeeded',payload:{id:'payment-1',amount:300,currency:'ZAR',status:'succeeded',mode:'test',metadata:{checkoutId:'checkout-1'}}});
test('accepts authentic Yoco signatures and rejects altered content, expired and future events',()=>{
  const body=JSON.stringify(event());
  assert.equal(api.verifyYocoSignature(body,signed(body),secret,now),true);
  assert.equal(api.verifyYocoSignature(body+' ',signed(body),secret,now),false);
  for(const delta of [-181,181]) assert.equal(api.verifyYocoSignature(body,signed(body,String(now/1000+delta)),secret,now),false);
});
test('malformed or missing signatures fail closed without crashing',()=>{
  for(const signature of ['', 'v2,abc','v1,é'.padEnd(47,'é')]) {
    const h=signed('{}');h.set('webhook-signature',signature);
    assert.equal(api.verifyYocoSignature('{}',h,secret,now),false);
  }
  assert.equal(api.verifyYocoSignature('{}',new Headers(),secret,now),false);
});
test('valid settlement includes exact integer cents, currency, mode and provider references',()=>{
  assert.equal(api.successfulPayment(event()).amountCents,300);
  for (const change of [{amount:3.1},{amount:0},{amount:'300'},{currency:'USD'},{mode:null},{status:'failed'},{id:''},{metadata:{}}]) {
    const e=event();Object.assign(e.payload,change);assert.throws(()=>api.successfulPayment(e));
  }
});
test('checkout redirects reject lookalike hosts, javascript URLs, credentials and alternate ports',()=>{
  assert.equal(api.checkoutUrl('https://c.yoco.com/checkout/abc'),'https://c.yoco.com/checkout/abc');
  for(const url of ['javascript:alert(1)','https://c.yoco.com.evil.test/a','https://evil.test/','https://user@c.yoco.com/a','https://c.yoco.com:444/a','http://c.yoco.com/a']) assert.throws(()=>api.checkoutUrl(url));
});
