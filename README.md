# QueensVoice

**Pick your language. See only the places in Queens that actually serve people in it.**

Almost half of Queens speaks a language other than English at home, but every service
directory for the borough is written like everybody reads English. A map of every clinic
near you is useless if you can't talk to anyone once you walk in.

So QueensVoice asks the language question first, and then only shows the health and
counseling places that report serving people in that language. Every language claim comes
from what the clinic itself reported to the federal government.

Only languages that some clinic actually serves show up in the picker, so you never pick
one and land on an empty map. There is also an "all languages" option for browsing every
clinic in the borough at once.

## Running it

Plain HTML, CSS and JS. It needs a server only because browsers won't let a page `fetch`
local files off `file://`:

```
python -m http.server 8000
```

then open http://localhost:8000

To rebuild the data:

```
pip install requests
python pipeline/build_data.py
```

## The data

| file | source | what it has |
| --- | --- | --- |
| `data/services.json` | [SAMHSA findtreatment.gov](https://findtreatment.gov) | Queens clinics + the languages each one reports serving |
| `data/community.json` | [NYC Facilities Database](https://data.cityofnewyork.us/resource/ji82-xba5) | Queens libraries, immigrant services, adult literacy, legal aid |
| `data/languages.json` | built from `services.json` | one row per language, and how many clinics serve it |

SAMHSA is the core source because it's the only open dataset that publishes a
**languages-offered field per site** instead of making you guess from a neighborhood's
demographics. The tradeoff is it covers health and social services, which is exactly where
language access reporting is federally required. That's why this is a map about getting
healthcare in your language and not a general directory.

The NYC Facilities Database sites are kept in a separate file on purpose and never answer
the language filter, because those records don't report languages. They show up labeled
"languages not reported" and stay off until you ask for them.

One judgment call: SAMHSA doesn't always use the name people call their own language, so
`Any Chinese Language` becomes `Chinese`, `Creole` becomes `Haitian Creole`, `Farsi`
becomes `Persian (Farsi)`, and `Sign language services for the deaf and hard of hearing`
becomes `American Sign Language`. That's the `same` dict at the top of
`pipeline/build_data.py`.

## How it works

`pipeline/build_data.py` keeps paging findtreatment.gov outward from the middle of Queens
until the results leave the borough, since that endpoint has no borough filter and only
sorts by distance. Then it filters to Queens ZIPs, merges clinics that got listed twice
under mental health and substance use so no language gets lost, and writes the three JSON
files.

`js/app.js` is the map. Leaflet draws it, Leaflet.markercluster handles the pins, Fuse.js
does the fuzzy search. The language filter, the distance math and the list/map syncing are
written out.

Built with [Leaflet](https://leafletjs.com),
[Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster),
[Fuse.js](https://fusejs.io) and [OpenStreetMap](https://www.openstreetmap.org/copyright) tiles.
