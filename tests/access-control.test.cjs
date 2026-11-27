const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function setup({user=null,active=false,currentLevel='aal1',nextLevel='aal1'}={}) {
 const api={};const client={auth:{getUser:async()=>({data:{user}}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel,nextLevel}})}},rpc:async()=>({data:active})};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('utils/supabase/middleware.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:api,process:{env:{}},URL,Headers,require:n=>n==='@supabase/ssr'?{createServerClient:()=>client}:{NextResponse:{next:()=>({kind:'next',cookies:{set(){}}}),redirect:url=>({kind:'redirect',url:new URL(url)})}}});
 return async path=>{const url=new URL('https://example.test'+path);url.clone=()=>new URL(url);return api.updateSession({url:url.href,nextUrl:url,headers:new Headers(),cookies:{getAll:()=>[]}})};
}
test('anonymous operations access requires sign-in',async()=>assert.equal((await setup()('/ops/invoices')).url.pathname,'/login'));
test('signed-in non-staff account is denied',async()=>assert.equal((await setup({user:{id:'user'}})('/ops')).url.pathname,'/access-denied'));
test('staff with enrolled factor must complete MFA',async()=>assert.equal((await setup({user:{id:'user'},active:true,nextLevel:'aal2'})('/ops')).url.pathname,'/login/mfa'));
test('MFA-verified active staff can access operations',async()=>assert.equal((await setup({user:{id:'user'},active:true,currentLevel:'aal2',nextLevel:'aal2'})('/ops')).kind,'next'));
test('staff can reach enrollment before a first factor is enabled',async()=>assert.equal((await setup({user:{id:'user'},active:true})('/ops/security')).kind,'next'));
