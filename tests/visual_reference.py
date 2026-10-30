"""Oracle NumPy indépendant : compare les widgets au vrai laboratoire, pas à une copie JS."""
from pathlib import Path
import json
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import numpy as np
from model.attention import scaled_dot_product_attention, apply_rope, rope_cos_sin
from model.autograd import Tensor
from model.mathutil import layernorm, rmsnorm, gelu, silu
from model.moe import moe_ffn
from model.ssm import sequential_affine, parallel_affine
from model.multimodal import patchify
from model.lora import apply_lora_numpy

x = np.array([[1., 0.], [0., 1.], [1., 1.]])
out, weights = scaled_dot_product_attention(x, x, x * 2)
backward = []
for w in [-2., -1/3, 0., 2., 3.]:
    a = Tensor(w)
    error = (a * 3 + 1).relu() - 4
    loss = error * error
    loss.backward()
    backward.append([float(loss.data), float(a.grad)])
q = np.array([[[[1., 0.], [1., 0.], [1., 0.]]]])
cos, sin = rope_cos_sin(np.arange(3), 2)
scores = np.array([[2.2, .2, -1], [2., 1.8, .2], [1.9, .3, 2.1]])
experts = [{"w1": np.eye(3), "b1": np.zeros(3), "w2": np.eye(3), "b2": np.zeros(3)} for _ in range(3)]
routes = []
for k in [1,2,3]:
    for factor in [.5, 1.25, 3.]:
        run = moe_ffn(scores, experts, np.eye(3), k=k, capacity_factor=factor)
        routes.append({"k":k,"factor":factor,"choices":run['choices'].tolist(),"dropped":run['dropped'],"capacity":run['capacity'],"aux":run['aux']})
a = np.full(4, .7); b = np.array([1., 0., 2., 0.])
lora = []
for rank in range(1,5):
    left=np.array([[(i+r+1)/10 for r in range(rank)] for i in range(4)])
    right=np.array([[r+1,1-r,.5,-.5] for r in range(rank)])
    result=apply_lora_numpy({'l0.wq':np.eye(4)}, {'l0.wq':{'A':left,'B':right,'scale':1.}})
    lora.append(result['l0.wq'].tolist())
payload = dict(output=out.tolist(),weights=weights.tolist(),backward=backward,rope=apply_rope(q,cos,sin)[0,0].tolist(),layer=layernorm(np.array([1.,2.,3.,4.]),np.ones(4),np.zeros(4)).tolist(),rms=rmsnorm(np.array([1.,2.,3.,4.]),np.ones(4)).tolist(),gelu=gelu(np.array([-3.,-1.,0.,1.,3.])).tolist(),silu=silu(np.array([-3.,-1.,0.,1.,3.])).tolist(),routes=routes,scan=sequential_affine(a,b).tolist(),parallel=parallel_affine(a,b).tolist(),patches=patchify(np.arange(16).reshape(4,4),2).tolist(),lora=lora)
print(json.dumps(payload))
