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

    // Crear y agregar el botón justo después del mapa
    const locateButton = document.createElement("button");
    locateButton.textContent = "Volver a mi ubicación";
    locateButton.type = "button"; // Evitar que el botón actúe como "submit"
    locateButton.style.marginTop = "10px";
    locateButton.style.marginBottom = "15px"; // Añadir margen inferior para separar del texto
    locateButton.style.padding = "10px";
    locateButton.style.backgroundColor = "#28a745";
    locateButton.style.color = "white";
    locateButton.style.border = "none";
    locateButton.style.borderRadius = "4px";
    locateButton.style.cursor = "pointer";
    locateButton.style.fontSize = "16px";

    locateButton.addEventListener("click", function (event) {
        event.preventDefault(); // Evitar cualquier comportamiento predeterminado
        locateUser(); // Llamar a la función para geolocalizar
    });

    // Insertar el botón después del mapa
    const mapElement = document.getElementById("map");
    mapElement.parentNode.insertBefore(locateButton, mapElement.nextSibling);

    document.getElementById("formulario").addEventListener("submit", function (event) {
        event.preventDefault();

        const formData = new FormData(this);
        const fotoInput = document.getElementById("foto"); // Campo para la imagen
        const file = fotoInput.files[0]; // Obtén el archivo seleccionado

        if (file) {
            const reader = new FileReader();
            reader.onload = function (event) {
                const base64Image = event.target.result; // Imagen convertida a base64

                // Construir el objeto con todos los datos del formulario
                const data = {
                    especie_comun: formData.get("especie_comun"),
                    especie_cientifico: formData.get("especie_cientifico"),
                    fecha: formData.get("fecha"),
                    municipio: formData.get("municipio"),
                    posible_causa: formData.getAll("posible_causa"), // Captura múltiples valores de checkbox
                    remitente: formData.getAll("remitente"), // Captura múltiples valores de checkbox
                    estado_animal: formData.getAll("estado_animal"), // Captura múltiples valores de checkbox
                    coordenadas: formData.get("coordenadas"),
                    coordenadas_mapa: formData.get("coordenadas_mapa"),
                    apoyo: formData.get("apoyo"),
                    cra_km: formData.get("cra_km"),
                    observaciones: formData.get("observaciones"),
                    cumplimentado_por: formData.get("cumplimentado_por"),
                    telefono_remitente: formData.get("telefono_remitente"),
                    foto: base64Image // Imagen en formato base64
                };

                // Enviar datos al servidor usando fetch
                fetch("https://script.google.com/macros/s/AKfycbxGlwmnY29vRmWA1tnD0ouOr0MreiPGO29Pc9fx7tA2Db_p_CceXKF7xQstyLs7UqLV/exec", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(data) // Convertir datos a JSON
                })
                    .then(response => response.json())
                    .then(result => {
                        if (result.result === "success") {
                            alert("Datos enviados correctamente");
                            document.getElementById("formulario").reset(); // Reiniciar formulario
                        } else {
                            alert("Ocurrió un error en el servidor: " + result.message);
                        }
                    })
                    .catch(error => {
                        console.error("Error al enviar datos:", error);
                        alert("Error al enviar los datos. Verifique la conexión.");
                    });
            };
            reader.readAsDataURL(file); // Convertir la imagen a base64
        } else {
            alert("Por favor, toma una foto antes de enviar.");
        }
    });
});

document.addEventListener("DOMContentLoaded", () => {
    const municipiosList = document.getElementById("municipios-list");

    // Cargar municipios desde el archivo JSON
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
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/Gestion-recogidas-2/service-worker.js')
        .then(() => console.log('Service Worker registrado correctamente'))
        .catch(error => console.error('Error al registrar el Service Worker:', error));
}
}
