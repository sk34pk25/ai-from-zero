import { h, crumb } from "./dom.js";
import { onLeave } from "./lifecycle.js";
import { publicAssetUrl } from "./public-url.js";
import { studyScope } from "./study-scope.js";
import { codeFingerprint, exerciseState, EXERCISE_LABELS } from "./exercise-result.js";
import { request, stopWorker } from "./pybridge.js";
import { harnessLab } from "./harness-lab.js";
import { readHarnessState, saveHarnessState, validateHarnessChecks, validateHarnessStudy } from "./harness-state.js";

let catalogPromise, filePromise;
const features=new Map(),featureAttempts=new Map();
async function feature(path) {
  if(!features.has(path)){
    const attempt=featureAttempts.get(path)||0,url=publicAssetUrl(new URL(path,import.meta.url));
    if(attempt)url.searchParams.set('retry',String(attempt));
    featureAttempts.set(path,attempt+1);
    features.set(path,import(url.href).catch(error=>{features.delete(path);throw error;}));
  }
  return features.get(path);
}
const lessonPromises=new Map();
async function catalog() {
  if (!catalogPromise) catalogPromise = fetch(publicAssetUrl("data/harness-index.json")).then(async r=>{if(!r.ok)throw Error("Catalogue indisponible");const data=await r.json();if(data.format!=="afz-harness-course-v1"||data.modules?.length!==8)throw Error("Catalogue invalide");return data;}).catch(error=>{catalogPromise=null;throw error;});
  return catalogPromise;
}
async function loadLesson(id) {
  if(!/^h[1-8]\.[1-4]$/.test(id))throw Error('Leçon inconnue');
  if(!lessonPromises.has(id))lessonPromises.set(id,fetch(publicAssetUrl(`data/harness/${id}.json`)).then(async response=>{if(!response.ok)throw Error('Leçon indisponible');const row=await response.json();if(row.id!==id||!row.exercise||!row.quiz)throw Error('Leçon incomplète');return row;}).catch(error=>{lessonPromises.delete(id);throw error;}));
  return lessonPromises.get(id);
}
async function pythonFiles(spec) {
  if (!filePromise) filePromise = Promise.all(spec.browserFiles.map(async path=>{
    if(!/^harness\/[a-z_]+\.py$/.test(path))throw Error("Source invalide");
    const r=await fetch(publicAssetUrl(path));if(!r.ok)throw Error("Source Python indisponible : "+path);
    return {path,content:await r.text()};
  })).catch(error=>{filePromise=null;throw error;});
  return filePromise;
}
function downloadJSON(name,value) { const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:"application/json"}));h("a",{href:url,download:name}).click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
const paragraph = text => String(text).split(/\n\n/).map(text=>h("p",{text}));
const lessonHref = id => id.startsWith("h") ? `#/harness/lecon/${id}` : `#/lecon/${id}`;

