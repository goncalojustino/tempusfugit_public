# Tempusfugit UI Palette

Centralized reference for the application color palette and CSS variables.

Primary palette (hex)
- Ink: #001219
- Teal 700: #005f73
- Teal 500: #0a9396
- Teal 200: #94d2bd
- Cream: #FFF9E6
- Amber: #ee9b00
- Orange: #ca6702
- Russet: #bb3e03
- Brick: #ae2012
- Oxblood: #9b2226

CSS variables (defined in `web/src/styles/base.css:1`)
- `--c-ink`: #001219
- `--c-teal-700`: #005f73
- `--c-teal-500`: #0a9396
- `--c-teal-200`: #94d2bd
- `--c-cream`: #FFF9E6
- `--c-amber`: #ee9b00
- `--c-orange`: #ca6702
- `--c-russet`: #bb3e03
- `--c-brick`: #ae2012
- `--c-oxblood`: #9b2226

Theme tokens (mapped from palette)
- `--bg`: var(--c-cream)
- `--bg-alt`: var(--c-teal-200)
- `--surface`: #FFFFFF
- `--muted`: var(--c-teal-700)
- `--border`: var(--c-teal-200)
- `--accent`: var(--c-teal-500)
- `--accent-2`: var(--c-teal-700)
- `--accent-3`: var(--c-amber)
- `--text`: var(--c-ink)

Grid slot light shades
- `--slot-weekend`: var(--c-teal-200)
- `--slot-30m`: var(--c-cream)
- `--slot-3h`: #e9f6f6
- `--slot-12h`: #fff1dc
- `--slot-24h`: #fff6d9

Status badges
- ok: teal tones (background alpha, border teal-200, text teal-700)
- limited: amber/orange tones
- down: oxblood/brick tones

Notes
- Use `var(--accent)` for buttons and links.
- Prefer `var(--muted)` for secondary text.
- Keep wall/display components high-contrast (see `slot-card` classes).

