# Attention Is All You Need — Summary

**Paper:** Vaswani, Shazeer, Parmar, Uszkoreit, Jones, Gomez, Kaiser, Polosukhin (2017)
**Link:** https://arxiv.org/abs/1706.03762 (NeurIPS 2017)

This is the paper that introduced the **Transformer**, the architecture behind
modern large language models. Its central claim: you can drop recurrence and
convolutions entirely and build a sequence-to-sequence model out of **attention
alone**.

---

## 1. The problem it solves

Before this paper, the dominant sequence models (for translation, language
modeling, etc.) were **RNNs / LSTMs / GRUs**, often paired with attention.
These had two structural weaknesses:

- **Sequential computation.** An RNN processes tokens one at a time — the hidden
  state at position *t* depends on the state at *t−1*. This prevents
  parallelization within a sequence and makes training slow.
- **Long-range dependencies.** Information has to travel through many
  intermediate steps to connect distant tokens, so the path length between two
  positions grows with distance, making long-range relationships hard to learn.

The Transformer replaces recurrence with **self-attention**, where every
position can directly attend to every other position in **constant path length**
and in a **fully parallelizable** way.

---

## 2. Scaled dot-product attention

Attention maps a **query** and a set of **key–value** pairs to an output. The
output is a weighted sum of the values, where each weight is computed from the
compatibility of the query with the corresponding key.

```
Attention(Q, K, V) = softmax( (Q · Kᵀ) / √d_k ) · V
```

- **Q** (queries), **K** (keys), **V** (values) are matrices of stacked vectors.
- **√d_k** is the scaling factor. Without it, for large `d_k` the dot products
  grow large in magnitude, pushing softmax into regions with tiny gradients.
  Dividing by √d_k keeps the variance stable.
- The softmax produces a distribution over positions; the result is a weighted
  blend of the value vectors.

### Self-attention vs. encoder–decoder attention
- **Self-attention:** Q, K, V all come from the same sequence — each position
  attends to all positions of the same layer.
- **Encoder–decoder attention:** queries come from the decoder, keys/values from
  the encoder output — this is the classic seq2seq attention.

---

## 3. Multi-head attention

Instead of a single attention function over `d_model`-dimensional vectors, the
model projects Q, K, V into **h** lower-dimensional subspaces (heads), runs
attention in parallel in each, concatenates the results, and projects back.

```
MultiHead(Q, K, V) = Concat(head_1, …, head_h) · W_O
        head_i      = Attention(Q·W_Qi, K·W_Ki, V·W_Vi)
```

Why multiple heads: a single attention head averages information, which can blur
distinct relationships. Multiple heads let the model **jointly attend to
information from different representation subspaces** at different positions —
e.g. one head tracks syntactic dependency, another tracks coreference.

In the base model: `h = 8` heads, `d_model = 512`, so each head works in
`d_k = d_v = d_model / h = 64` dimensions. Because each head is smaller, the
total cost is similar to single-head attention at full dimension.

---

## 4. The full architecture

The Transformer is an **encoder–decoder** stack. Both the encoder and the
decoder are built from **N = 6** identical layers.

### Encoder layer (two sub-layers)
1. Multi-head **self-attention**
2. Position-wise **feed-forward network**

### Decoder layer (three sub-layers)
1. **Masked** multi-head self-attention (masking prevents a position from
   attending to future positions, preserving the autoregressive property)
2. Multi-head **encoder–decoder attention** (attends over the encoder output)
3. Position-wise **feed-forward network**

### Around every sub-layer
- A **residual connection**: `output = LayerNorm(x + Sublayer(x))`
- **Layer normalization**

These residual + norm wrappers are critical for training deep stacks stably.

### Position-wise feed-forward network
Applied independently and identically to each position:

```
FFN(x) = max(0, x·W_1 + b_1) · W_2 + b_2
```

Inner dimension `d_ff = 2048`, outer `d_model = 512`. Think of it as a 1×1
convolution / per-token MLP that adds non-linear processing between attention
layers.

### Embeddings and softmax
Learned token embeddings of size `d_model`, with the input embedding and output
projection sharing weights (weight tying), scaled by √d_model.

---

## 5. Positional encoding

Self-attention is **permutation-invariant** — it has no inherent notion of
token order. So the model **adds positional encodings** to the input embeddings.
The paper uses fixed **sinusoidal** functions of varying frequency:

