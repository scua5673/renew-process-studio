'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../studio/app.html'),'utf8');
const start=html.indexOf('function errorSource('),end=html.indexOf('function track(',start);assert.ok(start>0&&end>start);
const c=vm.createContext({String,URL,location:{origin:'https://app.example.test'}});vm.runInContext(html.slice(start,end),c);
test('same-origin promise errors report file and position without URL queries or stack contents',()=>{assert.equal(c.errorSource({stack:'Error: private content\n at f (https://app.example.test/studio/sync.js?token=PRIVATE:31:7)'}),'sync.js:31:7');});
test('extension or other-site failures are identifiable without exposing extension IDs',()=>{for(const url of ['chrome-extension://private-id/script.js','https://other.example.test/private.js'])assert.equal(c.errorSource({stack:'Error: failure\n at f ('+url+':4:9)'}),'external-script');});
test('missing stack is explicitly unknown and unsafe filenames are not recorded',()=>{assert.equal(c.errorSource({message:'failure'}),'unknown-script');assert.equal(c.errorSource({stack:'Error\n at https://app.example.test/private%20name:3:8'}),'app-script');});
