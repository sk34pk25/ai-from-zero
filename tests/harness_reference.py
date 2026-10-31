"""Compare les miniatures au code Python réellement livré."""
from pathlib import Path
import json
import sys
import tempfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from harness import correction as f
from harness.coeur import Runner
from harness.outils import Tools
from harness.modeles import ScriptedModel
from model.finetune import example_ids,format_pair
from model.tokenizer import CharTokenizer

parent={'turns':5,'tools':2,'allowed':['calculer','chercher','calculer']}
requested={'turns':8,'tools':4,'allowed':['calculer','ecrire_fichier']}
memories=[{'key':'projet','value':'ancien','source':'utilisateur','at':1},{'key':'projet','value':'corrigé','source':'utilisateur','at':2}]
prefix=[f.message('system','Règles'),f.message('user','Ma tâche')]
groups=[f.message('assistant',letter*count) for letter,count in [('A',100),('B',80),('C',40)]]
compact=lambda rows:json.dumps(rows,ensure_ascii=False,separators=(',',':'))
group_sizes=[len(compact([row]))-1 for row in groups]
windows=[]
for budget in [80,160,300]:
    rows=f.context_window(prefix+groups,len(compact(prefix))+budget,reserve=0)
    windows.append({'budget':budget,'kept':[row['content'][0] for row in rows[2:]]})
flows=[]
for name in ['calcul','json','path','write','loop']:
    responses={'calcul':[{'type':'tool','id':'c','name':'calculer','arguments':{'expression':'2+3*4'}},{'type':'final','text':'14'}],
        'json':['invalide'], 'path':[{'type':'tool','id':'p','name':'lire_fichier','arguments':{'path':'../secret'}}],
        'write':[{'type':'tool','id':'w','name':'ecrire_fichier','arguments':{'path':'note','content':'bonjour'}},{'type':'final','text':'créée'}],
        'loop':[{'type':'tool','id':str(i),'name':'calculer','arguments':{'expression':'1+1'}} for i in range(5)]}[name]
    for approved in ([False,True] if name=='write' else [False]):
        with tempfile.TemporaryDirectory() as root:
            report=Runner(ScriptedModel(responses),Tools(root,f),f,turns=6,tool_limit=2).run('Ma tâche',approve=(lambda p:True) if approved else None)
            flows.append({'name':name,'approved':approved,'status':report['status'],'calls':report['tool_calls']})
masks=[]
for question,answer in [('A','B'),('Plus long','court'),('3+7','10')]:
    prompt,full=format_pair(question,answer);tokenizer=CharTokenizer(full)
    ids,mask=example_ids(tokenizer,question,answer)
    masks.append({'prompt':len(tokenizer.encode(prompt)),'total':len(ids),'mask':mask})
print(json.dumps({'parent':parent,'requested':requested,'child':f.delegation_budget(parent,requested),'memories':memories,'merged':f.merge_memory([],memories),'group_sizes':group_sizes,'windows':windows,'flows':flows,'masks':masks}))
