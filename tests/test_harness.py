"""Le nouveau parcours, le projet élève et ses frontières réelles."""
from __future__ import annotations
from contextlib import contextmanager,redirect_stdout
import copy
import importlib.util
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import numpy as np
import pytest
from harness import correction as f
from harness.coeur import Runner
from harness.outils import Tools,READ_ONLY
from harness.modeles import ScriptedModel,LocalAPIModel,RepoCheckpointModel
from harness.stockage import MemoryStore,SQLiteStore
from harness.cli import action
from harness.extensions import load_skills,delegate,run_due
from harness.evaluer import evaluate
from harness.verifier import verify
from harness.sonder import probe,PROBES

ROOT=Path(__file__).resolve().parents[1]
COURSE=json.loads((ROOT/'data/harness-curriculum.json').read_text())
LESSONS=[row for module in COURSE['modules'] for row in module['lessons']]

def builder():
    spec=importlib.util.spec_from_file_location('build_harness',ROOT/'scripts/build_harness.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module


def test_course_is_generated_complete_and_still_follows_the_model():
    b=builder();assert b.build()==COURSE
    assert b.build_index(COURSE)==json.loads((ROOT/'data/harness-index.json').read_text())
    assert b.project_manifest()==json.loads((ROOT/'data/harness-project.json').read_text())
    assert (ROOT/'docs/HARNESS.md').read_text()==b.render(COURSE)
    assert len(LESSONS)==32 and len({row['id'] for row in LESSONS})==32
    ids={row['id']:i for i,row in enumerate(LESSONS)}
    model_ids={row['id'] for level in json.loads((ROOT/'data/curriculum.json').read_text())['levels'] for row in level['steps']}
    assert len(model_ids)==161
    for row in LESSONS:
        assert row==json.loads((ROOT/'data/harness'/(row['id']+'.json')).read_text())
        for prior in row['prerequisites']:
            assert prior in model_ids or ids[prior]<ids[row['id']],(row['id'],prior)
    assert [sum(row['quiz']['answer']==i for row in LESSONS) for i in range(4)]==[8]*4


@pytest.mark.parametrize('row',LESSONS,ids=[row['id'] for row in LESSONS])
def test_examples_and_solution_execute_independently(row):
    with redirect_stdout(io.StringIO()):exec(row['code'],{})
    namespace={};exec(row['exercise']['solution'],namespace);exec(row['exercise']['check'],namespace)
    with pytest.raises((NotImplementedError,NameError)):
        namespace={};exec(row['exercise']['starter'],namespace);exec(row['exercise']['check'],namespace)


def test_reference_and_student_are_distinguished():
    assert verify('correction')['passed']==8
    assert verify('eleve')['passed']==0
    report=evaluate('correction')
    assert report['metrics']['attempts']==report['metrics']['passed']==10
    assert report['autonomy_measured'] is False and report['model']=='scenario-scripted'


@pytest.mark.parametrize('bad',['__import__("os")','(1).__class__','True+2','1/0','2**9999','9'*100])
def test_calculator_rejects_code_and_disproportionate_numbers(bad):
    with pytest.raises(ValueError):f.calculate(bad)


def test_paths_permissions_and_exclusive_creation(tmp_path):
    root=tmp_path/'work';outside=tmp_path/'outside';outside.mkdir();root.mkdir()
    (root/'link').symlink_to(outside,target_is_directory=True)
    for value in ['../secret','/etc/passwd','link/secret','a\\b','']:
        with pytest.raises(ValueError):f.safe_path(root,value)
    tool=Tools(root,f,allowed=READ_ONLY)
    with pytest.raises(PermissionError):tool.prepare(action('ecrire_fichier',{'path':'a','content':'b'}))
    with pytest.raises(ValueError):tool.prepare(action('diagnostic',{'preset':'python_version; echo nope'}))
    tool=Tools(root,f);a=action('ecrire_fichier',{'path':'note','content':'first'})
    assert tool.execute(a)['created'];assert (root/'note').read_text()=='first'
    with pytest.raises(FileExistsError):tool.execute({**a,'arguments':{'path':'note','content':'second'}})
    assert (root/'note').read_text()=='first'


def test_invalid_json_never_executes_an_effect_and_retries_are_bounded(tmp_path):
    for raw in ['[]','```json\n{}\n```','{"type":"final","text":"a","text":"b"}','{"type":"tool","id":"x","name":"calculer","arguments":{"expression":NaN}}']:
        with pytest.raises(ValueError):f.parse_action(raw)
    r=Runner(ScriptedModel(['invalid']),Tools(tmp_path,f),f,turns=3).run('Tester le contrat.')
    assert r['status']=='turn_limit' and r['turns']==3 and r['tool_calls']==0
    assert not list(tmp_path.iterdir())


def test_reused_call_is_not_reexecuted_and_conflicting_id_is_refused(tmp_path):
    a=action('calculer',{'expression':'2+3'})
    model=ScriptedModel([a,a,{'type':'final','text':'5'}])
    report=Runner(model,Tools(tmp_path,f),f).run('Calcule.')
    assert report['status']=='finished' and report['tool_calls']==1
    assert any(row['kind']=='tool_reused' for row in report['events'])
    model=ScriptedModel([a,{**a,'arguments':{'expression':'3+3'}}])
    assert Runner(model,Tools(tmp_path,f),f).run('Calcule.')['status']=='denied'


def test_approval_resume_and_model_signature(tmp_path):
    store=MemoryStore();a=action('ecrire_fichier',{'path':'note','content':'ok'})
    model=ScriptedModel([a,{'type':'final','text':'créé'}]);tools=Tools(tmp_path,f)
    report=Runner(model,tools,f,store).run('Créer une note.',session='one')
    assert report['status']=='approval_required' and not (tmp_path/'note').exists()
    report=Runner(model,tools,f,store).run(session='one',resume=True,approve=lambda preview:preview['arguments']['content']=='ok')
    assert report['status']=='finished' and report['tool_calls']==1 and (tmp_path/'note').read_text()=='ok'
    with pytest.raises(ValueError,match='modifi'):
        Runner(ScriptedModel([{'type':'final','text':'different'}]),tools,f,store).run(session='one',resume=True)


def test_effect_interrupted_after_write_is_not_replayed(tmp_path):
    class CrashTools(Tools):
        def execute(self,action):
            super().execute(action);raise KeyboardInterrupt
    store=MemoryStore();model=ScriptedModel([action('ecrire_fichier',{'path':'note','content':'one'}),{'type':'final','text':'ok'}])
    r=Runner(model,CrashTools(tmp_path,f),f,store).run('Créer.',session='crash',approve=lambda p:True)
    assert r['status']=='interrupted' and (tmp_path/'note').read_text()=='one'
    r=Runner(model,Tools(tmp_path,f),f,store).run(session='crash',resume=True,approve=lambda p:True)
    assert r['status']=='uncertain_effect' and r['tool_calls']==1 and (tmp_path/'note').read_text()=='one'


def test_changes_during_approval_are_rechecked(tmp_path):
    root=tmp_path/'work';root.mkdir();(root/'folder').mkdir();outside=tmp_path/'outside';outside.mkdir()
    def approve(preview):
        (root/'folder').rmdir();(root/'folder').symlink_to(outside,target_is_directory=True);return True
    model=ScriptedModel([action('ecrire_fichier',{'path':'folder/note','content':'no'}),{'type':'final','text':'not verified'}])
    r=Runner(model,Tools(root,f),f).run('Créer une note.',approve=approve)
    assert not (outside/'note').exists()
    assert any(row['kind']=='tool_finished' and row['ok'] is False for row in r['events'])


def test_context_keeps_original_task_and_complete_groups():
    messages=[f.message('system','Règle'),f.message('user','But'),f.message('assistant','x'*200),f.tool_observation('c','calculer',{'value':4}),f.message('assistant','Fin')]
    reduced=f.context_window(messages,150,reserve=10)
    assert reduced[:2]==messages[:2] and reduced[-1]==messages[-1]
    assert not any(row['role']=='tool' for row in reduced)
    with pytest.raises(ValueError):f.context_window(messages,10,reserve=2)
    large=f.tool_observation('x','lire_fichier',{'text':'"'*8000})
    assert json.loads(large['content'])['truncated'] is True


def test_sqlite_roundtrip_sources_and_literal_search(tmp_path):
    store=SQLiteStore(tmp_path/'data/sessions.sqlite');store.save('one',{'messages':[{'content':'ok'}]})
    assert SQLiteStore(store.path).load('one')=={'messages':[{'content':'ok'}]}
    store.remember([{'key':'a','value':'100% local','source':'utilisateur','at':1},{'key':'b','value':'autre','source':'document','at':2}],f)
    assert store.recall('%')[0]['value']=='100% local'
    store.remember([{'key':'a','value':'corrigé','source':'utilisateur','at':3}],f)
    assert store.recall('corrigé')[0]['source']=='utilisateur'


def test_hash_corruption_is_refused_on_resume(tmp_path):
    store=MemoryStore();model=ScriptedModel(['invalid'])
    runner=Runner(model,Tools(tmp_path,f),f,store,turns=2);runner.run('Tâche',session='bad')
    row=store.load('bad');row['events'][0]['message']='altéré';store.save('bad',row)
    with pytest.raises(ValueError,match='altéré'):runner.run(session='bad',resume=True)


def test_skills_delegation_and_queue_do_not_escalate_or_replay(tmp_path):
    catalog=load_skills(ROOT/'harness/competences',f)
    assert f.select_skills(catalog,'relire note')[0]['id']=='relire'
    parent={'turns':5,'tools':2,'allowed':['calculer']};requested={'turns':8,'tools':4,'allowed':['calculer','ecrire_fichier']}
    result=delegate(parent,requested,'Calculer',ScriptedModel([action('calculer',{'expression':'3+4'}),{'type':'final','text':'7'}]),Tools(tmp_path,f),f)
    assert result['budget']['allowed']==['calculer'] and result['remaining']['tools']==1
    jobs=[{'id':'a','due':1,'state':'pending','task':'x'},{'id':'b','due':1,'state':'running','task':'y'}];calls=[]
    run_due(jobs,2,lambda task:calls.append(task) or 'done',f);run_due(jobs,2,lambda task:calls.append(task),f)
    assert calls==['x'] and jobs[1]['state']=='running'


@contextmanager
def http_fixture(callback):
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            code,payload,headers=callback(self.path,body)
            raw=json.dumps(payload).encode();self.send_response(code)
            for key,value in headers.items():self.send_header(key,value)
            self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
        def log_message(self,*args):pass
    host=ThreadingHTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=host.serve_forever,daemon=True);thread.start()
    try:yield f'http://127.0.0.1:{host.server_port}'
    finally:host.shutdown();host.server_close();thread.join(timeout=3)


