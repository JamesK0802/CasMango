# Deployment

CasMango is a standalone static application. Analysis runs locally in the browser without an analysis backend or database.

## GitHub Pages

Live site: **https://jamesk0802.github.io/CasMango/**

The [GitHub Actions workflow](../.github/workflows/deploy.yml) tests and builds pushes to `main` with `/CasMango/` as the base URL, then deploys to GitHub Pages. Set the repository's Pages publishing source to **GitHub Actions**.

## RSB rawdata

```sh
npm ci
npm test
npm run build -- --base-href /pub/rawdata1/CasMANGO/
```

Publish the contents of `dist/casmango/browser/` to the `CasMANGO` directory in the RSB rawdata repository. Publish assets before replacing `index.html`, then verify the live page and referenced bundles.

Live site: **https://ftp.rsb.anu.edu.au/pub/rawdata1/CasMANGO/**

For other static hosts, use the corresponding base URL. Do not commit build output, dependencies or caches.

The landing page is at `#/`, analysis at `#/analysis`, results at `#/results`, sequences at `#/sequence-viewer`, and contact at `#/contact`. Hash navigation supports static subdirectory hosts.
