# Contributing

Thank you for improving **Vulkanchik Music** for Firebot.

## Flow

1. Fork → branch → PR against `main`.
2. Run `npm test` and `npm run build` locally.
3. Maintainers review and merge.
4. A maintainer cuts a GitHub Release (`vX.Y.Z`); the site pulls artifacts via `make sync-plugins` in the Vulkanchik monorepo.

## Notes

- Plugin talks to the public Music API (`/api/music/v1`); do not hardcode secrets.
- Bump `version` + `vulkanchik.releaseNotesUk` in `package.json` when shipping user-visible changes.
- Site download paths stay `/downloads/firebot/...` (manifests are rewritten/kept site-relative on sync).