export async function paintHarness(main, options={}) {
  let active=true,running=false,generation=0;
  onLeave(()=>{active=false;generation++;if(running)stopWorker();});
  const scope=studyScope();
  main.replaceChildren(h("p",{role:"status",text:"Chargement du parcours…"}));
  let spec;
  try {spec=await catalog();if(options.id){const lesson=await loadLesson(options.id);spec={...spec,modules:spec.modules.map(module=>({...module,lessons:module.lessons.map(row=>row.id===lesson.id?lesson:row)}))};}}catch {
    if(active)main.replaceChildren(h("h1",{text:"Parcours harness indisponible"}),h("p",{role:"status",text:"Le catalogue n’a pas pu être chargé. Ton travail reste conservé."}),h("button",{type:"button",class:"button button-secondary",onClick:()=>{if(active)void paintHarness(main,options);}},"Réessayer le parcours harness"));
    return;
  }
  if(!active)return;
  options.onCatalog?.(spec);
  const rows=spec.modules.flatMap(module=>module.lessons.map(lesson=>({lesson,module})));
  const read=()=>readHarnessState(scope);
  const save=state=>saveHarnessState(scope,state);
  const update=(id,patch)=>{const state=read();return save({...state,lessons:{...state.lessons,[id]:{...state.lessons[id],...patch}}});};
  const execute=async(code,button,status)=>{
    if(running){status.textContent="Python est occupé par une autre activité de cette page.";return {busy:true};}
    const ticket=++generation;running=true;button.disabled=true;
    const stop=h("button",{type:"button",class:"button button-secondary",onClick:()=>{generation++;stopWorker();running=false;button.disabled=false;stop.remove();status.textContent="Exécution arrêtée ; ton travail est conservé.";}},"Arrêter Python");button.after(stop);
    status.textContent="Chargement de Python et des sources du harness…";
    try{
      const files=await pythonFiles(spec);if(!active||ticket!==generation)return {cancelled:true};
      let stdout="";
      const result=await request({type:"exercise",code,files},event=>{if(event.type==="stdout")stdout=(stdout+event.text+"\n").slice(-6000);});
      if(!active||ticket!==generation)return {cancelled:true};
      if(result.busy)status.textContent="Python est occupé. Réessaie après le calcul en cours.";
      if(result.cancelled)status.textContent=(result.text||"Exécution arrêtée.")+" Ton travail est conservé.";
      return {...result,stdout};
    }catch(error){return {type:"error",phase:"dependencies",text:error.message};}
    finally{stop.remove();if(active&&ticket===generation){running=false;button.disabled=false;}}
  };
  if(!options.id){
    const studied=()=>rows.filter(({lesson})=>read().lessons[lesson.id]?.studied).length;
    const progress=h("p",{class:"lead",text:`${studied()} / 32 leçons étudiées. La lecture, les contrôles Python et la capacité d’un modèle sont suivis séparément.`});
    const filters=h("input",{type:"search","aria-label":"Rechercher dans le parcours harness",placeholder:"JSON, mémoire, checkpoint, permissions…"});
    const modules=h("div",{class:"harness-modules"});
    const renderModules=()=>{
      const term=filters.value.trim().toLocaleLowerCase("fr");
      modules.replaceChildren(...spec.modules.map(module=>{
        const lessons=module.lessons.filter(row=>`${row.id} ${row.title} ${row.why} ${row.objectives.join(' ')} ${row.searchText}`.toLocaleLowerCase("fr").includes(term));
        if(!lessons.length)return null;
        const count=module.lessons.filter(row=>read().lessons[row.id]?.studied).length;
        return h("section",{class:"sheet harness-module",id:`harness-module-${module.id}`,tabindex:"-1"},[
          h("p",{class:"eyebrow",text:`Module ${module.id} · ${count} / 4 leçons étudiées`}),h("h2",{text:module.title}),h("p",{text:module.result}),
          h("ol",{class:"chapter-list"},lessons.map(row=>h("li",{},h("a",{class:"chapter",href:lessonHref(row.id)},[h("span",{class:"chapter-id",text:row.id.toUpperCase()}),h("span",{class:"chapter-copy"},[h("strong",{text:row.title}),h("span",{class:"chapter-tag",text:`Pratique indicative : ${row.minutes} min · ${read().lessons[row.id]?.studied?"étudiée":"à étudier"}`})])])))),
          h("details",{},[h("summary",{text:`TP ${module.id} · ${module.tp}`}),h("p",{text:`À construire dans eleve.py : ${module.functions.join(", ")}.`}),h("ul",{},module.criteria.map(text=>h("li",{text}))),h("pre",{tabindex:"0"},h("code",{text:`python -m harness.verifier --tp ${module.id}`}))])]);
      }).filter(Boolean));
      if(!modules.children.length)modules.append(h("p",{text:"Aucune leçon ne correspond. Essaie un autre terme."}));
    };filters.oninput=renderModules;
    main.replaceChildren(crumb([{href:"#/",label:"Accueil"},{label:"Mon harness"}]),h("section",{class:"hero harness-hero"},[
      h("p",{class:"eyebrow",text:"Après ton modèle · 32 leçons · 8 TP cumulatifs"}),h("h1",{text:"Construis ton propre harness d’agent."}),h("p",{class:"lead",text:"Transforme un modèle en un programme capable de proposer des actions, utiliser des outils et vérifier son travail. Code chaque mécanisme, puis mesure ce que ton modèle sait réellement faire."}),
      h("div",{class:"hero-actions"},[h("a",{class:"button button-primary",href:lessonHref(rows.find(({lesson})=>!read().lessons[lesson.id]?.studied)?.lesson.id||"h8.4"),text:studied()?"Reprendre mon parcours harness":"Commencer le parcours harness"}),h("a",{href:"#/lecon/12.12",text:"Revoir le dossier de mon modèle"})])]),progress,
      h("section",{class:"sheet harness-bridge"},[h("h2",{text:"Du checkpoint à l’agent"}),h("p",{text:"Prépare les fonctions, classes, dictionnaires, tests et ton premier modèle. Les modules 1 à 5 se construisent avec une fixture explicite ; le module 6 branche ton checkpoint et son tokenizer. La taille de sa fenêtre et son apprentissage du protocole déterminent les capacités possibles."}),h("p",{},spec.prerequisites.flatMap((id,i)=>[i?" · ":"Prérequis : ",h("a",{href:lessonHref(id),text:id})]))]),
      h("label",{class:"harness-search"},["Trouver une brique",filters]),modules,
      projectPanel(spec,scope,read,save,execute),studyBackup(rows,read,save),
      h("section",{class:"sheet"},[h("h2",{text:"Portée et références"}),h("p",{text:"Projet pédagogique original, inspiré des mécanismes documentés de Hermes Agent. Le livrable inclut une CLI, des outils contrôlés, une mémoire SQLite, une reprise, une API locale, un ajustement du modèle, des procédures et une délégation synchrone bornée. Les connecteurs de messagerie, backends distants et une robustesse de production restent des extensions à développer et mesurer."}),...spec.references.map(row=>h("p",{},h("a",{href:row.url,target:"_blank",rel:"noopener",text:row.title})))]));
    const refresh=()=>{progress.textContent=`${studied()} / 32 leçons étudiées. La lecture, les contrôles Python et la capacité d’un modèle sont suivis séparément.`;renderModules();};
    onLeave(scope.subscribe(refresh));
    refresh();
    if(options.module)requestAnimationFrame(()=>{if(active){const node=main.querySelector(`#harness-module-${options.module}`);node?.focus({preventScroll:true});node?.scrollIntoView({block:"start"});}});
    if(options.project)requestAnimationFrame(()=>{if(active){const node=main.querySelector('#harness-project');node?.focus({preventScroll:true});node?.scrollIntoView({block:'start'});}});
    return;
  }
  const position=rows.findIndex(row=>row.lesson.id===options.id), item=rows[position];
  if(!item){main.replaceChildren(h("h1",{text:"Leçon harness introuvable"}),h("a",{href:"#/harness",text:"Revenir au programme"}));return;}
  const {lesson,module}=item;
  document.title=`${lesson.id.toUpperCase()} ${lesson.title} · AI From Zero`;
  const state=()=>read().lessons[lesson.id]||{};
  const notice=h("p",{class:"muted",role:"status",text:scope.message});
  const persist=patch=>{if(!update(lesson.id,patch)){notice.textContent="Non enregistré : le suivi a été effacé ou le stockage est refusé. Exporte ou copie ton travail avant de fermer.";return false;}return true;};
  const codeView=h("pre",{tabindex:"0"},h("code",{text:lesson.code}));
  const exampleStatus=h("div",{role:"status"});
  const example=h("button",{type:"button",class:"button button-secondary",onClick:async()=>{
    const result=await execute(lesson.code,example,exampleStatus);
    if(result.cancelled||result.busy)return;
    exampleStatus.textContent=result.type==="error"?`Exemple interrompu : ${result.text}`:"Exemple exécuté dans Python. Les assertions de cet exemple sont passées.";
    if(result.stdout)exampleStatus.append(h("pre",{tabindex:"0"},h("code",{text:result.stdout})));
  }},"Exécuter cet exemple Python");
  const exercise=exercisePanel(lesson,state,persist,execute,()=>active);
  const quiz=h("section",{class:"sheet harness-quiz","aria-label":"Quiz de la leçon harness"});
  const paintQuiz=()=>{
    const saved=state().quiz, valid=saved?.version===lesson.quiz.version;
    const feedback=h("p",{role:"status",class:"quiz-feedback",text:valid?saved.correct?"Quiz réussi. Explique ensuite le cas nouveau.":"Réponse à reprendre. "+lesson.quiz.explanation:"Choisis une réponse, puis explique ton raisonnement."});
    quiz.replaceChildren(h("h2",{text:"Vérifier l’idée"}),h("p",{text:lesson.quiz.question}),h("div",{class:"quiz-choices"},lesson.quiz.choices.map((choice,i)=>h("button",{type:"button",class:"quiz-choice","aria-pressed":valid&&saved.choice===i?"true":"false","data-harness-choice":i,onClick:()=>{
      if(persist({quiz:{choice:i,correct:i===lesson.quiz.answer,version:lesson.quiz.version}})){paintQuiz();quiz.querySelector(`[data-harness-choice="${i}"]`)?.focus({preventScroll:true});}
    }},choice))),feedback);
  };
  const note=h("textarea",{rows:4,maxlength:20000,"aria-label":"Mes notes harness"});note.value=state().note||"";note.oninput=()=>persist({note:note.value});
  const explanation=h("textarea",{rows:5,maxlength:20000,"aria-label":"Mon explication sur un cas nouveau"});explanation.value=state().explanation||"";explanation.oninput=()=>persist({explanation:explanation.value});
  const studied=h("button",{type:"button",class:"button button-primary","aria-pressed":String(!!state().studied)},state().studied?"Retirer de mes leçons étudiées":"J’ai étudié cette leçon");
  studied.onclick=()=>{const value=!state().studied;if(persist({studied:value})){studied.setAttribute("aria-pressed",String(value));studied.textContent=value?"Retirer de mes leçons étudiées":"J’ai étudié cette leçon";}};
  const source=h("div");let sourceTicket=0;
  const sourceDetails=h("details",{},[h("summary",{text:`Inspecter ${lesson.reference.file} · ${lesson.reference.symbol}`}),source]);
  sourceDetails.addEventListener("toggle",async()=>{if(!sourceDetails.open||source.children.length)return;const ticket=++sourceTicket;source.replaceChildren(h("p",{text:"Chargement du code de référence…"}));try{const r=await fetch(publicAssetUrl(lesson.reference.file));if(!r.ok)throw Error("Source indisponible");const text=await r.text();if(active&&ticket===sourceTicket)source.replaceChildren(h("p",{text:"Référence à comparer après ton essai ; elle ne certifie pas une reconstruction personnelle."}),h("pre",{tabindex:"0"},h("code",{text})));}catch{if(active){source.replaceChildren();sourceDetails.open=false;notice.textContent="Le code de référence n’a pas pu être chargé. Rouvre le bloc pour réessayer.";}}});
  main.replaceChildren(crumb([{href:"#/",label:"Accueil"},{href:"#/harness",label:"Mon harness"},{href:`#/harness/module/${module.id}`,label:`Module ${module.id}`},{label:lesson.id.toUpperCase()}]),h("article",{class:"harness-lesson","data-harness-lesson":lesson.id},[
    h("p",{class:"eyebrow",text:`${lesson.id.toUpperCase()} · ${module.title} · pratique indicative ${lesson.minutes} min`}),h("h1",{text:lesson.title}),h("p",{class:"lead",text:lesson.why}),
    h("section",{class:"sheet lesson-objectives"},[h("h2",{text:"Ce que tu vas construire"}),h("ul",{},lesson.objectives.map(text=>h("li",{text}))),h("p",{},lesson.prerequisites.flatMap((id,i)=>[i?" · ":"Prérequis : ",h("a",{href:lessonHref(id),text:id.toUpperCase()})]))]),
    harnessLab(lesson.lab),h("section",{class:"sheet"},[h("h2",{text:"Comprendre le mécanisme"}),...paragraph(lesson.explanation),h("dl",{class:"harness-vocabulary"},Object.entries(lesson.vocabulary).flatMap(([term,definition])=>[h("dt",{text:term}),h("dd",{text:definition})]))]),
    h("section",{class:"sheet"},[h("h2",{text:"Un exemple à exécuter et modifier"}),codeView,example,exampleStatus,sourceDetails]),exercise,quiz,
    h("section",{class:"sheet"},[h("h2",{text:`Construire le TP ${module.id} · ${module.tp}`}),h("p",{text:`Fonctions cumulatives : ${module.functions.join(", ")}. L’atelier utilise eleve.py par défaut ; le mode correction est identifié comme référence.`}),h("ul",{},module.criteria.map(text=>h("li",{text}))),h("pre",{tabindex:"0"},h("code",{text:`python -m harness.verifier --tp ${module.id}`})),h("a",{href:"#/harness",text:"Télécharger l’atelier et ouvrir les guides"})]),
    h("section",{class:"sheet"},[h("h2",{text:"Expliquer sur un cas nouveau"}),h("p",{text:lesson.transfer}),h("label",{},["Ma prédiction, ma trace et la limite observée",explanation]),h("p",{class:"muted",text:"Cette explication est déclarée. Une relecture par une personne réelle reste une preuve distincte du quiz et du contrôle Python."}),h("label",{},["Mes notes personnelles",note]),notice,studied]),
    h("nav",{class:"lesson-actions","aria-label":"Continuer le parcours harness"},[position?h("a",{class:"button button-secondary",href:lessonHref(rows[position-1].lesson.id),text:`Précédente : ${rows[position-1].lesson.title}`}):h("a",{href:"#/harness",text:"Programme du harness"}),position<rows.length-1?h("a",{class:"button button-primary",href:lessonHref(rows[position+1].lesson.id),text:`Suivante : ${rows[position+1].lesson.title}`}):h("a",{class:"button button-primary",href:"#/harness",text:"Préparer mon dossier final de harness"})]) ]));
  paintQuiz();
}

