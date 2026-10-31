"""Sonder le protocole d'un modèle, avant de lui accorder des outils."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from .coeur import SYSTEM
from . import correction as f
from .modeles import LocalAPIModel,RepoCheckpointModel

PROBES=[
 {'id':'addition-nouvelle','task':'Calcule 19+6 avec calculer.','kind':'calculer','value':25},
 {'id':'produit-nouveau','task':'Calcule 3*6 avec calculer.','kind':'calculer','value':18},
 {'id':'final-simple','task':'Termine avec le texte exact prêt.','kind':'final','text':'prêt'},
 {'id':'proposition-fichier','task':'Propose de créer preuve.txt contenant exactement bonjour.','kind':'ecrire_fichier','path':'preuve.txt','content':'bonjour'},
]

def probe(model):
    rows=[]
    for turn,case in enumerate(PROBES,1):
        record={'id':case['id'],'valid_json':False,'correct_action':False}
        try:
            raw=model.complete([f.message('system',SYSTEM),f.message('user',case['task'])],list(f.SCHEMAS),turn)
            record['output']=str(raw)[:2000];action=f.parse_action(raw);record['valid_json']=True
            if case['kind']=='final':ok=action['type']=='final' and action['text']==case['text']
            else:
                ok=action['type']=='tool' and action['name']==case['kind']
                if ok:
                    args=f.validate_args(action['name'],action['arguments'])
                    ok=f.calculate(args['expression'])==case['value'] if case['kind']=='calculer' else args=={'path':case['path'],'content':case['content']}
            record['correct_action']=bool(ok)
        except (ValueError,ConnectionError,TimeoutError,OSError) as error:record['error']=str(error)[:500]
        record['evidence']=dict(getattr(model,'last_metadata',{}));rows.append(record)
    return {'format':'afz-harness-probe-v1','model':model.label,'tools_executed':0,'summary':f.probe_summary(rows),'cases':rows,'limit':'Un petit banc de protocole ne mesure pas une autonomie générale. Les sorties sont déclarées ; aucune action sur les fichiers n’est exécutée par cette sonde.'}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--endpoint');p.add_argument('--api-mode',choices=['atelier','chat'],default='atelier');p.add_argument('--model',default='local');p.add_argument('--repo');p.add_argument('--checkpoint');p.add_argument('--allow-clipped',action='store_true');p.add_argument('--out',type=Path);a=p.parse_args()
    if bool(a.endpoint)==bool(a.checkpoint):p.error('choisir --endpoint ou --repo avec --checkpoint')
    if a.checkpoint and not a.repo:p.error('--repo requis')
    model=LocalAPIModel(a.endpoint,mode=a.api_mode,model=a.model,allow_clipped=a.allow_clipped) if a.endpoint else RepoCheckpointModel(a.repo,a.checkpoint,allow_clipped=a.allow_clipped)
    report=probe(model);raw=json.dumps(report,ensure_ascii=False,indent=2)
    if a.out:
        with a.out.open('x',encoding='utf-8') as file:file.write(raw+'\n')
    print(raw);raise SystemExit(0 if report['summary']['all_passed'] else 1)
