/* ============================================
   ANTI-PULL-TO-REFRESH  (Chrome/Android)
   ============================================ */
let touchStartY = 0;
document.addEventListener('touchstart', e => {
  touchStartY = e.touches[0].screenY;
}, { passive: true });

document.addEventListener('touchmove', e => {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const deltaY    = e.touches[0].screenY - touchStartY;
  if (scrollTop === 0 && deltaY > 0) e.preventDefault();
}, { passive: false });
/* ============================================ */

/* ---------- Botón Borrar Coordenadas del Mapa ---------- */
document.getElementById("btnBorrarCoords").addEventListener("click", () => {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        seguimientoActivo = false;
    }
    document.getElementById("coordenadas_mapa").value = "";
    document.getElementById("coordenadas").value = "";
    if (marker) {
        map.removeLayer(marker);
        marker = null;
    }
});

document.addEventListener("DOMContentLoaded", function () {
    var map = L.map("map").setView([39.4699, -0.3763], 10);

    const osmMap = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    });
    const googleSat = L.tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
        attribution: "© Google Maps"
    });
    L.control.layers({ "Mapa estándar": osmMap, "Ortofotografía (satélite)": googleSat }).addTo(map);
    osmMap.addTo(map);

    let marker, watchId = null, seguimientoActivo = true, forzarZoomInicial = false, ultimaPosicion = null;

    function iniciarSeguimiento() {
        if (!navigator.geolocation) return;
        watchId = navigator.geolocation.watchPosition(
            pos => {
                if (!seguimientoActivo) return;
                const lat = pos.coords.latitude, lng = pos.coords.longitude;
                ultimaPosicion = [lat, lng];
                map.setView([lat, lng], forzarZoomInicial ? 13 : map.getZoom());
                forzarZoomInicial = false;
                marker ? marker.setLatLng([lat, lng])
                       : marker = L.marker([lat, lng]).addTo(map).bindPopup("Estás aquí").openPopup();
                document.getElementById("coordenadas_mapa").value = lat.toFixed(5) + ", " + lng.toFixed(5);
            },
            err => console.error("Error GPS:", err),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
    }
    function detenerSeguimiento() {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        watchId = null; seguimientoActivo = false;
    }
    function onMapClick(e) {
        detenerSeguimiento();
        const latlng = e.latlng;
        marker ? marker.setLatLng(latlng) : marker = L.marker(latlng).addTo(map);
        document.getElementById("coordenadas_mapa").value = latlng.lat.toFixed(5) + ", " + latlng.lng.toFixed(5);
    }
    map.on("click", onMapClick);

    document.getElementById("coordenadas").addEventListener("change", function () {
        const raw = this.value.trim();
        if (!raw) return;
        const partes = raw.includes(",") ? raw.split(",").map(n => n.trim()) : raw.split(" ").map(n => n.trim());
        if (partes.length !== 2) return;
        const lat = parseFloat(partes[0]);
        const lng = parseFloat(partes[1]);
        if (isNaN(lat) || isNaN(lng)) return;
        detenerSeguimiento();
        document.getElementById("coordenadas_mapa").value = lat.toFixed(5) + ", " + lng.toFixed(5);
        if (marker) marker.setLatLng([lat, lng]); else marker = L.marker([lat, lng]).addTo(map);
        map.setView([lat, lng], 13);
    });

    const btnLocalizar = document.getElementById("btnLocalizar");
    if (btnLocalizar) {
        btnLocalizar.addEventListener("click", function () {
            const raw = document.getElementById("coordenadas").value.trim();
            if (!raw) return;
            const partes = raw.includes(",") ? raw.split(",").map(n => n.trim()) : raw.split(" ").map(n => n.trim());
            if (partes.length !== 2) return;
            const lat = parseFloat(partes[0]);
            const lng = parseFloat(partes[1]);
            if (isNaN(lat) || isNaN(lng)) return;
            detenerSeguimiento();
            if (marker) marker.setLatLng([lat, lng]); else marker = L.marker([lat, lng]).addTo(map);
            map.setView([lat, lng], 13);
            document.getElementById("coordenadas_mapa").value = lat.toFixed(5) + ", " + lng.toFixed(5);
        });
    }

    const locateButton = document.createElement("button");
    locateButton.textContent = "Volver a mi ubicación";
    locateButton.type = "button";
    Object.assign(locateButton.style, { marginTop: "10px", marginBottom: "15px", padding: "10px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "16px" });
    locateButton.addEventListener("click", e => {
        e.preventDefault();
        seguimientoActivo = true; forzarZoomInicial = true;
        if (ultimaPosicion) {
            const [lat, lng] = ultimaPosicion;
            if (marker) marker.setLatLng([lat, lng]); else marker = L.marker([lat, lng]).addTo(map).bindPopup("Estás aquí").openPopup();
            map.setView([lat, lng], 13); document.getElementById("coordenadas_mapa").value = lat.toFixed(5) + ", " + lng.toFixed(5);
        }
        iniciarSeguimiento();
    });
    const mapElement = document.getElementById("map");
    mapElement.parentNode.insertBefore(locateButton, mapElement.nextSibling);

    // 2. QUITAR LECTURA INICIAL DEL NÚMERO
    // fetch(url + "?getNumeroEntrada")...  <-- ESTO YA NO SE USA

    // Validación datalist
    function validarInputDatalist(inputId, datalistId, mensajeError) {
        const input = document.getElementById(inputId);
        const datalist = document.getElementById(datalistId);
        input.addEventListener('blur', function() {
            const opciones = Array.from(datalist.options).map(opt => opt.value.trim());
            if (input.value.trim() && !opciones.includes(input.value.trim())) {
                alert(mensajeError);
                input.value = ""; input.focus();
            }
        });
    }
    validarInputDatalist('especie_comun', 'especies-comun-list', 'Debes seleccionar una especie (nombre común) existente.');
    validarInputDatalist('especie_cientifico', 'especies-cientifico-list', 'Debes seleccionar una especie (nombre científico) existente.');

    // Envío del formulario
    document.getElementById("formulario").addEventListener("submit", function (e) {
        e.preventDefault();
        localStorage.removeItem('recogidasForm');
        const btn = document.getElementById("enviarBtn");
        btn.disabled = true; btn.textContent = "Enviando...";

        const fd = new FormData(this);
        const data = {
            // 1. QUITAR numero_entrada del envío
            especie_comun: fd.get("especie_comun"),
            especie_cientifico: fd.get("especie_cientifico"),
            cantidad_animales: fd.get("cantidad_animales"),
            fecha: fd.get("fecha"),
            municipio: fd.get("municipio"),
            posible_causa: fd.getAll("posible_causa"),
            remitente: fd.getAll("remitente"),
            estado_animal: fd.getAll("estado_animal"),
            coordenadas: fd.get("coordenadas"),
            coordenadas_mapa: fd.get("coordenadas_mapa"),
            apoyo: fd.get("apoyo"),
            cra_km: fd.get("cra_km"),
            observaciones: fd.get("observaciones"),
            cumplimentado_por: fd.get("cumplimentado_por"),
            telefono_remitente: fd.get("telefono_remitente"),
            foto: ""
        };

        const file = fd.get("foto");
        if (file && file.size) {
            const reader = new FileReader();
            reader.onload = ev => { data.foto = ev.target.result; enviarDatos(data, btn); };
            reader.readAsDataURL(file);
        } else {
            enviarDatos(data, btn);
        }
    });

    function enviarDatos(data, btn) {
        const url = "https://script.google.com/macros/s/AKfycbxbEuN7xEosZeIkmjVSJRabhFdMHHh2zh5VI5c0nInRZOw9nyQSWw774lEQ2UDqbY46/exec";

        fetch(url, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        })
        .then(() => fetch(url + "?getNumeroEntrada", { method: "GET", mode: "cors" }))
        .then(r => r.json())
        .then(d => {
            // 3. Actualizar mensaje de éxito y mostrar número
            document.getElementById("numero_entrada").value = d.numeroEntrada;
            alert(`✅ Entrada registrada con número: ${d.numeroEntrada}`);
            sessionStorage.setItem('formEnviadoOK', '1');
            document.getElementById("formulario").reset();
            btn.disabled = false; btn.textContent = "Enviar";
        })
        .catch(err => {
            console.error(err);
            alert("Error al enviar.");
            btn.disabled = false; btn.textContent = "Enviar";
        });
    }

    // Auto-guardado en localStorage
    const form = document.getElementById("formulario");
    form.addEventListener('input', () => {
        const obj = {};
        Array.from(form.elements).forEach(el => {
            if (!el.name) return;
            if (el.type === 'checkbox') {
                if (!obj[el.name]) obj[el.name] = [];
                if (el.checked) obj[el.name].push(el.value);
            } else if (el.type === 'radio') {
                if (el.checked) obj[el.name] = el.value;
            } else {
                obj[el.name] = el.value;
            }
        });
        localStorage.setItem('recogidasForm', JSON.stringify(obj));
    });
});

