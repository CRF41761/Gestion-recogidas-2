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

    // Crear y agregar el botón para volver a la ubicación actual
    const locateButton = document.createElement("button");
    locateButton.textContent = "Volver a mi ubicación";
    locateButton.type = "button";
    locateButton.style.marginTop = "10px";
    locateButton.style.marginBottom = "15px";
    locateButton.style.padding = "10px";
    locateButton.style.backgroundColor = "#28a745";
    locateButton.style.color = "white";
    locateButton.style.border = "none";
    locateButton.style.borderRadius = "4px";
    locateButton.style.cursor = "pointer";
    locateButton.style.fontSize = "16px";

    locateButton.addEventListener("click", function (event) {
        event.preventDefault();
        locateUser();
    });

    const mapElement = document.getElementById("map");
    mapElement.parentNode.insertBefore(locateButton, mapElement.nextSibling);

   document.getElementById("formulario").addEventListener("submit", function (event) {
    event.preventDefault();

    const formData = new FormData(this);
         // Depuración: Mostrar todas las claves y valores recolectados del formulario
    for (let [key, value] of formData.entries()) {
        console.log(`Clave: ${key}, Valor: ${value}`);
    }
    const data = {
        especie_comun: formData.get("especie_comun"),
        especie_cientifico: formData.get("especie_cientifico"),
        fecha: formData.get("fecha"),
        municipio: formData.get("municipio"),
        posible_causa: formData.getAll("posible_causa"), // Checkboxes como arrays
        remitente: formData.getAll("remitente"), // Checkboxes como arrays
        estado_animal: formData.getAll("estado_animal"), // Checkboxes como arrays
        coordenadas: formData.get("coordenadas"),
        coordenadas_mapa: formData.get("coordenadas_mapa"),
        apoyo: formData.get("apoyo"),
        cra_km: formData.get("cra_km"),
        observaciones: formData.get("observaciones"),
        cumplimentado_por: formData.get("cumplimentado_por"),
        telefono_remitente: formData.get("telefono_remitente"),
        foto: "" // La imagen sigue igual
    };

        // Obtener imagen y convertirla en Base64 si existe
        const fotoInput = document.getElementById("foto");
        const file = fotoInput.files[0];

        if (file) {
            const reader = new FileReader();
            reader.onload = function (event) {
                data.foto = event.target.result; // Imagen convertida a Base64
                enviarDatos(data);
            };
            reader.readAsDataURL(file);
        } else {
            enviarDatos(data);
        }
    });

    function enviarDatos(data) {
        fetch("https://script.google.com/macros/s/AKfycbw3ExSl3V9b17n1TjGXH0ijROleSFxUcMaW3MqFd_Rfgd7IfS2KgTC8r3IUd4OPyO06/exec", {
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

// 🔹 Restaurar la carga del desplegable de municipios
document.addEventListener("DOMContentLoaded", () => {
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
});

// 🔹 Restaurar la carga del desplegable de especies
document.addEventListener("DOMContentLoaded", () => {
    const especieComunInput = document.getElementById("especie_comun");
    const especieCientificoInput = document.getElementById("especie_cientifico");

    let especiesData = [];

    // Cargar datos de especies
    fetch("especies.json")
        .then(response => response.json())
        .then(data => {
            especiesData = data; // Guardar los datos en una variable para usarlos más tarde

            // Llenar los desplegables de nombres comunes y científicos
            const especieComunList = document.getElementById("especies-comun-list");
            const especieCientificoList = document.getElementById("especies-cientifico-list");

            data.forEach(especie => {
                const optionComun = document.createElement("option");
                optionComun.value = especie.nombreComun;
                especieComunList.appendChild(optionComun);

                const optionCientifico = document.createElement("option");
                optionCientifico.value = especie.nombreCientifico;
                especieCientificoList.appendChild(optionCientifico);
            });
        })
        .catch(error => console.error("Error al cargar las especies:", error));

    // Evento para completar automáticamente el nombre científico al ingresar nombre común
    especieComunInput.addEventListener("input", () => {
        const seleccion = especieComunInput.value.trim();
        const especieEncontrada = especiesData.find(
            especie => especie.nombreComun === seleccion
        );

        if (especieEncontrada) {
            especieCientificoInput.value = especieEncontrada.nombreCientifico;
        } else {
            especieCientificoInput.value = ""; // Limpiar si no coincide
        }
    });

    // Evento para completar automáticamente el nombre común al ingresar nombre científico
    especieCientificoInput.addEventListener("input", () => {
        const seleccion = especieCientificoInput.value.trim();
        const especieEncontrada = especiesData.find(
            especie => especie.nombreCientifico === seleccion
        );

        if (especieEncontrada) {
            especieComunInput.value = especieEncontrada.nombreComun;
        } else {
            especieComunInput.value = ""; // Limpiar si no coincide
        }
    });
});





// Registrar el Service Worker si es compatible
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/Gestion-recogidas-2/service-worker.js')
        .then(() => console.log('Service Worker registrado correctamente'))
        .catch(error => console.error('Error al registrar el Service Worker:', error));
}










