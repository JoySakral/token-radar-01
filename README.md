# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/JoySakral/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/JoySakral/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar — which pre-token protocol is worth farming next? It reads a sealed snapshot of
DefiLlama protocol data (758 protocols, 40 on the watchlist), ranks every protocol that could
still launch a token of its own by an implied value computed from the snapshot's own figures
(TVL, seven-day growth, time run with no token, chain breadth, momentum), and gives each one a
seven-step farm plan with costs and times. Wrapped, staked and bridged products of tokens that
already trade are left out: they are not tokens that do not exist yet.

The dashboard is a static page (no network, no framework): a ranked board with search, chain
and category filters, a watchlist view, a live-token view, a per-protocol detail drawer with the
model's own breakdown, and a model sandbox that recomputes implied values live. Implied value
is the radar's own estimate, never a price and never a prediction that a token will be issued.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json
npx serve out/dashboard
```

Or serve the built dashboard directly: `node serve.ts` is not included — any static server works,
for example `python3 -m http.server` inside `out/`, then open `dashboard/index.html`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=tvfbjxfd&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
