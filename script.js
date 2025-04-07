document.addEventListener("DOMContentLoaded", () => {
    // Inicializar el mapa con Leaflet
    const map = L.map("map").setView([39.4667, -0.375], 13); // Centro inicial en Valencia

    // Agregar capa de OpenStreetMap
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    }).addTo(map);

    // Intentar obtener la geolocalización del usuario
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords;

                // Centrar el mapa en la ubicación del usuario y añadir marcador
                map.setView([latitude, longitude], 15);
                L.marker([latitude, longitude]).addTo(map)
                    .bindPopup("Tu ubicación")
                    .openPopup();

                console.log(`Ubicación encontrada: Latitud ${latitude}, Longitud ${longitude}`);
            },
            error => {
                console.error("Error al obtener la ubicación:", error.message);

                // Mostrar alerta clara al usuario
                alert("No se pudo obtener tu ubicación. Asegúrate de habilitar la geolocalización.");
            },
            {
                enableHighAccuracy: true, // Precisión máxima para la ubicación
                timeout: 10000, // Tiempo máximo para intentar obtener la ubicación
                maximumAge: 0 // No usar ubicaciones guardadas en caché
            }
        );
    } else {
        alert("Tu navegador no admite geolocalización.");
    }

    // Manejar el envío del formulario
    document.getElementById("recogidasForm").addEventListener("submit", async function(event) {
        event.preventDefault();

        const formData = new FormData(this);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });

        try {
            const response = await fetch("https://script.google.com/macros/s/AKfycbxQwCTVBe9hd8jj6-VFOWhd8FzQ8ZEo_fAQ6PeS91QJuirqQA7JyBZMKfNJ_6z167Xr/exec", {
                method: "POST",
                mode: "no-cors",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            });
            alert("Datos enviados correctamente");
            this.reset();
        } catch (error) {
            console.error("Error al enviar los datos: ", error);
            alert("Hubo un error al enviar los datos");
        }
    });
});
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js")
    .then(() => console.log("Service Worker registrado con éxito."))
    .catch(error => console.log("Error al registrar el Service Worker:", error));
}


