"""Écritures atomiques et empreintes ; copie autonome distribuée dans l’atelier."""

import hashlib
import json
import os
from pathlib import Path
import tempfile
import unicodedata


def empreinte(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def empreinte_texte(text):
    text = unicodedata.normalize("NFC", text.replace("\r\n", "\n").replace("\r", "\n"))
    return hashlib.sha256((text.strip() + "\n").encode("utf-8")).hexdigest()


def sortie_sure(path, entrees=(), remplacer=False):
    """Vérifier AVANT le calcul et l'écriture ; les sources restent protégées."""
    path = Path(path)
    if any(path.resolve() == Path(p).resolve() for p in entrees):
        raise ValueError("La sortie désigne une entrée protégée")
    if path.exists() and not remplacer:
        raise FileExistsError("La sortie existe déjà : choisis un nouveau fichier")
    return path


def ecriture_atomique(path, writer, remplacer=False):
    path = sortie_sure(path, remplacer=remplacer)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".afz-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            writer(stream)
            stream.flush()
            os.fsync(stream.fileno())
        if remplacer:
            os.replace(temporary, path)
        else:
            # link est exclusif : un fichier créé entre-temps n'est pas écrasé.
            os.link(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def ecrire_json(path, value, entrees=()):
    path = sortie_sure(path, entrees)
    if path.suffix.lower() != ".json":
        raise ValueError("Un rapport doit avoir l'extension .json")
    data = (
        json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    ).encode("utf-8")
    ecriture_atomique(path, lambda f: f.write(data))
