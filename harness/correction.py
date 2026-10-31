"""Référence des huit TP. Construis les mêmes contrats dans eleve.py.

Aucun framework d'agent, aucun eval de texte et aucune clé réseau.
"""
from __future__ import annotations
import ast
import hashlib
import json
import math
import operator
import re
from pathlib import Path


def message(role, content):
    if role not in {"system", "user", "assistant", "tool"} or not isinstance(content, str):
        raise ValueError("rôle ou contenu invalide")
    return {"role": role, "content": content}


def parse_action(raw):
    if not isinstance(raw, str) or len(raw) > 12000:
        raise ValueError("réponse absente ou trop longue")
    def pairs(rows):
        result = {}
        for key, value in rows:
            if key in result: raise ValueError("clé JSON dupliquée")
            result[key] = value
        return result
    def invalid(value): raise ValueError("nombre JSON non fini")
    try: value = json.loads(raw, object_pairs_hook=pairs, parse_constant=invalid)
    except (json.JSONDecodeError, RecursionError) as error: raise ValueError("JSON strict requis") from error
    if not isinstance(value, dict): raise ValueError("objet JSON requis")
    if value.get("type") == "final":
        if set(value) != {"type", "text"} or not isinstance(value["text"], str) or not value["text"].strip():
            raise ValueError("réponse finale invalide")
    elif value.get("type") == "tool":
        if set(value) != {"type", "id", "name", "arguments"} or not isinstance(value["id"], str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", value["id"]):
            raise ValueError("appel invalide")
        if not isinstance(value["name"], str) or not isinstance(value["arguments"], dict):
            raise ValueError("nom ou arguments invalides")
    else: raise ValueError("type d'action inconnu")
    return value


SCHEMAS = {
    "calculer": {"expression": str},
    "lire_fichier": {"path": str},
    "ecrire_fichier": {"path": str, "content": str},
    "chercher": {"query": str},
    "diagnostic": {"preset": str},
}

def validate_args(name, arguments):
    if name not in SCHEMAS or not isinstance(arguments, dict) or set(arguments) != set(SCHEMAS[name]):
        raise ValueError("outil ou arguments inconnus")
    if any(not isinstance(arguments[key], kind) or len(arguments[key]) > 8000 for key, kind in SCHEMAS[name].items()):
        raise ValueError("type ou taille d'argument invalide")
    if name == "calculer" and len(arguments["expression"]) > 200: raise ValueError("expression trop longue")
    if name == "diagnostic" and arguments["preset"] not in {"python_version", "platform"}: raise ValueError("commande non autorisée")
    return dict(arguments)


def calculate(expression):
    if not isinstance(expression, str) or len(expression) > 200: raise ValueError("expression trop longue")
    try: tree = ast.parse(expression, mode="eval")
    except (SyntaxError, RecursionError) as error: raise ValueError("expression invalide") from error
    if len(list(ast.walk(tree))) > 80: raise ValueError("calcul trop complexe")
    operations = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv, ast.Pow: operator.pow}
    def visit(node):
        if isinstance(node, ast.Constant) and type(node.value) in {int, float}: result = node.value
        elif isinstance(node, ast.UnaryOp) and type(node.op) in {ast.USub, ast.UAdd}:
            result = -visit(node.operand) if isinstance(node.op, ast.USub) else visit(node.operand)
        elif isinstance(node, ast.BinOp) and type(node.op) in operations:
            left, right = visit(node.left), visit(node.right)
            if isinstance(node.op, ast.Pow) and (abs(right) > 8 or abs(left) > 10000): raise ValueError("puissance hors budget")
            try: result = operations[type(node.op)](left, right)
            except (ZeroDivisionError, OverflowError, ValueError) as error: raise ValueError("calcul non défini") from error
        else: raise ValueError("seuls nombres et opérations arithmétiques sont admis")
        if type(result) not in {int, float} or abs(result) > 1e12 or not math.isfinite(result): raise ValueError("résultat hors budget")
        return result
    return visit(tree.body)


def safe_path(root, name):
    root = Path(root).resolve()
    if not isinstance(name, str) or not name or "\\" in name or "\0" in name:
        raise ValueError("chemin relatif requis")
    path = Path(name)
    if path.is_absolute() or ".." in path.parts or not path.parts: raise ValueError("sortie du dossier interdite")
    cursor = root
    for part in path.parts:
        cursor /= part
        if cursor.is_symlink(): raise ValueError("lien symbolique interdit")
    resolved = cursor.resolve()
    if not resolved.is_relative_to(root) or resolved == root: raise ValueError("sortie du dossier interdite")
    return resolved


def stop_reason(turns, calls, limits):
    if any(type(value) is not int or value < 0 for value in [turns, calls]): raise ValueError("compteurs invalides")
    if type(limits.get("turns")) is not int or type(limits.get("tools")) is not int or min(limits.values()) < 1: raise ValueError("limites invalides")
    if turns >= limits["turns"]: return "turn_limit"
    if calls >= limits["tools"]: return "tool_limit"
    return None


def tool_observation(call_id, name, result):
    content=json.dumps(result,ensure_ascii=False,allow_nan=False)
    if len(content)>10000:content=json.dumps({'truncated':True,'preview':content[:9000]},ensure_ascii=False)
    return {"role": "tool", "call_id": call_id, "name": name, "content": content, "trust": "data"}


