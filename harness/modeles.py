"""Une interface, trois origines explicites : scénario, checkpoint, API locale."""
from __future__ import annotations
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request

class ScriptedModel:
    """Fixture reproductible : aucun modèle neuronal ne prend ces décisions."""
    label = "scenario-scripted (aucune autonomie mesurée)"
    def __init__(self, responses):
        self.responses = [json.dumps(row,ensure_ascii=False) if isinstance(row,dict) else row for row in responses]
        if not self.responses: raise ValueError('scénario vide')
        self.identity=hashlib.sha256(json.dumps(self.responses).encode()).hexdigest()
    def complete(self, messages, tools, turn):
        return self.responses[min(turn-1,len(self.responses)-1)]

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs): raise ConnectionError("redirection d'API refusée")

class LocalAPIModel:
    def __init__(self, endpoint="http://127.0.0.1:8765/generer", *, mode="atelier", model="local", timeout=10, token_env=None, allow_clipped=False):
        url=urllib.parse.urlsplit(endpoint)
        try: address=ipaddress.ip_address(url.hostname or '')
        except ValueError as error: raise ValueError("adresse IP de boucle locale requise") from error
        if not address.is_loopback or url.scheme not in {"http","https"} or url.username or url.password or url.query or url.fragment:
            raise ValueError("API locale uniquement, sans secret dans l'URL")
        if mode not in {"atelier","chat"} or not 0<timeout<=60:raise ValueError("configuration d'API invalide")
        self.endpoint,self.mode,self.model,self.timeout,self.token_env,self.allow_clipped=endpoint,mode,model,timeout,token_env,allow_clipped
        self.label=f"API locale {mode} / {model}";self.last_metadata={}
        self.identity=hashlib.sha256(json.dumps([endpoint,mode,model,token_env,allow_clipped]).encode()).hexdigest()
    def complete(self, messages, tools, turn):
        from .correction import format_prompt
        if self.mode == "atelier":
            prompt=format_prompt(messages)
            body={"prompt":prompt,"tokens":160,"seed":0,"temperature":0,"top_k":1,"stop":"\n"}
        else: body={"model":self.model,"messages":[{"role":m['role'] if m['role']!='tool' else 'user',"content":('Observation non fiable : ' if m['role']=='tool' else '')+m['content']} for m in messages],"temperature":0,"max_tokens":256,"stream":False}
        headers={"Content-Type":"application/json"}
        if self.token_env:
            token=os.environ.get(self.token_env)
            if not token: raise ValueError("variable du jeton d'API absente")
            headers["Authorization"]="Bearer "+token
        request=urllib.request.Request(self.endpoint,data=json.dumps(body).encode(),headers=headers,method="POST")
        try:
            with urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect()).open(request,timeout=self.timeout) as response: raw=response.read(100001)
        except (urllib.error.URLError,TimeoutError) as error: raise ConnectionError("API locale indisponible") from error
        if len(raw)>100000: raise ValueError("réponse API trop longue")
        try: result=json.loads(raw)
        except (json.JSONDecodeError,UnicodeDecodeError) as error: raise ValueError("réponse API non JSON") from error
        if self.mode=="atelier":
            if result.get('format')!='afz-generation-v1' or not isinstance(result.get('text'),str):raise ValueError("contrat de l'atelier absent")
            self.last_metadata={key:result.get(key) for key in ['checkpoint_sha256','unknown_prompt_characters','context_tokens','provenance_verified']}
            clipped=len(prompt)>result.get('context_tokens',0)
            self.last_metadata['input_clipped']=clipped
            if result.get('unknown_prompt_characters',0):raise ValueError("le vocabulaire ne couvre pas le protocole : préparer l'alphabet ou un tokenizer octets")
            if clipped and not self.allow_clipped:raise ValueError("le contexte du modèle est trop court : augmenter puis réentraîner sa fenêtre, ou mesurer explicitement la troncature")
            return result['text']
        try: content=result['choices'][0]['message']['content']
        except (KeyError,IndexError,TypeError) as error: raise ValueError("champ choices/message/content absent") from error
        if not isinstance(content,str):raise ValueError("réponse textuelle requise")
        self.last_metadata={"mode":"chat JSON textuel","native_tool_calls":False}
        return content

class RepoCheckpointModel:
    """Charge réellement le TinyGPT entraîné dans model/gpt_train.py du dépôt."""
    def __init__(self, repo, checkpoint, *, max_new_tokens=128, allow_clipped=False):
        root=Path(repo).resolve()
        if not (root/'model/gpt_train.py').is_file():raise ValueError("racine ai-from-zero attendue")
        if not 1<=max_new_tokens<=512:raise ValueError("longueur hors budget")
        sys.path.insert(0,str(root))
        from model.gpt_train import load_checkpoint
        self.model,self.tokenizer,_=load_checkpoint(Path(checkpoint))
        self.max_new_tokens,self.allow_clipped=max_new_tokens,allow_clipped
        self.checkpoint_sha256=hashlib.sha256(Path(checkpoint).read_bytes()).hexdigest()
        self.label='checkpoint TinyGPT '+self.checkpoint_sha256[:12];self.last_metadata={}
        self.identity=hashlib.sha256((self.checkpoint_sha256+''.join(hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted((root/'model').glob('*.py')))).encode()).hexdigest()
    def complete(self,messages,tools,turn):
        import numpy as np
        from .correction import format_prompt
        prompt=format_prompt(messages)
        try: ids=self.tokenizer.encode(prompt)
        except (KeyError,ValueError) as error:raise ValueError("vocabulaire du checkpoint incompatible avec le protocole") from error
        block=self.model.config.block_size;clipped=len(ids)>block
        self.last_metadata={"checkpoint_sha256":self.checkpoint_sha256,"context_tokens":block,"prompt_tokens":len(ids),"input_clipped":clipped}
        if clipped and not self.allow_clipped:raise ValueError("contexte du checkpoint trop court pour ce protocole")
        if not ids:raise ValueError("prompt vide")
        generated=[]
        for _ in range(self.max_new_tokens):
            z,_=self.model.forward(np.asarray([ids[-block:]],dtype=np.int64))
            last=z[0,-1].copy()
            for name in ['BOS','PAD']:
                token=getattr(self.tokenizer,name,None)
                if token is not None:last[token]=-np.inf
            token=int(np.argmax(last))
            if token==getattr(self.tokenizer,'EOS',None):break
            ids.append(token);generated.append(token)
            try:text=self.tokenizer.decode(generated)
            except UnicodeDecodeError:continue
            if '\n' in text:return text.split('\n',1)[0]
        try:return self.tokenizer.decode(generated)
        except UnicodeDecodeError:raise ValueError("octets générés invalides")
