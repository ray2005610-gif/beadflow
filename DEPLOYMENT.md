# BeadFlow Public Test Deployment

BeadFlow is a static React + Vite app. It does not need a backend, login, payment, or server runtime.

## Recommended Public URLs

Use one of these static hosting platforms:

- Vercel: `https://your-project.vercel.app`
- Netlify: `https://your-project.netlify.app`
- Cloudflare Pages: `https://your-project.pages.dev`

Do not use `localhost` or a Codex preview URL for public testing. Those URLs are only reachable from the current machine or current Codex session.

## Vercel

1. Push this project to GitHub.
2. Open Vercel and import the GitHub repository.
3. Framework Preset: `Vite`
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Deploy.
7. Share the generated `.vercel.app` URL.

The included `vercel.json` already configures the build and SPA fallback.

## Netlify

1. Push this project to GitHub.
2. Open Netlify and create a new site from the GitHub repository.
3. Build Command: `npm run build`
4. Publish Directory: `dist`
5. Deploy.
6. Share the generated `.netlify.app` URL.

The included `netlify.toml` already configures the build and SPA fallback.

## Cloudflare Pages

1. Push this project to GitHub.
2. Open Cloudflare Pages and connect the repository.
3. Framework Preset: `Vite`
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Deploy.

## Local Network Testing

For testing on a phone or tablet on the same Wi-Fi:

```bash
npm run dev
```

Then open the computer's LAN IP, for example:

```text
http://192.168.x.x:5173
```

This is only for local network testing. It is not a public URL.

## Production Preview

After building:

```bash
npm run build
npm run preview
```

Then open:

```text
http://192.168.x.x:4173
```

Again, this is only a local network preview. Use Vercel, Netlify, or Cloudflare Pages for a real public test URL.

## Data Notes

BeadFlow currently stores projects, inventory, recent colors, and settings in browser localStorage.

- Data stays in the browser/device where it was created.
- Opening the public URL on another device will not show the original device's saved projects.
- This is expected for the no-backend first version.

## Verification Checklist

- `npm run build` succeeds.
- `dist/` is generated.
- Public URL opens without depending on Codex or localhost.
- Upload image works in mobile Safari/Chrome.
- Canvas renders and can be zoomed/panned.
- Save uses browser localStorage.
- PNG export downloads from the browser.
