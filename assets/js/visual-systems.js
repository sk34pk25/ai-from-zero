/** Vues de systèmes : échantillonnage, mémoire et modalités. Les budgets sont des calculs, pas des mesures. */
import { h } from './dom.js';
import { sum, softmax } from './visual-math.js';
import { action, cards, chart, fmt, lab, matrix, note, slider } from './visual-ui.js';

export function mountSampling(host) {
  const temperature=slider('Température des logits',.2,3,1,.1), k=slider('Top-k des tokens',1,4,4), draw=slider('Tirage uniforme u',0,.999,.5,.001), stage=h('div'), status=note('');
  const logits=[1.2,.2,-.4,.7];
  const paint=()=>{
    const ids=logits.map((_,i)=>i).sort((a,b)=>logits[b]-logits[a]).slice(0,Number(k.input.value));
    const p=softmax(logits.map((n,i)=>ids.includes(i)?n:-Infinity),Number(temperature.input.value));
    let cumulative=0;const intervals=p.map(value=>{const from=cumulative;cumulative+=value;return [from,cumulative];});
    const selected=Math.max(0,intervals.findIndex(([,to])=>Number(draw.input.value)<to));
    stage.replaceChildren(cards(p.map((value,i)=>({label:`Token t${i}`,value:`P=${fmt(value)}`,active:i===selected,detail:`intervalle [${fmt(intervals[i][0])}, ${fmt(intervals[i][1])}[`}))));
    status.textContent=`T=${temperature.input.value}, k=${k.input.value}, u=${draw.input.value} → token t${selected}. La somme des probabilités conservées vaut ${fmt(sum(p))}. Déplace le tirage pour traverser les intervalles ; un tirage n’est pas toujours l’argmax. Pour k=1, le résultat est déterministe. Logits d’exemple ; aucun modèle n’est réentraîné.`;
  };
  host.dataset.lab='sampling';host.append(h('h2',{class:'lab-title',text:'Top-k, température, puis tirage du prochain token'}),temperature.field,k.field,draw.field,stage,status);for(const s of [temperature,k,draw])s.input.addEventListener('input',paint);paint();
}

export function mountRetrieval(host) {
  const docs=['le gradient indique la pente de la loss','le tokenizer decoupe le texte','la mémoire externe se retire'];
  const input=h('input',{type:'search',value:'pente','aria-label':'Question à comparer aux documents',maxlength:120}),stage=h('div'),status=note('');
  const words=text=>(text.toLowerCase().match(/[a-z0-9àâäéèêëïîôùûüçœ]+/g)||[]);
  const paint=()=>{
    const vocabulary=[...new Set([input.value,...docs].flatMap(words))].sort();
    const vector=text=>{const tokens=words(text),v=vocabulary.map(w=>tokens.filter(t=>t===w).length),norm=Math.hypot(...v);return v.map(x=>norm?x/norm:0);};
    const q=vector(input.value),scores=docs.map((text,index)=>({text,index,score:sum(q.map((n,i)=>n*vector(text)[i]))})).sort((a,b)=>b.score-a.score||a.index-b.index);
    stage.replaceChildren(h('ol',{class:'flow-list'},scores.map((row,i)=>h('li',{class:i===0&&row.score>0?'is-on':''},`${fmt(row.score)} · doc ${row.index} : ${row.text}`))),cards([{label:'Question',value:input.value||'vide'},{label:'Top-2 documents',value:scores.slice(0,2).map(x=>`doc ${x.index}`).join(' + ')},{label:'Contexte injecté',value:'question + extraits',detail:'les poids du modèle ne sont pas modifiés'}]));
    status.textContent=`Similarité cosinus de sacs de mots normalisés, comme model/memory.py. Vocabulaire partagé : ${vocabulary.length} mots. Un score nul signale ici l’absence de mot commun ; ce système ne comprend pas les synonymes et ne garantit pas la vérité d’un extrait.`;
  };
  host.dataset.lab='retrieval';host.append(h('h2',{class:'lab-title',text:'Chercher des extraits avant de construire le contexte'}),h('label',{},['Question',input]),stage,status);input.addEventListener('input',paint);paint();
}