function exercisePanel(lesson,state,persist,execute,isActive) {
  const exercise=lesson.exercise,area=h("textarea",{class:"ide-fallback",rows:10,maxlength:100000,wrap:"off","aria-label":"Code de l’exercice harness"});area.value=state().code??exercise.starter;
  const status=h("p",{role:"status","data-harness-result":lesson.id,text:"Contrôle disponible sans compte."});
  let ticket=0;
  const validity=async()=>{const current=++ticket,hash=await codeFingerprint(area.value);if(!isActive()||current!==ticket)return;const receipt=state().receipt;status.textContent=receipt?EXERCISE_LABELS[exerciseState(receipt,hash,exercise.validatorVersion)]+". Le résultat appartient à ce code et à cette version du contrôle.":"Contrôle non lancé.";};
  const history=h("details",{},[h("summary",{text:"Mes tentatives de cet exercice"})]),historyList=h("ol");history.append(historyList);
  const paintHistory=()=>{historyList.replaceChildren(...(Array.isArray(state().attempts)?state().attempts:[]).slice(-5).reverse().map(row=>h("li",{text:`${new Date(row.checkedAt).toLocaleString("fr")} · ${row.ok?"contrôle passé":"à corriger"} · code ${(row.codeHash||"").slice(0,8)}`})));history.hidden=!historyList.children.length;};
  area.oninput=()=>{ticket++;if(persist({code:area.value})){status.textContent="Code modifié : contrôle à relancer.";void validity();}};
  const run=h("button",{type:"button",class:"button button-primary",onClick:async()=>{
    const source=area.value,hash=await codeFingerprint(source);if(!isActive())return;persist({code:area.value});
    const result=await execute(source+"\n"+exercise.check,run,status);
    if(result.cancelled||result.busy||!isActive())return;
    if(["loading","dependencies"].includes(result.phase)){status.textContent=`Python n’est pas prêt : ${result.text}. Ton code est conservé ; aucun nouveau résultat de code n’est enregistré.`;return;}
    const receipt={ok:result.type!=="error",codeHash:hash,validatorVersion:exercise.validatorVersion,checkedAt:Date.now()};
    if(persist({receipt,attempts:[...(Array.isArray(state().attempts)?state().attempts:[]),receipt].slice(-20)})){await validity();paintHistory();if(result.type==="error"&&area.value===source)status.append(document.createTextNode(" "+(result.text||"Vérifie les cas limites.")));}
  }},"Lancer le contrôle harness");
  const help=h("details",{},[h("summary",{text:"Indices et correction de l’exercice"}),h("ol",{},lesson.hints.map(text=>h("li",{text}))),h("pre",{tabindex:"0"},h("code",{text:exercise.solution}))]);
  const host=h("section",{class:"sheet harness-exercise"},[h("h2",{text:"À toi de reconstruire"}),h("p",{text:exercise.prompt}),h("label",{},["Ton programme Python",area]),run,status,help,history]);paintHistory();void validity();return host;
}

