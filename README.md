# All About Julie

A single-page tribute site: her basics, her favorite foods, her photos, and a
note. Plain HTML, CSS, and JavaScript — no framework, no build step, no
dependencies. It works with JavaScript turned off and it is deployable straight
to GitHub Pages.

**Live preview while editing:**

```bash
python3 -m http.server 8000 --bind 0.0.0.0
# then open http://localhost:8000
```

---

## Adding your photos

This is the part you will actually do. Every photo on the page currently points
at a labelled placeholder in [`images/`](images/).

| Page slot        | File the page loads        | What to do                                            |
| ---------------- | -------------------------- | ----------------------------------------------------- |
| Hero portrait    | `images/portrait.svg`      | Drop in `images/portrait.jpg` and update the `src`     |
| Gallery photo 1  | `images/gallery-1.svg`     | Drop in `images/gallery-1.jpg` and update the `src`    |
| Gallery photo 2  | `images/gallery-2.svg`     | Drop in `images/gallery-2.jpg` and update the `src`    |
| …through photo 6 | `images/gallery-6.svg`     | Same pattern                                           |
| Favorites photos | `images/fav-food-1.jpg` …  | Already filled — replace to change her actual favorites |

Each gallery photo lives in `index.html` inside a `<li>` that looks like this:

```html
<li class="reveal" data-cat="smiles">
  <button type="button" class="frame" data-lightbox="0">
    <img src="images/gallery-1.svg" alt="Photo of Julie, slot 1"
         width="800" height="1000" />
    <span class="frame-caption">Photo 1</span>
  </button>
</li>
```

- **`src`** — point it at your file.
- **`alt`** — describe the photo; it is read aloud by screen readers and shown
  if the image fails to load.
- **`frame-caption`** — the handwritten-style label under the photo.
- **`data-cat`** — which filter button shows it: `smiles`, `dates`, or
  `everyday`.

To add a seventh photo, copy one `<li>` block and give the button the next
`data-lightbox` number (0, 1, 2, …). To add a filter, add a `<button class="chip"
data-filter="yourcategory">` next to the others.

The four favorite-food photos (`fav-food-1.jpg`, `fav-food-2.jpg`,
`fav-drink.jpg`, `fav-flowers.jpg`) are AI-generated stand-ins until you send
real ones.

## Editing the text

- **Basics** — the `<dl class="facts">` block. Every value is marked
  `data-editable` with a dashed underline so you can see what is still a
  placeholder.
- **Favorites** — the `<div class="fav-grid">` cards, including the color
  swatches (`--c: #hex`) and the lists.
- **Likes** — the `<ul class="tags">` chips.
- **Note** — the `<blockquote class="note-card">` near the bottom.
- **Her name** — it appears in `<title>`, the hero `<h1>`, the header brand,
  and the footer.

## What the page does

- **Light / dark theme** that respects the OS setting, remembers a manual
  choice in `localStorage`, and follows the system again until you pick one.
- **Photo lightbox** — click a photo to open it full size, with arrow keys,
  on-screen arrows, swipe, and <kbd>Esc</kbd> to close.
- **Gallery filters** — `data-cat` driven, with a live-region announcement of
  how many photos are shown.
- **Scroll reveals, floating hearts, scroll progress bar** — all disabled under
  `prefers-reduced-motion`.
- **Responsive** down to small phones; the nav collapses and the hero stacks.

## Checking your work

`scripts/check.py` validates the shipped files (nothing is stubbed or mocked):

```bash
python3 scripts/check.py --verbose
```

It fails the build if any of these are true:

- `index.html` has an unclosed, stray, or misnested tag
- an `href` or `src` points at a file that is not on disk
- an in-page `#fragment` link has no matching `id`, or an `id` is duplicated
- `<html>` is missing `lang`, or `<head>` is missing `charset`, `title`, or
  `viewport`
- a `.css` file has unbalanced braces or a `url()` pointing at a missing file
- a `.js` file fails `node --check`
- an SVG in `assets/` or `images/` is malformed, or a photo file is empty

It exits `0` when everything passes and `1` otherwise.

### Turning on CI

A ready-made workflow lives at [`ci/check.yml`](ci/check.yml). It is parked
outside `.github/workflows/` on purpose: the automated account used to push
this repository is not granted GitHub's `workflows` permission, so it is not
allowed to create or modify files under that path. Your own account is, so
activating it is a one-step move:

```bash
mkdir -p .github/workflows
git mv ci/check.yml .github/workflows/check.yml
git commit -m "Enable CI: validate the site on every PR and push"
git push
```

From then on every pull request runs `python3 scripts/check.py`, so a broken
link or an unclosed tag cannot reach `main`.

## Deploying to GitHub Pages

1. In the repository, open **Settings → Pages**.
2. Set **Source** to *GitHub Actions* if you enabled the workflow above (it
   publishes `main` automatically once checks pass), or to *Deploy from a
   branch* and pick `main` / `/ (root)`.
3. The site will be at `https://<username>.github.io/Julie/`.

If you deploy under a project path like that and want absolute URLs to work,
add `<base href="/Julie/">` in `<head>` — or keep using the relative paths this
page already uses, which work in both cases.

## Layout

```
.
├── index.html              the whole page
├── assets/
│   ├── styles.css          all styling
│   ├── app.js              theme, gallery, lightbox, reveals
│   └── favicon.svg
├── images/                 photos and placeholders
├── scripts/
│   └── check.py            the validation described above
└── ci/
    └── check.yml           GitHub Actions workflow (see "Turning on CI")
```
