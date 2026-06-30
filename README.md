# Visit Kirtland GitHub Pages

This repo now builds a static GitHub Pages version of the Visit Kirtland site from the downloaded Google Sites HTML in `VK2.0`.

## Build locally

```powershell
.\tools\build-site.ps1
```

The deployable site is generated into `site/`.

## Deploy

The workflow in `.github/workflows/pages.yml` builds `site/` and deploys it to GitHub Pages on every push to `main`.

In GitHub, set **Settings > Pages > Build and deployment > Source** to **GitHub Actions**. The generated `site/CNAME` is configured for `www.visitkirtland.com`, so point the domain DNS to GitHub Pages when you are ready to switch over.
