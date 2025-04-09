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

    // Cargar especies desde el archivo JSON
    const especiesComunList = document.getElementById("especies-comun");
    const especiesCientificoList = document.getElementById("especies-cientifico");

    // URL del archivo especies.json
    const jsonURL = "./especies.json"; // Cambia la ruta si está en otra ubicación (ej.: ./data/especies.json)

    fetch(jsonURL)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar el archivo JSON: ${response.status}`);
            }
            return response.json(); // Convertir la respuesta a JSON
        })
        .then(data => {
            // Rellenar los desplegables con los datos obtenidos
            data.forEach(especie => {
                const optionComun = document.createElement("option");
                optionComun.value = especie.nombreComun; // Campo nombre común
                especiesComunList.appendChild(optionComun);

                const optionCientifico = document.createElement("option");
                optionCientifico.value = especie.nombreCientifico; // Campo nombre científico
                especiesCientificoList.appendChild(optionCientifico);
            });
        })
        .catch(error => console.error("Error al cargar los datos dinámicos:", error));
});

// Registrar el Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
        .then(() => console.log('Service Worker registrado correctamente'))
        .catch(error => console.error('Error al registrar el Service Worker:', error));
}





