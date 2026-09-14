# Visit Kirtland GitHub Pages

This repo now builds a static GitHub Pages version of the Visit Kirtland site from the downloaded Google Sites HTML in `VK2.0`.

## Build locally

```powershell
.\tools\build-site.ps1
```

The deployable site is generated into `site/`.

## Web analytics

Cloudflare Web Analytics tracks visits and page views for Visit Kirtland. The
tracking script is included in every published HTML page by
`tools/add-web-analytics.ps1`, which also runs at the end of the site build.
The public beacon token is a site identifier, not an API credential.

Reports: https://dash.cloudflare.com/00557c31aa7179ae04ffb2b9bbe7d6bb/web-analytics/overview?siteTag~in=429aa3db9cfe4171944f37d5d48d94dc&excludeBots=Yes

Tracking was added September 14, 2026; earlier visits cannot be recovered by this setup.

## Deploy

The workflow in `.github/workflows/pages.yml` builds `site/` and deploys it to GitHub Pages on every push to `main`.

In GitHub, set **Settings > Pages > Build and deployment > Source** to **GitHub Actions**. The generated `site/CNAME` is configured for `www.visitkirtland.com`, so point the domain DNS to GitHub Pages when you are ready to switch over.
