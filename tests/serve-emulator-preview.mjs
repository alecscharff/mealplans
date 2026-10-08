// Local-only browser harness. Every Firebase service is pinned to demo emulators.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { readFile, writeFile, cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import http from 'node:http';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080') throw new Error('Requires the local demo emulator.');
const env=await initializeTestEnvironment({projectId:'demo-mealplans',firestore:{rules:await readFile('firestore.rules','utf8')}});
await env.clearFirestore();
await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  const recipes=Array.from({length:20},(_,i)=>({uid:`test-${i}`,name:`Emulator recipe ${i+1}`,sourceUrl:null,image:null,servings:4,totalTimeMinutes:20,lastCooked:null,ingredientsRaw:'2 eggs\n1 cup rice',ingredientsParsed:[{raw:'2 eggs',name:'eggs',quantity:2,unit:null},{raw:'1 cup rice',name:'rice',quantity:1,unit:'cup'}],directions:['Cook rice.','Fry eggs.']}));
  await setDoc(doc(db,'recipeCache','main'),{recipes});
  await setDoc(doc(db,'settings','main'),{familySize:4,shuffleSeed:'emulator'});
});
await env.cleanup();
const root=await mkdtemp(join(tmpdir(),'mealplans-emulator-ui-'));
await cp('docs',root,{recursive:true});
await writeFile(join(root,'firebase-config.js'),'export const firebaseConfig={apiKey:"fake-api-key",projectId:"demo-mealplans",authDomain:"demo-mealplans.firebaseapp.com"};');
let source=await readFile(join(root,'firestore.js'),'utf8');
source=source.replace('  signInAnonymously,','  signInAnonymously,\n  connectAuthEmulator,\n  signOut,');
source=source.replace('  runTransaction,','  runTransaction,\n  connectFirestoreEmulator,');
source=source.replace('  await signInAnonymously(auth);\n  dbInstance = getFirestore(app);',`  connectAuthEmulator(auth, "http://127.0.0.1:9099", {disableWarnings:true});
  dbInstance=getFirestore(app); connectFirestoreEmulator(dbInstance,"127.0.0.1",8080);
  await signInAnonymously(auth);
  const controls=document.createElement("aside"); controls.style.cssText="padding:8px;border:2px solid blue;background:white";
  controls.setAttribute("aria-label","Emulator test controls");
  const status=document.createElement("p"); status.setAttribute("role","status");
  for(const [label,action] of [["Test: deny access",()=>signOut(auth)],["Test: restore access",()=>signInAnonymously(auth)]]){
    const button=document.createElement("button");button.textContent=label;button.onclick=async()=>{await action();status.textContent=label+" complete";};controls.appendChild(button);
  }
  controls.appendChild(status); document.body.prepend(controls);`);
await writeFile(join(root,'firestore.js'),source);
await writeFile(join(root,'functionsClient.js'),'export async function scrapeRecipeUrl(url){return {name:"Emulator imported recipe",sourceUrl:url,servings:4,totalTimeMinutes:20,image:null,ingredientsRaw:"2 eggs",ingredientsParsed:[{raw:"2 eggs",name:"eggs",quantity:2,unit:null}],directions:["Cook eggs."]};}');
const mime={'.js':'text/javascript','.json':'application/json','.css':'text/css','.html':'text/html','.jpg':'image/jpeg','.png':'image/png'};
http.createServer(async(req,res)=>{
  const path=resolve(root,`.`+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!path.startsWith(root+'/')){res.writeHead(403);res.end();return;}
  try{res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}
}).listen(8766,'127.0.0.1',()=>console.log('Isolated emulator preview: http://127.0.0.1:8766'));
