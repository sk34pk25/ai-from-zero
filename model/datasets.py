"""Catalogue et préparation des jeux de données.

data/datasets.json est la liste vérifiée. Les gros fichiers ne sont pas
versionnés : download et prepare écrivent sous model/data/downloads et
model/data/prepared, avec une attribution à côté du texte nettoyé.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "datasets.json"
DOWNLOADS = ROOT / "model" / "data" / "downloads"
PREPARED = ROOT / "model" / "data" / "prepared"

REQUIRED = (
    "id",
    "name",
    "url",
    "licence",
    "licenceUrl",
    "language",
    "sizeMb",
    "approxChars",
    "format",
    "stage",
    "order",
    "prerequisites",
    "compatibility",
    "teaches",
    "caveats",
    "gated",
    "checkedOn",
)
COMPAT_REQUIRED = ("char", "bpe", "numpyCpu", "pyodide", "needsGpu", "ramMb", "minutes")
STAGES = {1, 2, 3, 4, 5, 6}
USER_AGENT = "ai-from-zero/1.0 (educational; github.com/sk34pk25)"


def load_catalog(path: Path | None = None) -> dict:
    return json.loads((path or CATALOG_PATH).read_text(encoding="utf-8"))


def validate_catalog(data: dict) -> list[str]:
    errors: list[str] = []
    rows = data.get("datasets")
    if not isinstance(rows, list) or not rows:
        return ["datasets doit être une liste non vide"]
    seen: set[str] = set()
    orders: set[int] = set()
    for row in rows:
        if not isinstance(row, dict):
            errors.append("entrée non objet")
            continue
        missing = [key for key in REQUIRED if key not in row]
        if missing:
            errors.append(f"{row.get('id', '?')} : champs manquants {missing}")
            continue
        identifier = row["id"]
        if not isinstance(identifier, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,80}", identifier):
            errors.append(f"id invalide : {identifier!r}")
        if identifier in seen:
            errors.append(f"id dupliqué : {identifier}")
        seen.add(identifier)
        if not str(row["url"]).startswith("https://"):
            errors.append(f"{identifier} : url non https")
        if not str(row["licenceUrl"]).startswith("https://"):
            errors.append(f"{identifier} : licenceUrl non https")
        if row["language"] not in {"fr", "en", "multi"}:
            errors.append(f"{identifier} : langue")
        if not isinstance(row["sizeMb"], (int, float)) or row["sizeMb"] < 0:
            errors.append(f"{identifier} : sizeMb")
        if row["approxChars"] is not None and (not isinstance(row["approxChars"], int) or row["approxChars"] < 0):
            errors.append(f"{identifier} : approxChars")
        if row["stage"] not in STAGES:
            errors.append(f"{identifier} : stage")
        if not isinstance(row["order"], int) or row["order"] < 1 or row["order"] in orders:
            errors.append(f"{identifier} : order")
        else:
            orders.add(row["order"])
        if not isinstance(row["prerequisites"], list) or not isinstance(row["caveats"], list):
            errors.append(f"{identifier} : listes")
        if not isinstance(row["gated"], bool):
            errors.append(f"{identifier} : gated")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(row["checkedOn"])):
            errors.append(f"{identifier} : checkedOn")
        compat = row["compatibility"]
        if not isinstance(compat, dict) or any(key not in compat for key in COMPAT_REQUIRED):
            errors.append(f"{identifier} : compatibility")
        elif not isinstance(compat["minutes"], (int, float)) or compat["minutes"] < 0:
            errors.append(f"{identifier} : minutes")
        if not str(row["licence"]).strip() or not str(row["teaches"]).strip():
            errors.append(f"{identifier} : texte vide")
    known = seen
    for row in rows:
        if not isinstance(row, dict) or "prerequisites" not in row:
            continue
        for need in row["prerequisites"]:
            if need not in known:
                errors.append(f"{row.get('id')} : prérequis inconnu {need}")
    return errors


def dataset_by_id(data: dict, identifier: str) -> dict:
    for row in data["datasets"]:
        if row["id"] == identifier:
            return row
    raise KeyError(identifier)


def clean_text(raw: str) -> str:
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    start = text.find("*** START OF")
    end = text.find("*** END OF")
    if start != -1:
        newline = text.find("\n", start)
        start = 0 if newline < 0 else newline + 1
    else:
        start = 0
    if end == -1:
        end = len(text)
    body = text[start:end]
    body = re.sub(r"[ \t]+\n", "\n", body)
    body = re.sub(r"\n{3,}", "\n\n", body)
    return body.strip() + "\n"


def split_text(text: str, val_ratio: float = 0.1) -> tuple[str, str]:
    if not 0 < val_ratio < 0.5:
        raise ValueError("val_ratio doit être entre 0 et 0.5")
    cut = max(1, min(len(text) - 1, int(len(text) * (1.0 - val_ratio))))
    return text[:cut], text[cut:]


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def download_bytes(url: str, max_bytes: int | None = None) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=120) as response:
        if max_bytes is None:
            return response.read()
        chunks = []
        total = 0
        while total < max_bytes:
            block = response.read(min(1 << 16, max_bytes - total))
            if not block:
                break
            chunks.append(block)
            total += len(block)
        return b"".join(chunks)


def prepare_id(identifier: str, catalog: dict | None = None, max_mb: float | None = None, root: Path | None = None) -> Path:
    data = catalog or load_catalog()
    errors = validate_catalog(data)
    if errors:
        raise ValueError("; ".join(errors[:8]))
    row = dataset_by_id(data, identifier)
    if row["gated"]:
        raise RuntimeError(f"{identifier} est gated : le téléchargement automatique est refusé, voir les caveats")
    if row["format"] in {"parquet", "xml.bz2"}:
        raise RuntimeError(
            f"{identifier} est au format {row['format']} ({row['sizeMb']} Mo). "
            "Le laboratoire ne le décode pas tout seul : prélève un extrait texte en amont, ou entraîne avec un jeu txt/json."
        )
    limit = None if max_mb is None else int(max_mb * 1_000_000)
    payload = download_bytes(row["url"], max_bytes=limit)
    digest = sha256_bytes(payload)
    expected = row.get("sha256")
    if expected and limit is None and digest != expected:
        raise ValueError(f"sha256 inattendu pour {identifier}")
    downloads = DOWNLOADS if root is None else root / "downloads"
    downloads.mkdir(parents=True, exist_ok=True)
    (downloads / f"{identifier}.bin").write_bytes(payload)
    if row["format"] == "jsonl.gz":
        if limit is not None:
            raise RuntimeError("un fichier gzip tronqué ne se décompresse pas : prépare ce jeu en entier")
        import gzip
        text = gzip.decompress(payload).decode("utf-8", errors="replace")
        text = _text_from_jsonl(text)
    else:
        text = payload.decode("utf-8", errors="replace")
        if row["format"] == "json":
            text = _text_from_json(text)
        elif row["format"] == "jsonl":
            text = _text_from_jsonl(text)
    cleaned = clean_text(text)
    if limit is not None and len(cleaned.encode("utf-8")) > limit * 2:
        cleaned = cleaned.encode("utf-8")[:limit].decode("utf-8", errors="ignore")
    train, val = split_text(cleaned)
    destination = (root or PREPARED) / identifier
    destination.mkdir(parents=True, exist_ok=True)
    (destination / "train.txt").write_text(train, encoding="utf-8")
    (destination / "val.txt").write_text(val, encoding="utf-8")
    note = [
        f"# {row['name']}",
        "",
        f"- id : {identifier}",
        f"- source : {row['url']}",
        f"- licence : {row['licence']}",
        f"- licence (texte) : {row['licenceUrl']}",
        f"- vérifié le : {row['checkedOn']}",
        f"- sha256 des octets téléchargés : {digest}",
        f"- caractères après nettoyage : {len(cleaned)}",
        f"- échantillon max-mb : {max_mb if max_mb is not None else 'fichier entier'}",
        "",
        "Le texte brut n'est pas versionné. Relance `python -m model.datasets prepare` pour le reconstruire.",
        "",
    ]
    (destination / "ATTRIBUTION.md").write_text("\n".join(note), encoding="utf-8")
    return destination


def prepared_corpus(identifier: str, root: Path | None = None) -> str:
    folder = (root or PREPARED) / identifier
    train = folder / "train.txt"
    if not train.exists():
        raise FileNotFoundError(f"prépare d'abord le jeu {identifier}")
    val = folder / "val.txt"
    text = train.read_text(encoding="utf-8")
    if val.exists():
        text += val.read_text(encoding="utf-8")
    return text


def _text_from_json(raw: str) -> str:
    payload = json.loads(raw)
    rows = payload if isinstance(payload, list) else payload.get("items", [])
    parts = []
    for row in rows:
        if isinstance(row, str):
            parts.append(row)
        elif isinstance(row, dict):
            bits = [str(row[key]) for key in ("instruction", "input", "output", "question", "answer", "text", "content") if row.get(key)]
            if bits:
                parts.append("\n".join(bits))
    return "\n\n".join(parts) + "\n"


def _text_from_jsonl(raw: str) -> str:
    parts = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        row = json.loads(line)
        if isinstance(row, dict):
            bits = [str(value) for value in row.values() if isinstance(value, str)]
            parts.append("\n".join(bits))
    return "\n\n".join(parts) + "\n"


def _rough_xml(payload: bytes) -> str:
    if payload[:2] == b"BZ" or payload[:3] == b"BZh":
        import bz2
        payload = bz2.decompress(payload)
    text = payload.decode("utf-8", errors="replace")
    text = re.sub(r"<[^>]+>", " ", text)
    return text


def list_rows(data: dict | None = None) -> list[dict]:
    rows = sorted((data or load_catalog())["datasets"], key=lambda row: row["order"])
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Catalogue des jeux de données du laboratoire.")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list")
    download = sub.add_parser("download")
    download.add_argument("id")
    download.add_argument("--max-mb", type=float, default=None)
    prepare = sub.add_parser("prepare")
    prepare.add_argument("id")
    prepare.add_argument("--max-mb", type=float, default=None)
    args = parser.parse_args()
    if args.command == "list":
        for row in list_rows():
            gate = " gated" if row["gated"] else ""
            print(f"{row['order']:02d}  {row['id']}  étape {row['stage']}  {row['language']}  {row['sizeMb']} Mo{gate}")
        return
    destination = prepare_id(args.id, max_mb=args.max_mb)
    print(destination)


if __name__ == "__main__":
    main()
