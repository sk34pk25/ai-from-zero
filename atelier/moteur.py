"""Autograd minimal sur des tableaux NumPy.

Chaque opération enregistre comment renvoyer le gradient à ses parents.
C'est assez pour entraîner un petit modèle de langage, attention comprise,
sans PyTorch. Ce n'est pas un remplaçant de torch.autograd : pas de batch
de dimensions arbitraires exotiques, pas de checkpoint, pas de GPU.
"""

from __future__ import annotations

import numpy as np


def _as_tensor(value: "Tensor | np.ndarray | float") -> "Tensor":
    if isinstance(value, Tensor):
        return value
    return Tensor(value, requires_grad=False)


def _unbroadcast(grad: np.ndarray, shape: tuple[int, ...]) -> np.ndarray:
    while grad.ndim > len(shape):
        grad = grad.sum(axis=0)
    for axis, size in enumerate(shape):
        if size == 1 and grad.shape[axis] != 1:
            grad = grad.sum(axis=axis, keepdims=True)
    return grad.reshape(shape)


class Tensor:
    def __init__(self, data: np.ndarray | float, requires_grad: bool = True):
        self.data = np.asarray(data, dtype=np.float64)
        self.requires_grad = requires_grad
        self.grad = np.zeros_like(self.data) if requires_grad else None
        self._prev: tuple[Tensor, ...] = ()
        self._backward = lambda: None

    def __repr__(self) -> str:
        return f"Tensor(shape={self.data.shape}, grad={self.requires_grad})"

    def zero_grad(self) -> None:
        if self.requires_grad:
            self.grad = np.zeros_like(self.data)

    def backward(self) -> None:
        if self.data.size != 1:
            raise ValueError("backward part d'un scalaire")
        if not self.requires_grad:
            raise ValueError("ce tenseur ne suit pas le gradient")
        self.grad = np.ones_like(self.data)
        for node in reversed(self._topological_order()):
            node._backward()

    def _topological_order(self) -> list[Tensor]:
        """Parents avant enfants, sans récursion : un graphe profond ne bute pas sur la pile Python."""
        order: list[Tensor] = []
        seen: set[int] = set()
        stack: list[tuple[Tensor, bool]] = [(self, False)]
        while stack:
            node, parents_done = stack.pop()
            if parents_done:
                order.append(node)
                continue
            if id(node) in seen:
                continue
            seen.add(id(node))
            stack.append((node, True))
            for parent in reversed(node._prev):
                if id(parent) not in seen:
                    stack.append((parent, False))
        return order

    def _binary(self, other: Tensor, out: np.ndarray, backward) -> Tensor:
        result = Tensor(out, requires_grad=self.requires_grad or other.requires_grad)
        result._prev = tuple(node for node in (self, other) if node.requires_grad)
        result._backward = backward
        return result

    def __add__(self, other: Tensor | float) -> Tensor:
        other_t = _as_tensor(other)
        out = self.data + other_t.data

        def backward() -> None:
            if self.requires_grad:
                self.grad += _unbroadcast(result.grad, self.data.shape)
            if other_t.requires_grad:
                other_t.grad += _unbroadcast(result.grad, other_t.data.shape)

        result = self._binary(other_t, out, backward)
        return result

    def __radd__(self, other: float) -> Tensor:
        return self + other

    def __sub__(self, other: Tensor | float) -> Tensor:
        return self + (other * -1.0 if isinstance(other, Tensor) else -other)

    def __mul__(self, other: Tensor | float) -> Tensor:
        other_t = _as_tensor(other)
        out = self.data * other_t.data

        def backward() -> None:
            if self.requires_grad:
                self.grad += _unbroadcast(result.grad * other_t.data, self.data.shape)
            if other_t.requires_grad:
                other_t.grad += _unbroadcast(
                    result.grad * self.data, other_t.data.shape
                )

        result = self._binary(other_t, out, backward)
        return result

    def __rmul__(self, other: float) -> Tensor:
        return self * other

    def __neg__(self) -> Tensor:
        return self * -1.0

    def matmul(self, other: Tensor) -> Tensor:
        other_t = _as_tensor(other)
        out = self.data @ other_t.data

        def backward() -> None:
            if self.requires_grad:
                grad = result.grad @ np.swapaxes(other_t.data, -1, -2)
                self.grad += _unbroadcast(grad, self.data.shape)
            if other_t.requires_grad:
                grad = np.swapaxes(self.data, -1, -2) @ result.grad
                other_t.grad += _unbroadcast(grad, other_t.data.shape)

        result = self._binary(other_t, out, backward)
        return result

    def sum(self) -> Tensor:
        out = np.asarray(self.data.sum())

        def backward() -> None:
            if self.requires_grad:
                self.grad += np.ones_like(self.data) * result.grad

        result = Tensor(out, requires_grad=self.requires_grad)
        result._prev = (self,) if self.requires_grad else ()
        result._backward = backward
        return result

    def mean(self) -> Tensor:
        return self.sum() * (1.0 / self.data.size)

    def reshape(self, *shape: int) -> Tensor:
        out = self.data.reshape(shape)

        def backward() -> None:
            if self.requires_grad:
                self.grad += result.grad.reshape(self.data.shape)

        result = Tensor(out, requires_grad=self.requires_grad)
        result._prev = (self,) if self.requires_grad else ()
        result._backward = backward
        return result

    def permute(self, axes: tuple[int, ...]) -> Tensor:
        out = np.transpose(self.data, axes)
        inverse = tuple(int(axis) for axis in np.argsort(axes))

        def backward() -> None:
            if self.requires_grad:
                self.grad += np.transpose(result.grad, inverse)

        result = Tensor(out, requires_grad=self.requires_grad)
        result._prev = (self,) if self.requires_grad else ()
        result._backward = backward
        return result

    def gelu(self) -> Tensor:
        """Approximation tanh, la même que model.mathutil.gelu."""
        values = self.data
        scale = float(np.sqrt(2.0 / np.pi))
        inner = scale * (values + 0.044715 * values**3)
        tanh_inner = np.tanh(inner)
        out = 0.5 * values * (1.0 + tanh_inner)

        def backward() -> None:
            if not self.requires_grad:
                return
            sech2 = 1.0 - tanh_inner**2
            d_inner = scale * (1.0 + 3.0 * 0.044715 * values**2)
            local = 0.5 * (1.0 + tanh_inner) + 0.5 * values * sech2 * d_inner
            self.grad += result.grad * local

        result = Tensor(out, requires_grad=self.requires_grad)
        result._prev = (self,) if self.requires_grad else ()
        result._backward = backward
        return result

    def relu(self) -> Tensor:
        mask = self.data > 0
        out = self.data * mask

        def backward() -> None:
            if self.requires_grad:
                self.grad += result.grad * mask

        result = Tensor(out, requires_grad=self.requires_grad)
        result._prev = (self,) if self.requires_grad else ()
        result._backward = backward
        return result

    def softmax(self, axis: int = -1) -> Tensor:
        shifted = self.data - np.max(self.data, axis=axis, keepdims=True)
        exp = np.exp(shifted)
        probs = exp / np.sum(exp, axis=axis, keepdims=True)

        def backward() -> None:
            if not self.requires_grad:
                return
            grad = result.grad
            dot = np.sum(grad * probs, axis=axis, keepdims=True)
            self.grad += probs * (grad - dot)

        result = Tensor(probs, requires_grad=self.requires_grad)
        result._prev = (self,) if self.requires_grad else ()
        result._backward = backward
        return result

    def log_softmax(self, axis: int = -1) -> Tensor:
        shifted = self.data - np.max(self.data, axis=axis, keepdims=True)
        log_z = np.log(np.sum(np.exp(shifted), axis=axis, keepdims=True))
        out = shifted - log_z

        def backward() -> None:
            if not self.requires_grad:
                return
            probs = np.exp(out)
            self.grad += result.grad - probs * np.sum(
                result.grad, axis=axis, keepdims=True
            )

        result = Tensor(out, requires_grad=self.requires_grad)
        result._prev = (self,) if self.requires_grad else ()
        result._backward = backward
        return result


