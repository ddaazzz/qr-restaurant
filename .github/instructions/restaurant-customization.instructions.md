---
description: "Use when working on restaurant/ branches, forking a restaurant, or making per-restaurant customizations. Covers the branch-based versioning model, deployment conventions, and mobile compatibility rules."
---

# Per-Restaurant Customization via Branch Forking

## Branch Model
- `main` = platform. All default restaurants share this deployment at chuio.io.
- `restaurant/<name>` = forked from main at a specific version. Own deployment + own database.
- Customized restaurants do NOT auto-receive main updates.
- Mobile app is a single binary connecting to `apiBaseUrl` returned at login.

## Making Changes on a Restaurant Branch
Edit files directly. No plugin system, no overrides, no hooks.
- Backend: `backend/src/routes/`, `backend/src/services/`
- Frontend: `frontend/*.js`, `frontend/*.css`, `frontend/*.html`
- Database: `backend/migrations/` (continue the sequence number from where you forked)
- Customer menu: `frontend/menu.js`, `frontend/menu.css`, `frontend/landing.html`

## Database
Each customized restaurant has its own database. ALTER tables freely.
Migration numbers continue from where the branch was forked from main.
Always use parameterized queries.

## Mobile Compatibility
The mobile app connects to the `apiBaseUrl` returned by the login API.
Staff at customized restaurants are automatically directed to their backend.
- Login always goes through the main platform first
- The response includes `apiBaseUrl` which redirects the app to the custom backend
- On logout, the app resets to the main platform URL
- If the restaurant branch removes or renames API endpoints the mobile uses, the app must handle that gracefully

## Deploying a Forked Restaurant

1. Create branch: `git checkout -b restaurant/<name>` from main
2. Deploy to its own server (Render, Railway, VPS, etc.)
3. Set up its own PostgreSQL database, run all migrations
4. Set the restaurant's URL in the main database:
   ```sql
   UPDATE restaurants SET api_base_url = 'https://<name>.chuio.io' WHERE id = <ID>;
   ```
5. QR codes for this restaurant should point to the custom deployment domain

## Merging Platform Updates (Optional, Rare)
```sh
git checkout restaurant/<name>
git merge main
# Resolve conflicts
# Test thoroughly
# Re-deploy
```
Only do this when the restaurant explicitly needs new platform features.
