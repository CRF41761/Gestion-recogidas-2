document.addEventListener("DOMContentLoaded", function () {
    initMap(); // Inicia el mapa cuando se carga la página

    document.getElementById("recogidasForm").addEventListener("submit", function (event) {
        event.preventDefault(); // Evita el envío por defecto

        const formData = new FormData(this);
        const data = {};

        formData.forEach((value, key) => {
            if (data[key]) {
                data[key] += `, ${value}`;
            } else {
                data[key] = value;
            }
        });

        fetch("https://script.google.com/macros/s/AKfycbzUmVu-dKTNUu-L8tVFKkEFUrzAy5sKXPKYZ3JMw4tyCm7NS7MGRW3gP7qPleZgwX0/exec", {
            method: "POST",
            mode: "cors",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        })
        .then(response => response.json())
        .then(result => {
            alert("Datos enviados correctamente");
            document.getElementById("recogidasForm").reset();
        })
        .catch(error => console.error("Error al enviar datos:", error));
    });
});

function initMap() {
    const map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 39.4657792, lng: -0.3964928 },
        zoom: 10,
    });

    const marker = new google.maps.Marker({
        position: { lat: 39.4657792, lng: -0.3964928 },
        map: map,
        draggable: true,
    });

    google.maps.event.addListener(marker, 'dragend', function(event) {
        document.getElementById("coordenadas_mapa").value = event.latLng.lat() + "," + event.latLng.lng();
    });
}



