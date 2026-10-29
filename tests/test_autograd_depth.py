"""Le backward ne dépend pas de la profondeur de pile Python."""

import sys

import numpy as np
import pytest
from atelier import moteur
from model import autograd


@pytest.mark.parametrize("api", [autograd, moteur])
def test_backward_traverses_a_graph_deeper_than_the_recursion_limit(api):
    depth = sys.getrecursionlimit() * 3
    x = api.Tensor(np.array(2.0))
    y = x
    for _ in range(depth):
        y = y * 1.0 + 0.0
    (y * y).backward()
    assert float(x.grad) == pytest.approx(4.0)


@pytest.mark.parametrize("api", [autograd, moteur])
def test_shared_node_receives_every_contribution_once(api):
    w = api.Tensor(np.array(3.0))
    a = w * w
    b = a + w
    (b * a).backward()
    # f = (w² + w) · w² = w⁴ + w³ ; f'(3) = 4·27 + 3·9 = 135
    assert float(w.grad) == pytest.approx(135.0)


@pytest.mark.parametrize("api", [autograd, moteur])
def test_topological_order_puts_parents_first(api):
    a = api.Tensor(np.array(1.0))
    b = a * 2.0
    c = a + b
    d = c * b
    order = d._topological_order()
    position = {id(node): index for index, node in enumerate(order)}
    for node in order:
        for parent in node._prev:
            assert position[id(parent)] < position[id(node)]
    assert order[-1] is d
