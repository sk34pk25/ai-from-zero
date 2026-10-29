"""Contrôles publics : python verifier.py --module eleve --jusqua 3.

Les contrôles vérifient les propriétés ; ils ne certifient pas l'autonomie.
"""

import argparse
import json
from pathlib import Path
import numpy as np
from moteur import Tensor
from commun import module_eleve, parametres, empreinte


def controles(m):
    def tokenizer():
        v = m.vocabulaire("é ba é")
        assert v == {" ": 0, "a": 1, "b": 2, "é": 3}
        ids = m.encoder("é ba", v)
        assert ids == [3, 0, 2, 1]
        assert m.decoder(ids, v) == "é ba"
        try:
            m.encoder("z", v)
        except KeyError:
            pass
        else:
            raise AssertionError("Un caractère inconnu doit être signalé")

    def batches():
        x, y = m.fenetres([4, 4, 9, 4], 2)
        np.testing.assert_array_equal(x, [[4, 4], [4, 9]])
        np.testing.assert_array_equal(y, [[4, 9], [9, 4]])
        try:
            m.fenetres([1], 2)
        except ValueError:
            pass
        else:
            raise AssertionError("Pas de cible hors de la liste")

    def probabilites():
        p = m.softmax(np.array([[1000, 1000], [1, 3.0]]))
        np.testing.assert_allclose(p.sum(-1), [1, 1])
        np.testing.assert_allclose(p[0], [0.5, 0.5])
        assert np.isclose(m.entropie(np.zeros((2, 5)), np.array([1, 3])), np.log(5))
        assert np.isfinite(m.entropie(np.array([[1000.0, -1000.0]]), np.array([1])))

    def pente():
        assert np.isclose(m.derivee(lambda x: (3 * x + 1) ** 2, 1), 24)
        assert np.isclose(m.derivee(lambda x: x * x, -2), -4)

    def autograd():
        w = m.Valeur(3)
        y = w * w + w
        y.backward()
        assert np.isclose(w.grad, 7)
        x = m.Valeur(-2)
        u = x * x
        y = u + u
        y.backward()
        assert np.isclose(x.grad, -8)

    def broadcast():
        g = m.reduire_gradient(np.ones((2, 4, 3)), (1, 3))
        np.testing.assert_array_equal(g, [[8, 8, 8]])
        assert m.reduire_gradient(np.ones((2, 3)), ()).shape == ()

    def attention():
        rng = np.random.default_rng(19)
        raw = [rng.normal(size=(1, 2, 4, 3)) for _ in range(3)]
        q, k, v = [Tensor(x.copy()) for x in raw]
        a = m.attention(q, k, v)
        assert a.data.shape == (1, 2, 4, 3)
        v2 = raw[2].copy()
        v2[:, :, -1] = 999
        b = m.attention(q, k, Tensor(v2))
        np.testing.assert_allclose(a.data[:, :, :-1], b.data[:, :, :-1], atol=1e-10)
        np.testing.assert_allclose(a.data[:, :, 0], raw[2][:, :, 0], atol=1e-10)
        a.sum().backward()
        eps = 1e-5
        high = raw[0].copy()
        low = raw[0].copy()
        high[0, 0, 1, 0] += eps
        low[0, 0, 1, 0] -= eps

        def f(t):
            return m.attention(Tensor(t), Tensor(raw[1]), Tensor(raw[2])).data.sum()

        np.testing.assert_allclose(
            q.grad[0, 0, 1, 0], (f(high) - f(low)) / (2 * eps), atol=1e-6
        )

    def tetes():
        p, c = parametres(7, d=8)
        x = Tensor(np.random.default_rng(5).normal(size=(2, 4, 8)))
        z = m.multi_tetes(x, p, "0.", 2)
        assert z.data.shape == x.data.shape
        z.sum().backward()
        assert np.isfinite(p["0.wq"].grad).all()
        assert np.linalg.norm(p["0.wv"].grad) > 0

    def bloc():
        p, c = parametres(7, d=8)
        x = Tensor(np.random.default_rng(6).normal(size=(2, 4, 8)))
        for name in ("wo", "w2"):
            p["0." + name].data[:] = 0
        z = m.bloc(x, p, "0.", 2)
        np.testing.assert_array_equal(z.data, x.data)

    def decoder():
        p, c = parametres(7, d=8, layers=2, block=6)
        x = np.array([[1, 2, 3, 4], [2, 3, 1, 5]])
        z = m.logits(x, p, c)
        assert z.data.shape == (2, 4, 7)
        other = x.copy()
        other[:, -1] = 6
        np.testing.assert_allclose(
            m.logits(other, p, c).data[:, :-1], z.data[:, :-1], atol=1e-10
        )
        loss = m.perte(z, np.roll(x, -1, axis=1))
        loss.backward()
        assert np.isfinite(float(loss.data))
        for name in ("tok", "0.wq", "1.w1", "head"):
            assert np.linalg.norm(p[name].grad) > 0, (name, "gradient absent")
        name = "0.wq"
        index = (0, 1)
        original = p[name].data[index]
        eps = 1e-5

        def f(value):
            p[name].data[index] = value
            return float(m.perte(m.logits(x, p, c), np.roll(x, -1, axis=1)).data)

        numeric = (f(original + eps) - f(original - eps)) / (2 * eps)
        p[name].data[index] = original
        np.testing.assert_allclose(p[name].grad[index], numeric, atol=1e-6)

    def optimiseur():
        p = {"w": Tensor(np.array([[1.0]]))}
        state = {}
        for _ in range(2):
            p["w"].grad[:] = 0.5
            m.adamw(p, state, 0.1, weight_decay=0.01)
        np.testing.assert_allclose(p["w"].data, [[0.798101]], atol=1e-7)
        assert state["t"] == 2

    def generation():
        rng = np.random.default_rng(0)
        assert m.prochain([1, 5, 2], rng, temperature=0) == 1
        assert {
            m.prochain([1, 5, 2], rng, temperature=1, top_k=1) for _ in range(20)
        } == {1}
        a = np.random.default_rng(7)
        b = np.random.default_rng(7)
        assert [m.prochain([1, 2, 3], a) for _ in range(10)] == [
            m.prochain([1, 2, 3], b) for _ in range(10)
        ]

    return [
        tokenizer,
        batches,
        probabilites,
        pente,
        autograd,
        broadcast,
        attention,
        tetes,
        bloc,
        decoder,
        optimiseur,
        generation,
    ]


