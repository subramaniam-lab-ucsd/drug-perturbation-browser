#!/bin/sh
# Publish the built site to the gh-pages branch.
#
# The site branch is rewritten as ONE orphan commit every time. The per-drug
# Arrow files change wholesale on each rebuild, so an ordinary branch would add
# about 448 MB of new blobs per release: dist packs to 313 MB, a redeploy peaks
# the repository at 626 MB, and it returns to 313 MB once the orphaned objects
# are collected. The cost is that the site branch has no history, which is
# correct: its history is main's.
#
# Usage:  ./deploy.sh                      build output -> gh-pages
#         REMOTE=<url> ./deploy.sh         publish somewhere else
#         ./deploy.sh --no-test            skip the gates (not advised)
set -e
cd "$(dirname "$0")"

REMOTE="${REMOTE:-$(git config --get remote.origin.url)}"
[ -n "$REMOTE" ] || { echo "no remote. Set REMOTE=<url>." >&2; exit 1; }
PAGES_BRANCH="${PAGES_BRANCH:-gh-pages}"

NODE_DIR=$(dirname "$(find "$HOME" -maxdepth 4 -name node -type f -perm -u+x 2>/dev/null | head -1)")
PATH="$NODE_DIR:$PWD/node_modules/.bin:$PATH"; export PATH

die() { echo "deploy: $1" >&2; exit 1; }

[ -d dist ] || die "no dist/. Run ./build.sh first."
[ -f dist/.nojekyll ] || die "dist/.nojekyll missing. Pages would strip _file/ and the site would render nothing. Run ./build.sh."
[ -d dist/_file/detail ] || die "dist/_file/detail missing. Run ./build.sh."

if [ "$1" != "--no-test" ]; then
  # A deploy is the one action that is awkward to take back: the old site is
  # gone the moment the force-push lands.
  echo "[1/3] acceptance"
  node check.mjs
  echo "[2/3] pages layout at a subpath"
  node check_pages.mjs
else
  echo "[1/3] skipped"; echo "[2/3] skipped"
fi

N=$(find dist/_file/detail -name '*.arrow' | wc -l)
if [ "$N" -lt 1000 ]; then
  echo
  echo "WARNING: dist carries detail for $N files, not the full 1137."
  echo "That is the committed development subset. The deployed site would 404"
  echo "on every other drug. Run ./refresh.sh detail first, then ./build.sh."
  printf "Deploy anyway? [y/N] "
  read -r a; case "$a" in y|Y) ;; *) die "stopped" ;; esac
fi

echo "[3/3] force-push $(du -sh dist | cut -f1) to $PAGES_BRANCH"
# A bare repository outside the tree, with dist as the work tree. This avoids
# copying 448 MB just to commit it.
GD=$(mktemp -d)/site.git
git init -q --bare "$GD"
GIT_DIR="$GD" GIT_WORK_TREE="$PWD/dist" git add -A
GIT_DIR="$GD" GIT_WORK_TREE="$PWD/dist" git commit -q \
  -m "Built site $(date -u +%Y-%m-%dT%H:%MZ)" \
  -m "Source: $(git rev-parse --short HEAD 2>/dev/null || echo uncommitted)"
GIT_DIR="$GD" git push --force "$REMOTE" "HEAD:refs/heads/$PAGES_BRANCH"
rm -rf "$(dirname "$GD")"
echo "deployed to $PAGES_BRANCH."
