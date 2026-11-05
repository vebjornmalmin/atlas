# Offline geography sources

Atlas ships actual geographic outlines as local SVG paths in JSON. Exercises never require online map tiles. The geometry is simplified for display; it is unsuitable for navigation or legal boundary decisions.

## World

`public/maps/world.json` contains 176 country and administrative outlines from [Natural Earth Admin 0 – Countries, 1:110 million](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/), excluding Antarctica. Source [GeoJSON](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson) retrieved 10 October 2026.

Natural Earth data is [public domain](https://www.naturalearthdata.com/about/terms-of-use/). Natural Earth uses de facto boundaries; disputed territories can differ from other sources. Atlas preserves the supplied administrative outlines and labels without independently adjudicating sovereignty.

Coordinates use a simple equirectangular display projection: x = 2 × (longitude + 180), y = 2 × (85 − latitude). Douglas–Peucker simplification uses a tolerance of 0.25 display units. Regions use lowercase ISO A3 IDs, with Natural Earth administrative IDs for entries lacking an ISO code. The current data includes Norway (`nor`), France (`fra`), Italy (`ita`), Brazil (`bra`), Japan (`jpn`), Egypt (`egy`), United States of America (`usa`), India (`ind`), and Australia (`aus`).

## Projections in Atlas → Kart

Because the world map is equirectangular, `src/lib/projections.js` reads longitude and latitude back from the paths (lon = x/2 − 180, lat = 85 − y/2). Long edges are split every 2° so borders that follow a parallel keep following it, rings inside a larger ring become holes (Lesotho), and every ring is turned to enclose the small side of the sphere as d3 expects. `d3-geo` 3.1.1 and `d3-geo-projection` 4.0.0 (ISC) then draw the same regions in the chosen projection with the same region IDs, so colouring, labels, tapping and grading by ID work unchanged.

The geometry was simplified in flat map units, so it is coarser near the poles than near the equator. Natural Earth cuts Russia and Fiji at the antimeridian; on the globe the cut can show as a faint line. The quizzes keep the flat map.

## Norway

`public/maps/norway.json` contains all 15 official counties. It derives from [Kartverket – Administrative enheter fylker](https://kartkatalog.geonorge.no/metadata/administrative-enheter-fylker/6093c8a8-fa80-11e6-bc64-92361f002671), reference date 1 January 2026, retrieved 10 October 2026. [Download ZIP, EUREF89 / UTM zone 33](https://nedlasting.geonorge.no/geonorge/Basisdata/Fylker/GeoJSON/Basisdata_0000_Norge_25833_Fylker_GeoJSON.zip).

License: [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Required attribution: **County boundaries © Kartverket, simplified for display. CC BY 4.0.** The map dataset includes this attribution for presentation below the exercise.

The source [metadata API](https://kartkatalog.geonorge.no/api/getdata/6093c8a8-fa80-11e6-bc64-92361f002671) explicitly identifies this license and 2026 reference date. [Kartverket boundary information](https://kartverket.no/en/api-and-data/grensedata) describes the official dataset and download formats.

Only features of object type `Fylke` are retained. Shapes are uniformly scaled from the supplied projected coordinates, inverted vertically, and simplified by Douglas–Peucker with a 0.25 display-unit tolerance. Official county regions include marine administrative extents; coastlines are not invented or substituted. Tiny island rings below 0.3 display units in both dimensions are omitted. These operations change display detail, not the county membership or identifiers.

IDs are `no-` plus official county number: `03` Oslo, `11` Rogaland, `15` Møre og Romsdal, `18` Nordland, `31` Østfold, `32` Akershus, `33` Buskerud, `34` Innlandet, `39` Vestfold, `40` Telemark, `42` Agder, `46` Vestland, `50` Trøndelag, `55` Troms, `56` Finnmark.

## Interaction contract

`createMapExercise(dataset, regionId)` returns `{id,targetId,prompt,answer,svg,regions,source}`. Each unlabeled SVG region is focusable, has `role="button"`, and carries `data-region="…"`. The application must handle click, Enter, and Space selection and show the supplied source attribution. Keyboard-accessible region names are generic indices to keep the geography answer hidden; a named list can be provided as a separate accessible recall modality.

SVG paths contain local geometry only. The helper escapes attributes and rejects unexpected path syntax. `gradeMapSelection` compares exact region IDs.
