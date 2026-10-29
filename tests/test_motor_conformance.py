"""L'atelier reste autonome ; ses primitives gardent le contrat du laboratoire."""

import numpy as np
import pytest
from atelier import moteur
from model import autograd


@pytest.mark.parametrize("seed", [3, 17])
def test_embedding_norm_and_composed_gradients_stay_equivalent(seed):
    rng = np.random.default_rng(seed)
    values = {
        "table": rng.normal(size=(7, 4)),
        "weight": rng.normal(size=(4, 3)),
        "bias": rng.normal(size=3),
        "gain": rng.normal(size=3),
    }
    outputs = []
    for api in (moteur, autograd):
        p = {k: api.Tensor(v.copy()) for k, v in values.items()}
        x = api.embedding(p["table"], np.array([[1, 1, 2], [4, 3, 1]]))
        z = api.layernorm(x.matmul(p["weight"]).gelu(), p["gain"], p["bias"])
        loss = api.cross_entropy(z.reshape(-1, 3), np.array([0, 2, 1, 1, 0, 2]))
        loss.backward()
        outputs.append((z.data, float(loss.data), {k: v.grad for k, v in p.items()}))
    np.testing.assert_allclose(outputs[0][0], outputs[1][0], atol=1e-12)
    assert outputs[0][1] == pytest.approx(outputs[1][1])
    for key in values:
        np.testing.assert_allclose(outputs[0][2][key], outputs[1][2][key], atol=1e-12)
