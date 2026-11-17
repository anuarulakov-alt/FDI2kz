# Changelog

## 2026-11-16: content for §1–§4 (v0.2)
- Inserted your wording for §1 Problem, §2 Data (figure, four panels, 12 silences), §3 Research (5 approaches, gap), §4 Solution (spec and 3 cases), the credit line, and 17 sources. Bill, Verdict, Transparency and the Hero verdict are left as [TO FILL].
- data.json now holds 60 numbers, all `verified: false`. Problem stat 2 reads the Panel B records (B_mining, B_manufacturing), so each number is stored once.
- New optional fields:
  - `derived`: arithmetic on numbers you supplied; shown in the tooltip.
  - `chart: false`: shown in text only, not drawn.
  - `separate`: the Panel A 9M 2025 diamonds, not joined to the series.
  - `value_high`: ranges such as 10–11%.
- Text can show a number in your exact wording: `{{id|template|decimals}}` in data.json, or `data-fmt` / `data-dec` in HTML (e.g. "$164bn").
- Presentation mode shows only the "what is missing" column of the silences map.
- FLAG: 4 numbers have no source: S_net2024_low, S_net2024_high, S_income_payable, S_net_profit.

## 2026-11-16: skeleton (v0.1)
- Built the one-page structure: hero, §1 Problem, §2 Data (four-panel figure plus silences map), §3 Research, §4 Solution, §5 Bill, §6 Verdict, AI transparency, Sources.
- data.json schema: every value is `null`, every `verified` is `false`, and there are template records for panels A–D.
- Charts are hand-written SVG read from data.json. Filled markers mean verified and outlined markers mean unverified. Tooltips show source, basis and vintage.
- Sticky arc navigation with a progress bar. Presentation mode (P, arrows, F, Esc).
- Fonts are self-hosted, and a CSP blocks all external requests.
- No content supplied yet: placeholders only.
