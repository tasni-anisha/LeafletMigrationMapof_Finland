const map = L.map("map", {
    minZoom: -3
});

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

const geoJsonUrl =
    "https://geo.stat.fi/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=tilastointialueet:kunta4500k&outputFormat=json&srsName=EPSG:4326";

const migrationUrl =
    "https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/muutl/11a2.px";

Promise.all([
    fetch(geoJsonUrl).then(response => response.json()),

    fetch("migration_data_query.json")
        .then(response => response.json())
        .then(query =>
            fetch(migrationUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(query)
            })
        )
        .then(response => response.json())
])
.then(([geoData, migrationData]) => {

    const values = migrationData.value;

    // Municipality codes and their positions in the PXWeb response
    const municipalityDimension =
        migrationData.dimension["alue_23_20260101"].category.index;

    const migrationByCode = {};

    Object.keys(municipalityDimension).forEach(code => {

        // Skip the whole-country value
        if (code === "SSS") {
            return;
        }

        const position = municipalityDimension[code];

        migrationByCode[code.replace("KU", "")] = {
            positive: values[position * 2],
            negative: values[position * 2 + 1]
        };
    });

    const geoJsonLayer = L.geoJSON(geoData, {

        style: function(feature) {

            const municipalityCode =
                String(feature.properties.kunta).padStart(3, "0");

            const migration = migrationByCode[municipalityCode];

            if (!migration) {
                return {
                    weight: 2
                };
            }

            let hue =
                Math.pow(
                    migration.positive / migration.negative,
                    3
                ) * 60;

            hue = Math.min(hue, 120);

            return {
                weight: 2,
                color: `hsl(${hue}, 75%, 50%)`
            };
        },

        onEachFeature: function(feature, layer) {

            const municipalityName = feature.properties.name;

            const municipalityCode =
                String(feature.properties.kunta).padStart(3, "0");

            const migration = migrationByCode[municipalityCode];

            layer.bindTooltip(municipalityName);

            if (migration) {
                layer.bindPopup(
                    "<b>" + municipalityName + "</b><br>" +
                    "Positive migration: " + migration.positive + "<br>" +
                    "Negative migration: " + migration.negative
                );
            }
        }

    }).addTo(map);

    map.fitBounds(geoJsonLayer.getBounds());
})
.catch(error => {
    console.error("Error:", error);
});