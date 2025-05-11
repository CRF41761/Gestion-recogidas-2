document.addEventListener("DOMContentLoaded", function () {
    var map = L.map("map").setView([39.4699, -0.3763], 10); // Coordenadas de Valencia por defecto

    // Añadir capas de mapa
    var osmMap = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    });

    var googleSat = L.tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
        attribution: "© Google Maps"
    });

    // Agregar control para elegir entre mapa estándar y ortofoto
    var baseMaps = {
        "Mapa estándar": osmMap,
        "Ortofografía (satélite)": googleSat
    };

    L.control.layers(baseMaps).addTo(map);
    osmMap.addTo(map); // Activar mapa estándar por defecto

    var marker; // Variable para el marcador del usuario
    var watchID; // ID del seguimiento GPS

    // Función para iniciar el seguimiento de la ubicación
    function startTracking() {
        if (navigator.geolocation) {
            watchID = navigator.geolocation.watchPosition(
                function (position) {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;

                    // Centrar el mapa en la nueva ubicación
                    map.setView([lat, lng], 15); // Zoom más cercano (15)

                    // Actualizar la posición del marcador
                    if (marker) {
                        marker.setLatLng([lat, lng]);
                    } else {
                        marker = L.marker([lat, lng]).addTo(map).bindPopup("Estás aquí").openPopup();
                    }
                },
                function (error) {
                    console.error("Error al obtener la geolocalización:", error);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            console.error("La geolocalización no está soportada por este navegador.");
        }
    }

    // Función para detener el seguimiento
    function stopTracking() {
        if (watchID) {
            navigator.geolocation.clearWatch(watchID);
            console.log("Seguimiento detenido.");
        }
    }

    // Botón para iniciar el seguimiento
    const startButton = document.createElement("button");
    startButton.textContent = "Iniciar seguimiento";
    startButton.type = "button";
    startButton.style.marginTop = "10px";
    startButton.style.marginRight = "10px";
    startButton.style.padding = "10px";
    startButton.style.backgroundColor = "#007bff";
    startButton.style.color = "white";
    startButton.style.border = "none";
    startButton.style.borderRadius = "4px";
    startButton.style.cursor = "pointer";
    startButton.style.fontSize = "16px";

    startButton.addEventListener("click", function (event) {
        event.preventDefault();
        startTracking();
    });

    // Botón para detener el seguimiento
    const stopButton = document.createElement("button");
    stopButton.textContent = "Detener seguimiento";
    stopButton.type = "button";
    stopButton.style.marginTop = "10px";
    stopButton.style.padding = "10px";
    stopButton.style.backgroundColor = "#dc3545";
    stopButton.style.color = "white";
    stopButton.style.border = "none";
    stopButton.style.borderRadius = "4px";
    stopButton.style.cursor = "pointer";
    stopButton.style.fontSize = "16px";

    stopButton.addEventListener("click", function (event) {
        event.preventDefault();
        stopTracking();
    });

    // Añadir botones al DOM
    const mapElement = document.getElementById("map");
    mapElement.parentNode.insertBefore(startButton, mapElement.nextSibling);
    mapElement.parentNode.insertBefore(stopButton, startButton.nextSibling);
});

     // Generar automáticamente el número de entrada al cargar la página
    fetch("https://script.google.com/macros/s/AKfycbyGtDA1IDjdx8rwjUNx9WOQjrZ12pYG1r-BRXWewLv5cWyI1bVrzdkZy-cA7wsmhVt-/exec?getNumeroEntrada") // Reemplaza con tu URL de Apps Script
        .then(response => response.json())
        .then(data => {
            document.getElementById("numero_entrada").value = data.numero_entrada; // Asignar el número de entrada al formulario
        })
        .catch(error => console.error("Error al obtener el número de entrada:", error));
    
   document.getElementById("formulario").addEventListener("submit", function (event) {
    event.preventDefault();
       
// Capturar el botón de envío y cambiar su estado
    const enviarBtn = document.getElementById("enviarBtn");
    enviarBtn.disabled = true;
    enviarBtn.textContent = "Enviando..."; // Dar feedback al usuario
       
    const formData = new FormData(this);
       
         // Depuración: Mostrar todas las claves y valores recolectados del formulario
    for (let [key, value] of formData.entries()) {
        console.log(`Clave: ${key}, Valor: ${value}`);
    }
    const data = {
        numero_entrada: document.getElementById("numero_entrada").value, // Número generado automáticamente
        especie_comun: formData.get("especie_comun"),
        especie_cientifico: formData.get("especie_cientifico"),
        cantidad_animales: document.getElementById("cantidad_animales").value, // Cantidad de ejemplares
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
                enviarDatos(data, enviarBtn); // Enviar datos con el botón deshabilitado
            };
            reader.readAsDataURL(file);
        } else {
           enviarDatos(data, enviarBtn);
        }
    });

    function enviarDatos(data) {
        fetch("https://script.google.com/macros/s/AKfycbyGtDA1IDjdx8rwjUNx9WOQjrZ12pYG1r-BRXWewLv5cWyI1bVrzdkZy-cA7wsmhVt-/exec", {
            method: "POST",
            mode: "no-cors",  
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(data)
        })
        .then(() => {alert("Datos enviados correctamente");
            document.getElementById("formulario").reset();
            enviarBtn.disabled = false; // Reactivar el botón
            enviarBtn.textContent = "Enviar"; // Restaurar el texto
        })
        .catch(error => {
            console.error("Error al enviar datos:", error);
            alert("Error al enviar los datos. Verifique la conexión.");
             enviarBtn.disabled = false; // Reactivar el botón en caso de error
             enviarBtn.textContent = "Enviar"; // Restaurar el texto
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










