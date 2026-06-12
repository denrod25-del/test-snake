# GPT-2 LoRA Fine-Tuning

A complete, minimal project for fine-tuning **GPT-2 small (124M)** with **LoRA**
adapters. LoRA freezes the base model and trains a tiny set of low-rank
matrices, so the whole thing runs on modest hardware — a CPU is fine for the
small sample dataset, and the trained adapter is only a few MB.

The architecture being tuned is the decoder-only Transformer from
[*Attention Is All You Need*](../docs/attention-is-all-you-need.md).

## What's here

| File | Purpose |
|------|---------|
| `train_lora.py` | Fine-tunes a LoRA adapter on your data |
| `generate.py` | Generates text from base model + adapter (with a `--base_only` mode for before/after comparison) |
| `data/sample.jsonl` | A small demo dataset (a pirate-speak assistant) so you can see the effect immediately |
| `requirements.txt` | Python dependencies |

## Requirements / network note

Install the dependencies (these come from PyPI):

```bash
pip install -r requirements.txt
```

> **Important:** the base GPT-2 weights are downloaded from `huggingface.co` the
> first time you run either script. The machine you run on therefore needs
> network access to that host. In the current Claude Code web environment
> HuggingFace is blocked by the network policy, so run this on your own machine,
> on Google Colab, or after editing the environment's network policy to allow
> `huggingface.co` (see
> https://code.claude.com/docs/en/claude-code-on-the-web).

## Quick start

```bash
# 1. Install deps
pip install -r requirements.txt

# 2. Train a LoRA adapter on the sample data (a few minutes on CPU)
python train_lora.py --data data/sample.jsonl --format instruct --epochs 5

# 3. Generate from the fine-tuned model
python generate.py --adapter_dir ./gpt2-lora-adapter \
    --prompt "Tell me about the ocean." --format instruct

# Compare against the untuned base model:
python generate.py --base_only \
    --prompt "Tell me about the ocean." --format instruct
```

After training on the pirate dataset, the tuned model should answer in
pirate-speak ("Arr, matey!"), while `--base_only` produces generic GPT-2 text.
That contrast is the LoRA effect.

## Using your own data

### Instruction format (`--format instruct`)

A `.jsonl` file, one JSON object per line. Keys `prompt`/`completion` are the
defaults; `instruction`/`response` and `input`/`output` also work:

```json
{"prompt": "Summarize: <text>", "completion": "<summary>"}
{"prompt": "Translate to French: hello", "completion": "bonjour"}
```

The loss is computed on the completion only — the prompt tokens are masked — so
the model learns to *produce* the response given the instruction.

### Plain-text format (`--format text`)

A `.txt` file with any prose. It is concatenated and chunked into fixed-length
blocks, and the model learns to continue in that style:

```bash
python train_lora.py --data my_corpus.txt --format text --epochs 3
```

## Key options

`train_lora.py`:

| Flag | Default | Meaning |
|------|---------|---------|
| `--model_name` | `gpt2` | Base model (`gpt2`, `gpt2-medium`, `distilgpt2`, ...) |
| `--epochs` | `3` | Training epochs |
| `--batch_size` | `2` | Per-device batch size |
| `--grad_accum` | `4` | Gradient accumulation (effective batch = batch_size × grad_accum) |
| `--lr` | `2e-4` | Learning rate |
| `--max_length` | `256` | Max sequence length (tokens) |
| `--lora_r` | `8` | LoRA rank (higher = more capacity, more params) |
| `--lora_alpha` | `16` | LoRA scaling factor |
| `--lora_dropout` | `0.05` | Dropout on the adapter |

`generate.py`: `--prompt`, `--max_new_tokens`, `--temperature`, `--top_p`,
`--base_only`.

## Notes & expectations

- **GPT-2 small is tiny by modern standards.** It excels at picking up a *style
  or format* but won't reason or follow complex instructions like a current
  model. It's an excellent, fast way to learn how fine-tuning works.
- For better quality, point `--model_name` at a larger model (e.g.
  `gpt2-medium`) or a small modern model and train on a GPU.
- More, cleaner data is the single biggest lever on quality. A few hundred
  consistent examples already shows an effect; aim for thousands for real use.
- The saved adapter is portable: keep multiple adapters for different tasks and
  load whichever you need at inference time.