def call_key(action):
    return hashlib.sha256(json.dumps({"name": action["name"], "arguments": action["arguments"]}, sort_keys=True, ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def context_window(messages, budget, reserve=256):
    """Budget en caractères, pas une estimation prétendument exacte de tokens."""
    if type(budget) is not int or type(reserve) is not int or reserve < 0 or budget <= reserve: raise ValueError("budget de contexte invalide")
    if not messages or messages[0].get("role") != "system": raise ValueError("instruction système absente")
    prefix = messages[:2] if len(messages)>1 and messages[1].get('role')=='user' else messages[:1]
    groups = []
    for row in messages[len(prefix):]:
        if row.get("role") == "tool":
            if not groups or groups[-1][0].get("role") != "assistant": raise ValueError("observation orpheline")
            groups[-1].append(row)
        else: groups.append([row])
    size = lambda rows: len(json.dumps(rows, ensure_ascii=False, separators=(",", ":")))
    kept = []
    if size(prefix) > budget-reserve: raise ValueError("instruction système ou demande initiale trop longue")
    for group in reversed(groups):
        if size([*prefix, *group, *kept]) > budget-reserve:
            if not kept: raise ValueError("dernier échange trop long")
            break
        kept = [*group, *kept]
    return [*prefix, *kept]


def merge_memory(old, new):
    by_key = {}
    for row in [*old, *new]:
        if not isinstance(row, dict) or set(row) != {"key", "value", "source", "at"}: raise ValueError("mémoire sans provenance")
        if any(not isinstance(row[key], str) or len(row[key]) > 2000 for key in ["key", "value", "source"]) or type(row["at"]) not in {int,float} or not math.isfinite(row["at"]): raise ValueError("mémoire invalide")
        if row["key"] not in by_key or row["at"] >= by_key[row["key"]]["at"]: by_key[row["key"]] = dict(row)
    return sorted(by_key.values(), key=lambda row: (row["at"], row["key"]))[-100:]


def event_hash(previous, event):
    return hashlib.sha256((previous + "\n" + json.dumps(event, sort_keys=True, ensure_ascii=False, allow_nan=False)).encode()).hexdigest()


def recover_pending(events):
    pending = {}
    for event in events:
        if event.get("kind") == "tool_started": pending[event["call_id"]] = event
        elif event.get("kind") == "tool_finished": pending.pop(event["call_id"], None)
    return list(pending.values())


def evaluate_case(report, expected):
    """Une assertion exacte ne certifie pas une compréhension générale."""
    return {"status_ok": report.get("status") == expected["status"], "answer_ok": report.get("answer") == expected.get("answer", ""), "no_forbidden_tool": not any(e.get("kind") == "tool_started" and e.get("name") in expected.get("forbidden_tools", []) for e in report.get("events", []))}


def format_prompt(messages):
    return "\n".join(f"[{row['role']}]\n{row['content']}" for row in messages) + "\n[assistant]\n"


def probe_summary(results):
    n = len(results)
    return {"total": n, "valid_json": sum(row.get("valid_json") is True for row in results), "correct_action": sum(row.get("correct_action") is True for row in results), "all_passed": n > 0 and all(row.get("valid_json") is True and row.get("correct_action") is True for row in results)}


def paired_delta(base, variant):
    def by_seed(rows):
        result = {}
        for row in rows:
            if row["seed"] in result: raise ValueError("graine dupliquée")
            result[row["seed"]] = row["score"]
        return result
    a,b = by_seed(base), by_seed(variant)
    if a.keys() != b.keys() or not a: raise ValueError("graines non appariées")
    return [b[seed]-a[seed] for seed in sorted(a)]


def select_skills(catalog, query):
    terms = set(re.findall(r"\w+", query.casefold()))
    ranked = [(len(terms & set(row["keywords"])), row) for row in catalog]
    return [dict(row) for count,row in sorted(ranked,key=lambda x:(-x[0],x[1]["id"])) if count > 0][:3]


def delegation_budget(parent, requested):
    if any(type(x) is not int or x < 0 for x in [parent["turns"], parent["tools"], requested["turns"], requested["tools"]]): raise ValueError("budget invalide")
    return {"turns": min(parent["turns"],requested["turns"]), "tools": min(parent["tools"],requested["tools"]), "allowed": sorted(set(parent["allowed"]) & set(requested["allowed"]))}


def due_jobs(jobs, now):
    return [dict(row) for row in sorted(jobs,key=lambda row:(row["due"],row["id"])) if row.get("state") == "pending" and row["due"] <= now]


def validate_request(value):
    if not isinstance(value,dict) or set(value) != {"task"} or not isinstance(value["task"],str) or not 1 <= len(value["task"].strip()) <= 4000:
        raise ValueError("une tâche textuelle de 1 à 4000 caractères est requise")
    return value["task"].strip()


def export_trace(report):
    fields = ["format", "session", "status", "answer", "turns", "tool_calls", "model", "events", "source_sha256", "elapsed_seconds"]
    return {key: report[key] for key in fields if key in report}


def success_metrics(rows):
    n = len(rows)
    return {"attempts": n, "passed": sum(row.get("ok") is True for row in rows), "success_rate": sum(row.get("ok") is True for row in rows)/n if n else None}
