# Deploying

The site is static. It is built on a machine that can reach the analysis
objects, and the built directory is pushed to GitHub Pages.

## What this repository needs to build

Nothing outside itself. `src/data/` holds the loader output as static Arrow and
JSON, so `./build.sh` is Node only: Tailwind, the Framework build, a copy of
`src/detail/` into `dist/_file/`, and `.nojekyll`.

Regenerating that data is the one step that needs the analysis repository, and
only when the analysis outputs change. `./refresh.sh` reads, from
`<ANALYSIS_REPO>`:

| input | size | read by |
|---|---|---|
| `tahoe_response/calibration/profiles/` | 375 MB | `loaders/build_detail.py`, copied verbatim |
| `tahoe_response/calibration/*.parquet`, 8 tables | 3.3 MB | the loaders in `loaders/` |
| `tahoe_response/spec/*.yaml`, 2 files | under 1 MB | the families loader |
| `data/tahoe-metadata/*.csv`, 3 files | 0.31 MB | `panel.lines()`, `panel.drugs()` |
| `tahoe_response/src/`, the Python package | 452 KB | every loader, via `loaders/_common.py` |

About 379 MB in total. The 11.5 GB `deseq2_well_vs_dmso.h5ad` and the 415 MB
`tf_activity_collectri.h5ad` sit one stage further upstream: they are what
produced the calibration tables, and nothing in this repository opens them.

That 379 MB is why a refresh does not run in GitHub Actions. The build does, in
principle, since it needs only what is committed; the limit is that a full
deploy also needs the 444 MB of per-drug detail, and only 24 drugs of it are
committed.

Every number on the site comes from the same calibration tables as the analysis
figures. The loaders compute no statistic.

## What gets published where

| branch | contents | size |
|---|---|---|
| `main` | everything in this repository | about 32 MB |
| `gh-pages` | the built site, one orphan commit, force-pushed | 448 MB after a full refresh |

`gh-pages` is rewritten as a single commit on every deploy. The 1,137 per-drug
Arrow files change wholesale on each rebuild, so an ordinary branch would add
about 448 MB of new blobs per release and the repository would exceed GitHub's
1 GB guidance within two of them. Its history is `main`'s.

Measured against a local bare repository: the 448 MB `dist` packs to 313 MB, and
a second deploy takes the repository to 626 MB until the orphaned objects are
collected, after which it returns to 313 MB. So the repository does not grow
release over release, but it does hold two copies between a deploy and GitHub's
garbage collection, which is not on a schedule you control. Budget for roughly
630 MB.

Breakdown of the 448 MB:

- 255 MB: 379 per-drug gene response profiles, `_file/detail/profiles/gene/`
- 121 MB: 379 per-drug transcription factor response profiles
- 69 MB: 379 per-drug gene tables, `_file/detail/genes/`
- 3 MB: the four pages, the JavaScript, and the tables loaded on every visit

Largest single file is 2.1 MB, well inside the 100 MB per-file limit. A reader
fetches about 0.7 MB per drug they open, so the 100 GB/month soft bandwidth
limit is not a concern.

## First-time setup

```sh
npm install
git push -u origin main                                        # the source

ANALYSIS_REPO=~/perturbseq-harmonization ./refresh.sh detail   # all 1,137 files
./build.sh
./deploy.sh                                                    # tests, then gh-pages
```

Then in the repository settings, Pages, set the source to **Deploy from a
branch**, branch `gh-pages`, folder `/ (root)`. The site appears at
`https://subramaniam-lab-ucsd.github.io/drug-perturbation-browser/` within a
minute or two.

The `refresh.sh detail` step is what makes the deployed site cover all 379
drugs. Without it `deploy.sh` warns and asks before publishing a site that
would 404 on every drug outside `dev-drugs.txt`.

## Routine deploy

```sh
./build.sh
./deploy.sh
```

`deploy.sh` refuses to push unless `check.mjs` and `check_pages.mjs` both pass,
because the force-push replaces the live site immediately. Source changes go to
`main` the ordinary way, with `git push`.

## Two things that silently break a Pages deployment

**`.nojekyll`.** Pages runs Jekyll unless `dist/.nojekyll` exists, and Jekyll
discards every path beginning with an underscore. That is `_file/`, `_import/`
and `_observablehq/`: the entire data layer and all the JavaScript. The site
would deploy, return 200 on every page, and render nothing. `build.sh` writes
the file, and `check_pages.mjs --jekyll` asserts that removing it really does
kill the site, so the guard cannot be quietly dropped.

**Absolute paths.** A project site is served from
`subramaniam-lab-ucsd.github.io/drug-perturbation-browser/`, so any absolute
path leaves the site. Every link is relative: `./`, `./statistics`, `./about`
in `observablehq.config.js`, `./results?...` in `src/index.md`, and
`./_file/detail` for the runtime fetches. `check_pages.mjs` serves `dist` under
that prefix and fails on any request that escapes it.

## What a reader downloads

Measured on a cold cache, which matters more than the size of `dist`:

| page | transferred | requests |
|---|---|---|
| landing | 1.74 MB | 57 |
| Datasets | 3.81 MB | 58 |
| About | 0.39 MB | 16 |
| results, one drug | 5.52 MB | 71 |
| results, six drugs | 13.09 MB | 91 |
| results, all 379 drugs | 4.0 MB | 67 |

Each added drug costs about 1.5 MB, being its three per-drug files. The worst
case is not the largest selection: with every drug selected the page fetches no
per-drug files at all, because the two panels that need them are capped and
everything else comes from the 3.2 MB of tables loaded on every visit.

Pages allows roughly 100 GB of bandwidth a month, which at 5.5 MB a view is
about 18,000 results views.

## Moving off GitHub Pages

If 448 MB on a branch becomes awkward, the same `dist` deploys to Cloudflare
Pages with `wrangler pages deploy dist`, which uploads the directory and keeps
it out of Git entirely. Its limits are 25 MB per file and 20,000 files; this
site is 2.1 MB and 1,208. Nothing in the site assumes a host.
