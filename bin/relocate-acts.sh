#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# relocate-acts.sh  (post-build step, owned by the Acts page agent)
#
# Binary-tier Zephyrus Leaf cannot nest custom pages: a file under
# templates/pages/acts/ is NOT routed, and content/*.md would render with the
# bundled docs chrome (sidebar + CDN Prism), which is off-brand for a flagship.
# So each Act chapter is authored as a flat top-level narrative page
# (templates/pages/act-{slug}.latte -> dist/act-{slug}/) whose canonical URL is
# already pinned to /acts/{slug}/ via $pageSlug. This step moves the built
# directory into its canonical home and fixes the auto-generated sitemap, so the
# /acts/{slug}/ links (home teaser + the /acts/ overview) resolve on the deployed
# site. It is the post-build relocation pattern anticipated in CONTENT-IA.
#
# Idempotent. Run by `make build` and by the Pages CI workflow after `leaf build`.
# ---------------------------------------------------------------------------
set -euo pipefail

DIST="${1:-dist}"

if [ ! -d "$DIST" ]; then
  echo "relocate-acts: no '$DIST' directory, nothing to do"
  exit 0
fi

shopt -s nullglob
mkdir -p "$DIST/acts"

moved=0
for dir in "$DIST"/act-*/; do
  name="$(basename "$dir")"     # e.g. act-eth-prague  (never matches 'acts')
  slug="${name#act-}"           # e.g. eth-prague
  target="$DIST/acts/$slug"
  rm -rf "$target"
  mv "$dir" "$target"
  moved=$((moved + 1))
  echo "relocate-acts: /$name/ -> /acts/$slug/"
done

# Rewrite the auto-generated sitemap loc entries: /act-{slug}/ -> /acts/{slug}/.
# The overview is '/acts/' (no trailing dash after 'act'), so it is left alone.
if [ -f "$DIST/sitemap.xml" ]; then
  perl -0pi -e 's{/act-([a-z0-9][a-z0-9-]*)/}{/acts/$1/}g' "$DIST/sitemap.xml"
fi

echo "relocate-acts: relocated ${moved} Act page(s) into ${DIST}/acts/"
