# Personal Blog Website

This repository contains the source code for a personal blog built with HTML, CSS, and JavaScript.

## Features

- Responsive layout
- Filterable blog posts
- Built-in admin editor
- Rich-text formatting (bold, italic, underline, font, size, color)
- Image upload/paste support for posts
- Saves directly to `js/posts.js`

## Project Structure

- `assets/` -> images and uploads
- `css/` -> styles
- `js/` -> client scripts and `posts.js`
- `pages/` -> additional pages
- `server.js` -> local API for editing/saving posts

## Getting Started

1. Clone the repository.
2. Run `npm start`.
3. Open `http://127.0.0.1:3000`.

## Admin Editor

1. Click `Admin` in the top bar.
2. Add or edit posts from the built-in editor.
3. Save changes (written to `js/posts.js`).

## GitHub Pages (Free Hosting)

1. Push this repo to GitHub (branch `main`).
2. In GitHub: `Settings` -> `Pages`.
3. Under `Build and deployment`, set `Source` to `GitHub Actions`.
4. Push any commit to `main` to trigger deploy.
5. Your site will be available at:
   - `https://<your-username>.github.io/<repo-name>/`

Notes:
- The workflow file is: `.github/workflows/pages.yml`.
- The Admin editor is intentionally hidden on hosted Pages.
- Saving to `js/posts.js` requires local server mode (`npm start`), because GitHub Pages is static-only.
