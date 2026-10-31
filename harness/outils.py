"""Outils déterministes : espace de travail choisi et commandes fixes."""
from pathlib import Path
import json

WRITES = {"ecrire_fichier"}
READ_ONLY = {"calculer", "lire_fichier", "chercher", "diagnostic"}

class Tools:
    def __init__(self, root, functions, allowed=None, documents=None):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.functions = functions
        self.allowed = set(READ_ONLY | WRITES if allowed is None else allowed)
        self.documents = list(documents or [])
        if len(self.documents) > 100: raise ValueError("100 documents au maximum")

    def prepare(self, action):
        name = action["name"]
        if name not in self.allowed: raise PermissionError("outil absent des permissions")
        args = self.functions.validate_args(name, action["arguments"])
        if name in {"lire_fichier", "ecrire_fichier"}:
            target = self.functions.safe_path(self.root, args["path"])
            if name in WRITES and target.exists(): raise FileExistsError("création seulement : le fichier existe déjà")
        return args

    def preview(self, action):
        args = self.prepare(action)
        return {"name": action["name"], "arguments": args, "effect": "création d'un nouveau fichier" if action["name"] in WRITES else "lecture/calcul", "key": self.functions.call_key(action)}

    def execute(self, action):
        args = self.prepare(action)  # Vérifier de nouveau après l'attente d'approbation.
        name = action["name"]
        if name == "calculer": return {"value": self.functions.calculate(args["expression"])}
        if name == "lire_fichier":
            path = self.functions.safe_path(self.root, args["path"])
            with path.open("rb") as handle: data = handle.read(8001)
            if len(data) > 8000: raise ValueError("fichier supérieur à 8000 octets")
            return {"path": args["path"], "text": data.decode("utf-8"), "source": "workspace"}
        if name == "ecrire_fichier":
            path = self.functions.safe_path(self.root, args["path"])
            if not path.parent.is_dir(): raise ValueError("le dossier parent doit déjà exister")
            with path.open("x", encoding="utf-8") as handle: handle.write(args["content"])
            return {"path": args["path"], "created": True}
        if name == "chercher":
            words = set(args["query"].casefold().split())
            rows = [{"id":str(row["id"]),"source":str(row["source"]),"text":str(row["text"])[:1000],"score":len(words & set(str(row["text"]).casefold().split()))} for row in self.documents]
            return {"documents": sorted([row for row in rows if row["score"]],key=lambda row:(-row["score"],row["id"]))[:3]}
        if name == "diagnostic":
            import subprocess
            import sys
            argv = [sys.executable, "--version"] if args["preset"] == "python_version" else [sys.executable, "-I", "-c", "import platform; print(platform.system())"]
            completed = subprocess.run(argv, shell=False, timeout=5, capture_output=True, text=True, cwd=self.root)
            return {"returncode": completed.returncode, "stdout": completed.stdout[:1000], "stderr": completed.stderr[:1000]}
        raise ValueError("outil inconnu")