def layernorm(values: Tensor, gain: Tensor, bias: Tensor, eps: float = 1e-5) -> Tensor:
    """LayerNorm sur le dernier axe. Même formule que model.mathutil.layernorm."""
    data = values.data
    mean = np.mean(data, axis=-1, keepdims=True)
    centered = data - mean
    var = np.mean(centered**2, axis=-1, keepdims=True)
    inv_std = 1.0 / np.sqrt(var + eps)
    normalized = centered * inv_std
    out = normalized * gain.data + bias.data

    def backward() -> None:
        grad = result.grad
        reduce_axes = tuple(range(grad.ndim - 1))
        if gain.requires_grad:
            gained = grad * normalized
            gain.grad += gained if not reduce_axes else gained.sum(axis=reduce_axes)
        if bias.requires_grad:
            bias.grad += grad if not reduce_axes else grad.sum(axis=reduce_axes)
        if values.requires_grad:
            d_normalized = grad * gain.data
            mean_d = np.mean(d_normalized, axis=-1, keepdims=True)
            mean_d_norm = np.mean(d_normalized * normalized, axis=-1, keepdims=True)
            values.grad += (d_normalized - mean_d - normalized * mean_d_norm) * inv_std

    result = Tensor(
        out,
        requires_grad=values.requires_grad or gain.requires_grad or bias.requires_grad,
    )
    result._prev = tuple(node for node in (values, gain, bias) if node.requires_grad)
    result._backward = backward
    return result


