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
   FECHA LOCAL CORRECTA (sin problema UTC)
   ============================================ */
function getFechaLocalISO() {
    const ahora = new Date();
    const año = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
}
// Función para obtener el municipio a partir de coordenadas
async function obtenerMunicipio(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1&countrycodes=ES`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data && data.address) {
      // Prioridad: municipio > ciudad > pueblo > county
      const address = data.address;
      const municipio = 
        address.town || 
        address.city || 
        address.village || 
        address.county || 
        address.state_district || 
        "Desconocido";
      
      const provincia = address.state || "";
      return { municipio, provincia };
    }
    return { municipio: "No encontrado", provincia: "" };
  } catch (error) {
    console.error("Error al obtener municipio:", error);
    return { municipio: "Error", provincia: "" };
  }
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

// Mostrar registros en el modal (con botón CARGAR)
const mostrarRegistros = async () => {
    const registros = await obtenerRegistros();
    const contenedor = document.getElementById('contenidoRegistros');
const importarEnModal = document.getElementById('importarEnModal');
const btnExportar = document.getElementById('btnExportarRegistros');

// Mostrar siempre el botón de exportar si existen registros
if (registros.length === 0) {
  contenedor.innerHTML = '<p style="color:#666;">No hay registros guardados localmente.</p>';
  if (btnExportar) btnExportar.style.display = 'none';
} else {
  if (btnExportar) btnExportar.style.display = 'inline-block';
}

// El botón de importar sigue mostrándose siempre (opcional)
if (importarEnModal) importarEnModal.style.display = 'inline-block';
    registros.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const html = registros.map(reg => `
        <div style="border:1px solid #ddd; padding:12px; margin-bottom:12px; border-radius:6px; background:#f9f9f9;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div style="flex:1;">
                  <strong style="color:#333; font-size:1.1em;">
${reg.especie_comun || 'Sin especie'}
</strong><br>
                    <small style="color:#666;">📅 ${formatearFechaHora(reg.timestamp)}</small>
                </div>
                <div style="display:flex; gap:5px;">
                    <button onclick="cargarRegistroEnFormulario(${reg.id})" 
                            style="background:#28a745; color:white; border:none; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:13px; flex-shrink:0;" 
                            title="Cargar registro">📋 Cargar</button>
                    <button onclick="eliminarYActualizar(${reg.id})" 
                            style="background:#dc3545; color:white; border:none; padding:4px; border-radius:3px; cursor:pointer; font-size:14px; flex-shrink:0; width:30px; height:30px;" 
                            title="Eliminar registro">×</button>
                </div>
            </div>
            <details style="font-size:0.9em; color:#555; margin-top:8px;">
                <summary style="cursor:pointer; color:#17a2b8;">Ver detalles completos</summary>
                <pre style="margin:8px 0 0 0; padding:10px; background:#fff; border:1px solid #e0e0e0; border-radius:4px; white-space: pre-wrap; word-wrap: break-word; font-size:0.85em;">${JSON.stringify(reg, null, 2)}</pre>
            </details>
        </div>
    `).join('');
    contenedor.innerHTML = html;
};
// Función para eliminar un registro y actualizar la vista
window.eliminarYActualizar = async function(id) {
  if (confirm('¿Seguro que quieres eliminar este registro?')) {
    try {
      await eliminarRegistro(id);
      await mostrarRegistros(); // Actualiza la lista tras eliminar
    } catch (err) {
      console.error("Error al eliminar:", err);
      alert("❌ Error al eliminar el registro.");
    }
  }
};

// Función para cargar un registro guardado en el formulario
window.cargarRegistroEnFormulario = async function(id) {
    try {
        // Obtener registro de IndexedDB
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);
        
        request.onsuccess = async () => {
            const registro = request.result;
            if (!registro) {
                alert('❌ No se encontró el registro');
                return;
            }

            // Cerrar modal
            document.getElementById('modalRegistros').style.display = 'none';

            // Limpiar formulario
            document.getElementById('formulario').reset();

            // Rellenar campos simples
            document.getElementById('especie_comun').value = registro.especie_comun || '';
            document.getElementById('especie_cientifico').value = registro.especie_cientifico || '';
            document.getElementById('cantidad_animales').value = registro.cantidad_animales || '';
            document.getElementById('fecha').value = registro.fecha || '';
            document.getElementById('municipio').value = registro.municipio || '';
            document.getElementById('coordenadas').value = registro.coordenadas || '';
            document.getElementById('coordenadas_mapa').value = registro.coordenadas_mapa || '';
            document.getElementById('apoyo').value = registro.apoyo || '';
            document.getElementById('cra_km').value = registro.cra_km || '';
            document.getElementById('observaciones').value = registro.observaciones || '';
            document.getElementById('cumplimentado_por').value = registro.cumplimentado_por || '';
            document.getElementById('telefono_remitente').value = registro.telefono_remitente || '';

            // Activar autocompletado
            document.getElementById('especie_comun').dispatchEvent(new Event('input'));

            // Rellenar checkboxes de posible_causa
            document.querySelectorAll('input[name="posible_causa"]').forEach(cb => cb.checked = false);
            if (Array.isArray(registro.posible_causa)) {
                registro.posible_causa.forEach(valor => {
                    const cb = document.querySelector(`input[name="posible_causa"][value="${valor}"]`);
                    if (cb) cb.checked = true;
                });
            }

            // Rellenar checkboxes de remitente
            document.querySelectorAll('input[name="remitente"]').forEach(cb => cb.checked = false);
            if (Array.isArray(registro.remitente)) {
                registro.remitente.forEach(valor => {
                    const cb = document.querySelector(`input[name="remitente"][value="${valor}"]`);
                    if (cb) cb.checked = true;
                });
            }

            // Rellenar estado_animal
            document.querySelectorAll('input[name="estado_animal"]').forEach(cb => cb.checked = false);
            if (Array.isArray(registro.estado_animal)) {
                registro.estado_animal.forEach(valor => {
                    // Para checkbox "Recoge Centro"
                    if (valor === 'Recoge Centro') {
                        const cb = document.querySelector('input[type="checkbox"][name="estado_animal"][value="Recoge Centro"]');
                        if (cb) cb.checked = true;
                    }
                    // Para radio "Animal Vivo" o "Cadáver"
                    if (valor === 'Animal Vivo' || valor === 'Cadáver') {
                        const radio = document.querySelector(`input[type="radio"][name="estado_animal"][value="${valor}"]`);
                        if (radio) radio.checked = true;
                    }
                    // Para checkbox "Recuperación"
                    if (valor === 'Recuperación') {
                        const cb = document.getElementById('recuperacion');
                        if (cb) cb.checked = true;
                        document.getElementById('anillaWrapper').style.display = 'inline-block';
                        
                        // Extraer anilla de observaciones si existe
                        const match = (registro.observaciones || '').match(/Anilla: (\w+)/);
                        if (match) {
                            document.getElementById('anilla').value = match[1];
                        }
                    }
                });
            }

            // Limpiar foto (no se puede pre-rellenar)
            document.getElementById('foto').value = '';

            alert(`✅ Registro cargado:\n${registro.especie_comun || 'Sin especie'}`);
        };
        
        request.onerror = () => {
            alert('❌ Error al cargar el registro');
        };
    } catch (error) {
        console.error('Error al cargar registro:', error);
        alert('❌ Error al cargar el registro');
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
        // Capa OpenStreetMap (estándar)
    const osmMap = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    });
    
    // ORTOFOTO OFICIAL IGN ESPAÑA (PNOA) + TOPÓNIMOS
    const pnoaBase = L.tileLayer(
        'https://www.ign.es/wmts/pnoa-ma?layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={z}&TileCol={x}&TileRow={y}', 
        {
            attribution: 'Ortofoto © <a href="https://www.ign.es">IGN</a> (PNOA)',
            maxZoom: 20,
            maxNativeZoom: 19
        }
    );

    // Topónimos y límites administrativos oficiales (transparente)
    const toponimosIGN = L.tileLayer(
        'https://www.ign.es/wmts/ign-base?layer=IGNBaseOrto&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix={z}&TileCol={x}&TileRow={y}', 
        {
            attribution: 'Topónimos © IGN',
            maxZoom: 20,
            transparent: true
        }
    );

    // Grupo combinado: ortofoto + topónimos siempre van juntos
    const ortofotoOficial = L.layerGroup([pnoaBase, toponimosIGN]);

    // Control de capas actualizado
    L.control.layers({ 
        "Mapa estándar": osmMap, 
        "Ortofoto España + nombres": ortofotoOficial 
    }).addTo(map);
    
    // Capa por defecto al cargar
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
// Mostrar/ocultar desplegable de "Otras" en Posible causa
const chkOtrasCausa = document.getElementById('otras');
const wrapperOtrasCausa = document.getElementById('otrasCausaWrapper');

if (chkOtrasCausa && wrapperOtrasCausa) {
    // Función para ocultar el desplegable y limpiar selección
    function ocultarDesplegableOtras() {
        wrapperOtrasCausa.style.display = 'none';
        document.getElementById('otrasCausaSelect').value = '';
        chkOtrasCausa.checked = false;
    }

    // Evento para mostrar/ocultar al hacer clic en "Otras"
    chkOtrasCausa.addEventListener('change', function() {
        if (this.checked) {
            wrapperOtrasCausa.style.display = 'block';
        } else {
            ocultarDesplegableOtras();
        }
    });

    // Evento para ocultar el desplegable cuando se marca cualquier otra causa
    const todasCausasCheckboxes = document.querySelectorAll('input[name="posible_causa"]');
    todasCausasCheckboxes.forEach(checkbox => {
        if (checkbox.id !== 'otras') { // Excluir el checkbox "Otras" mismo
            checkbox.addEventListener('change', function() {
                if (this.checked) {
                    ocultarDesplegableOtras();
                }
            });
        }
    });
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
    
    // Actualizar campo de coordenadas
    document.getElementById("coordenadas_mapa").value = latlng.lat.toFixed(5) + ", " + latlng.lng.toFixed(5);
    
    // Mostrar/actualizar marcador
    if (marker) {
        marker.setLatLng(latlng);
    } else {
        marker = L.marker(latlng).addTo(map);
    }
    
    // ✅ Obtener y mostrar municipio
    obtenerMunicipio(latlng.lat, latlng.lng).then(({ municipio, provincia }) => {
        const popupContent = `
            <div style="font-family:sans-serif; font-size:14px;">
                <strong>📍 Coordenadas:</strong> ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}<br>
                <strong>🏙️ Municipio:</strong> ${municipio}<br>
                ${provincia ? `<strong>🗺️ Provincia:</strong> ${provincia}<br>` : ''}
                <small style="color:#666;">Datos de OpenStreetMap</small>
            </div>
        `;
        
        // ✅ Crear/actualizar popup correctamente
        if (marker.getPopup()) {
            marker.setPopupContent(popupContent);
        } else {
            marker.bindPopup(popupContent);
        }
        marker.openPopup();
        
      // ✅ Buscar coincidencia en la lista oficial de municipios
const municipioInput = document.getElementById('municipio');
if (municipioInput && municipio !== "Desconocido" && municipio !== "No encontrado") {
    // Normalizar el municipio obtenido (quitar acentos y convertir a minúsculas)
    const municipioNormalizado = municipio.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    
    // Buscar en la lista oficial de municipios
    const municipioOficial = window.municipiosData?.find(m => 
        m.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === municipioNormalizado
    );
    
    // Usar el nombre oficial si se encuentra, sino usar el obtenido
    municipioInput.value = municipioOficial || municipio;
    
    // Disparar evento 'input' para activar el autocompletado visual
    municipioInput.dispatchEvent(new Event('input'));
}
    });
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
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ES&q=${encodeURIComponent(raw)}`;
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
   validarInputDatalist('municipio', 'municipios-list', 'Debes seleccionar un municipio existente.');

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
// Validar "Otras" solo si está marcada
const chkOtras = document.getElementById('otras');
const selectOtras = document.getElementById('otrasCausaSelect');

