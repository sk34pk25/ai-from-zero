"""Interface de ton harness. Depuis le projet décompressé : python -m harness.cli --help."""
from __future__ import annotations
import argparse
import importlib
import json
from pathlib import Path
from .coeur import Runner
from .modeles import ScriptedModel, LocalAPIModel, RepoCheckpointModel
from .outils import Tools,READ_ONLY
from .stockage import SQLiteStore


def action(name,arguments,call_id='c1'):
    return {"type":"tool","id":call_id,"name":name,"arguments":arguments}


def demo(name):
    cases={
        'calcul':[action('calculer',{'expression':'(8+4)*3'}),{'type':'final','text':'36'}],
        'erreur':['{invalide',action('calculer',{'expression':'7-2'}),{'type':'final','text':'5'}],
        'ecriture':[action('ecrire_fichier',{'path':'resultat.txt','content':'Exemple approuvé.\n'}),{'type':'final','text':'Fichier créé.'}],
        'refus':[action('lire_fichier',{'path':'../secret.txt'})],
        'boucle':[action('calculer',{'expression':'1+1'})],
    }
    return ScriptedModel(cases[name])


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--module',default='eleve',choices=['eleve','correction'])
    parser.add_argument('--demo',choices=['calcul','erreur','ecriture','refus','boucle'],default='calcul')
    parser.add_argument('--task',default='Calcule (8+4)*3 et vérifie le résultat.')
    parser.add_argument('--endpoint');parser.add_argument('--api-mode',choices=['atelier','chat'],default='atelier')
    parser.add_argument('--model',default='local');parser.add_argument('--token-env')
    parser.add_argument('--repo');parser.add_argument('--checkpoint')
    parser.add_argument('--allow-clipped',action='store_true',help='Expérience explicite : accepter et journaliser une troncature du prompt')
    parser.add_argument('--workspace',type=Path,default=Path('workspace'))
    parser.add_argument('--state-db',type=Path,default=Path('donnees/sessions.sqlite'))
    parser.add_argument('--session');parser.add_argument('--resume',action='store_true')
    parser.add_argument('--turns',type=int,default=8);parser.add_argument('--tools',type=int,default=4)
    parser.add_argument('--allow-write',action='store_true',help='Proposer les créations, avec confirmation distincte pour chaque action')
    parser.add_argument('--out',type=Path)
    args=parser.parse_args(argv)
    if args.state_db.resolve().is_relative_to(args.workspace.resolve()):parser.error('la base doit rester hors du workspace accessible aux outils')
    if args.endpoint and args.checkpoint:parser.error('choisir une origine du modèle')
    if bool(args.repo)!=bool(args.checkpoint):parser.error('--repo et --checkpoint vont ensemble')
    functions=importlib.import_module('harness.'+args.module)
    model=LocalAPIModel(args.endpoint,mode=args.api_mode,model=args.model,token_env=args.token_env,allow_clipped=args.allow_clipped) if args.endpoint else RepoCheckpointModel(args.repo,args.checkpoint,allow_clipped=args.allow_clipped) if args.checkpoint else demo(args.demo)
    tools=Tools(args.workspace,functions,allowed=READ_ONLY|({'ecrire_fichier'} if args.allow_write else set()))
    def approve(preview):
        print('Proposition exacte : '+json.dumps(preview,ensure_ascii=False))
        return input('Créer ce fichier ? Taper oui : ').strip().casefold()=='oui'
    runner=Runner(model,tools,functions,SQLiteStore(args.state_db),turns=args.turns,tool_limit=args.tools)
    try:report=runner.run(args.task,session=args.session,resume=args.resume,approve=approve if args.allow_write else None)
    except NotImplementedError as error:parser.exit(2,'TP incomplet : '+str(error)+'\n')
    except (ValueError,OSError) as error:parser.exit(2,str(error)+'\n')
    raw=json.dumps(functions.export_trace(report),ensure_ascii=False,indent=2)
    if args.out:
        with args.out.open('x',encoding='utf-8') as handle:handle.write(raw+'\n')
    print(raw)
    return 0 if report['status']=='finished' else 1

if __name__=='__main__':raise SystemExit(main())
