// Local-only browser harness. Every Firebase service is pinned to demo emulators.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { readFile, writeFile, cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import http from 'node:http';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080') throw new Error('Requires the local demo emulator.');
const rules=await readFile('firestore.rules','utf8');
const env=await initializeTestEnvironment({projectId:'demo-mealplans',firestore:{rules}});
await env.clearFirestore();
await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  const recipes=Array.from({length:20},(_,i)=>({uid:`test-${i}`,name:`Emulator recipe ${i+1}`,sourceUrl:null,image:null,servings:4,totalTimeMinutes:20,lastCooked:null,ingredientsRaw:'2 eggs\n1 cup rice',ingredientsParsed:[{raw:'2 eggs',name:'eggs',quantity:2,unit:null},{raw:'1 cup rice',name:'rice',quantity:1,unit:'cup'}],directions:['Cook rice.','Fry eggs.']}));
  await setDoc(doc(db,'recipeCache','main'),{recipes});
  await setDoc(doc(db,'settings','main'),{familySize:4,shuffleSeed:'emulator'});
  await setDoc(doc(db,'privateConfig','household'),{emails:['first.test@example.com']});
});
await env.cleanup();
const root=await mkdtemp(join(tmpdir(),'mealplans-emulator-ui-'));
await cp('docs',root,{recursive:true});
await writeFile(join(root,'firebase-config.js'),'export const firebaseConfig={apiKey:"fake-api-key",projectId:"demo-mealplans",authDomain:"demo-mealplans.firebaseapp.com"};');
let source=await readFile(join(root,'firestore.js'),'utf8');
source=source.replace('  runTransaction,','  runTransaction,\n  connectFirestoreEmulator,');
const sessionStart=source.indexOf('  const auth = getAuth(app);');
const sessionEnd=source.indexOf('\n}',sessionStart);
source=source.slice(0,sessionStart)+`  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8080, {
    mockUserToken: {
      sub: "local-household", user_id: "local-household",
      email: "first.test@example.com", email_verified: true,
      firebase: { sign_in_provider: "google.com" },
    },
  });
  const controls = document.createElement("aside");
  controls.setAttribute("aria-label", "Emulator test controls");
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  for (const [label, action] of [["Test: deny access", "deny"], ["Test: restore access", "restore"]]) {
    const button = document.createElement("button");
    button.textContent = label;
    button.onclick = async () => {
      const response = await fetch("/__preview_rules/" + action, { method: "POST" });
      status.textContent = response.ok ? label + " complete" : label + " failed";
    };
    controls.append(button);
  }
  controls.append(status);
  document.body.prepend(controls);
  return { db, isHouseholdSignedIn: async () => true, signOut: async () => {} };`+source.slice(sessionEnd);
await writeFile(join(root,'firestore.js'),source);
await writeFile(join(root,'functionsClient.js'),'export async function scrapeRecipeUrl(url){return {name:"Emulator imported recipe",sourceUrl:url,servings:4,totalTimeMinutes:20,image:null,ingredientsRaw:"2 eggs",ingredientsParsed:[{raw:"2 eggs",name:"eggs",quantity:2,unit:null}],directions:["Cook eggs."]};}');
const mime={'.js':'text/javascript','.json':'application/json','.css':'text/css','.html':'text/html','.jpg':'image/jpeg','.png':'image/png'};
http.createServer(async(req,res)=>{
  if (req.method === 'POST' && ['/__preview_rules/deny','/__preview_rules/restore'].includes(req.url)) {
    try {
      const nextRules = req.url.endsWith('/deny') ? rules.replace('return request.auth != null', 'return false && request.auth != null') : rules;
      const ruleEnv = await initializeTestEnvironment({ projectId:'demo-mealplans', firestore:{ rules:nextRules } });
      await ruleEnv.cleanup();
      res.writeHead(204).end();
    } catch {
      res.writeHead(500).end();
    }
    return;
  }
  const path=resolve(root,`.`+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!path.startsWith(root+'/')){res.writeHead(403);res.end();return;}
  try{res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}
}).listen(8766,'127.0.0.1',()=>console.log('Isolated emulator preview: http://127.0.0.1:8766'));
