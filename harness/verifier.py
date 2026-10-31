"""Contrôles cumulatifs de l'élève. python -m harness.verifier --module correction"""
from __future__ import annotations
import argparse
import hashlib
import importlib
import json
from pathlib import Path
import tempfile


def rejected(function,*args):
    try:function(*args)
    except (ValueError,PermissionError,FileNotFoundError):return
    raise AssertionError('entrée invalide acceptée')


def tp1(m):
    assert m.message('user','bonjour')=={'role':'user','content':'bonjour'}
    rejected(m.message,'root','bonjour')
    assert m.parse_action('{"type":"final","text":"ok"}')=={'type':'final','text':'ok'}
    assert m.parse_action('{"type":"tool","id":"c1","name":"calculer","arguments":{"expression":"2+3"}}')['id']=='c1'
    for raw in ['```json\n{}\n```','[]','{"type":"final","type":"tool","text":"ok"}','{"type":"final","text":""}','{"type":"tool","id":"../x","name":"calculer","arguments":{}}']:
        rejected(m.parse_action,raw)


def tp2(m):
    assert m.calculate('2+3*4')==14 and m.calculate('(-3+1)/2')==-1
    for raw in ['__import__("os")','2**1000','1/0','True+1']:rejected(m.calculate,raw)
    assert m.validate_args('calculer',{'expression':'3-2'})=={'expression':'3-2'}
    rejected(m.validate_args,'calculer',{'expression':'3-2','shell':True})
    with tempfile.TemporaryDirectory() as path:
        assert m.safe_path(path,'note.txt')==Path(path)/'note.txt'
        for bad in ['../note','/etc/passwd','a\\b','']:rejected(m.safe_path,path,bad)


def tp3(m):
    limits={'turns':4,'tools':2}
    assert m.stop_reason(0,0,limits) is None
    assert m.stop_reason(4,0,limits)=='turn_limit' and m.stop_reason(0,2,limits)=='tool_limit'
    observation=m.tool_observation('c1','calculer',{'value':5})
    assert observation['role']=='tool' and observation['trust']=='data' and observation['call_id']=='c1'
    assert json.loads(observation['content'])=={'value':5}
    action={'type':'tool','id':'a','name':'calculer','arguments':{'expression':'2+3'}}
    assert m.call_key(action)==m.call_key({**action,'id':'b'})
    assert m.call_key(action)!=m.call_key({**action,'arguments':{'expression':'3+3'}})


def tp4(m):
    rows=[m.message('system','Règle'),m.message('user','Demande initiale'),m.message('assistant','A'*180),m.tool_observation('a','calculer',{'value':'x'*80}),m.message('assistant','Fin')]
    kept=m.context_window(rows,180,reserve=10)
    assert kept[0]==rows[0] and kept[1]==rows[1] and kept[-1]==rows[-1]
    assert not any(row['role']=='tool' for row in kept)
    a={'key':'projet','value':'ancien','source':'user','at':1}
    b={**a,'value':'nouveau','at':2}
    assert m.merge_memory([a],[b])==[b]
    assert m.merge_memory([b],[a])==[b]
    rejected(m.merge_memory,[],[{'key':'x','value':'sans source'}])


def tp5(m):
    e={'kind':'tool_started','call_id':'c1'}
    assert len(m.event_hash('',e))==64 and m.event_hash('',e)!=m.event_hash('a',e)
    assert m.recover_pending([e])==[e]
    assert m.recover_pending([e,{'kind':'tool_finished','call_id':'c1'}])==[]
    result=m.evaluate_case({'status':'finished','answer':'5','events':[]},{'status':'finished','answer':'5'})
    assert all(result.values())
    assert m.evaluate_case({'status':'finished','answer':'4','events':[]},{'status':'finished','answer':'5'})['answer_ok'] is False


def tp6(m):
    assert m.format_prompt([m.message('user','teste')])=='[user]\nteste\n[assistant]\n'
    assert m.probe_summary([])['all_passed'] is False
    summary=m.probe_summary([{'valid_json':True,'correct_action':False},{'valid_json':True,'correct_action':True}])
    assert summary['valid_json']==2 and summary['correct_action']==1 and summary['all_passed'] is False
    assert m.paired_delta([{'seed':1,'score':.5},{'seed':2,'score':.8}],[{'seed':2,'score':.9},{'seed':1,'score':.3}])==[-.2,.09999999999999998]
    rejected(m.paired_delta,[{'seed':1,'score':.5}],[{'seed':2,'score':.5}])


def tp7(m):
    catalog=[{'id':'a','keywords':['python','calcul']},{'id':'b','keywords':['memoire']}]
    assert m.select_skills(catalog,'Un calcul Python')[0]['id']=='a'
    assert m.select_skills(catalog,'inconnu')==[]
    parent={'turns':3,'tools':2,'allowed':['calculer','chercher']}
    request={'turns':8,'tools':1,'allowed':['calculer','ecrire_fichier']}
    assert m.delegation_budget(parent,request)=={'turns':3,'tools':1,'allowed':['calculer']}
    rows=[{'id':'b','due':2,'state':'done'},{'id':'a','due':1,'state':'pending'},{'id':'c','due':4,'state':'pending'}]
    assert m.due_jobs(rows,2)==[rows[1]]


def tp8(m):
    assert m.validate_request({'task':'  tester '})=='tester'
    rejected(m.validate_request,{'task':'x','allow_write':True})
    assert m.export_trace({'format':'afz-harness-v1','answer':'ok','token':'secret'})=={'format':'afz-harness-v1','answer':'ok'}
    assert m.success_metrics([])['success_rate'] is None
    assert m.success_metrics([{'ok':True},{'ok':False},{'ok':False}])=={'attempts':3,'passed':1,'success_rate':1/3}

CHECKS=[tp1,tp2,tp3,tp4,tp5,tp6,tp7,tp8]

def verify(module='eleve',tp=None):
    m=importlib.import_module('harness.'+module)
    rows=[]
    for i,check in enumerate(CHECKS,1):
        if tp is not None and i!=tp:continue
        try:check(m)
        except Exception as error:rows.append({'tp':i,'ok':False,'error':type(error).__name__+': '+str(error)[:300]})
        else:rows.append({'tp':i,'ok':True})
    return {'format':'afz-harness-checks-v1','module':module,'source_sha256':hashlib.sha256(Path(m.__file__).read_bytes()).hexdigest(),'total':len(rows),'passed':sum(row['ok'] for row in rows),'checks':rows}


def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--module',choices=['eleve','correction'],default='eleve');p.add_argument('--tp',type=int,choices=range(1,9));p.add_argument('--out',type=Path);a=p.parse_args(argv)
    report=verify(a.module,a.tp);raw=json.dumps(report,ensure_ascii=False,indent=2)
    if a.out:
        with a.out.open('x',encoding='utf-8') as file:file.write(raw+'\n')
    print(raw);return 0 if report['total']==report['passed'] else 1

if __name__=='__main__':raise SystemExit(main())
