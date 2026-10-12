#!/bin/sh
# Build the site. Node only: the data under src/data/ is static Arrow and JSON,
# so nothing here runs Python or reaches outside this repository. To regenerate
# that data from the analysis objects, see ./refresh.sh.
set -e
cd "$(dirname "$0")"
NODE_DIR=$(dirname "$(find "$HOME" -maxdepth 4 -name node -type f -perm -u+x 2>/dev/null | head -1)")
PATH="$NODE_DIR:$PWD/node_modules/.bin:$PATH"; export PATH

echo "[1/3] tailwind"
tailwindcss -i src/tw.css -o src/tailwind.css --minify

echo "[2/3] framework build"
# Framework caches by file, and has served a stale table whose columns had
# changed. Clearing the cache costs a second.
rm -rf src/.observablehq/cache/data
observable build

# Framework copies only what a FileAttachment references. The per-drug detail is
# fetched by URL at runtime, one file per drug, so it is copied by hand.
#
# It goes under _file/ because that is where `observable preview` serves
# everything in the source root. Copying it to a bare dist/detail made the built
# site work while the dev server 404'd on every one of them.
echo "[3/3] detail into dist/_file"
mkdir -p dist/_file
rm -rf dist/_file/detail dist/detail
cp -R src/detail dist/_file/detail

# GitHub Pages runs Jekyll unless told not to, and Jekyll discards every path
# that starts with an underscore. That is _file/, _import/ and _observablehq/,
# which is the whole data layer and all the JS: the site would deploy, serve a
# 200 on every page, and render nothing.
touch dist/.nojekyll

N=$(find src/detail -name '*.arrow' | wc -l)
echo "dist: $(du -sh dist | cut -f1), detail: $(du -sh dist/_file/detail | cut -f1) in $N files"