export function mountAdaptive(host, lesson) {
  const depth=slider('Nombre de raffinements',1,5,2),stage=h('div'),status=note('');
  const paint=()=>{
    const n=Number(depth.input.value);let state=0;
    const states=Array.from({length:n},(_,i)=>{const previous=state;state=.5*state+1;return {label:`Passage ${i+1}`,value:`h=${fmt(state)}`,detail:`0.5×${fmt(previous)}+1`};});
    stage.replaceChildren(cards(states),matrix('État final [1,D]',[[state,state/2]]));
    status.textContent=`${n} passage(s) du même module, avec des poids partagés. La forme reste [1,2] mais le calcul augmente avec le nombre de passages. Cette récurrence scalaire illustre le budget interne ; elle ne constitue pas une preuve de raisonnement. ${lesson.id==='10.7'?'Un agent ajoute encore des appels d’outils et doit vérifier leurs résultats.':'Une règle d’arrêt doit se vérifier sur une validation réservée.'}`;
  };
  host.dataset.lab='adaptive';host.append(h('h2',{class:'lab-title',text:'Distinguer profondeur, état et budget de calcul'}),depth.field,stage,status);depth.input.addEventListener('input',paint);paint();
}

export function mountModalities(host, lesson) {
  const mode=h('select',{'aria-label':'Modalité à suivre'},['texte','image','audio'].map(value=>h('option',{value,text:value}))),stage=h('div'),status=note('');
  if(['9.4','9.5'].includes(lesson.id))mode.value='audio';
  const paint=()=>{
    const type=mode.value;
    if(type==='audio') {
      const signal=Array.from({length:16},(_,i)=>Math.sin(2*Math.PI*2*i/16));
      const spectrum=Array.from({length:9},(_,k)=>Math.hypot(sum(signal.map((x,n)=>x*Math.cos(2*Math.PI*k*n/16))),sum(signal.map((x,n)=>-x*Math.sin(2*Math.PI*k*n/16)))));
      stage.replaceChildren(chart('Signal pédagogique et amplitude de sa DFT, pas un son enregistré',[{name:'Signal : amplitude en fonction de l’échantillon',values:signal.map((x,i)=>[i,x])}],{xLabel:'Indice échantillon',yLabel:'Amplitude (sans unité)'}),matrix('Amplitude DFT par case fréquentielle k=0…8',[spectrum]),cards([{label:'Fenêtre temporelle',value:'16 échantillons'},{label:'Fréquences',value:'pic dans la case k=2'},{label:'Spectrogramme',value:'empiler plusieurs fenêtres',detail:'temps × fréquences → patches → tokens'}]));
    } else stage.replaceChildren(cards(type==='texte'?[{label:'Texte',value:'« le chat »'},{label:'Tokenizer',value:'IDs de tokens'},{label:'Embedding',value:'[T,D]'}]:[{label:'Image',value:'[H,W,C]'},{label:'Patches',value:'[N,P×P×C]'},{label:'Projection',value:'[N,D]'}]));
    status.textContent=`Modalité ${type} → séquence de vecteurs → espace commun de largeur D. Le type de donnée et les positions restent identifiables ; les IDs texte et les patches ne deviennent pas identiques. Le dépôt implémente les patches d’image ; l’encodeur audio complet et les sorties audio restent des idées de cours. La DFT miniature ci-dessus est calculée pour illustrer temps et fréquence.`;
  };
  host.dataset.lab='modalities';host.append(h('h2',{class:'lab-title',text:'Des entrées différentes vers des séquences de vecteurs'}),h('label',{},['Modalité',mode]),stage,status);mode.addEventListener('change',paint);paint();
}

export function mountPrecision(host, lesson) {
  const count=slider('Millions de paramètres',1,16,4),stage=h('div'),status=note('');
  const paint=()=>{
    const p=Number(count.input.value)*1e6;
    stage.replaceChildren(cards([{label:'Poids float32',value:`${p*4/1e6} Mo`},{label:'Poids float16',value:`${p*2/1e6} Mo`},{label:'AdamW float32, poids+grads+m+v',value:`${p*16/1e6} Mo`,detail:'activations et surcoûts exclus'}]));
    status.textContent=`${count.input.value} millions de paramètres. Mo décimaux (10⁶ octets). ${lesson.id==='6.6'?'La précision mixte peut garder des poids maîtres et des états en float32 : diviser la taille des poids par deux ne divise pas toute la mémoire par deux.':'Les activations dépendent du batch, du contexte et de l’architecture ; ce calcul ne mesure pas la mémoire totale d’un processus.'}`;
  };
  host.dataset.lab='precision';host.append(h('h2',{class:'lab-title',text:'Compter les octets des poids et des états'}),count.field,stage,status);count.input.addEventListener('input',paint);paint();
}