if (chkOtras?.checked && (!selectOtras?.value || selectOtras.value === "")) {
    alert('Debes seleccionar una causa específica en "Otras"');
    selectOtras?.focus();
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
       // Recoger valor de "Posible causa" (radio button)
const posibleCausaRadio = document.querySelector('input[name="posible_causa"]:checked');
let posibleCausaValue = posibleCausaRadio?.value || "";

// Si está seleccionado "Otras", usar el valor del desplegable
if (posibleCausaValue === "Otras") {
    const otrasCausaSelect = document.getElementById('otrasCausaSelect');
    if (otrasCausaSelect?.value) {
        posibleCausaValue = otrasCausaSelect.value;
    }
}

const data = {
    numero_entrada: document.getElementById("numero_entrada").value,
    especie_comun: fd.get("especie_comun"),
    especie_cientifico: fd.get("especie_cientifico"),
    cantidad_animales: fd.get("cantidad_animales"),
    fecha: fd.get("fecha"),
    municipio: fd.get("municipio"),
    posible_causa: posibleCausaValue, // ← Valor único (string)
    remitente: fd.get("remitente") || "",
    estado_animal: fd.getAll("estado_animal"),
    coordenadas: fd.get("coordenadas"),
    coordenadas_mapa: fd.get("coordenadas_mapa"),
    apoyo: fd.get("apoyo"),
    cra_km: fd.get("cra_km"),
    observaciones: (() => {
        let txt = fd.get("observaciones")?.trim() || "";
        // Añadir texto de "Especificar causa"
        const especificarCausa = document.getElementById('otras_texto')?.value?.trim();
        if (especificarCausa) {
            txt += (txt ? " | " : "") + especificarCausa;
        }
        // Añadir texto de "Especificar remitente"
        const especificarRemitente = document.getElementById('otras_remitente_texto')?.value?.trim();
        if (especificarRemitente) {
            txt += (txt ? " | " : "") + especificarRemitente;
        }
        // Añadir anilla si aplica
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

// ✅ FUNCIÓN ACTUALIZADA: guarda ANTES del envío y maneja offline correctamente
async function enviarDatos(data, btn) {
  let registroPendienteId = null;
  try {
    const cantidad = Math.max(1, parseInt(data.cantidad_animales) || 1);

    // ✅ 1. GUARDAR REGISTRO COMO "PENDIENTE" ANTES DE INTENTAR ENVIAR
    const registroPendiente = {
      ...data,
      estado: "pendiente",
      id: Date.now()
    };
    registroPendienteId = registroPendiente.id;
    await guardarRegistroLocalConEstado(registroPendiente, "pendiente");

    // 2. Enviar el formulario (sin leer respuesta, por no-cors)
    await fetch("https://script.google.com/macros/s/AKfycbwtC82haU7l0Ta0n5L-WhakFvYQWDUETb0_JOmo7g7E_lifJ4ccXNGTjm8OFyJnAnkL/exec", {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    // 3. Esperar un poco para que el servidor termine
    await new Promise(resolve => setTimeout(resolve, 500));

    // 4. Obtener todos los datos y filtrar/ordenar por número de entrada
    const response = await fetch("https://script.google.com/macros/s/AKfycbwtC82haU7l0Ta0n5L-WhakFvYQWDUETb0_JOmo7g7E_lifJ4ccXNGTjm8OFyJnAnkL/exec?funcion=getAllData", {
      method: "GET",
      mode: "cors"
    });
    if (!response.ok) throw new Error(`Error al obtener los datos: ${response.status}`);
    const allData = await response.json();

    // Filtrar solo filas con número válido y convertir a número
    const filasConNumero = allData
      .map(fila => {
        const num = Number(fila[0]);
        return { numero: num, datos: fila };
      })
      .filter(item => !isNaN(item.numero) && item.numero > 0);

    // Ordenar de mayor a menor (más reciente primero)
    filasConNumero.sort((a, b) => b.numero - a.numero);

    // Tomar las primeras "cantidad" entradas
    const entradasRecientes = filasConNumero.slice(0, cantidad);
    if (entradasRecientes.length === 0) throw new Error("No se encontraron filas guardadas");

    // Extraer números y ordenar ASCENDENTEMENTE para lógica de rango
    const numeros = entradasRecientes
      .map(item => item.numero)
      .sort((a, b) => a - b); // ← ¡ESTO ES CLAVE!

    // 5. ACTUALIZAR EL REGISTRO A "ENVIADO" (con los números asignados)
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(registroPendienteId);
    getRequest.onsuccess = () => {
      const reg = getRequest.result;
      if (reg) {
        reg.estado = "enviado";
        reg.numerosAsignados = numeros;
        store.put(reg);
      }
    };

    // 6. Mostrar resultado al usuario
    let mensajeNumeros;
    if (numeros.length === 1) {
      mensajeNumeros = `Número de entrada: <span class="numeros-grandes">${numeros[0]}</span>`;
    } else {
      const esConsecutivo = numeros.every((num, i) => i === 0 || num === numeros[i - 1] + 1);
      if (esConsecutivo && numeros.length >= 5) {
        mensajeNumeros = `Rango asignado: <span class="numeros-grandes">${numeros[0]}-${numeros[numeros.length - 1]}</span> (${numeros.length} animales)`;
      } else if (esConsecutivo && numeros.length <= 4) {
        mensajeNumeros = `Números de entrada: <span class="numeros-grandes">${numeros.join(", ")}</span>`;
      } else {
        mensajeNumeros = `Números asignados: <span class="numeros-grandes">${numeros[0]}, ${numeros[1]}, …, ${numeros[numeros.length - 1]}</span> (${numeros.length} animales)`;
      }
    }

    Swal.fire({
      icon: 'success',
      title: `${cantidad} registro(s) guardado(s)`,
      html: mensajeNumeros,
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#28a745',
      width: '600px'
    });

    sessionStorage.setItem('formEnviadoOK', '1');
    document.getElementById("formulario").reset();
    document.getElementById('fecha').value = getFechaLocalISO();

  } catch (err) {
    console.error("Error al enviar:", err);
    // ❌ Si falla, el registro YA está guardado como "pendiente"
    alert("❌ Error al enviar. El registro se guardó localmente y se puede reenviar después.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Enviar";
  }
}

   // Guarda un registro con estado ("pendiente" o "enviado")
const guardarRegistroLocalConEstado = (datos, estado = "pendiente") => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const datosParaGuardar = { ...datos, estado };
    datosParaGuardar.timestamp = new Date().toISOString();
    datosParaGuardar.id = Date.now();
    const request = store.add(datosParaGuardar);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

    // Auto-guardado temporal (localStorage) mientras se rellena el formulario
    const form = document.getElementById("formulario");
   // Prevenir envío al pulsar Enter en el campo Teléfono Remitente
const telefonoInput = document.getElementById('telefono_remitente');
if (telefonoInput) {
    telefonoInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.keyCode === 13) {
            e.preventDefault(); // Evita que se envíe el formulario
            this.blur(); // Opcional: quita el foco del campo
        }
    });
}
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
   // ==================================================
// 🐦 ASISTENTE DE USUARIO - "PÁJARO AYUDANTE" CON SONIDO Y VUELO (versión 2)
// Gestión de Recogidas - Aparece tras 10s de inactividad
// ==================================================
(function() {
    if (document.getElementById('birdAssistant')) return;

    // ====== 1. Sonido suave ======
    function playChime() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 1.2);
        } catch (e) {
            console.warn("Audio no disponible:", e);
        }
    }

    // ====== 2. Nuevo pájaro: SVG de gorrión claro y bonito ======
    const bird = document.createElement('div');
    bird.id = 'birdAssistant';
    bird.innerHTML = `
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style="pointer-events:none;">
            <path d="M12 5C9.2 5 7 7.2 7 10C7 11.5 7.7 12.8 8.8 13.6L7.5 16C7.2 16.5 7.5 17.1 8 17.3C8.2 17.4 8.4 17.4 8.6 17.4C8.9 17.4 9.2 17.3 9.4 17.1L10.7 15.8C11.2 15.9 11.6 16 12 16C14.8 16 17 13.8 17 11C17 8.2 14.8 6 12 6C12 5.7 12 5.3 12 5Z" fill="#27ae60"/>
            <circle cx="10" cy="9" r="1" fill="#fff"/>
            <circle cx="10" cy="9" r="0.5" fill="#000"/>
            <path d="M15 10C15 11.1 14.1 12 13 12C11.9 12 11 11.1 11 10C11 8.9 11.9 8 13 8C14.1 8 15 8.9 15 10Z" fill="#f39c12"/>
        </svg>
    `;
    Object.assign(bird.style, {
        position: 'fixed',
        bottom: '-100px',
        right: '-50px',
        cursor: 'pointer',
        zIndex: '10000',
        background: '#fff',
        borderRadius: '50%',
        padding: '6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        opacity: '0',
        transition: 'all 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28)'
    });
    document.body.appendChild(bird);

    // ====== 3. Modal con nombre único ======
    const birdModalContainer = document.createElement('div');
    birdModalContainer.id = 'birdModal';
    birdModalContainer.innerHTML = `
        <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:10001; opacity:0; pointer-events:none; transition:opacity 0.3s;">
            <div style="background:#fff; border-radius:12px; width:90%; max-width:500px; max-height:80vh; overflow:auto; box-shadow:0 6px 20px rgba(0,0,0,0.3);">
                <div style="background:#2c3e50; color:white; padding:16px; border-radius:12px 12px 0 0; font-weight:bold; display:flex; justify-content:space-between; align-items:center;">
                    🆘 ¿Necesitas ayuda?
                    <button id="closeBirdModal" style="background:none; border:none; color:white; font-size:20px; cursor:pointer;">×</button>
                </div>
                <div id="birdModalContent" style="padding:16px; font-size:15px; line-height:1.5; color:#2c3e50;">
                    <!-- Contenido dinámico -->
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(birdModalContainer);

    // ====== 4. Contenido de ayuda (sin cambios) ======
    const helpSections = {
  direccionPrecisa: `
    <h3>📍 Cómo buscar direcciones correctamente</h3>
    <p>Para que el mapa ubique bien la dirección, <strong>escribe siempre el nombre de la ciudad o pueblo completo</strong>.</p>
    <ul style="padding-left:20px; margin-top:8px;">
      <li>✅ <strong>Bien:</strong> <code>Calle Colón, Valencia ciudad</code></li>
      <li>✅ <strong>Bien:</strong> <code>Plaza Mayor, Xàtiva</code></li>
      <li>✅ <strong>Bien:</strong> <code>Avenida Elche, Alicante</code></li>
      <li>❌ <strong>Evita:</strong> <code>Calle Colón, Valencia</code> → puede ir a Alicante</li>
      <li>❌ <strong>Evita:</strong> <code>Calle Colón</code> → puede ir a otro municipio</li>
    </ul>
    <p style="margin-top:12px; font-weight:bold; color:#27ae60;">
      💡 Consejo: usa "Valencia ciudad", "Alicante ciudad" o el nombre exacto del pueblo.
    </p>
  `,
  coordsFormat: `
    <h3>📍 Formatos admitidos en "Coordenadas dadas o dirección"</h3>
    <p><strong>1. Dirección:</strong> Ej. <code>Ayuntamiento de Valencia ciudad</code></p>
    <p><strong>2. Grados decimales:</strong> Ej. <code>39.47, -0.38</code> (usa punto como separador decimal)</p>
    <p><strong>3. Coordenadas UTM (WGS84):</strong></p>
    <ul style="margin-top:8px; padding-left:20px;">
      <li><code>731053 4413603</code> → asume zona 30N (Comunidad Valenciana)</li>
      <li><code>731053 4413603 30N</code> → zona explícita</li>
      <li>No uses comas decimales ni letras "E/N" sueltas</li>
    </ul>
    <p style="margin-top:12px;"><em>Tras escribir, pulsa ENTER o el botón "Localizar".</em></p>
  `,
  coordsNoMarker: `
    <h3>🔍 No aparece el marcador en el mapa</h3>
    <ul style="padding-left:20px;">
      <li>Asegúrate de pulsar ENTER o "Localizar"</li>
      <li>Verifica que las coordenadas estén en formato válido</li>
      <li>Si usas UTM, deben ser números enteros (ej. 731053 4413603)</li>
      <li>Prueba con una dirección conocida para descartar fallos de red</li>
    </ul>
  `,
  especiesComo: `
    <h3>🦉 Cómo elegir especie común/científica</h3>
    <p>Escribe parte del nombre común (ej. "búho") y selecciona de la lista desplegable.</p>
    <p>El campo científico se rellena automáticamente.</p>
    <p><strong>Importante:</strong> Solo puedes elegir especies de la lista oficial. No se admiten nombres libres.</p>
  `,
  especiesNoAparece: `
    <h3>⚠️ Mi especie no aparece en la lista</h3>
    <ul style="padding-left:20px;">
      <li>Revisa ortografía</li>
      <li>Si sigue sin aparecer, contacta con Alberto ;) para añadirla al fichero <code>especies.json</code></li>
    </ul>
  `,
  numeroEntrada: `
    <h3>🔢 ¿Dónde está mi número de entrada?</h3>
    <p>Se genera <strong>automáticamente tras enviar</strong> el formulario.</p>
    <p>Aparece en la alerta de confirmación y se guarda en "Registros locales".</p>
  `,
  falloEnvio: `
    <h3>📡 ¿Qué pasa si falla el envío?</h3>
    <p>Si no hay conexión a internet:</p>
    <ul style="padding-left:20px;">
      <li>El registro se guarda <strong>localmente en tu dispositivo</strong></li>
      <li>Puedes verlo y reenviarlo desde el botón <strong>"Ver registros guardados"</strong></li>
      <li>¡Nunca se pierde un registro!</li>
    </ul>
  `,
  registrosLocales: `
    <h3>💾 Cómo ver o enviar registros guardados</h3>
    <p>Pulsa el botón <strong>"Ver registros guardados"</strong> (abajo del formulario).</p>
    <p>Allí puedes:</p>
    <ul style="padding-left:20px;">
      <li>Ver detalles completos</li>
      <li>Eliminar registros</li>
      <li>Reenviar a Google Sheets</li>
      <li>Exportar/importar como copia de seguridad (JSON)</li>
    </ul>
  `,
  recuperacionAnilla: `
    <h3>🪶 ¿Cuándo marcar "Recuperación con anilla"?</h3>
    <p>Márcalo <strong>solo si el animal llevaba anilla identificativa</strong>.</p>
    <p>Luego introduce el código de la anilla en el campo que aparece.</p>
    <p>Esta información se añadirá automáticamente a "Observaciones".</p>
  `,
  camposAdicionales: `
    <h3>📋 ¿Qué poner en "Posible causa" o "Remitente"?</h3>
    <p><strong>Posible causa:</strong> Elige una o varias opciones (ej. atropello, electrocución, colisión).</p>
    <p><strong>Remitente:</strong> Quién encontró/comunicó el animal (ciudadano, agente forestal, veterinario, etc.).</p>
    <p><strong>Municipio:</strong> Empieza a escribir para autocompletar (debe coincidir con la lista oficial).</p>
  `
};

    // ====== 5. Funciones de interacción (usando birdModalContainer) ======
    function showHelp(contentKey) {
        document.getElementById('birdModalContent').innerHTML = helpSections[contentKey];
        birdModalContainer.style.display = 'block';
        setTimeout(() => {
            birdModalContainer.children[0].style.opacity = '1';
            birdModalContainer.children[0].style.pointerEvents = 'auto';
        }, 10);
    }

    function closeModal() {
        birdModalContainer.children[0].style.opacity = '0';
        birdModalContainer.children[0].style.pointerEvents = 'none';
        setTimeout(() => birdModalContainer.style.display = 'none', 300);
    }

    document.getElementById('closeBirdModal').addEventListener('click', closeModal);
    birdModalContainer.addEventListener('click', (e) => {
        if (e.target === birdModalContainer) closeModal();
    });

    function showMainMenu() {
  const menu = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
      <div onclick="showHelp('direccionPrecisa')" style="cursor:pointer; padding:10px; background:#e8f5e9; border-radius:8px; border:1px solid #27ae60;">
        <strong>📍 Direcciones precisas</strong><br><small>Evita errores de ubicación</small>
      </div>
      <div onclick="showHelp('coordsFormat')" style="cursor:pointer; padding:10px; background:#f8f9fa; border-radius:8px; border:1px solid #ddd;">
        <strong>Coordenadas</strong><br><small>Formatos admitidos</small>
      </div>
      <div onclick="showHelp('coordsNoMarker')" style="cursor:pointer; padding:10px; background:#f8f9fa; border-radius:8px; border:1px solid #ddd;">
        <strong>Coordenadas</strong><br><small>No aparece marcador</small>
      </div>
      <div onclick="showHelp('especiesComo')" style="cursor:pointer; padding:10px; background:#f8f9fa; border-radius:8px; border:1px solid #ddd;">
        <strong>Especies</strong><br><small>Cómo elegir</small>
      </div>
      <div onclick="showHelp('especiesNoAparece')" style="cursor:pointer; padding:10px; background:#f8f9fa; border-radius:8px; border:1px solid #ddd;">
        <strong>Especies</strong><br><small>No aparece mi especie</small>
      </div>
      <div onclick="showHelp('numeroEntrada')" style="cursor:pointer; padding:10px; background:#f8f9fa; border-radius:8px; border:1px solid #ddd;">
        <strong>Número entrada</strong><br><small>¿Dónde está?</small>
      </div>
      <div onclick="showHelp('falloEnvio')" style="cursor:pointer; padding:10px; background:#f8f9fa; border-radius:8px; border:1px solid #ddd;">
        <strong>Fallo de envío</strong><br><small>¿Qué hago?</small>
      </div>
      <div onclick="showHelp('registrosLocales')" style="cursor:pointer; padding:10px; background:#f8f9fa; border-radius:8px; border:1px solid #ddd;">
        <strong>Registros locales</strong><br><small>Ver/reenviar</small>
      </div>
      <div onclick="showHelp('recuperacionAnilla')" style="cursor:pointer; padding:10px; background:#f8f9fa; border-radius:8px; border:1px solid #ddd;">
        <strong>Recuperación</strong><br><small>Anilla</small>
      </div>
      <div onclick="showHelp('camposAdicionales')" style="cursor:pointer; padding:10px; background:#f8f9fa; border-radius:8px; border:1px solid #ddd; grid-column: span 2;">
        <strong>Otros campos</strong><br><small>Posible causa, remitente, etc.</small>
      </div>
    </div>
    <button onclick="closeModal()" style="width:100%; margin-top:16px; padding:8px; background:#7f8c8d; color:white; border:none; border-radius:6px; font-weight:bold;">
      Cerrar
    </button>
  `;
  document.getElementById('birdModalContent').innerHTML = menu;
  birdModalContainer.style.display = 'block';
  setTimeout(() => {
    birdModalContainer.children[0].style.opacity = '1';
    birdModalContainer.children[0].style.pointerEvents = 'auto';
  }, 10);
}

    window.showHelp = showHelp;
    window.closeModal = closeModal;

    bird.addEventListener('click', (e) => {
        e.stopPropagation();
        showMainMenu();
    });

    // ====== 6. Animación con sonido (SOLO UNA VEZ) ======
let sonidoReproducido = false;

function showBird() {
  if (localStorage.getItem('birdDismissed') === 'true') return;
  
  // ✅ Reproducir sonido SOLO LA PRIMERA VEZ
  if (!sonidoReproducido) {
    playChime();
    sonidoReproducido = true;
  }
  
  bird.style.bottom = '-100px';
  bird.style.right = '-50px';
  bird.style.opacity = '0';
  bird.style.display = 'block';
  
  setTimeout(() => {
    bird.style.bottom = '20px';
    bird.style.right = '20px';
    bird.style.opacity = '1';
    
    // Efecto de aleteo sutil
    const svg = bird.querySelector('svg');
    svg.style.transition = 'transform 0.2s';
    
    bird.addEventListener('mouseenter', () => {
      svg.style.transform = 'rotate(-8deg)';
    });
    
    bird.addEventListener('mouseleave', () => {
      svg.style.transform = 'rotate(0deg)';
    });
  }, 50);
}
    // ====== 7. Inactividad ======
    let inactivityTimer;
    const ACTIVATION_DELAY = 10000;
    function resetTimer() {
        clearTimeout(inactivityTimer);
        if (localStorage.getItem('birdDismissed') !== 'true') {
            inactivityTimer = setTimeout(showBird, ACTIVATION_DELAY);
        }
    }
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
        document.addEventListener(event, resetTimer, true);
    });
    resetTimer();

    // Ocultar permanentemente con clic derecho
    bird.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (confirm("¿Quieres ocultar este ayudante permanentemente?")) {
            localStorage.setItem('birdDismissed', 'true');
            bird.style.opacity = '0';
            setTimeout(() => bird.style.display = 'none', 500);
        }
    });
})();
});

