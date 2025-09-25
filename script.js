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

/* ---------- Botón Borrar Coordenadas del Mapa ---------- */
document.getElementById("btnBorrarCoords").addEventListener("click", () => {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        seguimientoActivo = false;
    }
    document.getElementById("coordenadas_mapa").value = "";
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
    const googleSat = L.tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={z}&z={z}", {
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
        if (marker) {
            marker.setLatLng([lat, lng]);
        } else {
            marker = L.marker([lat, lng]).addTo(map);
        }
        map.setView([lat, lng], 13);
    });

    document.getElementById("btnLocalizar")?.addEventListener("click", function () {
        const raw = document.getElementById("coordenadas").value.trim();
        if (!raw) return;
        const partes = raw.includes(",") ? raw.split(",").map(n => n.trim()) : raw.split(" ").map(n => n.trim());
        if (partes.length !== 2) return;
        const lat = parseFloat(partes[0]);
        const lng = parseFloat(partes[1]);
        if (isNaN(lat) || isNaN(lng)) return;
        detenerSeguimiento();
        if (marker) {
            marker.setLatLng([lat, lng]);
        } else {
            marker = L.marker([lat, lng]).addTo(map);
        }
        map.setView([lat, lng], 13);
        document.getElementById("coordenadas_mapa").value = lat.toFixed(5) + ", " + lng.toFixed(5);
    });

    const locateButton = document.createElement("button");
    locateButton.textContent = "Volver a mi ubicación";
    locateButton.type = "button";
    Object.assign(locateButton.style, { marginTop: "10px", marginBottom: "15px", padding: "10px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "16px" });
    locateButton.addEventListener("click", e => {
        e.preventDefault();
        seguimientoActivo = true;
        forzarZoomInicial = true;
        if (ultimaPosicion) {
            const [lat, lng] = ultimaPosicion;
            if (marker) marker.setLatLng([lat, lng]); else marker = L.marker([lat, lng]).addTo(map).bindPopup("Estás aquí").openPopup();
            map.setView([lat, lng], 13);
            document.getElementById("coordenadas_mapa").value = lat.toFixed(5) + ", " + lng.toFixed(5);
        }
        iniciarSeguimiento();
    });
    document.getElementById("map").parentNode.insertBefore(locateButton, document.getElementById("map").nextSibling);

    fetch("https://script.google.com/macros/s/AKfycbxbEuN7xEosZeIkmjVSJRabhFdMHHh2zh5VI5c0nInRZOw9nyQSWw774lEQ2UDqbY46/exec?getNumeroEntrada=true")
        .then(r => r.json()).then(d => document.getElementById("numero_entrada").value = d.numeroEntrada)
        .catch(console.error);

    // VALIDACIONES Y ENVÍO (tu código actual)
    document.getElementById("formulario").addEventListener("submit", function (e) {
        e.preventDefault();
        localStorage.removeItem('recogidasForm');
        const btn = document.getElementById("enviarBtn");
        btn.disabled = true; btn.textContent = "Enviando...";

        const fd = new FormData(this);
        const data = {
            numero_entrada: document.getElementById("numero_entrada").value,
            especie_comun: fd.get("especie_comun"),
            especie_cientifico: fd.get("especie_cientifico"),
            cantidad_animales: Number(fd.get("cantidad_animales")) || 0,
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
        fetch("https://script.google.com/macros/s/AKfycbxbEuN7xEosZeIkmjVSJRabhFdMHHh2zh5VI5c0nInRZOw9nyQSWw774lEQ2UDqbY46/exec", {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        })
            .then(() => fetch("https://script.google.com/macros/s/AKfycbxbEuN7xEosZeIkmjVSJRabhFdMHHh2zh5VI5c0nInRZOw9nyQSWw774lEQ2UDqbY46/exec?getNumeroEntrada=true"))
            .then(r => r.json())
            .then(d => {
                alert(`✅ Número de entrada asignado: ${d.numeroEntrada}`);
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

    // ---------- NUEVOS BOTONES DE CONSULTA ----------
    const btnConsultarPDFs = document.getElementById("btnConsultarPDFs");
    const btnConsultarEntrada = document.getElementById("btnConsultarEntrada");
    const panelPDFs = document.getElementById("panelPDFs");
    const panelEntrada = document.getElementById("panelEntrada");
    const listaPDFs = document.getElementById("listaPDFs");
    const detalleEntrada = document.getElementById("detalleEntrada");
    const inputNumeroEntrada = document.getElementById("inputNumeroEntrada");

    btnConsultarPDFs.addEventListener("click", async () => {
        panelPDFs.style.display = "block";
        panelEntrada.style.display = "none";
        const res = await fetch("https://script.google.com/macros/s/AKfycbxbEuN7xEosZeIkmjVSJRabhFdMHHh2zh5VI5c0nInRZOw9nyQSWw774lEQ2UDqbY46/exec?listarPDFs=true");
        const pdfs = await res.json();
        listaPDFs.innerHTML = "";
        pdfs.forEach(p => {
            listaPDFs.innerHTML += `<p><a href="${p.url}" target="_blank" rel="noopener noreferrer">${p.nombre}</a></p>`;
        });
    });

    document.getElementById("btnCerrarPDFs").addEventListener("click", () => {
        panelPDFs.style.display = "none";
    });

    btnConsultarEntrada.addEventListener("click", () => {
        panelEntrada.style.display = "block";
        panelPDFs.style.display = "none";
        detalleEntrada.innerHTML = "";
        inputNumeroEntrada.value = "";
    });

    document.getElementById("btnBuscarEntrada").addEventListener("click", async () => {
        const n = inputNumeroEntrada.value.trim();
        if (!n || isNaN(n)) {
            detalleEntrada.innerHTML = "Escribe un número válido.";
            return;
        }
        const res = await fetch(`https://script.google.com/macros/s/AKfycbxbEuN7xEosZeIkmjVSJRabhFdMHHh2zh5VI5c0nInRZOw9nyQSWw774lEQ2UDqbY46/exec?consultar=${n}`);
        const data = await res.json();
        if (data.error) {
            detalleEntrada.innerHTML = "Entrada no encontrada.";
            return;
        }
        detalleEntrada.innerHTML = `
            <p><strong>Nº entrada:</strong> ${data.numero_entrada}</p>
            <p><strong>Especie:</strong> ${data.especie_comun} (${data.especie_cientifico})</p>
            <p><strong>Cantidad:</strong> ${data.cantidad_animales}</p>
            <p><strong>Fecha:</strong> ${data.fecha}</p>
            <p><strong>Municipio:</strong> ${data.municipio}</p>
            <p><strong>Coordenadas:</strong> ${data.coordenadas_mapa}</p>
            <p><strong>Observaciones:</strong> ${data.observaciones}</p>
            ${data.foto_url && data.foto_url !== "No se adjuntó imagen" ? `<img src="${data.foto_url}" style="max-width:100%;">` : ''}
        `;
    });

    document.getElementById("btnCerrarEntrada").addEventListener("click", () => {
        panelEntrada.style.display = "none";
    });

    // Service Worker y cerrar ventana (tu código actual)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/Gestion-recogidas-2/service-worker.js')
            .then(() => console.log('Service Worker registrado correctamente'))
            .catch(error => console.error('Error al registrar el Service Worker:', error));
    }

    const btnCerrar = document.getElementById('btnCerrar');
    if (btnCerrar) {
        btnCerrar.addEventListener('click', () => {
            window.close();
            if (!window.closed) alert('Puedes cerrar esta pestaña desde el navegador.');
        });
    }
});
