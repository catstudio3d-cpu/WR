import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('dist/registrations.js','utf8'),ctx);
const csv=ctx.window.WildRideRegistrations.csvCell;
assert.equal(csv('正常'), '"正常"');assert.equal(csv('A"B'), '"A""B"');
for(const s of ['=1+1','+123','-123','@cmd','  =1'])assert(csv(s).startsWith('"\''));
console.log('PASS: CSV text escaping and spreadsheet formula protection.');
