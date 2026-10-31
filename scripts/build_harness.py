#!/usr/bin/env python3
"""Compile le parcours harness et l'inventaire du projet autonome."""
from __future__ import annotations
import ast
import copy
import hashlib
import json
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'curriculum_src/harness/cours.json'


def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,ensure_ascii=False).encode()).hexdigest()


def project_files():
    return sorted(path.relative_to(ROOT).as_posix() for path in (ROOT/'harness').rglob('*') if path.is_file() and '__pycache__' not in path.parts and path.suffix in {'.py','.md','.json','.txt'} or path.is_file() and path.name=='LICENSE' and '__pycache__' not in path.parts)


def symbols(path):
    result=set()
    for node in ast.parse(path.read_text(encoding='utf-8')).body:
        if isinstance(node,(ast.FunctionDef,ast.ClassDef)):
            result.add(node.name)
            if isinstance(node,ast.ClassDef):result.update(node.name+'.'+row.name for row in node.body if isinstance(row,ast.FunctionDef))
    return result


def build():
    data=json.loads(SOURCE.read_text(encoding='utf-8'));seen=set()
    python={path:hashlib.sha256((ROOT/path).read_bytes()).hexdigest() for path in project_files() if path.endswith('.py')}
    runtime={path:hashlib.sha256((ROOT/path).read_bytes()).hexdigest() for path in ['assets/js/pyworker.js','assets/js/pybridge.js']}
    for module in data['modules']:
        if len(module['lessons'])!=4 or len(module['criteria'])!=3:raise ValueError('module incomplet')
        for number,row in enumerate(module['lessons'],1):
            lesson_id=row['id']
            if lesson_id!=f"h{module['id']}.{number}" or lesson_id in seen:raise ValueError('identifiant de leçon invalide')
            seen.add(lesson_id)
            if len(row['objectives'])!=3 or len(row['hints'])<2 or len(row['explanation'])<600 or len(row['transfer'])<60:raise ValueError('leçon insuffisante : '+lesson_id)
            if not row['prerequisites']:raise ValueError('prérequis absents')
            ref=row['reference'];path=ROOT/ref['file']
            if ref['symbol'] not in symbols(path):raise ValueError('référence non résolue : '+lesson_id)
            compile(row['code'],lesson_id,'exec')
            compile(row['exercise']['starter'],lesson_id,'exec');compile(row['exercise']['solution']+'\n'+row['exercise']['check'],lesson_id,'exec')
            quiz=row['quiz'];correct=quiz['choices'][quiz['answer']];wrong=[value for i,value in enumerate(quiz['choices']) if i!=quiz['answer']]
            quiz['answer']=(len(seen)-1)%4;quiz['choices']=wrong;quiz['choices'].insert(quiz['answer'],correct)
            if len(set(quiz['choices']))!=4:raise ValueError('quiz ambigu')
            quiz['version']=digest(quiz)
            row['exercise']['validatorVersion']=digest({'lesson':lesson_id,'exercise':row['exercise'],'sources':python,'runtime':runtime})
    if len(seen)!=32 or [m['id'] for m in data['modules']]!=list(range(1,9)):raise ValueError('parcours incomplet')
    for module in data['modules']:
        for row in module['lessons']:
            if any(not re.fullmatch(r'\d+\.\d+',p) and p not in seen for p in row['prerequisites']):raise ValueError('prérequis inconnu')
    data['version']=digest(data)
    data['browserFiles']=['harness/'+name for name in ['__init__.py','correction.py','coeur.py','outils.py','modeles.py','stockage.py','extensions.py','cli.py','preparer_donnees.py']]
    return data


def build_index(data):
    return {k:v for k,v in data.items() if k!='modules'}|{'modules':[{k:v for k,v in module.items() if k!='lessons'}|{'lessons':[{k:row[k] for k in ['id','title','minutes','objectives','why','prerequisites']}|{'searchText':' '.join(row['vocabulary'])} for row in module['lessons']]} for module in data['modules']]}


def project_manifest():
    files=project_files()
    return {'format':'afz-harness-project-v1','files':files,'sha256':{path:hashlib.sha256((ROOT/path).read_bytes()).hexdigest() for path in files},'documents':['harness/README.md','harness/GUIDE.md','harness/MODELE.md','harness/PROJET_FINAL.md','harness/PERMISSIONS.md'],'zipRoot':'mon-agent'}


def render(data):
    rows=['# Construire son harness d’agent de A à Z','','Suite du parcours de modèle : 32 leçons, huit TP cumulatifs, un projet local inspectable. Les contrôles d’infrastructure, de modèle et de pédagogie restent distincts.','']
    for module in data['modules']:
        rows.extend([f"## Module {module['id']} — {module['title']}",'',module['result'],'',f"TP {module['id']} : {module['tp']}. Fonctions : {', '.join(module['functions'])}.",''])
        for lesson in module['lessons']:rows.append(f"- {lesson['id']} — {lesson['title']} : {lesson['why']}")
        rows.append('')
    rows.extend(['## Références','',*['- ['+row['title']+']('+row['url']+')' for row in data['references']],''])
    return '\n'.join(rows)


def main():
    data=build()
    directory=ROOT/'data/harness';directory.mkdir(exist_ok=True)
    for module in data['modules']:
        for row in module['lessons']:(directory/(row['id']+'.json')).write_text(json.dumps(row,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    for name,value in [('harness-curriculum.json',data),('harness-index.json',build_index(data)),('harness-project.json',project_manifest())]:
        (ROOT/'data'/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (ROOT/'docs/HARNESS.md').write_text(render(data),encoding='utf-8')
    print('32 leçons harness, huit TP et projet autonome générés.')

if __name__=='__main__':main()
