# Drug Perturbation Browser

A browser over pooled chemical-perturbation atlases. Tahoe-100M today.

All 52,374 fitted drug-by-cell-line contrasts across 379 small molecules, 48
human cancer cell lines and three concentrations. Four pages:

| page | what it is |
|---|---|
| **Query** (`/`) | the form, and nothing else |
| **Results** (`/results`) | five tabs over one query: Overview, Differential Expression, Transcription Factors, Profile Similarity, Genotype Specificity |
| **Datasets** (`/statistics`) | the whole panel at one concentration: drugs, cell lines, transcription factors |
| **About** (`/about`) | what is loaded, how each number was measured, what it cannot tell you |

A query is three lists: drugs, cell lines, concentrations. Each control takes
more than one value, and a category (a mechanism, a tissue, a mutated gene, a
specific genotype) expands into its members rather than becoming a filter of its own. The
query lives in the URL, so a result is a shareable link:

```
/results?dose=0.5&d=Adagrasib,Trametinib&l=CVCL_0428,CVCL_1547
```

An empty list means everything, which keeps the common case out of the URL.

## Selecting more than one drug

Only two things on the results page are fetched per drug: the gene-level detail
and the 469-dimension profile vectors. Everything else comes from tables that
already cover all 379 drugs, so most of the page keeps working however many are
selected.

| panel | behaviour as the selection grows |
|---|---|
| response magnitude | bar chart for one drug, drug × cell line heatmap for several |
| which genes changed | gene × **cell line** for one drug, gene × **drug** for 2 to 8 |
| every gene / every factor, in one condition | the selector spans drug and cell line |
| which transcription factors each drug hits | drug × factor matrix, appears at 2 drugs, **no cap** |
| which responses look alike | condition × condition while that is under 60, then collapses to drug × drug |
| genotype verdicts | verdict census plus a per-drug table, appears at 2 drugs, **no cap** |
| the genotype ladder | gains a drug column, **no cap** |
| nearest drugs | one row per selected drug, **no cap** |

Two caps, both stated on the panel rather than left as a blank: **8 drugs** for
anything needing gene detail or a profile vector, and **60 rows** for a
correlation matrix before it aggregates. A capped panel says what to do instead.

Selecting a mechanism class is the case this was built for. Picking the six RAS
drugs puts trametinib, binimetinib, BI-3406 and RMC-6236 in one dark block of the
drug × drug matrix while adagrasib and lonafarnib sit apart, and the verdict
census reads 1 genotype-specific, 2 gene-level, 2 pathway-level.

## The results tabs

Every panel carries a byline stating the method and the cut-offs rather than a
plain-language gloss, because the audience is reading the numbers.

Each panel leads with one plain sentence saying what the number means, and
hides the method behind an (i) disclosure (`<details>`, not a modal: nothing to
focus-trap, it prints, and it is keyboard accessible without script). A test
fails if any plain caption contains Wald, ULM, CollecTRI, Benjamini, tmin,
`Driver_`, padj or Mann-Whitney.

Terminology is one word throughout. "Lesion" and "allele" both meant genotype,
so both are gone from the spec file, the data columns, the module names and the
prose; a test fails if either word appears anywhere a reader can see.

| tab | contents | what the method note states |
|---|---|---|
| Overview (*how much each cell line responded*) | response size by cell line, query summary and verdict, mutations in the panel | DESeq2 design, control set, gene filter, BH threshold; the DepMap columns the genotype comes from |
| Genes changed (*which genes went up or down*) | genes changed in the most cell lines | why ranking by \|Wald\| and taking the first `n_padj<0.05` recovers the FDR set exactly; recurrence-then-effect ordering; unshrunk log2FC |
| Pathway activity (*which transcription factors moved*) | activity by pathway, and every factor in one cell line | decoupleR ULM on the unfiltered Wald vector, CollecTRI edge and factor counts, `tmin`, NaN policy, what a score is |
| Response similarity (*do these responses look alike*) | gene and pathway correlation side by side on one ordering; nearest drugs | the coordinate systems, the ordering, the positive offset, and the neighbourhood hit rate against chance |
| Genotype link (*does the effect need a mutation*) | the three-rung ladder on three axes; the factors behind a hit | the spec file, the carrier minimum, exact Mann-Whitney, BH scope, the permutation null and its enumeration limit |

