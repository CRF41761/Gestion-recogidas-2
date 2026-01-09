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
/* ============================================
   CONVERSIÓN UTM → LAT/LON (WGS84) - España (Comunidad Valenciana)
   ============================================ */
function utmToLatLon(easting, northing, zoneNumber, northernHemisphere = true) {
    const a = 6378137.0;
    const eccSquared = 0.00669438;
    const k0 = 0.9996;

    const eccPrimeSquared = eccSquared / (1 - eccSquared);
    const e1 = (1 - Math.sqrt(1 - eccSquared)) / (1 + Math.sqrt(1 - eccSquared));
    const rad2deg = 180 / Math.PI;

    easting -= 500000.0;
    let arcLength = northing / k0;
    if (!northernHemisphere) arcLength -= 10000000.0;

    const mu = arcLength / (a * (1 - eccSquared / 4.0 - 3 * eccSquared * eccSquared / 64.0 - 5 * eccSquared * eccSquared * eccSquared / 256.0));
    const ei = (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32.0) * Math.sin(2 * mu) +
               (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32.0) * Math.sin(4 * mu) +
               (151 * e1 * e1 * e1 / 96.0) * Math.sin(6 * mu);
    const phi1 = mu + ei;

    const n = a / Math.sqrt(1 - eccSquared * Math.sin(phi1) * Math.sin(phi1));
    const t = Math.tan(phi1) * Math.tan(phi1);
    const c = eccPrimeSquared * Math.cos(phi1) * Math.cos(phi1);
    const r = a * (1 - eccSquared) / Math.pow(1 - eccSquared * Math.sin(phi1) * Math.sin(phi1), 1.5);
    const d = easting / (n * k0);

    let lat = phi1 - (n * Math.tan(phi1) / r) *
        (d * d / 2.0 -
         d * d * d * d / 24.0 * (5 + 3 * t + 10 * c - 4 * c * c - 9 * eccPrimeSquared) +
         d * d * d * d * d * d / 720.0 * (61 + 90 * t + 298 * c + 45 * t * t - 252 * eccPrimeSquared - 3 * c * c));

    let lon = (d -
        d * d * d / 6.0 * (1 + 2 * t + c) +
        d * d * d * d * d / 120.0 * (5 - 2 * c + 28 * t - 3 * c * c + 8 * eccPrimeSquared + 24 * t * t)) / Math.cos(phi1);

    const lonOrigin = (zoneNumber - 1) * 6 - 180 + 3;
    lat = lat * rad2deg;
    lon = lonOrigin + lon * rad2deg;

    return { lat, lon };
}

function parseUTM(input) {
    let clean = input.trim().toUpperCase();
    clean = clean.replace(/,/g, ' ').replace(/\s+/g, ' ');

    const parts = clean.split(' ');
    const nums = [];
    let zonePart = null;

    for (const p of parts) {
        if (/^\d{5,7}$/.test(p)) {
            nums.push(parseInt(p, 10));
        } else if (/^\d{1,2}[NS]$/.test(p)) {
            zonePart = p;
        }
    }

    if (nums.length < 2) return null;

    const easting = nums[0];
    const northing = nums[1];

    if (easting < 100000 || easting > 999999 || northing < 4000000 || northing > 5000000) {
        return null;
    }

    let zoneNumber = 30;
    let northern = true;

    if (zonePart) {
        zoneNumber = parseInt(zonePart.slice(0, -1), 10);
        northern = zonePart.endsWith('N');
        if (zoneNumber < 1 || zoneNumber > 60) return null;
    }

    return { easting, northing, zoneNumber, northern };
}
/* ============================================
   INDEXEDDB - GESTIÓN DE REGISTROS LOCALES
   ============================================ */
const DB_NAME = 'RecogidasDB';
const DB_VERSION = 1;
const STORE_NAME = 'registros';

// Inicializar IndexedDB
let db;
const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('fecha', 'fecha', { unique: false });
                store.createIndex('municipio', 'municipio', { unique: false });
            }
        };
    });
};