function studyBackup(rows,read,save) {
  const status=h("p",{role:"status"}),input=h("input",{type:"file",accept:".json,application/json","aria-label":"Sauvegarde de mon parcours harness"});
  input.onchange=async()=>{try{const file=input.files[0];if(!file||file.size>10_000_000)throw Error("Sauvegarde absente ou trop volumineuse");const imported=validateHarnessStudy(JSON.parse(await file.text()),rows.map(row=>row.lesson.id));const state=read();let added=0;const lessons={...state.lessons};for(const[id,row]of Object.entries(imported.lessons))if(!lessons[id]){lessons[id]=row;added++;}if(!save({...state,lessons,...(!state.checks&&imported.checks?{checks:imported.checks}:{})}))throw Error("Sauvegarde non enregistrée : stockage refusé ou suivi effacé");status.textContent=`${added} leçon(s) restaurée(s). Les éléments déjà présents sont conservés. Les résultats importés ne certifient pas l’exécution.`;}catch(error){status.textContent=error.message;}};
  return h("section",{class:"sheet"},[h("h2",{text:"Mes notes, contrôles et explications"}),h("p",{text:"Exporter conserve aussi le code et les versions de contrôle. L’import n’exécute aucun code et ajoute les leçons absentes. Le suivi sur cet appareil se gère depuis l’accueil."}),h("button",{type:"button",class:"button button-secondary",onClick:()=>downloadJSON("mon-parcours-harness.json",{format:"afz-harness-study-v1",state:read()})},"Exporter mon parcours harness"),input,status,h("a",{href:"#/",text:"Gérer le suivi sur cet appareil"})]);
}