/* =====  AL ARRANCAR: limpiar si NO venimos de un envío correcto  ===== */
(() => {
  if (!sessionStorage.getItem('formEnviadoOK')) localStorage.removeItem('recogidasForm');
  sessionStorage.removeItem('formEnviadoOK');
})();

// Carga municipios
document.addEventListener("DOMContentLoaded", () => {
    fetch("municipios.json")
        .then(r => r.json())
        .then(d => {
            const list = document.getElementById("municipios-list");
            d.municipios.forEach(m => {
                const opt = document.createElement("option");
                opt.value = m;
                list.appendChild(opt);
            });
        })
        .catch(console.error);
});

// Carga especies + sincronía común/científico
document.addEventListener("DOMContentLoaded", () => {
    const comInput  = document.getElementById("especie_comun");
    const cienInput = document.getElementById("especie_cientifico");
    let especiesData = [];

    fetch("especies.json")
        .then(r => r.json())
        .then(d => {
            especiesData = d;
            const comList = document.getElementById("especies-comun-list");
            const cienList = document.getElementById("especies-cientifico-list");
            d.forEach(e => {
                const opt1 = document.createElement("option");
                opt1.value = e.nombreComun;
                comList.appendChild(opt1);
                const opt2 = document.createElement("option");
                opt2.value = e.nombreCientifico;
                cienList.appendChild(opt2);
            });
        })
        .catch(console.error);

    comInput.addEventListener("input", () => {
        const found = especiesData.find(x => x.nombreComun === comInput.value.trim());
        cienInput.value = found ? found.nombreCientifico : "";
    });
    cienInput.addEventListener("input", () => {
        const found = especiesData.find(x => x.nombreCientifico === cienInput.value.trim());
        comInput.value = found ? found.nombreComun : "";
    });
});

// Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/Gestion-recogidas-2/service-worker.js')
        .then(() => console.log('Service Worker registrado correctamente'))
        .catch(error => console.error('Error al registrar el Service Worker:', error));
}

// Botón cerrar
const btnCerrar = document.getElementById('btnCerrar');
if (btnCerrar) {
  btnCerrar.addEventListener('click', () => {
    window.close();
    if (!window.closed) alert('Puedes cerrar esta pestaña desde el navegador.');
  });
}
