"""Contre-exemples des contrôles publics et traçabilité de leur version."""
import ast
import copy
import hashlib
import json
from pathlib import Path
import pytest
from tests.test_curriculum import load_builder

ROOT = Path(__file__).resolve().parents[1]
EXERCISES = {row['lessonId']:row for row in json.loads((ROOT/'data/exercises.json').read_text())}
TASKS = json.loads((ROOT/'data/transfer-tasks.json').read_text())['tasks']


def test_generated_contracts_and_capabilities_match_their_sources():
    builder = load_builder()
    assert list(EXERCISES.values()) == builder.build_exercises()
    assert json.loads((ROOT/'data/transfer-tasks.json').read_text()) == builder.build_transfer_tasks()
    caps = builder.build_capabilities()
    assert caps == json.loads((ROOT/'data/capabilities.json').read_text())
    assert (ROOT/'docs/CAPACITES.md').read_text() == builder.render_capabilities(caps)
    for row in EXERCISES.values():
        contract = copy.deepcopy(row); version = contract.pop('validatorVersion')
        dependencies = {path:hashlib.sha256((ROOT/path).read_bytes()).hexdigest() for path in contract.get('files',[])}
        def digest(value):return hashlib.sha256(json.dumps({'schema':2,'exercise':value,'dependencies':dependencies,'runtime':builder.runtime_fingerprint()},sort_keys=True,ensure_ascii=False).encode()).hexdigest()
        assert digest(contract) == version
        contract['check'] += '\nassert False\n'
        assert digest(contract) != version


@pytest.mark.parametrize('lesson,mutation', [
    ('1.4','def prediction(x,w,b): return 7'),
    ('1.9','def mse(pred,cible): return (sum(p-y for p,y in zip(pred,cible))/len(pred))**2'),
    ('1.12','def gradient_partage(w): return w+1'),
    ('1.15','import numpy as np\ndef gradient_biais(g): return np.asarray(g).mean(axis=(0,1))'),
    ('2.11','def batches(ids,t): return [(ids[i:i+t],ids[i:i+t]) for i in range(len(ids)-t)]'),
    ('3.5','def softmax(xs): return [1/len(xs)]*len(xs)'),
    ('4.3','def scores(q,k): return [[sum(a*b for a,b in zip(x,y)) for y in q] for x in k]'),
    ('4.4','import numpy as np\ndef attention(q,k,v):\n q,k,v=map(np.asarray,(q,k,v)); z=q@k.T; z=np.where(np.tril(np.ones(z.shape,dtype=bool)),z,-1e9); e=np.exp(z-z.max(-1,keepdims=True)); return e/e.sum(-1,keepdims=True)@v'),
    ('4.11','def bloc(x,attention,ffn,norm): return x+attention(norm(x))+ffn(norm(x))'),
    ('5.9','def cache(couches,t,kv,d): return couches*t*kv*d'),
    ('6.12','def classer(lignes): return sorted(lignes,key=lambda r:(r["seconds"],-r["quality"]))'),
    ('8.5','def composer(a1,b1,a2,b2): return a1*a2,a1*b2+b1'),
    ('13.6','def masque_reponse(n_prompt,n_total): return [i>=n_prompt for i in range(n_total-1)]'),
])
def test_plausible_wrong_implementations_fail(lesson, mutation):
    with pytest.raises((AssertionError, ValueError, TypeError)):
        namespace = {}; exec(mutation,namespace); exec(EXERCISES[lesson]['check'],namespace)


@pytest.mark.parametrize('task',TASKS,ids=[row['id'] for row in TASKS])
def test_transfer_reconstructs_and_detects_the_remaining_bug(task):
    namespace = {}; exec(task['solution'],namespace); exec(task['check'],namespace)
    # Réussir la reconstruction ne doit pas masquer le défaut à diagnostiquer.
    correct = ast.parse(task['solution']).body[0]
    broken = ast.parse(task['starter'])
    broken.body[0] = correct; ast.fix_missing_locations(broken)
    with pytest.raises(AssertionError):
        namespace = {}; exec(compile(broken,task['id'],'exec'),namespace); exec(task['check'],namespace)


def test_quiz_length_alone_no_longer_solves_most_questions():
    questions = [step['quiz'] for level in json.loads((ROOT/'data/curriculum.json').read_text())['levels'] for step in level['steps']]
    for extreme in (min,max):
        guessed = sum(len(q['choices'][q['answer']])==extreme(map(len,q['choices'])) and sum(len(c)==len(q['choices'][q['answer']]) for c in q['choices'])==1 for q in questions)
        assert guessed <= 60, (extreme.__name__, guessed)
    assert all(not any(word in q['explanation'].lower() for word in ('première phrase','deuxième phrase','troisième phrase','quatrième phrase')) for q in questions)


def test_observation_summary_does_not_turn_technical_success_into_human_evidence():
    import importlib.util
    spec = importlib.util.spec_from_file_location('observations', ROOT/'scripts/summarize_observations.py')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    task = TASKS[0]
    row = {'id':'sample','taskId':task['id'],'alias':'eleve-01','siteVersion':'test','taskVersion':task['validatorVersion'],'code':task['solution'],'diagnosis':'Carré après moyenne','explanation':'Les erreurs opposées ne doivent pas s’annuler.','events':[{'type':'start','at':1000},{'type':'finish','at':2000}], 'assistance':[], 'checks':[{'ok':True,'codeHash':module.fingerprint(task['solution']),'validatorVersion':task['validatorVersion'],'checkedAt':1800,'assistance':[]}]}
    catalog = json.loads((ROOT/'data/transfer-tasks.json').read_text())
    report = lambda value: {'format':'afz-comprehension-v1','attempts':[value]}
    stats = lambda value: module.summarize([report(value)],catalog)['stages'][0]
    assert stats(row)['current_code_passed']==1
    assert stats(row)['observer_reviews_declared']==0
    snapshot = json.dumps([row['code'],row['diagnosis'],row['explanation']],ensure_ascii=False,separators=(',',':'))
    row['review'] = {'type':'self','by':'','evidence':'Calcul vérifié','scores':[2,2,2],'contentHash':module.fingerprint(snapshot)}
    assert stats(row)['self_reviews']==1
    assert stats(row)['observer_reviews_declared']==0
    row['review'].update(type='observer',by='observateur-01')
    assert stats(row)['autonomy_observed_declared']==1
    row['checks'][0]['assistance']=['indice']
    assert stats(row)['autonomy_observed_declared']==0
    row['explanation']='Texte modifié après la relecture'
    assert stats(row)['observer_reviews_declared']==0
    assert stats(row)['stale_reviews']==1
    row['code']='pass'
    assert stats(row)['current_code_passed']==0
    summary=module.summarize([report(row),report(row)],catalog)
    assert summary['attempts']==1 and summary['duplicates_ignored']==1
    empty=module.summarize([],catalog)
    assert empty['attempts']==0 and 'Aucune observation humaine' in module.markdown(empty)
