import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import net from 'node:net';
import { addRecipe, updateRecipe, deleteRecipe, updateRecipeLastCooked, getRecipeCache, saveWeekState, getWeekState, updateWeekCheck, saveSettings, appendHistory } from '../docs/firestore.js';
let env, a, b, denied;
const seedRecipe = {uid:'a',name:'Original',lastCooked:null};
before(async()=>{
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Run inside the Firestore emulator; production is forbidden.');
  env=await initializeTestEnvironment({projectId:'demo-mealplans',firestore:{rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});
  a=env.authenticatedContext('a').firestore(); b=env.authenticatedContext('b').firestore(); denied=env.unauthenticatedContext().firestore();
});
after(async()=>{await env?.cleanup()});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async(ctx)=>{
  const seedDb=ctx.firestore();
  await setDoc(doc(seedDb,'recipeCache','main'),{recipes:[seedRecipe]});
  await setDoc(doc(seedDb,'settings','main'),{familySize:4});
});});
test('simultaneous recipe additions preserve both entries',async()=>{
  await Promise.all([addRecipe(a,{uid:'b',name:'B'}),addRecipe(b,{uid:'c',name:'C'})]);
  assert.deepEqual((await getRecipeCache(a)).recipes.map(r=>r.uid).sort(),['a','b','c']);
});
test('simultaneous edit and rollover preserve edits and lastCooked',async()=>{
  await Promise.all([updateRecipe(a,'a',{name:'Edited'}),updateRecipeLastCooked(b,{a:'2026-10-04'})]);
  assert.deepEqual((await getRecipeCache(a)).recipes[0],{...seedRecipe,name:'Edited',lastCooked:'2026-10-04'});
  await updateRecipeLastCooked(a,{a:'2026-09-27'});
  assert.equal((await getRecipeCache(a)).recipes[0].lastCooked,'2026-10-04');
});
test('simultaneous delete and add preserve intended operations',async()=>{
  await Promise.all([deleteRecipe(a,'a'),addRecipe(b,{uid:'b',name:'B'})]);
  assert.deepEqual((await getRecipeCache(a)).recipes.map(r=>r.uid),['b']);
});
test('only one competing menu save succeeds with same loaded version',async()=>{
  const timestamp=await saveWeekState(a,'2026-10-11',{candidates:['a','b'],picks:[]});
  const results=await Promise.allSettled([saveWeekState(a,'2026-10-11',{picks:['a']},timestamp),saveWeekState(b,'2026-10-11',{picks:['b']},timestamp)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.match(results.find(r=>r.status==='rejected').reason.message,/changed elsewhere/);
});
test('concurrent grocery and cooking checks preserve every field and week ownership',async()=>{
  await Promise.all([updateWeekCheck(a,'2026-10-11','grocery','carrots',true),updateWeekCheck(b,'2026-10-11','grocery','rice',true),updateWeekCheck(a,'2026-10-11','step','0',true,'a'),updateWeekCheck(b,'2026-10-11','step','1',true,'a')]);
  const week=await getWeekState(a,'2026-10-11');
  assert.deepEqual(week.groceryChecks,{carrots:true,rice:true}); assert.deepEqual(week.stepChecks,{a:{0:true,1:true}});
  assert.equal(await getWeekState(a,'2026-10-04'),null);
});
test('repeated concurrent rollover history is idempotent under append-only rules',async()=>{
  const entry={weekKey:'2026-09-27',recipeUids:['a'],recipes:[seedRecipe]};
  await Promise.all([appendHistory(a,entry),appendHistory(b,entry)]);
  await appendHistory(a,entry);
  assert.deepEqual((await getDoc(doc(a,'history',entry.weekKey))).data(),entry);
});
test('permission failures reject all write paths without changing saved data',async()=>{
  for(const action of [()=>saveSettings(denied,{familySize:6}),()=>addRecipe(denied,{uid:'b'}),()=>updateRecipe(denied,'a',{name:'No'}),()=>deleteRecipe(denied,'a'),()=>saveWeekState(denied,'2026-10-11',{picks:['a']}),()=>updateWeekCheck(denied,'2026-10-11','grocery','x',true)]){
    await assert.rejects(action,error=>error.code==='permission-denied');
  }
  assert.equal((await getRecipeCache(a)).recipes[0].name,'Original');
  assert.equal((await getDoc(doc(a,'settings','main'))).data().familySize,4);
});
test('disconnected transactional saves reject and succeed after reconnect', {timeout:60000}, async()=>{
  let disconnected=false;
  const sockets=new Set();
  const proxy=net.createServer(client=>{
    if(disconnected){client.destroy();return;}
    const upstream=net.connect(8080,'127.0.0.1'); sockets.add(client); sockets.add(upstream);
    client.pipe(upstream); upstream.pipe(client);
    client.on('error',()=>upstream.destroy()); upstream.on('error',()=>client.destroy());
    client.on('close',()=>{sockets.delete(client);upstream.destroy()}); upstream.on('close',()=>{sockets.delete(upstream);client.destroy()});
  });
  await new Promise(resolve=>proxy.listen(8081,'127.0.0.1',resolve));
  const app=initializeApp({projectId:'demo-mealplans'},'connection-failure');
  const offlineDb=getFirestore(app);
  connectFirestoreEmulator(offlineDb,'127.0.0.1',8081,{mockUserToken:{sub:'offline',user_id:'offline'}});
  try {
    await getRecipeCache(offlineDb);
    disconnected=true; for(const socket of sockets) socket.destroy();
    await assert.rejects(()=>addRecipe(offlineDb,{uid:'b',name:'Recovered'}),error=>error.code==='unavailable');
    await assert.rejects(()=>saveSettings(offlineDb,{familySize:6}),error=>error.code==='unavailable');
    disconnected=false;
    await addRecipe(offlineDb,{uid:'b',name:'Recovered'});
    assert.equal((await getRecipeCache(offlineDb)).recipes.length,2);
    await saveSettings(offlineDb,{familySize:6});
    assert.equal((await getDoc(doc(offlineDb,'settings','main'))).data().familySize,6);
  } finally {
    await deleteApp(app); for(const socket of sockets) socket.destroy();
    await new Promise(resolve=>proxy.close(resolve));
  }
});

test('concurrent imports with tracking variants cannot create duplicates',async()=>{
  const results=await Promise.allSettled([
    addRecipe(a,{uid:'b',name:'B',sourceUrl:'https://cooking.nytimes.com/recipes/1022532-bean-and-cheese-burritos?art=123'}),
    addRecipe(b,{uid:'c',name:'C',sourceUrl:'https://cooking.nytimes.com/recipes/1022532-bean-and-cheese-burritos'})
  ]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await getRecipeCache(a)).recipes.length,2);
});
test('editing a recipe deleted elsewhere fails explicitly',async()=>{
  await deleteRecipe(b,'a');
  await assert.rejects(()=>updateRecipe(a,'a',{name:'Edited'}),/removed elsewhere/);
});
test('week versions remain distinct even under an identical clock',async()=>{
  const originalNow=Date.now;
  Date.now=()=>Date.parse('2026-10-08T12:00:00.000Z');
  try{
    const first=await saveWeekState(a,'2026-10-11',{picks:[]});
    const second=await saveWeekState(a,'2026-10-11',{picks:['a']},first);
    assert.notEqual(first,second);
    await assert.rejects(()=>saveWeekState(b,'2026-10-11',{picks:['b']},first),/changed elsewhere/);
  }finally{Date.now=originalNow;}
});
test('storage validation rejects invalid settings without writing',async()=>{
  for(const familySize of [0,-1,1.5,NaN])await assert.rejects(()=>saveSettings(a,{familySize}),/whole number/);
  assert.equal((await getDoc(doc(a,'settings','main'))).data().familySize,4);
});