The tab bar is `src/components/tabs.js`. Panels are plain markup carrying
`data-tab` and are only hidden, never unmounted, so switching a tab does not
recompute a 47x47 correlation matrix. Plot sizes its charts from explicit
widths rather than from the DOM, so a chart drawn while hidden is still correct.

### The positive offset in the similarity matrices

Raw profile correlations sit almost entirely between 0 and 1, and the absolute
value is not interpretable. Every condition of a drug carries a shared additive
per-feature component: adagrasib's 41 **non**-responding cell lines still
correlate at r = 0.64 in gene space, and inert drugs score higher still (arbutin
0.77, uridine 0.81). Subtracting each feature's mean across the conditions in
view moves that to r = 0.01 with 47% negative, so the anticorrelation is real
and was only hidden.

Three things contribute: the Wald statistic divides by a per-gene standard error
that is a property of the experiment rather than the drug; CollecTRI regulons
overlap, so factor scores are correlated by construction; and the 1,000-gene
panel is selected for recurrent large \|Wald\|, which roughly doubles the floor
against a random panel (0.29 to 0.62; the top-\|Wald\| genes reach 0.75).

The matrices carry a centring toggle, off by default. The association tests are
unaffected either way, because response similarity is a within-group minus
between-group difference in which an additive component cancels.

## Repository layout

```
src/*.md              the four pages
src/components/       the query controls, tabs, icons, palette
src/data/             the data, as static Arrow and JSON (3.2 MB). Committed.
src/detail/           per-drug detail. 24 drugs committed, the rest ignored.
loaders/              the Python that produced src/data/. Not run by the build.
build.sh              tailwind, framework build, copy detail, write .nojekyll
refresh.sh            regenerate src/data/ and src/detail/ from the analysis repo
deploy.sh             force-push dist/ to gh-pages as one orphan commit
check.mjs             153 assertions against dist/
check_pages.mjs       12 assertions against dist/ served under a path prefix
dev-drugs.txt         which drugs' detail is committed, and why
```

The site builds with Node alone. Nothing in `build.sh` runs Python or reads
outside this repository, because `src/data/` holds the loader *output* rather
than the loaders. That is what makes this repository the place to work on the
browser.

## Build and run

```sh
npm install
./build.sh         # tailwind -> framework build -> copy detail -> .nojekyll
node serve.mjs     # http://localhost:3000
npm test           # check.mjs then check_pages.mjs
```

If `npm` is not on PATH, `build.sh` finds Node under the editor server itself.
For hot reload while editing:

```sh
export PATH="$(dirname $(find ~ -maxdepth 4 -name node -type f -perm -u+x | head -1)):$PWD/node_modules/.bin:$PATH"
observable preview     # http://127.0.0.1:3000
```

Preview serves `src/` directly, so `src/detail/` is already reachable there and
only `dist` needs the copy step.

**Do not serve `dist/` with `python -m http.server`.** The pages use clean URLs,
so `/about` is `about.html` on disk and a plain file server returns 404.
`serve.mjs` adds the `.html` fallback; real static hosts (GitHub Pages, Netlify,
Vercel, nginx `try_files`) do it for you.

## Which drugs work from a clone

All 379 drugs appear in the query and in every panel fed by the tables in
`src/data/`, which is most of the site. The three per-drug files that the
differential expression and profile similarity panels fetch are committed for
the 24 drugs in `dev-drugs.txt` only, because the full set is 444 MB. Query a
drug outside that list from a plain clone and those two panels will 404.

All three test suites stay green on the committed subset. `dev-drugs.txt` says which
entries are load-bearing for that.

## Refreshing the data

This is the only step that needs the analysis repository, and it is needed only
when the analysis outputs change.

```sh
ANALYSIS_REPO=~/perturbseq-harmonization ./refresh.sh tables   # src/data/, 3.2 MB
ANALYSIS_REPO=~/perturbseq-harmonization ./refresh.sh detail   # src/detail/, 444 MB
```

