[![make.fun](https://img.shields.io/badge/make.fun-bounty-blue)](https://make.fun)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node 22](https://img.shields.io/badge/Node-22-green)](https://nodejs.org)

# The World in One Day — 24 November 2026

A one-page newspaper front page that sums up Tuesday 24 November 2026
in a single image. The lead story is Seoul's brief shelter alert for
Ulleung Island after an unidentified aircraft entered South Korean
airspace, followed by the Banten candy factory fire, Russian strikes on
Kyiv, the Sparta II cargo ship fire in the Gulf of Finland, and the
Lisbon cost-of-living march — with a ticker of the day's other news.

## How it works

`main.ts` (Node 22, standard library only) draws the whole page pixel
by pixel: its own 5x7 bitmap alphabet, its own canvas primitives, and
its own PNG encoder. No network, no fonts, no image files. Run it with:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

It writes `entry.png` (1024x1024) into the output directory, and the
same bytes on every run.

## Referral

Built for the make.fun bounty — my referral code is `vqmdgqxf`.

## License

MIT — see `LICENSE`.