// Guardar registro en IndexedDB (sin número de entrada al guardar localmente antes del envío)
const guardarRegistroLocal = (datos) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const datosParaGuardar = { ...datos };
        delete datosParaGuardar.numero_entrada;
        datosParaGuardar.timestamp = new Date().toISOString();
        datosParaGuardar.id = Date.now();
        const request = store.add(datosParaGuardar);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

// Obtener todos los registros
const obtenerRegistros = () => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

// Eliminar registro
const eliminarRegistro = (id) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// Exportar registros a JSON
const exportarRegistrosJSON = async () => {
    const registros = await obtenerRegistros();
    const dataStr = JSON.stringify(registros, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registros_recogidas_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

// Importar registros desde JSON
const importarRegistrosJSON = (archivo) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const registros = JSON.parse(e.target.result);
                if (!Array.isArray(registros)) throw new Error('El archivo no contiene un array válido');
                for (const registro of registros) {
                    if (registro.fecha && registro.especie_comun) await guardarRegistroLocal(registro);
                }
                resolve();
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(archivo);
    });
};

// Formatear fecha/hora legible
const formatearFechaHora = (fechaISO) => {
    const fecha = new Date(fechaISO);
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const año = fecha.getFullYear();
    const horas = fecha.getHours().toString().padStart(2, '0');
    const minutos = fecha.getMinutes().toString().padStart(2, '0');
    const segundos = fecha.getSeconds().toString().padStart(2, '0');
    return `${dia}/${mes}/${año} ${horas}:${minutos}:${segundos}`;
};

// Mostrar registros en el modal
const mostrarRegistros = async () => {
    const registros = await obtenerRegistros();
    const contenedor = document.getElementById('contenidoRegistros');
    const importarEnModal = document.getElementById('importarEnModal');
    if (registros.length === 0) {
        contenedor.innerHTML = '<p style="color:#666;">No hay registros guardados localmente.</p>';
        importarEnModal.style.display = 'block';
        return;
    }
    importarEnModal.style.display = 'none';
    registros.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const html = registros.map(reg => `
        <div style="border:1px solid #ddd; padding:12px; margin-bottom:12px; border-radius:6px; background:#f9f9f9;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div style="flex:1;">
                    <strong style="color:#333; font-size:1.1em;">${reg.especie_comun || 'Sin especie'}</strong><br>
                    <small style="color:#666;">📅 ${formatearFechaHora(reg.timestamp)}</small>
                </div>
                <button onclick="eliminarYActualizar(${reg.id})" 
                        style="background:#dc3545; color:white; border:none; padding:4px; border-radius:3px; cursor:pointer; font-size:14px; flex-shrink:0; width:30px; height:30px; margin-left:10px;" 
                        title="Eliminar registro">×</button>
            </div>
            <details style="font-size:0.9em; color:#555; margin-top:8px;">
                <summary style="cursor:pointer; color:#17a2b8;">Ver detalles completos</summary>
                <pre style="margin:8px 0 0 0; padding:10px; background:#fff; border:1px solid #e0e0e0; border-radius:4px; white-space: pre-wrap; word-wrap: break-word; font-size:0.85em;">${JSON.stringify(reg, null, 2)}</pre>
            </details>
        </div>
    `).join('');
    contenedor.innerHTML = html;
};

// Eliminar y actualizar vista
window.eliminarYActualizar = async (id) => {
    if (confirm('¿Seguro que quieres eliminar este registro?')) {
        await eliminarRegistro(id);
        await mostrarRegistros();
    }
};

// Inicializar DB al cargar
initDB().then(() => {
    console.log('IndexedDB inicializada correctamente');
}).catch(err => {
    console.error('Error inicializando IndexedDB:', err);
    alert('Error al inicializar base de datos local. Los registros no se guardarán.');
});
/* ============================================ */