def test_model_api_checks_origin_contract_and_clipping():
    for url in ['http://example.org/generer','http://192.168.0.1/generer','http://u:secret@127.0.0.1/generer']:
        with pytest.raises(ValueError):LocalAPIModel(url)
    with http_fixture(lambda path,body:(200,{'format':'afz-generation-v1','text':'{"type":"final","text":"ok"}','context_tokens':10000,'unknown_prompt_characters':0,'checkpoint_sha256':'a'*64},{})) as base:
        model=LocalAPIModel(base+'/generer');assert f.parse_action(model.complete([f.message('user','x')],[],1))['text']=='ok'
    with http_fixture(lambda path,body:(200,{'format':'afz-generation-v1','text':'x','context_tokens':1,'unknown_prompt_characters':0},{})) as base:
        with pytest.raises(ValueError,match='contexte'):LocalAPIModel(base+'/generer').complete([f.message('user','long')],[],1)
    with http_fixture(lambda path,body:(302,{}, {'Location':'https://example.org/'})) as base:
        with pytest.raises(ConnectionError):LocalAPIModel(base+'/generer').complete([f.message('user','x')],[],1)


def test_gateway_auth_and_idempotency():
    from harness.passerelle import server
    calls=[];token='test-only-token-'+'x'*32
    host=server(lambda task:calls.append(task) or {'status':'finished','answer':task},token,port=0)
    thread=threading.Thread(target=host.serve_forever,daemon=True);thread.start()
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    def call(task='x',auth=True,key='one',origin=None):
        headers={'Content-Type':'application/json','Idempotency-Key':key}
        if auth:headers['Authorization']='Bearer '+token
        if origin:headers['Origin']=origin
        request=urllib.request.Request(f'http://127.0.0.1:{host.server_port}/run',data=json.dumps({'task':task}).encode(),headers=headers)
        try:
            with opener.open(request,timeout=3) as r:return r.status,json.loads(r.read())
        except urllib.error.HTTPError as error:return error.code,json.loads(error.read())
    try:
        assert call(auth=False)[0]==401
        assert call(origin='https://example.org')[0]==403
        assert call()[0]==200 and call()[0]==200 and calls==['x']
        assert call('other')[0]==409
    finally:host.shutdown();host.server_close();thread.join(timeout=3)