def embedding(table: Tensor, indices: np.ndarray) -> Tensor:
    """Sélectionne des lignes. Le gradient est dispersé vers les lignes lues."""
    rows = np.asarray(indices, dtype=np.int64)
    out = table.data[rows]

    def backward() -> None:
        if table.requires_grad:
            np.add.at(table.grad, rows, result.grad)

    result = Tensor(out, requires_grad=table.requires_grad)
    result._prev = (table,) if table.requires_grad else ()
    result._backward = backward
    return result


def cross_entropy(logits: Tensor, targets: np.ndarray) -> Tensor:
    """Entropie croisée moyenne. logits (N, V), targets (N,)."""
    labels = np.asarray(targets, dtype=np.int64)
    if logits.data.ndim != 2 or labels.shape != (logits.data.shape[0],):
        raise ValueError("cross_entropy attend logits (N, V) et targets (N,)")
    log_probs = logits.log_softmax(axis=-1)
    picked = log_probs.data[np.arange(labels.shape[0]), labels]
    loss_value = -picked.mean()

    def backward() -> None:
        if not log_probs.requires_grad:
            return
        grad = np.zeros_like(log_probs.data)
        grad[np.arange(labels.shape[0]), labels] = -1.0 / labels.shape[0]
        log_probs.grad += grad * result.grad

    result = Tensor(loss_value, requires_grad=logits.requires_grad)
    result._prev = (log_probs,) if logits.requires_grad else ()
    result._backward = backward
    return result


def _transpose_backward(source: Tensor) -> Tensor:
    out = np.swapaxes(source.data, -1, -2)

    def backward() -> None:
        if source.requires_grad:
            source.grad += np.swapaxes(result.grad, -1, -2)

    result = Tensor(out, requires_grad=source.requires_grad)
    result._prev = (source,) if source.requires_grad else ()
    result._backward = backward
    return result


# Transposition des deux derniers axes ; primitive de tableau.
Tensor.transpose = lambda self: _transpose_backward(self)  # type: ignore[method-assign]
