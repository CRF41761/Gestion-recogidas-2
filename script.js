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
        
        var formData = new FormData(this);
        var data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });

        fetch("https://script.google.com/macros/s/AKfycbyno2e8E_u3pPKdJbfOwb3mjkBsXk7Uw5L0vO0RhximhTpSxd7YS01O928lmIZc02wh/exec", {
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

