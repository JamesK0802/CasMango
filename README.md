# CasMango

**[Open CasMango →](https://jamesk0802.github.io/CasMango/)**

Browser-based analysis of pooled CRISPR amplicon sequencing, with Nanopore and Illumina paired-end support. Analysis runs locally on your computer; sequencing reads are not sent to a server.

## Features

- Multi-reference assignment with ambiguity handling, plus a homoeolog mode.
- Configurable target windows and mutation classification with read-level annotations.
- File and folder input (`.fq`, `.fastq`, `.fq.gz`, `.fastq.gz`), automatic filename sorting and drag reordering.
- Copy selected files into a local folder, with optional batch renaming (desktop Chrome/Edge).
- Curate files, references and mutation groups; save the retained results as a new baseline.
- Excel result export/reopening, benchmarking and a sequence workspace.

## Run locally

Use Node.js 22.12+ (22.x) or 24.x.

```sh
npm ci
npm start
```

Open [localhost:4200](http://localhost:4200).

```sh
npm test        # Regression and unit tests
npm run build   # Production output: dist/casmango/browser/
```

## Project layout

- `src/` — application and analysis code
- `tests/` — core, model, service and UI regression tests with fixtures
- `public/` — static assets
- `.github/workflows/deploy.yml` — test, build and deploy to GitHub Pages

Pushes to `main` automatically test and deploy the [live site](https://jamesk0802.github.io/CasMango/). See [deployment notes](docs/deployment.md).
