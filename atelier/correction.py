"""Référence à ouvrir APRÈS un essai. Aucun import de GPT préfabriqué.

Les primitives de tableaux différentiables viennent de moteur.py (NumPy).
Tu construis ici le modèle, le masque, le backward scalaire et l'optimiseur.
"""

import numpy as np
from moteur import Tensor, embedding, layernorm, cross_entropy


def vocabulaire(texte):
    return {c: i for i, c in enumerate(sorted(set(texte)))}


def encoder(texte, vocab):
    return [vocab[c] for c in texte]


def decoder(ids, vocab):
    inverse = {i: c for c, i in vocab.items()}
    return "".join(inverse[i] for i in ids)


def fenetres(ids, taille):
    if taille < 1 or len(ids) <= taille:
        raise ValueError("Il faut une cible après la fenêtre")
    x = np.array([ids[i : i + taille] for i in range(len(ids) - taille)])
    y = np.array([ids[i + 1 : i + taille + 1] for i in range(len(ids) - taille)])
    return x, y


def softmax(z):
    z = np.asarray(z, dtype=float)
    e = np.exp(z - z.max(axis=-1, keepdims=True))
    return e / e.sum(axis=-1, keepdims=True)


def entropie(z, y):
    z = np.asarray(z, dtype=float)
    z = z - z.max(axis=-1, keepdims=True)
    return float(np.mean(np.log(np.exp(z).sum(axis=-1)) - z[np.arange(len(y)), y]))


def derivee(f, x, eps=1e-5):
    return (f(x + eps) - f(x - eps)) / (2 * eps)


class Valeur:
    """TP 5 : graphe scalaire pour comprendre le moteur de tableaux fourni."""

    def __init__(self, data, parents=()):
        self.data, self.grad, self.parents = float(data), 0.0, parents
        self.local = lambda: None

    def __add__(self, other):
        out = Valeur(self.data + other.data, (self, other))

        def local():
            self.grad += out.grad
            other.grad += out.grad

        out.local = local
        return out

    def __mul__(self, other):
        out = Valeur(self.data * other.data, (self, other))

        def local():
            self.grad += other.data * out.grad
            other.grad += self.data * out.grad

        out.local = local
        return out

    def backward(self):
        order, seen = [], set()

        def visit(node):
            if id(node) in seen:
                return
            seen.add(id(node))
            for p in node.parents:
                visit(p)
            order.append(node)

        visit(self)
        self.grad = 1.0
        for node in reversed(order):
            node.local()


def reduire_gradient(grad, shape):
    while grad.ndim > len(shape):
        grad = grad.sum(axis=0)
    for axis, n in enumerate(shape):
        if n == 1:
            grad = grad.sum(axis=axis, keepdims=True)
    return grad.reshape(shape)


def attention(q, k, v):
    t = q.data.shape[-2]
    mask = np.triu(np.full((t, t), -1e9), k=1)
    scores = q.matmul(k.permute((0, 1, 3, 2))) * (q.data.shape[-1] ** -0.5)
    return (scores + mask).softmax(axis=-1).matmul(v)


def multi_tetes(x, p, prefix, heads):
    b, t, d = x.data.shape
    if d % heads:
        raise ValueError("Largeur non divisible par les têtes")
    projected = [
        x.matmul(p[prefix + n]).reshape(b, t, heads, d // heads).permute((0, 2, 1, 3))
        for n in ("wq", "wk", "wv")
    ]
    return (
        attention(*projected)
        .permute((0, 2, 1, 3))
        .reshape(b, t, d)
        .matmul(p[prefix + "wo"])
    )


def bloc(x, p, prefix, heads):
    h = x + multi_tetes(
        layernorm(x, p[prefix + "g1"], p[prefix + "b1"]), p, prefix, heads
    )
    n = layernorm(h, p[prefix + "g2"], p[prefix + "b2"])
    return h + n.matmul(p[prefix + "w1"]).gelu().matmul(p[prefix + "w2"])


def logits(ids, p, config):
    t = ids.shape[1]
    if t > config["block"]:
        raise ValueError("Fenêtre dépassée")
    h = embedding(p["tok"], ids) + embedding(p["pos"], np.arange(t))
    for i in range(config["layers"]):
        h = bloc(h, p, f"{i}.", config["heads"])
    return layernorm(h, p["gain"], p["bias"]).matmul(p["head"])


def perte(z, y):
    return cross_entropy(z.reshape(-1, z.data.shape[-1]), y.reshape(-1))


def adamw(params, state, lr, weight_decay=0.01):
    state["t"] = state.get("t", 0) + 1
    t = state["t"]
    for name, p in params.items():
        m, v = state.setdefault(name, (np.zeros_like(p.data), np.zeros_like(p.data)))
        m = 0.9 * m + 0.1 * p.grad
        v = 0.95 * v + 0.05 * p.grad**2
        state[name] = (m, v)
        if p.data.ndim >= 2:
            p.data *= 1 - lr * weight_decay
        p.data -= lr * (m / (1 - 0.9**t)) / (np.sqrt(v / (1 - 0.95**t)) + 1e-8)


def prochain(z, rng, temperature=1.0, top_k=None):
    z = np.asarray(z, dtype=float).copy()
    if temperature == 0:
        return int(np.argmax(z))
    if temperature < 0:
        raise ValueError("Température négative")
    if top_k is not None:
        if not 1 <= top_k <= len(z):
            raise ValueError("top_k invalide")
        keep = np.argsort(-z, kind="stable")[:top_k]
        mask = np.ones(len(z), bool)
        mask[keep] = False
        z[mask] = -np.inf
    return int(rng.choice(len(z), p=softmax(z / temperature)))