def verifier(module="eleve", jusqua=12):
    m = module_eleve(module)
    results = []
    for i, test in enumerate(controles(m)[:jusqua], 1):
        try:
            test()
            results.append({"tp": i, "nom": test.__name__, "ok": True})
        except Exception as e:
            results.append(
                {
                    "tp": i,
                    "nom": test.__name__,
                    "ok": False,
                    "erreur": f"{type(e).__name__}: {e}",
                }
            )
    return {
        "format": "afz-atelier-checks-v1",
        "module": module,
        "source_sha256": empreinte(m.__file__),
        "controles": results,
        "reussis": sum(r["ok"] for r in results),
        "total": len(results),
        "limite": "Contrôles techniques publics ; compréhension et autonomie à démontrer séparément.",
    }


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--module", default="eleve")
    p.add_argument("--jusqua", type=int, choices=range(1, 13), default=12)
    p.add_argument("--rapport", type=Path)
    a = p.parse_args()
    r = verifier(a.module, a.jusqua)
    print(json.dumps(r, ensure_ascii=False, indent=2))
    if a.rapport:
        a.rapport.parent.mkdir(parents=True, exist_ok=True)
        a.rapport.write_text(json.dumps(r, ensure_ascii=False, indent=2) + "\n")
    raise SystemExit(0 if r["reussis"] == r["total"] else 1)