document.addEventListener("DOMContentLoaded", function () {
    /* ---------- CONFIRMACIÓN DE CANTIDAD DE EJEMPLARES ---------- */
    const cantidadInput = document.getElementById('cantidad_animales');
    if (cantidadInput) {
        cantidadInput.addEventListener('change', function () {
            const cant = parseInt(this.value, 10);
            if (isNaN(cant) || cant <= 0) return;
            const mensaje = `¿Seguro que son ${cant} animales?`;
            const ok = confirm(mensaje);
            if (!ok) {
                this.value = "";
                this.focus();
            }
        });
    }

    var map = L.map("map").setView([39.4699, -0.3763], 10);
    const osmMap = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    });
    const googleSat = L.tileLayer("https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
        attribution: "© Google Maps",
        subdomains: ["mt0", "mt1", "mt2", "mt3"]
    });
    L.control.layers({ "Mapa estándar": osmMap, "Ortofotografía (satélite)": googleSat }).addTo(map);
    osmMap.addTo(map);

    let marker, watchId = null, seguimientoActivo = true, forzarZoomInicial = false, ultimaPosicion = null;

    /* Botón Borrar Coordenadas del Mapa */
    const btnBorrar = document.getElementById("btnBorrarCoords");
    if (btnBorrar) {
        btnBorrar.addEventListener("click", () => {
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
    }

    /* Mostrar/ocultar campo "Código anilla" */
    const chkRec = document.getElementById('recuperacion');
    const wrap   = document.getElementById('anillaWrapper');
    const inpAni = document.getElementById('anilla');
    if (chkRec && wrap && inpAni) {
        function toggleAnillaField() {
            wrap.style.display = chkRec.checked ? 'inline-block' : 'none';
            if (!chkRec.checked) inpAni.value = '';
        }
        chkRec.addEventListener('change', toggleAnillaField);
        toggleAnillaField();
    }

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

    /* ---------- BUSCAR COORDENADAS O DIRECCIÓN ---------- */
    function buscarOCoordenadas(raw) {
    raw = raw.trim();
    if (!raw) return;

    // 1. Intentar UTM primero
    const utm = parseUTM(raw);
    if (utm) {
        try {
            const { lat, lon } = utmToLatLon(utm.easting, utm.northing, utm.zoneNumber, utm.northern);
            detenerSeguimiento();
            if (marker) marker.setLatLng([lat, lon]);
            else marker = L.marker([lat, lon]).addTo(map);
            map.setView([lat, lon], 13);
            document.getElementById("coordenadas_mapa").value = lat.toFixed(5) + ", " + lon.toFixed(5);
            return;
        } catch (err) {
            console.error("Error convirtiendo UTM:", err);
        }
    }

    // 2. Intentar coordenadas decimales (lat, lng)
    const partes = raw.includes(",") ? raw.split(",").map(n => n.trim()) : raw.split(" ").map(n => n.trim());
    if (partes.length === 2 && !isNaN(parseFloat(partes[0])) && !isNaN(parseFloat(partes[1]))) {
        const lat = parseFloat(partes[0]);
        const lng = parseFloat(partes[1]);
        if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
            detenerSeguimiento();
            if (marker) marker.setLatLng([lat, lng]);
            else marker = L.marker([lat, lng]).addTo(map);
            map.setView([lat, lng], 13);
            document.getElementById("coordenadas_mapa").value = lat.toFixed(5) + ", " + lng.toFixed(5);
            return;
        }
    }

    // 3. Si no, tratar como dirección
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(raw)}`;
    fetch(url)
        .then(r => r.json())
        .then(data => {
            if (!data || data.length === 0) {
                alert("No se ha encontrado la dirección ni se reconocieron coordenadas válidas.");
                return;
            }
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            detenerSeguimiento();
            if (marker) marker.setLatLng([lat, lng]);
            else marker = L.marker([lat, lng]).addTo(map);
            map.setView([lat, lng], 16);
            document.getElementById("coordenadas").value = lat.toFixed(5) + ", " + lng.toFixed(5);
            document.getElementById("coordenadas_mapa").value = lat.toFixed(5) + ", " + lng.toFixed(5);
        })
        .catch(err => {
            console.error(err);
            alert("Error al buscar la dirección.");
        });
}

    document.getElementById("coordenadas").addEventListener("change", e => buscarOCoordenadas(e.target.value));
    const btnLocalizar = document.getElementById("btnLocalizar");
    if (btnLocalizar) {
        btnLocalizar.addEventListener("click", () => buscarOCoordenadas(document.getElementById("coordenadas").value));
    }

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
            if (marker) marker.setLatLng([lat, lng]);
            else marker = L.marker([lat, lng]).addTo(map).bindPopup("Estás aquí").openPopup();
            map.setView([lat, lng], 13);
            document.getElementById("coordenadas_mapa").value = lat.toFixed(5) + ", " + lng.toFixed(5);
        }
        iniciarSeguimiento();
    });
    const mapElement = document.getElementById("map");
    mapElement.parentNode.insertBefore(locateButton, mapElement.nextSibling);

    // ✅ ELIMINADO: la llamada a getNumeroEntrada al cargar la página
    // El campo numero_entrada quedará vacío (como debe ser)

    function validarInputDatalist(inputId, datalistId, mensajeError) {
        const input = document.getElementById(inputId);
        const datalist = document.getElementById(datalistId);
        input.addEventListener('blur', function () {
            const opciones = Array.from(datalist.options).map(opt => opt.value.trim());
            if (input.value.trim() === "") return;
            if (!opciones.includes(input.value.trim())) {
                alert(mensajeError);
                input.value = "";
                input.focus();
            }
        });
    }

    validarInputDatalist('especie_comun', 'especies-comun-list', 'Debes seleccionar una especie (nombre común) existente.');
    validarInputDatalist('especie_cientifico', 'especies-cientifico-list', 'Debes seleccionar una especie (nombre científico) existente.');

    /* ---------- ENVÍO DEL FORMULARIO (UNIFICADO Y CORREGIDO) ---------- */
    document.getElementById("formulario").addEventListener("submit", function (e) {
        
        // 1. PRIMERO: Validación nativa del navegador (muestra "Completa este campo")
        if (!this.checkValidity()) {
            e.preventDefault();
            this.reportValidity();
            return;
        }

        // 2. SEGUNDO: Validaciones personalizadas de especies
        const especieComunInput = document.getElementById("especie_comun");
        const especieComunList = Array.from(document.getElementById("especies-comun-list").options).map(opt => opt.value.trim());
        if (!especieComunInput.value.trim() || !especieComunList.includes(especieComunInput.value.trim())) {
            alert("Debes seleccionar una especie (nombre común) válida.");
            especieComunInput.focus();
            e.preventDefault();
            return;
        }
        
        const especieCientificoInput = document.getElementById("especie_cientifico");
        const especieCientificoList = Array.from(document.getElementById("especies-cientifico-list").options).map(opt => opt.value.trim());
        if (!especieCientificoInput.value.trim() || !especieCientificoList.includes(especieCientificoInput.value.trim())) {
            alert("Debes seleccionar una especie (nombre científico) válida.");
            especieCientificoInput.focus();
            e.preventDefault();
            return;
        }

        // 3. TERCERO: Si todo es válido, proceder con el envío AJAX
        e.preventDefault(); // Prevenir envío normal solo ahora
        localStorage.removeItem('recogidasForm');
        const btn = document.getElementById("enviarBtn");
        btn.disabled = true; 
        btn.textContent = "Enviando...";

        const fd = new FormData(this);
        const data = {
            numero_entrada: document.getElementById("numero_entrada").value, // Aunque esté vacío, lo incluimos (no se usa)
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
            observaciones: (() => {
                let txt = fd.get("observaciones")?.trim() || "";
                const anillaInput = document.getElementById('anilla');
                const recuperacionChecked = document.getElementById('recuperacion')?.checked;
                if (recuperacionChecked && anillaInput) {
                    const anilla = anillaInput.value.trim();
                    if (anilla) txt += (txt ? " | " : "") + `Anilla: ${anilla}`;
                }
                return txt;
            })(),
            cumplimentado_por: fd.get("cumplimentado_por"),
            telefono_remitente: fd.get("telefono_remitente"),
            foto: ""
        };

        const file = fd.get("foto");
        if (file && file.size) {
            const reader = new FileReader();
            reader.onload = ev => { 
                data.foto = ev.target.result; 
                enviarDatos(data, btn); 
            };
            reader.readAsDataURL(file);
        } else {
            enviarDatos(data, btn);
        }
    });

    // ✅ FUNCIÓN ACTUALIZADA: usa no-cors en POST y lee el número tras el envío
    async function enviarDatos(data, btn) {
    try {
        const cantidad = Math.max(1, parseInt(data.cantidad_animales) || 1);

        // 1. Enviar el formulario (sin leer respuesta, por no-cors)
        await fetch("https://script.google.com/macros/s/AKfycbwnXBlwDFixbkwI4vNNGfBIFP5QdcdcSlAoA53_hZm8I2JNJX7yLZockaT76FbN7X2d/exec", {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        // 2. Esperar un poco para que el servidor termine
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 3. Obtener todos los datos para leer las últimas N filas
        const response = await fetch("https://script.google.com/macros/s/AKfycbwnXBlwDFixbkwI4vNNGfBIFP5QdcdcSlAoA53_hZm8I2JNJX7yLZockaT76FbN7X2d/exec?funcion=getAllData", {
            method: "GET",
            mode: "cors"
        });

        if (!response.ok) throw new Error(`Error al obtener los datos: ${response.status}`);
        const allData = await response.json();

        // 4. Tomar las últimas "cantidad" filas
        const ultimasFilas = allData.slice(-cantidad);
        if (ultimasFilas.length === 0) throw new Error("No se encontraron filas guardadas");

        // 5. Extraer números y guardar en IndexedDB
        const numeros = [];
        for (let i = 0; i < ultimasFilas.length; i++) {
            const fila = ultimasFilas[i];
            const numero = fila[0]; // columna 0 = número de entrada
            numeros.push(numero);

            // Preparar datos para guardar (una entrada por animal)
            const entradaIndividual = {
                ...data,
                numero_entrada: numero,
                cantidad_animales: 1, // cada entrada local es 1 animal
                // Opcional: sobrescribir con valores reales guardados
                especie_comun: fila[1],
                especie_cientifico: fila[2],
                fecha: fila[4],
                municipio: fila[5],
                posible_causa: fila[6],
                remitente: fila[7],
                estado_animal: fila[8],
                coordenadas: fila[9],
                coordenadas_mapa: fila[10],
                apoyo: fila[11],
                cra_km: fila[12],
                observaciones: fila[13],
                cumplimentado_por: fila[14],
                telefono_remitente: fila[15],
                foto: fila[16]
            };

            await guardarRegistroLocalConNumero(entradaIndividual);
        }

        // 6. Mostrar resultado al usuario
        let mensajeNumeros;
        if (numeros.length === 1) {
            mensajeNumeros = `Número de entrada: ${numeros[0]}`;
        } else {
            mensajeNumeros = `Números de entrada: ${numeros.join(", ")}`;
        }

        alert(`✅ ${cantidad} registro(s) guardado(s) correctamente\n${mensajeNumeros}`);
        sessionStorage.setItem('formEnviadoOK', '1');
        document.getElementById("formulario").reset();
        document.getElementById('fecha').value = new Date().toISOString().split('T')[0];

    } catch (err) {
        console.error("Error al enviar:", err);
        alert("❌ Error al enviar. Verifique su conexión.");
    } finally {
        btn.disabled = false;
        btn.textContent = "Enviar";
    }
}

    // Nueva función auxiliar para guardar con número (solo usada tras el envío)
    const guardarRegistroLocalConNumero = (datos) => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const datosParaGuardar = { ...datos };
            datosParaGuardar.timestamp = new Date().toISOString();
            datosParaGuardar.id = Date.now();
            const request = store.add(datosParaGuardar);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    };

    // Auto-guardado temporal (localStorage) mientras se rellena el formulario
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

    // Modal de registros
    const modal = document.getElementById('modalRegistros');
    const btnVerRegistros = document.getElementById('btnVerRegistros');
    const btnImportar = document.getElementById('btnImportar');
    const btnCerrarModal = document.getElementById('btnCerrarModal');
    const inputImportarJSON = document.getElementById('importarJSON');
    const btnImportarModal = document.getElementById('btnImportarModal');

    btnVerRegistros.addEventListener('click', async () => {
        modal.style.display = 'block';
        await mostrarRegistros();
    });

    btnCerrarModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    btnImportar.addEventListener('click', () => {
        inputImportarJSON.click();
    });

    btnImportarModal.addEventListener('click', () => {
        inputImportarJSON.click();
    });

    inputImportarJSON.addEventListener('change', async (e) => {
        const archivo = e.target.files[0];
        if (!archivo) return;
        if (!confirm('¿Importar este archivo? Esto añadirá los registros a la base de datos local.')) return;
        try {
            await importarRegistrosJSON(archivo);
            alert('✅ Registros importados correctamente');
            if (modal.style.display === 'block') {
                await mostrarRegistros();
            }
            inputImportarJSON.value = '';
        } catch (error) {
            console.error('Error importando:', error);
            alert('❌ Error al importar el archivo. Asegúrate de que sea un JSON válido.');
        }
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
});

/* =====  AL ARRANCAR: limpiar si NO venimos de un envío correcto  ===== */
(() => {
    if (!sessionStorage.getItem('formEnviadoOK')) {
        localStorage.removeItem('recogidasForm');
    }
    sessionStorage.removeItem('formEnviadoOK');
})();

// Carga de municipios
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

// ---------- Carga de especies + autocompletado INTELIGENTE ----------
document.addEventListener("DOMContentLoaded", () => {
    const comInput  = document.getElementById("especie_comun");
    const cienInput = document.getElementById("especie_cientifico");
    let especiesData = [];

    // Función para quitar acentos
    function quitarAcentos(str) {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    }

    fetch("especies.json")
        .then(r => r.json())
        .then(d => {
            especiesData = d;
            const comList = document.getElementById("especies-comun-list");
            const cienList = document.getElementById("especies-cientifico-list");

            // Rellenar datalists: versión SIN acento para buscar y CON acento para insertar
            d.forEach(e => {
                const comSin  = quitarAcentos(e.nombreComun);
                const cienSin = quitarAcentos(e.nombreCientifico);

                const opt1 = document.createElement("option");
                opt1.value = comSin;          // sin acento → aparece al buscar
                comList.appendChild(opt1);

                const opt1b = document.createElement("option");
                opt1b.value = e.nombreComun;  // con acento → se inserta al seleccionar
                comList.appendChild(opt1b);

                const opt2 = document.createElement("option");
                opt2.value = cienSin;
                cienList.appendChild(opt2);

                const opt2b = document.createElement("option");
                opt2b.value = e.nombreCientifico;
                cienList.appendChild(opt2b);
            });

            // Autocompletado cruzado (común → científico)
            comInput.addEventListener("input", () => {
                const found = especiesData.find(x => quitarAcentos(x.nombreComun) === quitarAcentos(comInput.value.trim()));
                if (found) {
                    comInput.value  = found.nombreComun;   // muestra versión con tilde
                    cienInput.value = found.nombreCientifico;
                }
            });

            cienInput.addEventListener("input", () => {
                const found = especiesData.find(x => quitarAcentos(x.nombreCientifico) === quitarAcentes(cienInput.value.trim()));
                if (found) {
                    cienInput.value = found.nombreCientifico;
                    comInput.value  = found.nombreComun;
                }
            });
        })
        .catch(console.error);
});

// Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/Gestion-recogidas-2/service-worker.js')
        .then(() => console.log('Service Worker registrado correctamente'))
        .catch(error => console.error('Error al registrar el Service Worker:', error));
}

// Botón cerrar aplicación
const btnCerrar = document.getElementById('btnCerrar');
if (btnCerrar) {
    btnCerrar.addEventListener('click', () => {
        window.close();
        if (!window.closed) {
            alert('Puedes cerrar esta pestaña desde el navegador.');
        }
    });
}

// Fecha actual por defecto
const hoy = new Date().toISOString().split('T')[0];
document.getElementById('fecha').value = hoy;