/* =====  AL ARRANCAR: limpiar si NO venimos de un envío correcto  ===== */
(() => {
    if (!sessionStorage.getItem('formEnviadoOK')) {
        localStorage.removeItem('recogidasForm');
    }
    sessionStorage.removeItem('formEnviadoOK');
})();

// Carga de municipios con normalización de acentos
document.addEventListener("DOMContentLoaded", () => {
    fetch("municipios.json")
        .then(r => r.json())
        .then(d => {
            // Función para quitar acentos (igual que en especies)
            function quitarAcentos(str) {
                return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            }
            
            window.municipiosData = d.municipios; // Guardar datos para búsqueda
            const list = document.getElementById("municipios-list");
            
            // Rellenar datalist con ambas versiones (con y sin acento)
            d.municipios.forEach(municipio => {
                const sinAcento = quitarAcentos(municipio);
                
                // Opción sin acento (para que aparezca al buscar)
                const opt1 = document.createElement("option");
                opt1.value = sinAcento;
                list.appendChild(opt1);
                
                // Opción con acento (para insertar el valor correcto)
                const opt2 = document.createElement("option");
                opt2.value = municipio;
                list.appendChild(opt2);
            });
            
            // Autocorrección al escribir
            const municipioInput = document.getElementById("municipio");
            municipioInput.addEventListener("input", () => {
                const valorEscrito = municipioInput.value.trim();
                if (!valorEscrito) return;
                
                const encontrado = window.municipiosData.find(m => 
                    quitarAcentos(m) === quitarAcentos(valorEscrito)
                );
                
                if (encontrado) {
                    municipioInput.value = encontrado; // Asigna versión con acento correcto
                }
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
                const found = especiesData.find(x => quitarAcentos(x.nombreCientifico) === quitarAcentos(cienInput.value.trim()));
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
const hoy = getFechaLocalISO();
document.getElementById('fecha').value = hoy;

// ============================================
// ✅ ACTUALIZAR FECHA AUTOMÁTICAMENTE AL VOLVER A LA APP (tablets compartidas)
// ============================================
function actualizarFechaSiEsAnterior() {
  const fechaInput = document.getElementById('fecha');
  if (!fechaInput) return;
  
  const fechaActual = getFechaLocalISO();
  const fechaGuardada = fechaInput.value;
  
  // Si la fecha guardada es diferente a la fecha actual → actualizar
  if (fechaGuardada && fechaGuardada !== fechaActual) {
    fechaInput.value = fechaActual;
    console.log(`📅 Fecha actualizada automáticamente: ${fechaActual}`);
    
    // Feedback visual sutil
    fechaInput.style.borderColor = '#28a745';
    fechaInput.style.boxShadow = '0 0 0 2px rgba(40, 167, 69, 0.3)';
    setTimeout(() => {
      fechaInput.style.borderColor = '';
      fechaInput.style.boxShadow = '';
    }, 1500);
  }
}

// 1. Al cargar la página (ya se hace arriba, pero por si acaso)
actualizarFechaSiEsAnterior();

// 2. ✅ CUANDO EL USUARIO VUELVE A LA PESTAÑA (evento clave para tablets compartidas)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    actualizarFechaSiEsAnterior();
  }
});

// 3. ✅ CUANDO LA VENTANA RECIBE FOCO
window.addEventListener('focus', actualizarFechaSiEsAnterior);