```
PE(pos, 2i)   = sin( pos / 10000^(2i/d_model) )
PE(pos, 2i+1) = cos( pos / 10000^(2i/d_model) )
```

Rationale: sinusoids let the model attend by **relative position** (the encoding
of `pos + k` is a linear function of the encoding of `pos`), and they may
extrapolate to sequence lengths longer than those seen in training. Learned
positional embeddings worked about as well; the sinusoidal form was chosen for
its extrapolation property.

---

## 6. Why self-attention? (the motivation table)

The paper compares layer types on three axes:

| Layer type            | Complexity per layer | Sequential ops | Max path length |
|-----------------------|----------------------|----------------|-----------------|
| Self-attention        | O(n²·d)              | O(1)           | O(1)            |
| Recurrent             | O(n·d²)              | O(n)           | O(n)            |
| Convolutional         | O(k·n·d²)            | O(1)           | O(log_k n)      |
| Self-attention (local)| O(r·n·d)             | O(1)           | O(n/r)          |

(n = sequence length, d = representation dim, k = kernel width, r = restricted
neighborhood.)

Key takeaways:
- **O(1) sequential operations** → fully parallelizable within a sequence.
- **O(1) maximum path length** → any two positions interact directly, making
  long-range dependencies easy to learn.
- The cost is **O(n²·d)** in sequence length. This is cheaper than recurrence
  when `n < d` (typical for sentences), but it's the quadratic term that later
  long-context work has spent enormous effort optimizing.
- Bonus: attention is **interpretable** — you can inspect the attention weights.

---

## 7. Training setup

- **Data:** WMT 2014 English–German (~4.5M sentence pairs) and English–French
  (~36M pairs), byte-pair / word-piece tokenization with a shared vocabulary.
- **Hardware:** 8× NVIDIA P100 GPUs. Base model trained in ~12 hours (100k
  steps); the big model ~3.5 days (300k steps).
- **Optimizer:** Adam (β₁=0.9, β₂=0.98, ε=1e-9) with a custom **warmup**
  learning-rate schedule:
  ```
  lr = d_model^(-0.5) · min( step^(-0.5), step · warmup_steps^(-1.5) )
  ```
  Learning rate rises linearly for `warmup_steps = 4000`, then decays with the
  inverse square root of the step number.
- **Regularization:**
  - **Residual dropout** (P_drop = 0.1) applied to sub-layer outputs and to the
    sum of embeddings + positional encodings.
  - **Label smoothing** (ε_ls = 0.1) — hurts perplexity but improves accuracy
    and BLEU.

---

## 8. Results

On WMT 2014:

| Model                | EN→DE BLEU | EN→FR BLEU |
|----------------------|-----------|-----------|
| Previous best (single / ensemble) | ~25–26 | ~40–41 |
| **Transformer (base)** | 27.3 | 38.1 |
| **Transformer (big)**  | **28.4** | **41.8** |

The big Transformer set a **new state of the art** on EN→DE and EN→FR, beating
prior models (including ensembles) at a **fraction of the training cost**.

It also **generalized** beyond translation: applied to English constituency
parsing, it performed competitively with strong task-specific systems, in both
supervised and semi-supervised settings — evidence the architecture isn't
narrowly tuned to MT.

---

## 9. Why it mattered

- **Parallelism + scale.** Removing recurrence made training massively more
  parallel, which is precisely what unlocked training on ever-larger datasets
  and parameter counts.
- **The foundation of modern LLMs.** BERT (encoder-only), GPT (decoder-only),
  T5 (encoder–decoder), and essentially every large language model since are
  direct descendants of this architecture.
- **A general-purpose primitive.** Self-attention turned out to be useful far
  beyond NLP — vision (ViT), audio, protein folding, multimodal models, etc.

The provocative title proved accurate: for a huge class of sequence problems,
attention really was (almost) all you needed.

---

## Glossary

- **d_model** — the model's main embedding/hidden width (512 base, 1024 big).
- **head** — one parallel attention computation operating in a subspace.
- **autoregressive** — generating one token at a time, each conditioned on the
  previously generated tokens (enforced in the decoder by masking).
- **BLEU** — n-gram overlap metric for machine-translation quality.
- **label smoothing** — replacing hard 0/1 training targets with slightly
  softened distributions to reduce overconfidence.
