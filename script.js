document.addEventListener("DOMContentLoaded", function () {
    // --- Recuperación de datos del formulario ---
    const form = document.getElementById('formulario');
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

    // Inicialización del mapa
    var map = L.map("map").setView([39.4699, -0.3763], 10);
    var osmMap = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    });
    var googleSat = L.tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
        attribution: "© Google Maps"
    });
    var baseMaps = {
        "Mapa estándar": osmMap,
        "Ortofografía (satélite)": googleSat
    };
    L.control.layers(baseMaps).addTo(map);
    osmMap.addTo(map);

    let marker;
    let watchId = null;
    let seguimientoActivo = true;
    let forzarZoomInicial = false;
    let ultimaPosicion = null;

    function iniciarSeguimiento() {
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                function (position) {
                    if (seguimientoActivo) {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        ultimaPosicion = [lat, lng];
                        const zoom = forzarZoomInicial ? 13 : map.getZoom();
                        map.setView([lat, lng], zoom);
                        forzarZoomInicial = false;
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
        detenerSeguimiento();
        const latlng = e.latlng;
        if (marker) {
            marker.setLatLng(latlng);
        } else {
            marker = L.marker(latlng).addTo(map);
        }
        document.getElementById("coordenadas_mapa").value = latlng.lat.toFixed(5) + ", " + latlng.lng.toFixed(5);
    }

    map.on("click", onMapClick);

    document.getElementById("coordenadas").addEventListener("change", function () {
        const input = this.value.trim();
        let partes = input.split(",");
        if (partes.length !== 2) {
            partes = input.split(" ");
        }
        if (partes.length === 2) {
            const lat = parseFloat(partes[0]);
            const lng = parseFloat(partes[1]);
            if (!isNaN(lat) && !isNaN(lng)) {
                if (marker) {
                    marker.setLatLng([lat, lng]);
                } else {
                    marker = L.marker([lat, lng]).addTo(map);
                }
                map.setView([lat, lng], 13);
                document.getElementById("coordenadas_mapa").value = lat.toFixed(5) + ", " + lng.toFixed(5);
            }
        }
    });

    // Botón volver a ubicación
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
            map.setView(ultimaPosicion, 13);
        }
        iniciarSeguimiento();
    });

    const mapElement = document.getElementById("map");
    mapElement.parentNode.insertBefore(locateButton, mapElement.nextSibling);

    fetch("https://script.google.com/macros/s/AKfycbxbEuN7xEosZeIkmjVSJRabhFdMHHh2zh5VI5c0nInRZOw9nyQSWw774lEQ2UDqbY46/exec?getNumeroEntrada")
        .then(response => response.json())
        .then(data => {
            document.getElementById("numero_entrada").value = data.numero_entrada;
        })
        .catch(error => console.error("Error al obtener el número de entrada:", error));

    document.getElementById("formulario").addEventListener("submit", function (event) {
        event.preventDefault();

        // --- Borrado de datos al enviar el formulario ---
        localStorage.removeItem('recogidasForm');

        const enviarBtn = document.getElementById("enviarBtn");
        enviarBtn.disabled = true;
        enviarBtn.textContent = "Enviando...";

        const formData = new FormData(this);

        for (let [key, value] of formData.entries()) {
            console.log(`Clave: ${key}, Valor: ${value}`);
        }
        const data = {
            numero_entrada: document.getElementById("numero_entrada").value,
            especie_comun: formData.get("especie_comun"),
            especie_cientifico: formData.get("especie_cientifico"),
            cantidad_animales: document.getElementById("cantidad_animales").value,
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

        const fotoInput = document.getElementById("foto");
        const file = fotoInput.files[0];

        if (file) {
            const reader = new FileReader();
            reader.onload = function (event) {
                data.foto = event.target.result;
                enviarDatos(data, enviarBtn);
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
                return fetch("https://script.google.com/macros/s/AKfycbxbEuN7xEosZeIkmjVSJRabhFdMHHh2zh5VI5c0nInRZOw9nyQSWw774lEQ2UDqbY46/exec?getNumeroEntrada");
            })
            .then(response => response.json())
            .then(data => {
                alert(`✅ Número de entrada asignado: ${data.numeroEntrada}`);
                document.getElementById("formulario").reset();
                enviarBtn.disabled = false;
                enviarBtn.textContent = "Enviar";
            })
            .catch(error => {
                console.error("Error al obtener el número de entrada:", error);
                alert("Error al obtener el número de entrada. Verifique la conexión.");
                enviarBtn.disabled = false;
                enviarBtn.textContent = "Enviar";
            });
    }

    // --- Guardado de datos al modificar el formulario ---
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
});

// --- Borrado de datos SOLO al cerrar la pestaña/app, NO al refrescar ---
let lastNavigationType = performance.getEntriesByType("navigation")[0]?.type || "navigate";

// Solo borrar si no es reload o back_forward
window.addEventListener('beforeunload', function () {
    // Navegación tipo "navigate" (cierre de pestaña/app, no recarga ni atrás/adelante)
    if (lastNavigationType === "navigate") {
        localStorage.removeItem('recogidasForm');
    }
});

// --- Restaurar la carga del desplegable de municipios ---
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

// --- Restaurar la carga del desplegable de especies ---
document.addEventListener("DOMContentLoaded", () => {
    const especieComunInput = document.getElementById("especie_comun");
    const especieCientificoInput = document.getElementById("especie_cientifico");

    let especiesData = [];

    fetch("especies.json")
        .then(response => response.json())
        .then(data => {
            especiesData = data;
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

    especieComunInput.addEventListener("input", () => {
        const seleccion = especieComunInput.value.trim();
        const especieEncontrada = especiesData.find(
            especie => especie.nombreComun === seleccion
        );
        if (especieEncontrada) {
            especieCientificoInput.value = especieEncontrada.nombreCientifico;
        } else {
            especieCientificoInput.value = "";
        }
    });

    especieCientificoInput.addEventListener("input", () => {
        const seleccion = especieCientificoInput.value.trim();
        const especieEncontrada = especiesData.find(
            especie => especie.nombreCientifico === seleccion
        );
        if (especieEncontrada) {
            especieComunInput.value = especieEncontrada.nombreComun;
        } else {
            especieComunInput.value = "";
        }
    });
});

// --- Registrar el Service Worker si es compatible ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/Gestion-recogidas-2/service-worker.js')
        .then(() => console.log('Service Worker registrado correctamente'))
        .catch(error => console.error('Error al registrar el Service Worker:', error));
}
