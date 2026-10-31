/** Petits mécanismes exacts ; aucun outil du poste n’est exécuté dans ces schémas. */
import { h } from "./dom.js";
export function replyMask(prompt, total) { return Array.from({length:total-1}, (_, i) => i+1 >= prompt); }
export function childBudget(parent, requested) { return {turns: Math.min(parent.turns, requested.turns), tools: Math.min(parent.tools, requested.tools), allowed: [...new Set(parent.allowed.filter(tool => requested.allowed.includes(tool)))].sort()}; }
export function memoryMerge(rows) { const result = new Map(); for (const row of rows) if (!result.has(row.key) || row.at >= result.get(row.key).at) result.set(row.key, {...row}); return [...result.values()].sort((a,b) => a.at-b.at || a.key.localeCompare(b.key)); }
export function keptGroups(groups, budget) { let size=0; const result=[]; for (const group of [...groups].reverse()) { if (size+group.length > budget) break; result.unshift(group); size += group.length; } return result; }
export function flowTrace(scenario = "calcul", budget = 2, approved = false) {
  const steps = [{title:"Proposition",detail:scenario === "json" ? "Texte libre au lieu d’un objet JSON." : scenario === "path" ? "lire_fichier(path=../secret.txt)" : scenario === "write" ? "ecrire_fichier(path=note.txt, content=bonjour)" : "calculer(expression=2+3*4)"}];
  if (scenario === "json") return {steps:[...steps,{title:"Contrat refusé",detail:"Aucun outil n’est appelé. La nouvelle tentative reste soumise au budget de tours."},{title:"Budget épuisé",detail:"Si le modèle répète cette sortie invalide, le moteur s’arrête à la limite des tours."}],status:"turn_limit",calls:0};
  steps.push({title:"Contrat",detail:"Un objet JSON avec champs et types attendus."});
  if (scenario === "path") return {steps:[...steps,{title:"Permission refusée",detail:"Le chemin sort du workspace. Aucun fichier n’est ouvert."}],status:"denied",calls:0};
  steps.push({title:"Permissions",detail:"Outil connu et arguments vérifiés."});
  if (scenario === "write" && !approved) return {steps:[...steps,{title:"Accord attendu",detail:"La proposition est conservée. Aucun fichier n’est créé."}],status:"approval_required",calls:0};
  if (scenario === "loop") {
    for(let i=0;i<budget;i++) steps.push({title:`Outil ${i+1}`,detail:"Une nouvelle action identifiée consomme un appel."});
    return {steps:[...steps,{title:"Budget atteint",detail:"L’appel supplémentaire est refusé avant son effet."}],status:"tool_limit",calls:budget};
  }
  steps.push({title:"Outil",detail:scenario === "write" ? "Création exclusive après accord et revérification." : "Priorité : 3*4=12, puis 2+12=14."}, {title:"Observation",detail:scenario === "write" ? "Le résultat de création porte le call_id de la proposition." : "Le résultat 14 porte le call_id de la proposition."}, {title:"Fin",detail:"L’assistant peut conclure. La qualité de la réponse reste à évaluer."});
  return {steps,status:"finished",calls:1};
}
export function harnessLab(kind) {
  const host=h("section",{class:"sheet harness-lab","aria-label":"Laboratoire inspectable"});
  host.append(h("h2",{text:"Voir le mécanisme"}),h("p",{class:"muted",text:"Miniature calculée dans le navigateur. Aucun modèle ni outil du poste n’est appelé. Les contrats sont comparés à Python dans les tests."}));
  const body=h("div");host.append(body);
  const slider = (label, min, max, value, render) => {
    const input=h("input",{type:"range",min,max,value,"aria-label":label});
    const number=h("output",{text:String(value)});input.oninput=()=>{number.textContent=input.value;render(Number(input.value));};
    host.insertBefore(h("label",{class:"harness-range"},[label,input,number]),body);render(value);
  };
  if (kind === "training") {
    slider("Premier token de réponse (indice)",1,6,3,prompt=>{
      const mask=replyMask(prompt,8);host.dataset.mask=mask.map(Number).join("");
      body.replaceChildren(h("p",{text:`8 tokens dans la séquence, 7 cibles décalées. Début de réponse : ${prompt}.`}), h("div",{class:"harness-cells"},mask.map((keep,i)=>h("div",{class:keep?"is-kept":"is-muted"},[h("strong",{text:`Cible ${i+1}`}),h("span",{text:keep?"Loss comptée":"Loss masquée"})]))));
    });return host;
  }
  if (kind === "context") {
    slider("Budget des groupes après parties obligatoires",40,300,120,budget=>{
      const groups=["A".repeat(100),"B".repeat(80),"C".repeat(40)], kept=keptGroups(groups,budget);host.dataset.kept=String(kept.length);
      body.replaceChildren(h("p",{text:`Le système et la demande initiale sont conservés à part. Les groupes de 100, 80 et 40 caractères restent indivisibles. ${kept.length} groupe(s) récent(s) gardé(s).`}),h("div",{class:"harness-cells"},groups.map(group=>h("div",{class:kept.includes(group)?"is-kept":"is-muted",text:`Groupe ${group[0]} · ${group.length} caractères · ${kept.includes(group)?"gardé":"archivé"}`}))));
    });return host;
  }
  if (kind === "memory") {
    slider("Date de la nouvelle version",0,5,2,at=>{
      const rows=memoryMerge([{key:"projet",value:"ancien",source:"utilisateur",at:1},{key:"projet",value:"corrigé",source:"utilisateur",at}]);host.dataset.memory=rows[0].value;
      body.replaceChildren(h("p",{text:`Version ancienne : date 1. Version proposée : date ${at}.`}),h("pre",{tabindex:"0"},h("code",{text:JSON.stringify(rows,null,2)})),h("p",{text:"La date départage les versions. Elle ne certifie pas la vérité du souvenir."}));
    });return host;
  }
  if (kind === "delegation") {
    slider("Appels demandés par l’enfant",1,6,4,tools=>{
      const result=childBudget({turns:5,tools:2,allowed:["calculer","chercher"]},{turns:8,tools,allowed:["calculer","ecrire_fichier"]});host.dataset.tools=String(result.tools);
      body.replaceChildren(h("p",{text:"Parent : 5 tours, 2 outils, calculer et chercher. Enfant : 8 tours demandés, calculer et ecrire_fichier."}),h("pre",{tabindex:"0"},h("code",{text:JSON.stringify(result,null,2)})),h("p",{text:"Écrire ne figure pas dans les droits du parent : la demande de l’enfant ne crée pas cette capacité."}));
    });return host;
  }
  if (kind === "evaluation") {
    slider("Échecs parmi dix tentatives",0,10,3,fail=>{host.dataset.success=String((10-fail)/10);body.replaceChildren(h("p",{text:`${10-fail} succès / 10 tentatives = ${(10-fail)*10} %. Les échecs restent au dénominateur.`}),h("progress",{max:10,value:10-fail,"aria-label":"Réussites parmi les dix tentatives"}),h("p",{text:"Une fixture scriptée évalue le moteur. Une observation humaine et une mesure du modèle restent distinctes."}));});return host;
  }
  if (kind === "queue") {
    slider("Heure simulée",0,6,2,now=>{
      const rows=[{id:"a",due:1,state:"done"},{id:"b",due:2,state:"pending"},{id:"c",due:4,state:"pending"},{id:"d",due:1,state:"running"}];const due=rows.filter(row=>row.state==="pending"&&row.due<=now);host.dataset.due=due.map(row=>row.id).join(",");
      body.replaceChildren(h("pre",{tabindex:"0"},h("code",{text:JSON.stringify(rows,null,2)})),h("p",{text:`À lancer explicitement : ${due.map(row=>row.id).join(", ")||"aucune tâche"}. La tâche running demande une réconciliation.`}));
    });return host;
  }
  if (kind === "skills") {
    const input=h("input",{type:"search","aria-label":"Mots de la tâche",value:"relire note"});
    const render=()=>{const words=new Set(input.value.toLocaleLowerCase("fr").split(/\s+/)), rows=[{id:"relire",keywords:["note","relire"]},{id:"calcul",keywords:["calcul","nombres"]}];body.replaceChildren(h("ol",{},rows.map(row=>h("li",{text:`${row.id} · ${row.keywords.filter(word=>words.has(word)).length} mot(s) commun(s) · ${row.keywords.join(", ")}`}))),h("p",{text:"Cette sélection est lexicale : les synonymes ne sont pas reconnus automatiquement."}));};input.oninput=render;host.insertBefore(h("label",{},["Mots de la tâche",input]),body);render();return host;
  }
  const defaults={protocol:"json",path:"path",approval:"write",budget:"loop",error:"json",injection:"path",gateway:"write"};
  const select=h("select",{"aria-label":"Scénario de la boucle"},[["calcul","Calcul valide"],["json","JSON invalide"],["path","Chemin interdit"],["write","Création à examiner"],["loop","Boucle répétitive"]].map(([value,text])=>h("option",{value,text})));select.value=defaults[kind]||"calcul";
  const approved=h("input",{type:"checkbox","aria-label":"Accord simulé sur cette création"});
  let position=0,budget=2;
  const details=h("div",{tabindex:"-1",class:"harness-step-detail"}), next=h("button",{type:"button",class:"button button-secondary"},"Inspecter l’étape suivante");
  const render=(focus)=>{const trace=flowTrace(select.value,budget,approved.checked);position=Math.min(position,trace.steps.length-1);host.dataset.status=trace.status;host.dataset.calls=String(trace.calls);
    body.replaceChildren(h("ol",{class:"harness-flow"},trace.steps.map((step,i)=>h("li",{class:i===position?"is-active":""},[h("button",{type:"button",class:"harness-node","aria-current":i===position?"step":null,onClick:()=>{position=i;render('node');}},[h("span",{class:"eyebrow",text:String(i+1)}),h("strong",{text:step.title})])]))),details,next,h("p",{text:`Statut prévu : ${trace.status} · ${trace.calls} appel(s) d’outil simulé(s). Aucun effet sur ton poste.`}));details.replaceChildren(h("h3",{text:trace.steps[position].title}),h("p",{text:trace.steps[position].detail}));next.disabled=position===trace.steps.length-1;
    if(focus==='node')body.querySelector('[aria-current="step"]')?.focus({preventScroll:true});
    if(focus==='next')(next.disabled?details:next).focus({preventScroll:true});};
  next.onclick=()=>{position++;render('next');};select.onchange=()=>{position=0;render();};approved.onchange=()=>{position=0;render();};
  host.insertBefore(h("div",{class:"harness-lab-controls"},[h("label",{},["Scénario",select]),h("label",{class:"checkpoint-criterion"},[approved,"Accord simulé sur cette création"])]),body);
  if(kind==="budget")slider("Budget d’outils simulé",1,4,2,value=>{budget=value;position=0;render();});
  render();return host;
}
