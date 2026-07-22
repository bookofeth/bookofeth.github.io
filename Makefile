LEAF ?= leaf

# BOOE site: a static Zephyrus Leaf build. `make dev` for live preview, `make build`
# for the deployable dist/, `make check` for the smoke gate (renders + SEO artifacts
# + the house no-em-dash / no-en-dash rule). dist/ is rebuilt on CI, never committed.

.PHONY: dev build clean check preview

dev:
	$(LEAF) dev -addr :8080

build: clean
	$(LEAF) build
	bash bin/relocate-acts.sh dist

clean:
	rm -rf dist

check: build
	@test -f dist/index.html  || (echo "FAIL: dist/index.html missing" && exit 1)
	@test -f dist/sitemap.xml || (echo "FAIL: dist/sitemap.xml missing" && exit 1)
	@test -f dist/robots.txt  || (echo "FAIL: dist/robots.txt missing" && exit 1)
	@test -f dist/assets/css/tokens.css || (echo "FAIL: tokens.css missing" && exit 1)
	@test -f dist/assets/css/fonts.css  || (echo "FAIL: fonts.css missing" && exit 1)
	@! grep -rl $$'\xe2\x80\x94' dist --include='*.html' --include='*.css' --include='*.js' >/dev/null 2>&1 || (echo "FAIL: em-dash (U+2014) found in dist" && exit 1)
	@! grep -rl $$'\xe2\x80\x93' dist --include='*.html' --include='*.css' --include='*.js' >/dev/null 2>&1 || (echo "FAIL: en-dash (U+2013) found in dist" && exit 1)
	@! grep -rlE 'Deprecated:|Warning:|Notice:|Fatal error|Parse error' dist --include='*.html' >/dev/null 2>&1 || (echo "FAIL: PHP error text leaked into dist HTML" && exit 1)
	@echo "OK: smoke checks passed (home renders, SEO artifacts, no em/en-dash, no PHP leak)."

preview:
	cd dist && python3 -m http.server 4173
