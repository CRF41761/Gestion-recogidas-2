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

    const mapElement = document.getElementById("map");
    mapElement.parentNode.insertBefore(locateButton, mapElement.nextSibling);

    document.getElementById("formulario").addEventListener("submit", function (event) {
        event.preventDefault();

        const formData = new FormData(this);
        const fotoInput = document.getElementById("foto"); // Campo para la imagen
        const file = fotoInput.files[0]; // Obtén el archivo seleccionado

        const data = {
            especie_comun: formData.get("especie_comun"),
            especie_cientifico: formData.get("especie_cientifico"),
            fecha: formData.get("fecha"),
            municipio: formData.get("municipio"),
            posible_causa: formData.getAll("posible_causa"),
            remitente: formData.getAll("remitente"),
            estado_animal: formData.getAll("estado_animal"),
            coordenadas: formData.get("coordenadas"),
            coordenadas_mapa: formData.get("coordenadas_mapa"),
            apoyo: formData.get("apoyo"),
            cra_km: formData.get("cra_km"),
            observaciones: formData.get("observaciones"),
            cumplimentado_por: formData.get("cumplimentado_por"),
            telefono_remitente: formData.get("telefono_remitente"),
            foto: ""
        };

        if (file) {
            const reader = new FileReader();
            reader.onload = function (event) {
                data.foto = event.target.result;
                enviarDatos(data);
            };
            reader.readAsDataURL(file);
        } else {
            enviarDatos(data);
        }
    });

    function enviarDatos(data) {
        fetch("https://script.google.com/macros/s/.../exec", {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        })
        .then(() => {
            alert("Datos enviados correctamente");
            document.getElementById("formulario").reset();
        })
        .catch(error => {
            console.error("Error al enviar datos:", error);
            alert("Error al enviar los datos. Verifique la conexión.");
        });
    }
});



