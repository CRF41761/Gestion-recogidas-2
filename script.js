document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("recogidasForm");

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });

        fetch("https://script.google.com/macros/s/TU_SCRIPT_ID/exec", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(result => {
            alert("Datos enviados correctamente");
            form.reset();
        })
        .catch(error => {
            console.error("Error al enviar los datos:", error);
            alert("Hubo un problema al enviar los datos");
        });
    });

    // Inicializar mapa con Leaflet
    const map = L.map('map').setView([39.4699, -0.3763], 10); // Coordenadas de Valencia
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    let marker;
    map.on('click', function (e) {
        if (marker) {
            marker.setLatLng(e.latlng);
        } else {
            marker = L.marker(e.latlng).addTo(map);
        }
        document.getElementById("coordenadas_mapa").value = `${e.latlng.lat}, ${e.latlng.lng}`;
    });

    // Obtener ubicación actual y colocar marcador
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            map.setView([lat, lng], 15);
            marker = L.marker([lat, lng]).addTo(map);
            document.getElementById("coordenadas_mapa").value = `${lat}, ${lng}`;
        }, function (error) {
            console.error("Error obteniendo la ubicación: ", error);
        });
    } else {
        console.log("Geolocalización no soportada por este navegador.");
    }
});




