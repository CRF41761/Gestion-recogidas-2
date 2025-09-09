document.addEventListener("DOMContentLoaded", function () {
    var map = L.map("map").setView([39.4699, -0.3763], 10); // Coordenadas de Valencia por defecto

    // Definir las capas de mapa
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

    let marker;
    let watchId = null;
    let seguimientoActivo = true;
    let forzarZoomInicial = false;
    let ultimaPosicion = null; // ⬅️ Guardamos la última posición válida

    function iniciarSeguimiento() {
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                function (position) {
                    if (seguimientoActivo) {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;

                        ultimaPosicion = [lat, lng]; // ⬅️ Guardamos la posición más reciente

                        const zoom = forzarZoomInicial ? 13 : map.getZoom();
                        map.setView([lat, lng], zoom);

                        forzarZoomInicial = false; // Solo aplicar el zoom una vez

                        if (marker) {
                            marker.setLatLng([lat, lng]);
                        } else {
                            marker = L.marker([lat, lng]).addTo(map).bindPopup("Estás aquí").openPopup();
                        }
                        document.getElementById("coordenadas_mapa").value = lat.toFixed(5) + ", " + lng.toFixed(5);
                    }
                },
                function (error) {
                    console.error("Error al obtener la geolocalización:", error);
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 10000
                }
            );
        } else {
            console.error("La geolocalización no está soportada por este navegador.");
        }
    }

    function detenerSeguimiento() {
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        seguimientoActivo = false;
    }

    function onMapClick(e) {
        detenerSeguimiento(); // Al hacer clic, detener seguimiento
        const latlng = e.latlng;
        if (marker) {
            marker.setLatLng(latlng);
        } else {
            marker = L.marker(latlng).addTo(map);
        }
        document.getElementById("coordenadas_mapa").value = latlng.lat.toFixed(5) + ", " + latlng.lng.toFixed(5);
    }

    map.on("click", onMapClick);

    // Escuchar cambios en la casilla "coordenadas" y actualizar el mapa y coordenadas_mapa
    document.getElementById("coordenadas").addEventListener("change", function () {
        const input = this.value.trim();
        // Permitir separación por "," o por espacio
        let partes = input.split(",");
        if (partes.length !== 2) {
            partes = input.split(" ");
        }
        if (partes.length === 2) {
            const lat = parseFloat(partes[0]);
            const lng = parseFloat(partes[1]);
            if (!isNaN(lat) && !isNaN(lng)) {
                // Actualiza el marcador del mapa
                if (marker) {
                    marker.setLatLng([lat, lng]);
                } else {
                    marker = L.marker([lat, lng]).addTo(map);
                }
                map.setView([lat, lng], 13);

                // Actualiza la casilla de coordenadas del mapa también
                document.getElementById("coordenadas_mapa").value = lat.toFixed(5) + ", " + lng.toFixed(5);
            }
        }
    });

    // Crear botón para reactivar seguimiento y restablecer zoom
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
        seguimientoActivo = true;
        forzarZoomInicial = true;

        if (ultimaPosicion) {
            map.setView(ultimaPosicion, 13); // ⬅️ Centrar de inmediato en la última posición
        }

        iniciarSeguimiento(); // ⬅️ Volver a activar seguimiento GPS
    });

    const mapElement = document.getElementById("map");
    mapElement.parentNode.insertBefore(locateButton, mapElement.nextSibling);

    // Generar automáticamente el número de entrada al cargar la página
    fetch("https://script.google.com/macros/s/AKfycbxbEuN7xEosZeIkmjVSJRabhFdMHHh2zh5VI5c0nInRZOw9nyQSWw774lEQ2UDqbY46/exec?getNumeroEntrada") // Reemplaza con tu URL de Apps Script
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

    function enviarDatos(data, enviarBtn) {
        fetch("https://script.google.com/macros/s/AKfycbxbEuN7xEosZeIkmjVSJRabhFdMHHh2zh5VI5c0nInRZOw9nyQSWw774lEQ2UDqbY46/exec", {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        })
            .then(() => {
                // ✅ Solicitud `GET` para recuperar el número de entrada guardado en D1
                return fetch("https://script.google.com/macros/s/AKfycbxbEuN7xEosZeIkmjVSJRabhFdMHHh2zh5VI5c0nInRZOw9nyQSWw774lEQ2UDqbY46/exec?getNumeroEntrada");
            })
            .then(response => response.json())
            .then(data => {
                alert(`✅ Número de entrada asignado: ${data.numeroEntrada}`); // ✅ Mostrar número de entrada
                document.getElementById("formulario").reset();
                enviarBtn.disabled = false; // Reactivar el botón
                enviarBtn.textContent = "Enviar"; // Restaurar el texto
            })
            .catch(error => {
                console.error("Error al obtener el número de entrada:", error);
                alert("Error al obtener el número de entrada. Verifique la conexión.");
                enviarBtn.disabled = false; // ✅ Reactivar el botón en caso de error
                enviarBtn.textContent = "Enviar"; // ✅ Restaurar el texto
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

// --- Guardado, restauración y borrado de datos del formulario ---

const form = document.getElementById('formulario');

// Guardar cada vez que el usuario modifica el formulario
form.addEventListener('input', () => {
    const obj = {};

    Array.from(form.elements).forEach(el => {
        if (!el.name) return;
        if (el.type === 'checkbox') {
            if (!obj[el.name]) obj[el.name] = [];
            if (el.checked) obj[el.name].push(el.value);
        } else if (el.type === 'radio') {
            if (el.checked) obj[el.name] = el.value;
        } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
            obj[el.name] = el.value;
        }
    });

    localStorage.setItem('recogidasForm', JSON.stringify(obj));
});

// Recuperar al cargar la página
window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('recogidasForm');
    if (saved) {
        const obj = JSON.parse(saved);

        Array.from(form.elements).forEach(el => {
            if (!el.name) return;
            if (el.type === 'checkbox') {
                el.checked = obj[el.name] ? obj[el.name].includes(el.value) : false;
            } else if (el.type === 'radio') {
                el.checked = obj[el.name] === el.value;
            } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                if (typeof obj[el.name] !== 'undefined') el.value = obj[el.name];
            }
        });
    }
});

// Borrar al enviar el formulario
form.addEventListener('submit', () => {
    localStorage.removeItem('recogidasForm');
});

// Borrar localStorage al cerrar la app/pestaña/ventana
window.addEventListener('beforeunload', () => {
    localStorage.removeItem('recogidasForm');
});
