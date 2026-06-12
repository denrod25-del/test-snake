#!/usr/bin/env python3
"""Fine-tune GPT-2 (small) with LoRA adapters.

LoRA freezes the ~124M base-model weights and trains a small set of low-rank
adapter matrices instead, so this works on modest hardware (CPU is fine for a
small dataset). The output is a tiny adapter (a few MB), not a full model copy.

Two data formats are supported:

  * instruct (.jsonl)  one JSON object per line with an instruction + response,
                       e.g. {"prompt": "...", "completion": "..."}.
                       The loss is computed on the response only (the prompt
                       tokens are masked out), which teaches the model to follow
                       the instruction format.

  * text (.txt)        a plain text corpus. It is concatenated and chunked into
                       fixed-length blocks; the model simply learns to continue
                       in that style.

Example:
    python train_lora.py --data data/sample.jsonl --format instruct --epochs 3

The base weights download from huggingface.co on first run, so the machine
running this needs network access to that host.
"""
import argparse
import json

import torch
from datasets import Dataset
from peft import LoraConfig, TaskType, get_peft_model
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
    default_data_collator,
)

# Prompt template used for the instruct format. The model learns that text
# after "### Response:" is what it should generate.
INSTRUCT_TEMPLATE = "### Instruction:\n{instruction}\n\n### Response:\n"


def parse_args():
    p = argparse.ArgumentParser(description="LoRA fine-tuning for GPT-2.")
    p.add_argument("--model_name", default="gpt2",
                   help="Base model on HuggingFace (default: gpt2 = GPT-2 small).")
    p.add_argument("--data", required=True,
                   help="Path to a .jsonl (instruct) or .txt (text) dataset.")
    p.add_argument("--format", choices=["instruct", "text"], default="instruct",
                   help="Dataset format (default: instruct).")
    p.add_argument("--output_dir", default="./gpt2-lora-adapter",
                   help="Where to save the trained LoRA adapter.")
    p.add_argument("--epochs", type=float, default=3.0)
    p.add_argument("--batch_size", type=int, default=2)
    p.add_argument("--grad_accum", type=int, default=4,
                   help="Gradient accumulation steps (raises effective batch size).")
    p.add_argument("--lr", type=float, default=2e-4)
    p.add_argument("--max_length", type=int, default=256)
    # LoRA hyperparameters.
    p.add_argument("--lora_r", type=int, default=8, help="LoRA rank.")
    p.add_argument("--lora_alpha", type=int, default=16, help="LoRA scaling.")
    p.add_argument("--lora_dropout", type=float, default=0.05)
    return p.parse_args()


def load_rows(path):
    """Read a .jsonl file into a list of dicts."""
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def _get(example, *keys):
    """Return the first present key from an example (lets us accept synonyms)."""
    for k in keys:
        if k in example and example[k] is not None:
            return example[k]
    raise KeyError(f"None of {keys} found in example: {example}")


def build_instruct_dataset(path, tokenizer, max_length):
    """Tokenize instruct examples, masking the prompt tokens out of the loss."""
    rows = load_rows(path)

    def encode(example):
        instruction = _get(example, "prompt", "instruction", "input")
        completion = _get(example, "completion", "response", "output")
        prompt_text = INSTRUCT_TEMPLATE.format(instruction=instruction)

        prompt_ids = tokenizer(prompt_text, add_special_tokens=False)["input_ids"]
        completion_ids = tokenizer(
            completion + tokenizer.eos_token, add_special_tokens=False
        )["input_ids"]

        input_ids = (prompt_ids + completion_ids)[:max_length]
        # -100 tells the loss to ignore those positions (i.e. don't train on the
        # prompt, only on the response the model is supposed to produce).
        labels = ([-100] * len(prompt_ids) + completion_ids)[:max_length]

        pad_len = max_length - len(input_ids)
        attention_mask = [1] * len(input_ids) + [0] * pad_len
        input_ids = input_ids + [tokenizer.pad_token_id] * pad_len
        labels = labels + [-100] * pad_len

        return {
            "input_ids": input_ids,
            "attention_mask": attention_mask,
            "labels": labels,
        }

    return Dataset.from_list([encode(r) for r in rows])


def build_text_dataset(path, tokenizer, max_length):
    """Concatenate a plain-text corpus and chunk it into fixed-length blocks."""
    with open(path, encoding="utf-8") as f:
        corpus = f.read()

    ids = tokenizer(corpus, add_special_tokens=False)["input_ids"]
    blocks = []
    for i in range(0, len(ids) - 1, max_length):
        chunk = ids[i : i + max_length]
        if len(chunk) < 2:
            continue
        pad_len = max_length - len(chunk)
        attention_mask = [1] * len(chunk) + [0] * pad_len
        labels = chunk + [-100] * pad_len
        input_ids = chunk + [tokenizer.pad_token_id] * pad_len
        blocks.append({
            "input_ids": input_ids,
            "attention_mask": attention_mask,
            "labels": labels,
        })
    return Dataset.from_list(blocks)


def main():
    args = parse_args()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device}")

    print(f"Loading base model and tokenizer: {args.model_name}")
    tokenizer = AutoTokenizer.from_pretrained(args.model_name)
    # GPT-2 has no pad token; reuse EOS so batches can be padded.
    tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(args.model_name)
    model.config.pad_token_id = tokenizer.pad_token_id

    # Attach LoRA adapters to GPT-2's fused attention projection ("c_attn").
    peft_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=args.lora_dropout,
        target_modules=["c_attn"],
        bias="none",
    )
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    print(f"Building dataset ({args.format}) from {args.data}")
    if args.format == "instruct":
        dataset = build_instruct_dataset(args.data, tokenizer, args.max_length)
    else:
        dataset = build_text_dataset(args.data, tokenizer, args.max_length)
    print(f"Training examples: {len(dataset)}")

    training_args = TrainingArguments(
        output_dir=args.output_dir,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.lr,
        logging_steps=10,
        save_strategy="epoch",
        report_to="none",
        fp16=torch.cuda.is_available(),
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=dataset,
        data_collator=default_data_collator,
    )

    print("Starting training...")
    trainer.train()

    print(f"Saving LoRA adapter to {args.output_dir}")
    model.save_pretrained(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)
    print("Done. Run generate.py with --adapter_dir set to this directory.")


if __name__ == "__main__":
    main()