`tables` re-runs the loaders in `loaders/` against
`<ANALYSIS_REPO>/tahoe_response/calibration/`. Ten of the eleven outputs are
byte-identical run to run; `manifest.json` changes because it stamps the build
time and the analysis commit, which is how a stale build is detectable from
inside the About page.

`detail` rewrites all 1,137 per-drug files. Only the committed 24 will show as
modified afterwards; `.gitignore` covers the rest, and a tracked file stays
tracked, so `git status` is quiet.

Deployment is in [DEPLOY.md](DEPLOY.md).

## Data

Two files, and nothing else, for the measurements:

- `outputs/deseq2_well_vs_dmso/deseq2_well_vs_dmso.h5ad`
- `outputs/deseq2_well_vs_dmso/tf_activity_collectri.h5ad`

plus `data/tahoe-metadata/` for drug, cell line and sample annotation,
which is also where the DepMap driver calls come from.
`tahoe_response/src/sources.py` is the only place these are opened; everything the
site reads is derived from the tables it writes under `calibration/`.

Earlier objects (the consensus TF layer, the per-pair TF table, the hand-set
stringency thresholds) are deliberately not read. `sources.py` names them.

## Per-drug detail

Three sets, one file per drug, fetched by URL when a query needs them so they
never enter a page's payload:

| path | what | size |
|---|---|---|
| `detail/genes/<drug>.arrow` | the genes it changed, per condition | 160 KB each, 61 MB |
| `detail/profiles/gene/<drug>.arrow` | the Wald statistic over 1,000 genes | 703 KB each, 267 MB |
| `detail/profiles/tf/<drug>.arrow` | the ULM score over all 469 factors | 331 KB each, 126 MB |

The profiles are what make "how similar are these two responses?" answerable for
an arbitrary selection. Nothing is precomputed pairwise: the pairs depend on what
the user picked and there are far too many to enumerate, so the page fetches a
profile per selected drug and correlates in the browser. It declines above six
drugs rather than pulling tens of megabytes.

The gene panel is the same 1,000 genes for every drug, chosen by how often a gene
turns up in some condition's significant set. Two profiles can only be correlated
over the same coordinates.

`build_detail.py` writes them and `build.sh` copies them into `dist/`, because
Framework only copies what a `FileAttachment` references. The filename slug
mirrors Python's `str.isalnum()`, which is Unicode-aware, so the JavaScript side
matches on `\p{L}\p{N}` and not `A-Za-z0-9`.

## The genotype ladder

Three rungs, asked in order, for every drug whose annotated target is a mutated
oncogene in this panel:

| rung | contrast | what a hit means |
|---|---|---|
| gene | any mutation in the target gene vs none | the drug tracks the gene |
| vs wild type | one genotype vs unmutated lines | the drug tracks that genotype |
| conditional | one genotype vs other mutations in the same gene | the drug needs that genotype |

The gene rung alone is misleading and is never shown alone. At 0.5 µM adagrasib,
BI-3406, RMC-6236 and trametinib all clear it, and adagrasib clears it *least*
well of the four, because its effect is confined to one genotype and the other
eighteen KRAS-mutant lines dilute the median.

Three axes are measured independently at every rung and never combined:

- **genes changed**, the DESeq2 count at FDR 5%
- **pathway score**, the median z of the one family `spec/target_pathways.yaml`
  names for the drug's target, signed so larger always means more effect
- **response similarity**, how much more the carriers resemble each other than
  they resemble the comparison lines, with an exact permutation null

They disagree, and that is the point. Adagrasib is carried by all three.
Dabrafenib is carried by the pathway score and response similarity while the
gene count never reaches significance at any concentration. A portal built on
counts alone would report dabrafenib as having no BRAF dependence.

Response similarity is confirmatory only, never a scan. Used as a search across
all twelve genotypes its null rate is 13.6% rather than 5%, because carriers are
lineage-concentrated and same-lineage lines correlate under almost any drug.
Permuting within lineage improves calibration to 8.3% and costs most of the
power, so it does not pay for itself; the fix is to only ever run it on a
pre-specified genotype and to flag carrier sets drawn from fewer than three organs.

BH runs within a drug, across its genotypes, doses, contrasts and axes.

### Verdicts

