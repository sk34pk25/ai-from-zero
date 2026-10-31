"""Ajuster un TinyGPT du cours au protocole exact du harness, avec loss masquée.

Le moteur NumPy est celui du dépôt. Les 2 pas d'un test technique ne garantissent
ni JSON valide ni choix d'outil correct : mesurer ensuite avec sonder.py.
"""
from __future__ import annotations
import argparse
from dataclasses import asdict
import hashlib
import json
from pathlib import Path
import sys
from .correction import format_prompt
from .preparer_donnees import validate_dataset


def train(repo, data, out, *, initial=None, steps=20, block=1024, width=16, lr=.001, seed=0):
    import numpy as np
    root=Path(repo).resolve();sys.path.insert(0,str(root))
    from model.gpt_train import AdamW,bind_parameters,load_checkpoint,save_checkpoint
    from model.finetune import masked_loss
    from model.transformer import TinyGPT,GPTConfig
    from model.tokenizer import CharTokenizer
    data=validate_dataset(data);out=Path(out)
    if out.exists():raise FileExistsError('choisir un nouveau checkpoint')
    if type(steps) is not int or not 2<=steps<=100000 or not 0<lr<=.1:raise ValueError('budget ou pas invalide')
    # Alphabet de protocole défini avant validation ; aucun caractère appris depuis le test.
    alphabet='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ éèêàçùôîïûÉÀ.,:;!?()[]{}+-*/=\n"_<>|\\'
    if initial:
        model,tokenizer,_=load_checkpoint(Path(initial));block=model.config.block_size
    else:
        tokenizer=CharTokenizer(alphabet+''.join(format_prompt(row['messages'])+row['answer'] for row in data['parts']['train']))
        model=TinyGPT(GPTConfig(vocab_size=tokenizer.vocab_size,d_model=width,n_heads=2,n_layers=1,block_size=block,seed=seed))
    prepared={}
    for split in ['train','validation']:
        prepared[split]=[]
        for row in data['parts'][split]:
            prefix=tokenizer.encode(format_prompt(row['messages']));answer=tokenizer.encode(row['answer']+'\n')
            ids=prefix+answer
            if len(ids)-1>block:raise ValueError('fenêtre insuffisante : aucune troncature silencieuse des réponses')
            mask=np.array([[i+1>=len(prefix) for i in range(len(ids)-1)]],dtype=float)
            prepared[split].append((np.array([ids],dtype=np.int64),mask))
    params=bind_parameters(model);optimizer=AdamW(params,lr=lr);rng=np.random.default_rng(seed)
    before={key:value.copy() for key,value in model.params.items()}
    def loss_on(split):
        total=0.;count=0
        for ids,mask in prepared[split]:
            total+=float(masked_loss(params,ids,mask,model.config).data)*float(mask.sum());count+=float(mask.sum())
        return total/count
    initial_val=loss_on('validation');losses=[]
    for _ in range(steps):
        ids,mask=prepared['train'][int(rng.integers(len(prepared['train'])))];
        for tensor in params.values():tensor.zero_grad()
        loss=masked_loss(params,ids,mask,model.config)
        if not np.isfinite(float(loss.data)):raise ValueError('loss non finie')
        loss.backward();optimizer.step(clip=1.);losses.append(float(loss.data))
    report={'format':'afz-harness-training-v1','steps':steps,'seed':seed,'config':asdict(model.config),'initial_checkpoint_sha256':hashlib.sha256(Path(initial).read_bytes()).hexdigest() if initial else None,'validation_before':initial_val,'validation_after':loss_on('validation'),'train_losses':losses,'parameters_changed':sum(not np.array_equal(before[key],value) for key,value in model.params.items()),'test_measured':False,'data_sha256':hashlib.sha256(json.dumps(data,sort_keys=True,ensure_ascii=False).encode()).hexdigest(),'limit':'Perte masquée en nats par token de réponse. Le test reste réservé ; une baisse de loss ne garantit pas un agent autonome.'}
    save_checkpoint(out,model,tokenizer,report)
    return report

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--repo',required=True);p.add_argument('--data',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--initial',type=Path);p.add_argument('--steps',type=int,default=20);p.add_argument('--block',type=int,default=1024);p.add_argument('--width',type=int,default=16);p.add_argument('--lr',type=float,default=.001);p.add_argument('--seed',type=int,default=0);a=p.parse_args()
    print(json.dumps(train(a.repo,json.loads(a.data.read_text(encoding='utf-8')),a.out,initial=a.initial,steps=a.steps,block=a.block,width=a.width,lr=a.lr,seed=a.seed),ensure_ascii=False,indent=2))
