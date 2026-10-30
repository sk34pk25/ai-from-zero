#!/usr/bin/env python3
"""Résume des dossiers consentis. Des déclarations ne sont pas une certification."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def fingerprint(value: str) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def summarize(reports: list[dict], catalog: dict) -> dict:
    tasks = {row['id']:row for row in catalog['tasks']}
    rows, duplicates, unknown = {}, 0, 0
    for report in reports:
        if not isinstance(report,dict) or report.get('format') != 'afz-comprehension-v1' or not isinstance(report.get('attempts'),list):
            raise ValueError('Dossier de compréhension non reconnu')
        for row in report['attempts']:
            if not isinstance(row,dict) or not isinstance(row.get('id'),str):raise ValueError('Tentative invalide')
            if row.get('taskId') not in tasks:unknown += 1; continue
            if row['id'] in rows:
                if rows[row['id']] != row:raise ValueError('Deux versions différentes de la même tentative : conserver la version finale explicitement')
                duplicates += 1; continue
            rows[row['id']] = row
    stages = {task['stage']:{'stage':task['stage'],'attempts':0,'finished':0,'abandoned':0,'current_code_passed':0,'observer_reviews_declared':0,'self_reviews':0,'autonomy_observed_declared':0,'stale_reviews':0} for task in tasks.values()}
    aliases = set(); versions = set()
    for row in rows.values():
        task = tasks[row['taskId']]; stats = stages[task['stage']]; stats['attempts'] += 1
        if isinstance(row.get('alias'),str) and row['alias'].strip():aliases.add(row['alias'].strip())
        if isinstance(row.get('siteVersion'),str):versions.add(row['siteVersion'])
        last_event = row.get('events',[])[-1:] or [{}]
        finished = last_event[0].get('type') == 'finish'
        stats['finished'] += finished
        stats['abandoned'] += last_event[0].get('type') == 'abandon'
        code = row.get('code','')
        if not isinstance(code,str):raise ValueError('Code non textuel')
        checks = row.get('checks',[])
        check = checks[-1] if checks else {}
        passed = check.get('ok') is True and check.get('codeHash') == fingerprint(code) and check.get('validatorVersion') == task['validatorVersion']
        stats['current_code_passed'] += passed
        review = row.get('review')
        if review is None:continue
        if not isinstance(review,dict):raise ValueError('Relecture invalide')
        snapshot = json.dumps([code,row.get('diagnosis',''),row.get('explanation','')],ensure_ascii=False,separators=(',',':'))
        scores = review.get('scores',[])
        valid = finished and review.get('contentHash') == fingerprint(snapshot) and len(scores)==3 and all(type(score) is int and 0<=score<=2 for score in scores) and isinstance(review.get('evidence'),str) and bool(review['evidence'].strip())
        if not valid:stats['stale_reviews'] += 1;continue
        if review.get('type') == 'self':stats['self_reviews'] += 1
        elif review.get('type') == 'observer' and str(review.get('by','')).strip():
            stats['observer_reviews_declared'] += 1
            # Une aide révélée lors d’un contrôle reste une aide, même décochée ensuite.
            aids = set(row.get('assistance',[])) | set(row.get('revealed',[])) | {aid for c in checks for aid in c.get('assistance',[])}
            stats['autonomy_observed_declared'] += passed and not aids and scores==[2,2,2]
    return {'format':'afz-observation-summary-v1','catalog_version':catalog['version'],'attempts':len(rows),'distinct_aliases':len(aliases),'duplicates_ignored':duplicates,'unknown_tasks_ignored':unknown,'site_versions':sorted(versions),'stages':list(stages.values()),'limit':'Observations déclarées dans les dossiers fournis, sans vérification d’identité ni certification. Plusieurs tentatives d’un même alias ne sont pas plusieurs apprenants.'}


def markdown(report: dict) -> str:
    lines = ['# Bilan des observations déclarées','',f"{report['attempts']} tentative(s), {report['distinct_aliases']} alias distinct(s). Les essais sans alias ne permettent pas de compter des personnes.",'','| Palier | Tentatives | Terminées | Abandons | Code courant validé | Relectures par tiers | Autonomie déclarée observée |','| --- | --- | --- | --- | --- | --- | --- |']
    for row in report['stages']:
        lines.append('| '+ ' | '.join(str(row[key]) for key in ['stage','attempts','finished','abandoned','current_code_passed','observer_reviews_declared','autonomy_observed_declared'])+' |')
    if not sum(row['observer_reviews_declared'] for row in report['stages']):lines += ['', 'Aucune observation humaine exploitable dans les dossiers fournis.']
    lines += ['',report['limit'],'','Un échec, un abandon, une autoévaluation ou une relecture périmée ne deviennent jamais une observation autonome réussie. Les effectifs sont des tentatives ; examiner les traces et les participants avant toute généralisation.']
    return '\n'.join(lines)+'\n'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('dossiers',nargs='*',type=Path)
    parser.add_argument('--format',choices=['markdown','json'],default='markdown')
    args=parser.parse_args()
    reports=[]
    for path in args.dossiers:
        if path.stat().st_size>10_000_000:parser.error('Dossier trop volumineux')
        reports.append(json.loads(path.read_text(encoding='utf-8')))
    report=summarize(reports,json.loads((ROOT/'data/transfer-tasks.json').read_text(encoding='utf-8')))
    print(json.dumps(report,ensure_ascii=False,indent=2) if args.format=='json' else markdown(report),end='\n' if args.format=='json' else '')


if __name__=='__main__':main()
