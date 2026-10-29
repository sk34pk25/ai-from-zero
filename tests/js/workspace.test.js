import test from 'node:test';import assert from 'node:assert/strict';
import {reconcile,validateBackup} from '../../assets/js/workspace.js';
import {seededRandom} from '../../assets/js/page-playground.js';
test('un brouillon sur une ancienne révision devient un conflit, pas une perte',()=>{
 const local={payload:{note:'local'},revision:1,dirty:true};const remote={payload:{note:'remote'},revision:2};
 const result=reconcile(local,remote);assert.equal(result.payload.note,'local');assert.equal(result.conflict.payload.note,'remote');
 assert.equal(reconcile({...local,dirty:false},remote).payload.note,'remote');
});
test('les sauvegardes refusent une session ou une traversée de chemin',()=>{
 assert.throws(()=>validateBackup({format:'ai-from-zero',version:1,records:{'sb-token':'secret'}}));
 assert.throws(()=>validateBackup({format:'ai-from-zero',version:1,records:{'ide/../escape.py':{content:'x'}}}));
 assert.doesNotThrow(()=>validateBackup({format:'ai-from-zero',version:1,records:{'lesson/0.9':{note:'return'},progress:{done:[]}}}));
});
test('une graine conserve exactement la suite de tirages',()=>{
 const a=seededRandom(42),b=seededRandom(42);for(let i=0;i<20;i++)assert.equal(a(),b());
});
