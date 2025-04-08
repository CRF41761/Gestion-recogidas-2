document.addEventListener("DOMContentLoaded", function () {
    // Inicializar mapa con Leaflet
    var map = L.map('map').setView([39.4699, -0.3763], 10);

    // Capa de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Evento para capturar coordenadas
    var marker;
    map.on('click', function (e) {
        if (marker) {
            map.removeLayer(marker);
        }
        marker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);
        document.getElementById("coordenadas_mapa").value = e.latlng.lat + ", " + e.latlng.lng;
    });

    // Capturar el formulario y enviarlo a Google Sheets
    document.getElementById("recogidasForm").addEventListener("submit", function (e) {
        e.preventDefault();

        var formData = new FormData(this);

        fetch("https://script.google.com/macros/s/AKfycbzUmVu-dKTNUu-L8tVFKkEFUrzAy5sKXPKYZ3JMw4tyCm7NS7MGRW3gP7qPleZgwX0/exec", {
            method: "POST",
            body: formData
        })
        .then(response => response.text())
        .then(data => alert("Datos enviados correctamente"))
        .catch(error => console.error("Error al enviar:", error));
    });
});



