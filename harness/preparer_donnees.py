"""Corpus original de protocole : séparer les familles AVANT les formulations."""
from pathlib import Path
import argparse
import json
from .coeur import SYSTEM
from .correction import format_prompt, tool_observation, message


def dataset():
    parts={name:[] for name in ['train','validation','test']}
    ranges={'train':range(0,8),'validation':range(8,12),'test':range(12,16)}
    for split,values in ranges.items():
        for n in values:
            family=f'addition-{n}'
            action={'type':'tool','id':'c1','name':'calculer','arguments':{'expression':f'{n}+3'}}
            contexts=[message('system',SYSTEM),message('user',f'Calcule {n}+3 avec calculer.')]
            answer=json.dumps(action,ensure_ascii=False,separators=(',',':'))
            parts[split].append({'family':family,'messages':contexts,'answer':answer})
            contexts=[*contexts,message('assistant',answer),tool_observation('c1','calculer',{'ok':True,'data':{'value':n+3}})]
            parts[split].append({'family':family,'messages':contexts,'answer':json.dumps({'type':'final','text':str(n+3)},ensure_ascii=False,separators=(',',':'))})
    return {'format':'afz-harness-sft-v1','licence':'MIT','parts':parts,'limit':'Addition synthétique étroite ; réussir ce corpus ne prouve pas une généralisation aux tâches ouvertes.'}


def validate_dataset(data):
    if data.get('format')!='afz-harness-sft-v1' or set(data.get('parts',{}))!={'train','validation','test'}:raise ValueError('corpus de protocole invalide')
    families={};prompts={}
    for name,rows in data['parts'].items():
        if not rows:raise ValueError('ensemble vide')
        families[name]={row['family'] for row in rows};prompts[name]={format_prompt(row['messages']) for row in rows}
    for a,b in [('train','validation'),('train','test'),('validation','test')]:
        if families[a]&families[b] or prompts[a]&prompts[b]:raise ValueError('familles ou invites communes entre ensembles')
    return data

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',type=Path,required=True);a=p.parse_args();data=validate_dataset(dataset())
    with a.out.open('x',encoding='utf-8') as file:json.dump(data,file,ensure_ascii=False,indent=2)
    print(f"Corpus écrit : {a.out}. Le test est réservé.")
