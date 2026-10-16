# Deployment

Live site: **https://jamesk0802.github.io/CasMango/**

The [GitHub Actions workflow](../.github/workflows/deploy.yml) runs on pushes to `main` and can also be started manually from the Actions tab. It installs dependencies, runs tests, builds the app with `/CasMango/` as its base URL and deploys to GitHub Pages.

In repository **Settings → Pages**, the publishing source must be **GitHub Actions**. Do not commit `node_modules/`, build output or caches.

## Other static hosts

```sh
npm ci
npm run build
```

Serve `dist/casmango/browser/` using a static web server. For a subdirectory deployment, build with the appropriate prefix, for example:

```sh
npm run build -- --base-href /CasMango/
```

The app does not require an analysis backend, API credentials or a database. File and folder copying requires a supported browser on HTTPS or localhost.
