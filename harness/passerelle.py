"""Passerelle HTTP locale authentifiée, sans envoi vers une messagerie."""
from __future__ import annotations
import argparse
import hmac
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import json
import os
import threading
from .correction import validate_request


def server(run, token, port=8790):
    if not isinstance(token,str) or len(token)<32:raise ValueError('jeton local d’au moins 32 caractères requis')
    lock=threading.Lock();completed={}
    class Handler(BaseHTTPRequestHandler):
        def reply(self,status,value):
            raw=json.dumps(value,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
        def do_POST(self):
            self.connection.settimeout(5)
            auth=self.headers.get('Authorization','')
            if not hmac.compare_digest(auth,'Bearer '+token):self.reply(401,{'error':'authentification requise'});return
            if self.path!='/run':self.reply(404,{'error':'route inconnue'});return
            if self.headers.get('Origin'):self.reply(403,{'error':'appel intersite refusé'});return
            key=self.headers.get('Idempotency-Key','')
            if not key or len(key)>80 or not all(c.isalnum() or c in '_-' for c in key):self.reply(400,{'error':'Idempotency-Key requise'});return
            try:
                size=int(self.headers.get('Content-Length','0'))
                if not 0<size<=16384 or self.headers.get_content_type()!='application/json':raise ValueError('taille ou type invalide')
                task=validate_request(json.loads(self.rfile.read(size)))
            except (ValueError,UnicodeDecodeError,TimeoutError):self.reply(400,{'error':'requête invalide'});return
            if not lock.acquire(blocking=False):self.reply(409,{'error':'agent occupé'});return
            try:
                if key in completed:
                    before,result=completed[key]
                    if before!=task:self.reply(409,{'error':'clé déjà utilisée pour une autre tâche'});return
                else:
                    if len(completed)>=100:self.reply(503,{'error':'100 requêtes conservées : redémarrer explicitement la passerelle'});return
                    result=run(task);completed[key]=(task,result)
                self.reply(200,result)
            except Exception:self.reply(500,{'error':'exécution interrompue ; consulter le journal local'})
            finally:lock.release()
        def log_message(self,*args):pass
    return ThreadingHTTPServer(('127.0.0.1',port),Handler)


def main():
    import importlib
    from .coeur import Runner
    from .outils import Tools,READ_ONLY
    from .modeles import LocalAPIModel
    from .stockage import SQLiteStore
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--module',choices=['eleve','correction'],default='eleve');p.add_argument('--endpoint',required=True);p.add_argument('--api-mode',choices=['atelier','chat'],default='atelier');p.add_argument('--port',type=int,default=8790);p.add_argument('--workspace',default='workspace');p.add_argument('--state-db',default='donnees/sessions.sqlite');a=p.parse_args()
    functions=importlib.import_module('harness.'+a.module)
    from pathlib import Path
    if Path(a.state_db).resolve().is_relative_to(Path(a.workspace).resolve()):p.error('la base doit rester hors du workspace')
    model=LocalAPIModel(a.endpoint,mode=a.api_mode)
    def execute(task):return Runner(model,Tools(a.workspace,functions,allowed=READ_ONLY),functions,SQLiteStore(a.state_db)).run(task)
    host=server(execute,os.environ.get('HARNESS_TOKEN',''),a.port)
    print(f'Passerelle locale : http://127.0.0.1:{host.server_port}/run',flush=True)
    try:host.serve_forever()
    except KeyboardInterrupt:pass
    finally:host.server_close()

if __name__=='__main__':main()