function projectPanel(spec,scope,read,save,execute) {
  const status=h("p",{role:"status"}),host=h("section",{class:"sheet harness-project",id:"harness-project",tabindex:"-1"});let filesSpec=null;
  const loadManifest=async()=>{if(!filesSpec){const r=await fetch(publicAssetUrl("data/harness-project.json"));if(!r.ok)throw Error("Inventaire indisponible");filesSpec=await r.json();}return filesSpec;};
  const download=h("button",{type:"button",class:"button button-primary",onClick:async()=>{download.disabled=true;try{const manifest=await loadManifest(),files=[];for(const path of manifest.files){if(!/^harness\/[a-zA-Z0-9_./-]+$/.test(path)||path.includes(".."))throw Error("Chemin invalide");const r=await fetch(publicAssetUrl(path));if(!r.ok)throw Error("Fichier manquant");files.push({name:`mon-agent/${path.endsWith('.md')||path.endsWith('LICENSE')?path.slice(8):path}`,data:new Uint8Array(await r.arrayBuffer())});}const {zipStore}=await feature("./zipstore.js");const url=URL.createObjectURL(zipStore(files));h("a",{href:url,download:"mon-agent.zip"}).click();setTimeout(()=>URL.revokeObjectURL(url),10000);status.textContent="Projet prêt. Décompresse mon-agent.zip puis lis README.md et GUIDE.md.";}catch(error){status.textContent=`Téléchargement incomplet : ${error.message}. Tu peux réessayer.`;}finally{download.disabled=false;}}},"Télécharger mon harness (.zip)");
  const selector=h("select",{"aria-label":"Guide du harness"},[["README.md","Installation et premières commandes"],["GUIDE.md","Guide des huit TP"],["MODELE.md","Brancher et entraîner mon modèle"],["PERMISSIONS.md","Permissions et limites"],["PROJET_FINAL.md","Dossier final et grille /20"]].map(([value,text])=>h("option",{value:"harness/"+value,text})));
  const content=h("div",{class:"harness-guide"});let guideTicket=0;
  const showGuide=async()=>{const ticket=++guideTicket;content.textContent="Chargement du guide…";try{const r=await fetch(publicAssetUrl(selector.value));if(!r.ok)throw Error("Guide indisponible");const text=await r.text();const {renderMarkdown}=await feature("./markdown.js");if(ticket===guideTicket)content.replaceChildren(renderMarkdown(text,{baseURL:new URL(selector.value,document.baseURI)}));}catch{if(ticket===guideTicket)content.replaceChildren(h("p",{role:"status",text:"Le guide n’a pas pu être chargé."}),h("button",{type:"button",class:"button button-secondary",onClick:showGuide},"Réessayer ce guide"));}};
  selector.onchange=showGuide;const details=h("details",{},[h("summary",{text:"Lire les guides du harness"}),h("label",{},["Document",selector]),content]);details.addEventListener("toggle",()=>{if(details.open&&!content.childNodes.length)void showGuide();});
  const checkSummary=h("p");
  const refresh=()=>{const report=read().checks;checkSummary.textContent=report?`${report.passed} / ${report.total} contrôles déclarés · ${report.module==='correction'?'référence contrôlée':'module élève déclaré'} · SHA-256 ${report.source_sha256}. Une importation ne certifie ni l’exécution ni l’autonomie.`:"Aucun rapport de TP importé. Les leçons étudiées et les contrôles de projet restent distincts.";};
  const input=h("input",{type:"file",accept:".json,application/json","aria-label":"Rapport des huit TP harness"});input.onchange=async()=>{try{const file=input.files[0];if(!file||file.size>1_000_000)throw Error("Rapport absent ou trop volumineux");const checks=validateHarnessChecks(JSON.parse(await file.text()));if(!save({...read(),checks}))throw Error("Rapport non enregistré : suivi effacé ou stockage refusé");refresh();status.textContent="Rapport déclaré conservé avec ton parcours.";}catch(error){status.textContent=error.message;}};
  const demoStatus=h("p",{role:"status","data-harness-demo":"true"});
  const demo=h("button",{type:"button",class:"button button-secondary",onClick:async()=>{
    const source=`import json\nfrom harness import correction as f\nfrom harness.coeur import Runner\nfrom harness.outils import Tools\nclass Scenario:\n    label='scenario-scripted (aucune autonomie mesurée)'\n    def complete(self,messages,tools,turn):\n        return json.dumps({'type':'tool','id':'c1','name':'calculer','arguments':{'expression':'(8+4)*3'}} if turn==1 else {'type':'final','text':'36'})\nrapport=Runner(Scenario(),Tools('/harness-demo',f),f).run('Calcule (8+4)*3.')\nassert rapport['answer']=='36' and rapport['tool_calls']==1\njson.dumps(rapport,ensure_ascii=False)`;
    const result=await execute(source,demo,demoStatus);if(result.cancelled||result.busy)return;
    if(result.type==="error"){demoStatus.textContent=`Démo interrompue : ${result.text}`;return;}
    try{const report=JSON.parse(result.text);demoStatus.textContent=`Boucle Python : ${report.status} · réponse ${report.answer} · ${report.turns} tours · ${report.tool_calls} outil. Source : ${report.model}.`; }catch{demoStatus.textContent="La réponse de la démonstration n’a pas pu être lue.";}
  }},"Exécuter la boucle Python de référence");
  host.append(h("h2",{text:"Mon atelier de harness"}),h("p",{text:"Le ZIP contient le module élève à compléter, le moteur inspectable, la référence, les huit TP, le banc de dix scénarios et les adaptateurs. Le moteur de base utilise Python standard ; NumPy sert au modèle et à son ajustement."}),h("p",{class:"muted",text:scope.message}),download,details,h("pre",{tabindex:"0"},h("code",{text:"python -m harness.verifier --tp 1\npython -m harness.cli --module eleve --demo calcul"})),demo,demoStatus,h("h3",{text:"Mes preuves de projet"}),checkSummary,input,status);
  onLeave(scope.subscribe(refresh));refresh();return host;
}
