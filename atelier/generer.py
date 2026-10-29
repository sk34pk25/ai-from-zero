"""Utiliser TON checkpoint : CLI, puis serveur facultatif sur 127.0.0.1."""

import argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from pathlib import Path
import time
import numpy as np
from commun import charger, module_eleve, empreinte
from entrainer import ids_couverts


def generer(
    module, checkpoint, prompt, tokens=80, seed=0, temperature=0.7, top_k=5, stop="\n"
):
    if not isinstance(prompt, str) or not prompt or len(prompt) > 8192:
        raise ValueError("Invite non vide, au plus 8192 caractères")
    if type(tokens) is not int or not 1 <= tokens <= 1024 or type(seed) is not int:
        raise ValueError("Longueur de 1 à 1024 tokens et graine entière requises")
    if (
        isinstance(temperature, bool)
        or not isinstance(temperature, (int, float))
        or not np.isfinite(temperature)
        or temperature < 0
    ):
        raise ValueError("Température finie et positive ou nulle requise")
    if top_k is not None and (type(top_k) is not int or top_k < 1):
        raise ValueError("top_k entier positif ou null")
    if not isinstance(stop, str) or len(stop) > 100:
        raise ValueError("Critère d'arrêt invalide")
    m = module_eleve(module)
    p, vocab, c, metadata = charger(checkpoint, avec_metadata=True)
    provenance = metadata.get("provenance")
    if provenance and (
        provenance["code_sha256"] != empreinte(m.__file__)
        or provenance["moteur_sha256"]
        != empreinte(Path(__file__).with_name("moteur.py"))
    ):
        raise ValueError("Le code ou le moteur diffère de celui du checkpoint")
    ids, unknown = ids_couverts(m, prompt, vocab)
    context = ids[-c["block"] :].tolist()
    for v in p.values():
        v.requires_grad = False
        v.grad = None
    rng = np.random.default_rng(seed)
    generated = []
    start = time.perf_counter()
    reason = "limite de longueur"
    for _ in range(tokens):
        z = m.logits(np.array([context[-c["block"] :]]), p, c).data[0, -1]
        token = m.prochain(
            z,
            rng,
            temperature=temperature,
            top_k=min(top_k, len(vocab)) if top_k is not None else None,
        )
        generated.append(token)
        context.append(token)
        text = m.decoder(generated, vocab)
        if stop and stop in text:
            text = text.split(stop, 1)[0]
            reason = "critère d'arrêt"
            break
    seconds = time.perf_counter() - start
    return {
        "format": "afz-generation-v1",
        "prompt": prompt,
        "text": text,
        "seed": seed,
        "generated_tokens": len(generated),
        "seconds": seconds,
        "tokens_per_second": len(generated) / max(seconds, 1e-9),
        "unknown_prompt_characters": unknown,
        "context_tokens": c["block"],
        "stop_reason": reason,
        "checkpoint_sha256": empreinte(checkpoint),
        "provenance_verified": bool(provenance),
        "limite": "Sortie d'un petit modèle pédagogique ; vérifier son contenu.",
    }


def serveur(module, checkpoint, port=8765):
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            try:
                if self.path != "/generer":
                    self.send_error(404)
                    return
                origin = self.headers.get("Origin")
                if origin and origin not in (
                    f"http://127.0.0.1:{self.server.server_port}",
                    f"http://localhost:{self.server.server_port}",
                ):
                    self.send_error(403)
                    return
                size = int(self.headers.get("Content-Length", "0"))
                if (
                    not 0 < size <= 16384
                    or self.headers.get_content_type() != "application/json"
                ):
                    raise ValueError("JSON de 1 à 16384 octets requis")
                payload = json.loads(self.rfile.read(size))
                if not isinstance(payload, dict) or set(payload) - {
                    "prompt",
                    "tokens",
                    "seed",
                    "temperature",
                    "top_k",
                    "stop",
                }:
                    raise ValueError("Champs de génération invalides")
                result = generer(module, checkpoint, **payload)
                self.send_response(200)
            except (ValueError, TypeError, KeyError) as e:
                result = {"error": str(e)}
                self.send_response(400)
            data = json.dumps(result, ensure_ascii=False).encode("utf-8")
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *_):
            pass  # Ne pas enregistrer les invites.

    return HTTPServer(("127.0.0.1", port), Handler)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--module", default="eleve")
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--prompt", default="le ")
    parser.add_argument("--tokens", type=int, default=80)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--temperature", type=float, default=0.7)
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--stop", default="\n")
    parser.add_argument("--serve", action="store_true")
    parser.add_argument("--port", type=int, default=8765)
    a = parser.parse_args()
    if a.serve:
        server = serveur(a.module, a.checkpoint, a.port)
        print(f"API locale : http://127.0.0.1:{server.server_port}/generer", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()
    else:
        print(
            json.dumps(
                generer(
                    a.module,
                    a.checkpoint,
                    a.prompt,
                    a.tokens,
                    a.seed,
                    a.temperature,
                    a.top_k,
                    a.stop,
                ),
                ensure_ascii=False,
                indent=2,
            )
        )