`src/analysis/verdicts.py` assigns one label per drug from a closed vocabulary,
by rules fixed in advance and ranked strictly by rung: `specific_genotype`,
`specific_genotype_vs_wild_type`, `gene_level`, `pathway_level`,
`no_genotype_dependence`, `underpowered`, `untestable_in_panel`,
`not_genotype_targeted`. On the current data:

| verdict | drugs |
|---|---|
| specific_genotype | adagrasib (KRAS p.G12C) |
| specific_genotype_vs_wild_type | dabrafenib, vemurafenib, encorafenib, APTO-253, arbutin |
| gene_level | BI-3406, RMC-6236, bimiralisib, torkinib |
| pathway_level | alpelisib, GSK1059615, lonafarnib, regorafenib |
| untestable_in_panel | 45 |
| not_genotype_targeted | 320 |

A genotype hit against wild type is demoted to `gene_level` when the gene
tier also hits and the genotype is under 60% of that gene's carriers, because the
genotype's lines are a subset of the gene's and the same signal shows at both
rungs. That is what separates BI-3406 from dabrafenib.

## De-orphaning

For the 115 drugs with no annotated target, the ladder has nothing to say. The
only thing the data supports is a neighbourhood: the nearest drugs in
transcription-factor signature space. The nearest neighbour shares the drug's
annotated mechanism **17% of the time against a 5.6% chance baseline**, a
threefold enrichment. That number is computed by
`src/analysis/neighbourhood.py`, shipped in the table and printed on the page.

It is enough to suggest a neighbourhood and not enough to assign a target, so
the panel is suppressed entirely for any drug that already has a genotype
verdict.

What is deliberately not built: nominating a target by maximising a genotype
AUROC over the driver genes. That returns MYC for 274 of 375 drugs and recovers
the drug's own annotated target in 2 of 261.

## How it is wired

- `src/data/` holds static Arrow and JSON. The loaders that produced it live in
  `loaders/`, import `tahoe_response.src`, and are re-run by `./refresh.sh`, so
  the app can never disagree with the analysis tables while still building
  without them.
- `loaders/*.arrow.py` emit Arrow IPC, not parquet. Framework reads both, but
  `.parquet()` pulls a 5 MB wasm decoder while `.arrow()` uses the apache-arrow JS
  already on the page, for the same bytes over the wire.
- Repeated strings are dictionary-encoded. `drug` and `cell_line` repeat across
  52,374 rows; as pandas categories `conditions.arrow` is 0.56 MB rather than 2 MB.
- Integer columns are cast to int32 in `loaders/_common.to_browser`, because
  int64 reaches JavaScript as BigInt and Plot cannot scale it.
- `src/components/palette.js` is Okabe-Ito, matching the matplotlib figures. Grey
  is recessive only; pink was dropped for failing the normal-vision floor against
  purple.
- Regulators are split: `regulators.arrow` is a 1 MB summary over drug × dose ×
  factor. The unsplit table was 95.8 MB.

## Checks

`check.mjs` is the main suite: 153 assertions against `dist/`. It opens each tab
in turn, since a panel on a hidden tab has a zero bounding rect and cannot be
judged. It serves the build,
drives the form, follows it to the dashboard, and asserts on what a person sees:
every panel has marks in it, the gene view and the pathway view sit on the same
row rather than stacked, gene symbols appear, the genotype claim is stated, the
DepMap table carries real ACH identifiers, the correlation matrix draws and
redraws when the space is switched, selecting two drugs puts both in the link,
profiles stay under a megabyte, and the word "compound" appears nowhere.

It also measures the luminance contrast between a tooltip's panel and its text.
That check exists because an earlier version rendered tooltips as dark boxes with
invisible text while a `textContent` assertion passed.

`check_preview.mjs` drives **both** the dev server and the build over the same
URLs. It exists because the suite only ever tested `dist`, which is how every
per-drug fetch came to 404 under `observable preview` while 75 assertions
passed. Any change to how detail files are served has to keep both green.

`check_pages.mjs` serves `dist/` under a path prefix, the way GitHub Pages
serves a project site, and fails on any request that escapes it. With
`--jekyll` it mimics Pages without `.nojekyll` and asserts that the site really
does die without that file, so the guard cannot be quietly dropped.
