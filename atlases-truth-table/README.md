# Atlases Truth Table Lab

Interactive truth table builder modeled after the Rosen discrete mathematics
[Truth Table applet](https://semmedia.mhhe.com/digital_assets_table/rosen7e/TruthTable/index.html),
with **Atlases** branding.

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
cd atlases-truth-table
python -m http.server 8080
```

Then visit `http://localhost:8080`.

## Features

- Symbol palette: propositions `p`–`s`, parentheses, negation, AND, NAND, OR, NOR, conditional, biconditional, XOR
- **Display** builds the full truth table with intermediate sub-expression columns
- **Show All** / **Solve** reveals every cell
- Animated playback: **Play**, **Next**, **Back**, **Restart**
- Reveal modes: **By column** or **By row**
- Built-in exercises for tautologies, contingencies, and contradictions
- Automatic classification of the final column

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App shell and Atlases branding |
| `styles.css` | Dark atlas-themed UI |
| `app.js` | Parser, evaluator, table builder, animation |

No build step required.
