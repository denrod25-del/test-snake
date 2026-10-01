# pdf-batch-installer

A tiny, zero-dependency command-line app that **batch-downloads ("installs")
every PDF** from an Apache-style directory listing — for example the
*Game Development / Programming* folder of the Gentoomen Library mirror:

```
https://theswissbay.ch/pdf/Gentoomen%20Library/Game%20Development/Programming/
```

It crawls the listing, shows you what it found, then streams each PDF to disk
in parallel with retries, resume-friendly skipping of already-downloaded files,
and a clear progress summary.

## Requirements

- **Node.js 18 or newer** (uses the built-in `fetch` and web streams — nothing
  to `npm install`).

Check your version:

```bash
node --version
```

## Quick start

```bash
cd pdf-batch-installer

# 1. Preview what's in the folder (downloads nothing)
node download.mjs --list

# 2. Install everything into ./downloads
node download.mjs

# 3. Or grab the whole subtree (descend into subfolders) somewhere specific
node download.mjs --recursive --out ~/Books/gamedev
```

## Usage

```
node download.mjs [url] [options]
```

| Option | Description | Default |
| --- | --- | --- |
| `url` (positional) | Directory listing URL to scan | Gentoomen → Game Development → Programming |
| `-o, --out <dir>` | Output directory | `./downloads` |
| `-c, --concurrency N` | Parallel downloads | `4` |
| `-r, --recursive` | Descend into subfolders | off |
| `-f, --filter <regex>` | Only download paths matching the (case-insensitive) regex | — |
| `-l, --list` | List matching PDFs and exit (a.k.a. `--dry-run`) | — |
| `--force` | Re-download even if a complete copy already exists | off |
| `--retries N` | Retry attempts per file | `3` |
| `-h, --help` | Show help | — |

### Examples

```bash
# Only graphics/engine books, 6 at a time
node download.mjs --filter "unreal|opengl|directx|engine" -c 6

# Point it at any other listing
node download.mjs "https://theswissbay.ch/pdf/Gentoomen%20Library/Operating%20Systems/"

# Re-run any time — finished files are skipped automatically
node download.mjs --recursive
```

## How it works

1. **Crawl** — fetches the listing HTML and extracts every `href`. Links ending
   in `/` are subdirectories (followed only with `--recursive`); links ending
   in `.pdf` are queued for download. The crawl stays inside the root subtree.
2. **Plan** — dedupes, sorts, and applies your `--filter`, then prints the list.
3. **Install** — a small promise pool keeps `--concurrency` downloads in flight.
   Each file streams to a `*.part` temp file and is atomically renamed on
   success, so an interrupted run never leaves a corrupt PDF in place.
4. **Resume / skip** — before downloading, the local size is compared to the
   server's `Content-Length`; a complete match is skipped. Re-run the command to
   resume after an interruption or to retry failures.

## Notes & responsible use

- This tool only reads publicly served directory listings and downloads files
  the server already exposes. It sends a normal browser `User-Agent` and modest
  concurrency — please keep `--concurrency` reasonable to avoid hammering the
  mirror.
- The Gentoomen Library is a third-party mirror. Verify the licensing/copyright
  status of any material before redistributing it. Use for personal, lawful
  purposes only.
- If a download fails (network blip, server hiccup), it's reported at the end;
  just run the command again and only the missing files are fetched.

## License

MIT
