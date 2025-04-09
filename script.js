document.addEventListener("DOMContentLoaded", function () {
    // Configuración del mapa con Leaflet.js
    var map = L.map("map").setView([39.4699, -0.3763], 10); // Coordenadas de Valencia por defecto

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    }).addTo(map);

    var marker;

    function onMapClick(e) {
        if (marker) {
            marker.setLatLng(e.latlng);
        } else {
            marker = L.marker(e.latlng).addTo(map);
        }
        document.getElementById("coordenadas_mapa").value = e.latlng.lat + ", " + e.latlng.lng;
    }

    map.on("click", onMapClick);

    // Envío de datos del formulario
    document.getElementById("formulario").addEventListener("submit", function (event) {
        event.preventDefault();
        
        var formData = new FormData(this);
        var data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });

        fetch("https://script.google.com/macros/s/AKfycbzUmVu-dKTNUu-L8tVFKkEFUrzAy5sKXPKYZ3JMw4tyCm7NS7MGRW3gP7qPleZgwX0/exec", {
            method: "POST",
            mode: "cors",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(result => {
            alert("Datos enviados correctamente");
            document.getElementById("formulario").reset();
        })
        .catch(error => {
            console.error("Error al enviar datos:", error);
        });
    });

    // Cargar municipios desde el archivo JSON
    const municipiosList = document.getElementById("municipios-list");
    fetch("municipios.json")
        .then(response => response.json())
        .then(data => {
            data.municipios.forEach(municipio => {
                const option = document.createElement("option");
                option.value = municipio;
                municipiosList.appendChild(option);
            });
        })
        .catch(error => console.error("Error al cargar los municipios:", error));

    // Cargar especies desde Google Sheets
    const especiesComunList = document.getElementById("especies-comun");
    const especiesCientificoList = document.getElementById("especies-cientifico");

    // URL de la API pública de Google Sheets (reemplaza <ID_DE_TU_SHEET>)
    const googleSheetURL = "https://spreadsheets.google.com/feeds/list/<2PACX-1vTavKxDoIA034GrYK8e8vXOw-96_VbJfvGSpi6EKpMwvFpAkN7BfRrHdhOSPtvfSECSxK2x8ZtH7yBg/pubhtml>/1/public/values?alt=json";

    fetch(googleSheetURL)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar las especies: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const entries = data.feed.entry;
            entries.forEach(entry => {
                const comun = entry.gsx$nombrecomún.$t; // Nombre de la columna "Nombre Común"
                const cientifico = entry.gsx$nombrecientífico.$t; // Nombre de la columna "Nombre Científico"

                // Añadir al datalist de nombres comunes
                const optionComun = document.createElement("option");
                optionComun.value = comun;
                especiesComunList.appendChild(optionComun);

                // Añadir al datalist de nombres científicos
                const optionCientifico = document.createElement("option");
                optionCientifico.value = cientifico;
                especiesCientificoList.appendChild(optionCientifico);
            });
        })
        .catch(error => console.error("Error al cargar las especies:", error));
});

// Registrar el Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
        .then(() => console.log('Service Worker registrado correctamente'))
        .catch(error => console.error('Error al registrar el Service Worker:', error));
}





