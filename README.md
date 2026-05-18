# Digital Business Card Maker (11ty)

A static Eleventy (11ty) site that lets users create a digital business card, generate a QR code, and export images.

## Quick start

```bash
npm install
npm run dev
```

- Dev server: Eleventy prints the local URL.
- Build output: `_site/`

## Scripts

- `npm run dev` – build icon list, then run Eleventy dev server
- `npm run build` – build icon list, then build the site

## Notes

- QR is generated client-side.
- Exports are PNG downloads generated client-side.

## Deploy

### GitHub

1) Create a new GitHub repo (empty) under your account.
2) In this project folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

This repo includes a `.gitignore` so `node_modules/` and `_site/` won’t be committed.

### Netlify

This repo includes `netlify.toml`, so Netlify will automatically use:

- Build command: `npm run build`
- Publish directory: `_site`

Steps:

1) Netlify → **Add new site** → **Import an existing project**
2) Connect your GitHub repo
3) Deploy (settings should auto-detect from `netlify.toml`)

After deploy, your QR codes will point to `https://<your-site>.netlify.app/card/#...`.