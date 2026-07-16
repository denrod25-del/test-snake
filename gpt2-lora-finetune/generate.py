#!/usr/bin/env python3
"""Generate text from a GPT-2 base model + a trained LoRA adapter.

The base weights stay frozen; the small adapter from train_lora.py is loaded on
top of them. Use the same --format you trained with so the prompt template
matches.

Example:
    python generate.py --adapter_dir ./gpt2-lora-adapter \\
        --prompt "Tell me about the weather." --format instruct
"""
import argparse

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

# Must match the template used in train_lora.py.
INSTRUCT_TEMPLATE = "### Instruction:\n{instruction}\n\n### Response:\n"


def parse_args():
    p = argparse.ArgumentParser(description="Generate text from a LoRA-tuned GPT-2.")
    p.add_argument("--base_model", default="gpt2",
                   help="Base model the adapter was trained on (default: gpt2).")
    p.add_argument("--adapter_dir", default="./gpt2-lora-adapter",
                   help="Directory containing the trained LoRA adapter.")
    p.add_argument("--prompt", required=True, help="Prompt / instruction text.")
    p.add_argument("--format", choices=["instruct", "text"], default="instruct")
    p.add_argument("--max_new_tokens", type=int, default=100)
    p.add_argument("--temperature", type=float, default=0.8)
    p.add_argument("--top_p", type=float, default=0.95)
    p.add_argument("--base_only", action="store_true",
                   help="Skip the adapter and run the untuned base model "
                        "(useful for before/after comparison).")
    return p.parse_args()


def main():
    args = parse_args()
    device = "cuda" if torch.cuda.is_available() else "cpu"

    tokenizer = AutoTokenizer.from_pretrained(args.base_model)
    tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(args.base_model)
    if not args.base_only:
        model = PeftModel.from_pretrained(model, args.adapter_dir)
    model.to(device)
    model.eval()

    if args.format == "instruct":
        text = INSTRUCT_TEMPLATE.format(instruction=args.prompt)
    else:
        text = args.prompt

    inputs = tokenizer(text, return_tensors="pt").to(device)
    with torch.no_grad():
        output = model.generate(
            **inputs,
            max_new_tokens=args.max_new_tokens,
            do_sample=True,
            temperature=args.temperature,
            top_p=args.top_p,
            pad_token_id=tokenizer.pad_token_id,
        )

    generated = tokenizer.decode(output[0], skip_special_tokens=True)
    print("=" * 60)
    print(generated)
    print("=" * 60)


if __name__ == "__main__":
    main()
