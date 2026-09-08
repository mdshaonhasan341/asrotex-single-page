# Asrotex Group - single-page website

Static site: plain HTML, CSS and JavaScript, no build step.

## Publish on GitHub Pages

1. Create a repository and upload the contents of this folder (keep the folder structure: `frames/`, `assets/`, `vendor/`).
2. In the repository, open Settings > Pages, choose "Deploy from a branch", select the branch and the root folder, and save.
3. The site is served at `https://<user>.github.io/<repository>/`. All paths are relative, so no configuration is needed.

## Run locally

Any static server works, for example:

    python -m http.server 8090

then open http://localhost:8090. Do not open `index.html` directly from the file system; the scroll tour needs an HTTP server.

## Still to fill in

- Contact card: `[HQ ADDRESS]`, `[PHONE]`, `[EMAIL]`, `[LINKEDIN URL]`, `[LEADERSHIP NAMES + TITLES]` in `index.html`.
- Logo: the nav and footer use a typographic wordmark; the spot is marked with a `[LOGO SVG]` comment in `index.html`.
- Enquiry form: set `window.FORM_ENDPOINT` at the bottom of `index.html` to a form service URL (Formspree, Basin or your own API). Empty means demo mode.

## Layout

| Path | Purpose |
|---|---|
| `index.html`, `styles.css`, `main.js` | The site. Tour configuration is the `window.TOUR` block at the bottom of `index.html`. |
| `vendor/lenis.min.js` | Smooth scrolling. |
| `frames/<chapter>/` | Scroll-scrubbed tour, 120 WebP frames per chapter. |
| `assets/posters/` | First frame of each chapter (hero image, canvas poster, social preview). |
| `assets/video/` | Muted clips used on phones and for reduced-motion users. |
| `assets/photos/` | Photography used across the sections. |
