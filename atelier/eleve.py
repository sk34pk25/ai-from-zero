"""Ton code : complète les fonctions dans l’ordre des TP du GUIDE."""

"""Référence à ouvrir APRÈS un essai. Aucun import de GPT préfabriqué.

Les primitives de tableaux différentiables viennent de moteur.py (NumPy).
Tu construis ici le modèle, le masque, le backward scalaire et l'optimiseur.
"""
import numpy as np
from moteur import Tensor, embedding, layernorm, cross_entropy


def vocabulaire(texte):
    raise NotImplementedError("À compléter : vocabulaire — voir GUIDE.md")


def encoder(texte, vocab):
    raise NotImplementedError("À compléter : encoder — voir GUIDE.md")


def decoder(ids, vocab):
    raise NotImplementedError("À compléter : decoder — voir GUIDE.md")


def fenetres(ids, taille):
    raise NotImplementedError("À compléter : fenetres — voir GUIDE.md")


def softmax(z):
    raise NotImplementedError("À compléter : softmax — voir GUIDE.md")


def entropie(z, y):
    raise NotImplementedError("À compléter : entropie — voir GUIDE.md")


def derivee(f, x, eps=1e-05):
    raise NotImplementedError("À compléter : derivee — voir GUIDE.md")


class Valeur:
    """TP 5 : graphe scalaire pour comprendre le moteur de tableaux fourni."""

    def __init__(self, data, parents=()):
        self.data, self.grad, self.parents = (float(data), 0.0, parents)
        self.local = lambda: None

    def __add__(self, other):
        out = Valeur(self.data + other.data, (self, other))

        def local():
            raise NotImplementedError("À compléter : local — voir GUIDE.md")

        out.local = local
        return out

    def __mul__(self, other):
        out = Valeur(self.data * other.data, (self, other))

        def local():
            raise NotImplementedError("À compléter : local — voir GUIDE.md")

        out.local = local
        return out

    def backward(self):
        raise NotImplementedError("À compléter : backward — voir GUIDE.md")


def reduire_gradient(grad, shape):
    raise NotImplementedError("À compléter : reduire_gradient — voir GUIDE.md")


def attention(q, k, v):
    raise NotImplementedError("À compléter : attention — voir GUIDE.md")


def multi_tetes(x, p, prefix, heads):
    raise NotImplementedError("À compléter : multi_tetes — voir GUIDE.md")


def bloc(x, p, prefix, heads):
    raise NotImplementedError("À compléter : bloc — voir GUIDE.md")


def logits(ids, p, config):
    raise NotImplementedError("À compléter : logits — voir GUIDE.md")


def perte(z, y):
    raise NotImplementedError("À compléter : perte — voir GUIDE.md")


def adamw(params, state, lr, weight_decay=0.01):
    raise NotImplementedError("À compléter : adamw — voir GUIDE.md")


def prochain(z, rng, temperature=1.0, top_k=None):
    raise NotImplementedError("À compléter : prochain — voir GUIDE.md")
