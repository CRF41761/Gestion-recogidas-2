document.addEventListener("DOMContentLoaded", function () {
    var map = L.map("map").setView([39.4699, -0.3763], 10); // Coordenadas de Valencia por defecto

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    }).addTo(map);

    var marker;

    // Intentar obtener la ubicación del usuario
    function locateUser() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function (position) {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    map.setView([lat, lng], 13); // Centrar el mapa en la ubicación del usuario
                    if (marker) {
                        marker.setLatLng([lat, lng]);
                    } else {
                        marker = L.marker([lat, lng]).addTo(map).bindPopup("Estás aquí").openPopup();
                    }
                },
                function (error) {
                    console.error("Error al obtener la geolocalización:", error);
                }
            );
        } else {
            console.error("La geolocalización no está soportada por este navegador.");
        }
    }

    locateUser(); // Llamar a la función para geolocalizar al cargar la página

    function onMapClick(e) {
        if (marker) {
            marker.setLatLng(e.latlng);
        } else {
            marker = L.marker(e.latlng).addTo(map);
        }
        document.getElementById("coordenadas_mapa").value = e.latlng.lat + ", " + e.latlng.lng;
    }

    map.on("click", onMapClick);

    document.getElementById("formulario").addEventListener("submit", function (event) {
        event.preventDefault();

        var formData = new FormData(this);
        var data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });

        console.log("Datos recopilados antes de enviar:", data); // <-- Depuración previa al envío

        enviarDatos(data);
    });

    function enviarDatos(data) {
        fetch("https://script.google.com/macros/s/AKfycbzUmVu-dKTNUu-L8tVFKkEFUrzAy5sKXPKYZ3JMw4tyCm7NS7MGRW3gP7qPleZgwX0/exec", {
            method: "POST",
            mode: "cors",  // Restauramos CORS para recibir respuesta del servidor
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data) // Volvemos a JSON como en el código anterior que funcionaba
        })
        .then(response => response.json())
        .then(result => {
            console.log("Respuesta del servidor:", result);
            alert("Datos enviados correctamente");
            document.getElementById("formulario").reset();
        })
        .catch(error => {
            console.error("Error al enviar datos:", error);
            alert("Error al enviar los datos. Verifique la conexión.");
        });
    }
});