def test_real_checkpoint_and_masked_training(tmp_path):
    from model.transformer import GPTConfig,TinyGPT
    from model.tokenizer import CharTokenizer
    from model.gpt_train import save_checkpoint,load_checkpoint
    from harness.entrainer_controleur import train
    tokenizer=CharTokenizer('JSON[]systemuserassistant :\nx23456789+{}"typefinalok')
    model=TinyGPT(GPTConfig(vocab_size=tokenizer.vocab_size,d_model=8,n_heads=2,n_layers=1,block_size=128))
    checkpoint=tmp_path/'base.npz';save_checkpoint(checkpoint,model,tokenizer,{})
    adapter=RepoCheckpointModel(ROOT,checkpoint,max_new_tokens=2)
    x=np.array([[0,1,2]]);np.testing.assert_array_equal(model.forward(x)[0],adapter.model.forward(x)[0])
    assert isinstance(adapter.complete([f.message('user','x')],[],1),str)
    data={'format':'afz-harness-sft-v1','parts':{name:[{'family':name,'messages':[{'role':'system','content':'JSON'},{'role':'user','content':task}],'answer':'{"type":"final","text":"5"}'}] for name,task in [('train','2+3'),('validation','3+4'),('test','4+5')]}}
    out=tmp_path/'trained.npz';report=train(ROOT,data,out,steps=2,block=128,width=8)
    assert report['parameters_changed']>0 and report['test_measured'] is False
    reloaded,_,_=load_checkpoint(out);assert reloaded.config.block_size==128
    assert np.isfinite(report['validation_after'])


def test_downloaded_project_runs_without_repository(tmp_path):
    shutil.copytree(ROOT/'harness',tmp_path/'harness',ignore=shutil.ignore_patterns('__pycache__'))
    import os
    env=dict(os.environ);env.pop('PYTHONPATH',None)
    result=subprocess.run([sys.executable,'-m','harness.verifier','--module','correction'],cwd=tmp_path,env=env,capture_output=True,text=True,timeout=30)
    assert result.returncode==0,result.stderr
    assert json.loads(result.stdout)['passed']==8
    result=subprocess.run([sys.executable,'-m','harness.evaluer','--module','correction'],cwd=tmp_path,env=env,capture_output=True,text=True,timeout=30)
    assert result.returncode==0,result.stderr
    assert json.loads(result.stdout)['metrics']['passed']==10
    result=subprocess.run([sys.executable,'-m','harness.cli','--module','eleve'],cwd=tmp_path,env=env,capture_output=True,text=True,timeout=10)
    assert result.returncode==2 and 'TP incomplet' in result.stderr
