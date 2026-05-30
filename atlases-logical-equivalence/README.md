# Atlases Logical Equivalence Lab

Interactive logical equivalence chain builder modeled after the Rosen discrete
mathematics [Logical Equivalence applet](https://semmedia.mhhe.com/digital_assets_table/rosen7e/Logical_Equivalence/index.html),
with **Atlases** branding.

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
cd atlases-logical-equivalence
python -m http.server 8080
```

Then visit `http://localhost:8080`.

> ES modules require a local server — opening the file directly from disk may block imports.

## Features

- Symbol palette: propositions `p`–`s`, parentheses, negation, AND, NAND, OR, NOR, conditional, biconditional, XOR
- Vertical **equivalence chain** with up to 10 rows connected by ≡
- **Verify** checks each adjacent pair with a side-by-side truth table
- Animated proof playback: **Play**, **Next**, **Back**, **Restart**, **Solve**
- Built-in exercises including Rosen **1.2 Example 5** and **Example 6**
- Quick reference for common **logical identities**

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App shell and Atlases branding |
| `styles.css` | Equivalence-specific UI (extends truth-table theme) |
| `logic.js` | Parser, evaluator, equivalence checker |
| `app.js` | Chain builder, exercises, animation |

No build step required.
