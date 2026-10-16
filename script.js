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
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1&countrycodes=ES&accept-language=ca`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data && data.address) {
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

const obtenerRegistros = () => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const eliminarRegistro = (id) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

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

const mostrarRegistros = async () => {
    const registros = await obtenerRegistros();
    const contenedor = document.getElementById('contenidoRegistros');
    const importarEnModal = document.getElementById('importarEnModal');
    const btnExportar = document.getElementById('btnExportarRegistros');

    if (registros.length === 0) {
      contenedor.innerHTML = '<p style="color:#666;">No hay registros guardados localmente.</p>';
      if (btnExportar) btnExportar.style.display = 'none';
    } else {
      if (btnExportar) btnExportar.style.display = 'inline-block';
    }

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

window.eliminarYActualizar = async function(id) {
  if (confirm('¿Seguro que quieres eliminar este registro?')) {
    try {
      await eliminarRegistro(id);
      await mostrarRegistros();
    } catch (err) {
      console.error("Error al eliminar:", err);
      alert("❌ Error al eliminar el registro.");
    }
  }
};

window.cargarRegistroEnFormulario = async function(id) {
    try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);
        
        request.onsuccess = async () => {
            const registro = request.result;
            if (!registro) {
                alert('❌ No se encontró el registro');
                return;
            }

            document.getElementById('modalRegistros').style.display = 'none';
            document.getElementById('formulario').reset();

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

            document.getElementById('especie_comun').dispatchEvent(new Event('input'));

            document.querySelectorAll('input[name="posible_causa"]').forEach(rb => rb.checked = false);
            const otrasCausaSelect = document.getElementById('otrasCausaSelect');
            const chkOtrasCausa = document.getElementById('otras');
            const wrapperOtrasCausa = document.getElementById('otrasCausaWrapper');
            
            if (registro.posible_causa) {
                const valorCausa = registro.posible_causa.trim();
                const valorCausaUpper = valorCausa.toUpperCase();
                
                let rbEncontrado = null;
                document.querySelectorAll('input[name="posible_causa"]').forEach(rb => {
                    if (rb.value.toUpperCase() === valorCausaUpper) {
                        rbEncontrado = rb;
                    }
                });
                
                if (rbEncontrado) {
                    rbEncontrado.checked = true;
                    if (rbEncontrado.value === 'Otras' || rbEncontrado.id === 'otras') {
                        if (chkOtrasCausa) chkOtrasCausa.checked = true;
                        if (wrapperOtrasCausa) wrapperOtrasCausa.style.display = 'block';
                    }
                } else if (otrasCausaSelect) {
                    otrasCausaSelect.value = valorCausa;
                    if (chkOtrasCausa) {
                        chkOtrasCausa.checked = true;
                        chkOtrasCausa.dispatchEvent(new Event('change'));
                    }
                }
            } else {
                if (wrapperOtrasCausa) wrapperOtrasCausa.style.display = 'none';
                if (chkOtrasCausa) chkOtrasCausa.checked = false;
            }

            document.querySelectorAll('input[name="remitente"]').forEach(rb => rb.checked = false);
            const remitenteSelect = document.querySelector('select[name="remitente"]');
            
            if (registro.remitente) {
                if (remitenteSelect) {
                    remitenteSelect.value = registro.remitente;
                } else {
                    const rbRemitente = document.querySelector(`input[name="remitente"][value="${registro.remitente}"]`);
                    if (rbRemitente && rbRemitente.type === 'radio') {
                        rbRemitente.checked = true;
                    } else {
                        const inputRemitente = document.querySelector('input[name="remitente"]');
                        if (inputRemitente && inputRemitente.type !== 'radio') {
                            inputRemitente.value = registro.remitente;
                        }
                    }
                }
            }

            document.querySelectorAll('input[name="estado_animal"]').forEach(cb => cb.checked = false);
            if (Array.isArray(registro.estado_animal)) {
                registro.estado_animal.forEach(valor => {
                    if (valor === 'Recoge Centro') {
                        const cb = document.querySelector('input[type="checkbox"][name="estado_animal"][value="Recoge Centro"]');
                        if (cb) cb.checked = true;
                    }
                    if (valor === 'Animal Vivo' || valor === 'Cadáver') {
                        const radio = document.querySelector(`input[type="radio"][name="estado_animal"][value="${valor}"]`);
                        if (radio) radio.checked = true;
                    }
                    if (valor === 'Recuperación') {
                        const cb = document.getElementById('recuperacion');
                        if (cb) cb.checked = true;
                        document.getElementById('anillaWrapper').style.display = 'inline-block';
                        
                        const match = (registro.observaciones || '').match(/Anilla: (\w+)/);
                        if (match) {
                            document.getElementById('anilla').value = match[1];
                        }
                    }
                });
            }

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

initDB().then(() => {
    console.log('IndexedDB inicializada correctamente');
}).catch(err => {
    console.error('Error inicializando IndexedDB:', err);
    alert('Error al inicializar base de datos local. Los registros no se guardarán.');
});
/* ============================================ */

document.addEventListener("DOMContentLoaded", function () {
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

    const especieComunInput = document.getElementById('especie_comun');
    if (especieComunInput) {
        especieComunInput.addEventListener('change', function () {
            const especie = this.value.toLowerCase();
            if (especie.includes('murci') && 
                !especie.includes('no identificado') && 
                !especie.includes('indet')) {
                
                const mensaje = "Si no estás seguro de la especie de murciélago, selecciona 'Murciélago no identificado'. ¿Estás completamente seguro de la identificación?";
                if (!confirm(mensaje)) {
                    this.value = "Murciélago no identificado";
                    this.dispatchEvent(new Event('input'));
                }
            }
        });
    }

    var map = L.map("map").setView([39.4699, -0.3763], 10);
    const osmMap = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    });
    
    const pnoaBase = L.tileLayer(
        'https://www.ign.es/wmts/pnoa-ma?layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={z}&TileCol={x}&TileRow={y}', 
        {
            attribution: 'Ortofoto © <a href="https://www.ign.es">IGN</a> (PNOA)',
            maxZoom: 20,
            maxNativeZoom: 19
        }
    );

    const toponimosIGN = L.tileLayer(
        'https://www.ign.es/wmts/ign-base?layer=IGNBaseOrto&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix={z}&TileCol={x}&TileRow={y}', 
        {
            attribution: 'Topónimos © IGN',
            maxZoom: 20,
            transparent: true
        }
    );

    const ortofotoOficial = L.layerGroup([pnoaBase, toponimosIGN]);

    L.control.layers({ 
        "Mapa estándar": osmMap, 
        "Ortofoto España + nombres": ortofotoOficial 
    }).addTo(map);
    
    osmMap.addTo(map);

    let marker, watchId = null, seguimientoActivo = true, forzarZoomInicial = false, ultimaPosicion = null;

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

    function obtenerPosicionRapida() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocalización no soportada'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                pos => resolve(pos),
                err => {
                    navigator.geolocation.getCurrentPosition(
                        pos => resolve(pos),
                        err2 => reject(err2),
                        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
                    );
                },
                { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
            );
        });
    }

    function mostrarEstadoGPS(mensaje, tipo = 'info') {
        const existente = document.getElementById('gpsStatus');
        if (existente) existente.remove();

        const div = document.createElement('div');
        div.id = 'gpsStatus';
        div.textContent = mensaje;
        Object.assign(div.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '10px 20px',
            borderRadius: '6px',
            zIndex: '10000',
            fontWeight: 'bold',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            backgroundColor: tipo === 'error' ? '#dc3545' : tipo === 'success' ? '#28a745' : '#17a2b8',
            color: 'white',
            fontSize: '14px'
        });
        document.body.appendChild(div);

        setTimeout(() => {
            if (div.parentNode) div.remove();
        }, 4000);
    }

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

    const chkOtrasCausa = document.getElementById('otras');
    const wrapperOtrasCausa = document.getElementById('otrasCausaWrapper');

    if (chkOtrasCausa && wrapperOtrasCausa) {
        function ocultarDesplegableOtras() {
            wrapperOtrasCausa.style.display = 'none';
            const select = document.getElementById('otrasCausaSelect');
            if (select) select.value = '';
        }

        const todasCausasRadios = document.querySelectorAll('input[name="posible_causa"]');
        todasCausasRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.id === 'otras' && this.checked) {
                    wrapperOtrasCausa.style.display = 'block';
                } else {
                    ocultarDesplegableOtras();
                }
            });
        });
    }

    function iniciarSeguimiento() {
        if (!navigator.geolocation) return;
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
        }
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
            err => {
                console.error("Error GPS:", err);
            },
            { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 }
        );
    }

    function detenerSeguimiento() {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        watchId = null; seguimientoActivo = false;
    }

    function convertirAVaenciano(municipioNominatim) {
        if (!municipioNominatim || municipioNominatim === "Desconocido" || municipioNominatim === "No encontrado") {
            return municipioNominatim;
        }

        const normalizar = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        const municipioNorm = normalizar(municipioNominatim);

        if (window.mapeoMunicipios) {
            for (const clave in window.mapeoMunicipios) {
                if (normalizar(clave) === municipioNorm) {
                    return window.mapeoMunicipios[clave];
                }
            }
        }

        if (window.mapeoMunicipios) {
            for (const clave in window.mapeoMunicipios) {
                const valor = window.mapeoMunicipios[clave];
                if (normalizar(valor) === municipioNorm) {
                    return valor;
                }
            }
        }

        if (window.municipiosData) {
            const encontrado = window.municipiosData.find(m => normalizar(m) === municipioNorm);
            if (encontrado) {
                return encontrado;
            }
        }

        console.warn(`⚠️ No se pudo convertir "${municipioNominatim}" a valenciano`);
        return municipioNominatim;
    }

    function mostrarPopupYActualizarMunicipio(lat, lng, nombreForzado = null) {
        obtenerMunicipio(lat, lng).then(({ municipio, provincia }) => {
            const popupContent = `
                <div style="font-family:sans-serif; font-size:14px;">
                    <strong>📍 Coordenadas:</strong> ${lat.toFixed(5)}, ${lng.toFixed(5)}<br>
                    <strong>🏙️ Municipio:</strong> ${municipio}<br>
                    ${provincia ? `<strong>🗺️ Provincia:</strong> ${provincia}<br>` : ''}
                    <small style="color:#666;">Datos de OpenStreetMap</small>
                </div>
            `;
            
            if (marker.getPopup()) {
                marker.setPopupContent(popupContent);
            } else {
                marker.bindPopup(popupContent);
            }
            marker.openPopup();
            
            const municipioInput = document.getElementById('municipio');
            if (municipioInput && municipio !== "Desconocido" && municipio !== "No encontrado") {
                const nombreFinal = nombreForzado || convertirAVaenciano(municipio);
                municipioInput.value = nombreFinal;
                municipioInput.dispatchEvent(new Event('input'));
            }
        });
    }

    function onMapClick(e) {
        detenerSeguimiento();
        const latlng = e.latlng;
        document.getElementById("coordenadas_mapa").value = latlng.lat.toFixed(5) + ", " + latlng.lng.toFixed(5);
        
        if (marker) {
            marker.setLatLng(latlng);
        } else {
            marker = L.marker(latlng).addTo(map);
        }
        mostrarPopupYActualizarMunicipio(latlng.lat, latlng.lng);
    }
    map.on("click", onMapClick);

    function buscarOCoordenadas(raw) {
        raw = raw.trim();
        if (!raw) return;

        const utm = parseUTM(raw);
        if (utm) {
            try {
                const { lat, lon } = utmToLatLon(utm.easting, utm.northing, utm.zoneNumber, utm.northern);
                detenerSeguimiento();
                if (marker) marker.setLatLng([lat, lon]);
                else marker = L.marker([lat, lon]).addTo(map);
                map.setView([lat, lon], 13);
                document.getElementById("coordenadas_mapa").value = lat.toFixed(5) + ", " + lon.toFixed(5);
                mostrarPopupYActualizarMunicipio(lat, lon);
                return;
            } catch (err) {
                console.error("Error convirtiendo UTM:", err);
            }
        }

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
                mostrarPopupYActualizarMunicipio(lat, lng);
                return;
            }
        }

        buscarDireccionConPrioridad(raw);
    }

    async function buscarDireccionConPrioridad(query) {
        const queryEncoded = encodeURIComponent(query);
        const queryNormalizado = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        const resultadoMunicipio = await buscarMunicipio(query, queryNormalizado);
        
        if (resultadoMunicipio) {
            console.log(`🏙️ Municipio seleccionado: "${resultadoMunicipio}"`);
            const urlMunicipio = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ES&accept-language=ca&q=${encodeURIComponent(resultadoMunicipio)}, Comunitat Valenciana`;
            try {
                const response = await fetch(urlMunicipio);
                const data = await response.json();
                if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lng = parseFloat(data[0].lon);
                    detenerSeguimiento();
                    if (marker) marker.setLatLng([lat, lng]);
                    else marker = L.marker([lat, lng]).addTo(map);
                    map.setView([lat, lng], 14);
                    
                    const popupContent = `
                        <div style="font-family:sans-serif; font-size:14px;">
                            <strong>📍 Coordenadas:</strong> ${lat.toFixed(5)}, ${lng.toFixed(5)}<br>
                            <strong>🏙️ Municipio:</strong> ${resultadoMunicipio}<br>
                            <small style="color:#666;">Datos de OpenStreetMap</small>
                        </div>
                    `;
                    if (marker.getPopup()) marker.setPopupContent(popupContent);
                    else marker.bindPopup(popupContent);
                    marker.openPopup();
                    
                    const municipioInput = document.getElementById('municipio');
                    if (municipioInput) {
                        municipioInput.value = resultadoMunicipio;
                        municipioInput.dispatchEvent(new Event('input'));
                    }
                    document.getElementById("coordenadas").value = lat.toFixed(5) + ", " + lng.toFixed(5);
                    document.getElementById("coordenadas_mapa").value = lat.toFixed(5) + ", " + lng.toFixed(5);
                    return;
                }
            } catch (err) {
                console.warn(`Error buscando municipio ${resultadoMunicipio}:`, err);
            }
        }
        
        const palabrasVia = [
            'calle', 'c/', 'cl/', 'carrer', 'av.', 'avda', 'avenida', 'avinguda',
            'plaza', 'plaça', 'placa', 'placeta', 'camino', 'cno', 'carretera', 'ctra',
            'paseo', 'pg', 'ronda', 'travesia', 'travessia', 'callejon', 'callejo',
            'alameda', 'bulevar', 'via', 'vía', 'rambla', 'glorieta', 'rotonda',
            'camí', 'cami', 'senda', 'vereda', 'autovia', 'autopista'
        ];
        
        const queryMinusculas = query.toLowerCase();
        const contieneVia = palabrasVia.some(palabra => queryMinusculas.includes(palabra));
        
        if (!contieneVia) {
            console.log(`🔍 Búsqueda genérica: "${query}"`);
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ES&accept-language=ca&q=${queryEncoded}`;
            try {
                const response = await fetch(url);
                const data = await response.json();
                if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lng = parseFloat(data[0].lon);
                    detenerSeguimiento();
                    if (marker) marker.setLatLng([lat, lng]);
                    else marker = L.marker([lat, lng]).addTo(map);
                    map.setView([lat, lng], 14);
                    mostrarPopupYActualizarMunicipio(lat, lng);
                    document.getElementById("coordenadas").value = lat.toFixed(5) + ", " + lng.toFixed(5);
                    document.getElementById("coordenadas_mapa").value = lat.toFixed(5) + ", " + lng.toFixed(5);
                    return;
                }
            } catch (err) {
                console.warn("Error en búsqueda genérica:", err);
            }
            alert("No se ha encontrado la dirección ni se reconocieron coordenadas válidas.");
            return;
        }
        
        console.log(`🛣️ Buscando calle con prioridades: "${query}"`);
        const BBOX_VALENCIA_CIUDAD = "-0.40,39.45,-0.35,39.48";
        const BBOX_PROVINCIA_VALENCIA = "-1.5,38.7,0.2,40.0";
        const BBOX_PROVINCIA_ALICANTE = "-1.0,37.8,0.2,38.9";
        const BBOX_PROVINCIA_CASTELLON = "-0.5,39.5,0.5,40.8";
        const BBOX_COMUNITAT_VALENCIANA = "-1.5,37.8,0.5,40.8";
        
        const intentos = [
            { nombre: "Valencia ciudad", url: `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ES&accept-language=ca&viewbox=${BBOX_VALENCIA_CIUDAD}&bounded=1&q=${queryEncoded}` },
            { nombre: "Provincia de Valencia", url: `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ES&accept-language=ca&viewbox=${BBOX_PROVINCIA_VALENCIA}&bounded=1&q=${queryEncoded}` },
            { nombre: "Provincia de Alicante", url: `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ES&accept-language=ca&viewbox=${BBOX_PROVINCIA_ALICANTE}&bounded=1&q=${queryEncoded}` },
            { nombre: "Provincia de Castellón", url: `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ES&accept-language=ca&viewbox=${BBOX_PROVINCIA_CASTELLON}&bounded=1&q=${queryEncoded}` },
            { nombre: "Comunitat Valenciana", url: `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ES&accept-language=ca&viewbox=${BBOX_COMUNITAT_VALENCIANA}&bounded=1&q=${queryEncoded}` },
            { nombre: "España", url: `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ES&accept-language=ca&q=${queryEncoded}` }
        ];
        
        for (const intento of intentos) {
            try {
                const response = await fetch(intento.url);
                const data = await response.json();
                if (data && data.length > 0) {
                    console.log(`✅ Encontrado en: ${intento.nombre}`);
                    const lat = parseFloat(data[0].lat);
                    const lng = parseFloat(data[0].lon);
                    detenerSeguimiento();
                    if (marker) marker.setLatLng([lat, lng]);
                    else marker = L.marker([lat, lng]).addTo(map);
                    map.setView([lat, lng], 16);
                    mostrarPopupYActualizarMunicipio(lat, lng);
                    document.getElementById("coordenadas").value = lat.toFixed(5) + ", " + lng.toFixed(5);
                    document.getElementById("coordenadas_mapa").value = lat.toFixed(5) + ", " + lng.toFixed(5);
                    return;
                }
            } catch (err) {
                console.warn(`Error en búsqueda ${intento.nombre}:`, err);
            }
        }
        alert("No se ha encontrado la dirección ni se reconocieron coordenadas válidas.");
    }

    async function buscarMunicipio(query, queryNormalizado) {
        let coincidencias = [];
        if (window.municipiosData) {
            const exacto = window.municipiosData.find(m => {
                const mNorm = m.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                return mNorm === queryNormalizado;
            });
            if (exacto) return exacto;
            
            coincidencias = window.municipiosData.filter(m => {
                const mNorm = m.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                return mNorm.startsWith(queryNormalizado);
            });
        }
        
        if (window.mapeoMunicipios) {
            for (const clave in window.mapeoMunicipios) {
                const claveNorm = clave.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                if (claveNorm === queryNormalizado) return window.mapeoMunicipios[clave];
                if (claveNorm.startsWith(queryNormalizado)) {
                    const valor = window.mapeoMunicipios[clave];
                    if (!coincidencias.includes(valor)) coincidencias.push(valor);
                }
            }
        }
        
        if (coincidencias.length === 1) {
            console.log(`🏙️ Coincidencia parcial única: "${query}" → "${coincidencias[0]}"`);
            return coincidencias[0];
        }
        if (coincidencias.length > 1) {
            console.log(`🤔 Múltiples coincidencias para "${query}":`, coincidencias);
            const seleccion = await mostrarSelectorMunicipios(coincidencias, query);
            return seleccion;
        }
        return null;
    }

    function mostrarSelectorMunicipios(municipios, queryOriginal) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); display: flex; align-items: center;
                justify-content: center; z-index: 10000;
            `;
            
            const contenido = document.createElement('div');
            contenido.style.cssText = `
                background: white; border-radius: 8px; padding: 20px;
                max-width: 400px; width: 90%; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;
            
            let html = `
                <h3 style="margin-top:0; color:#2c3e50;">🏙️ Varios municipios encontrados</h3>
                <p style="color:#666;">Para "<strong>${queryOriginal}</strong>" se han encontrado ${municipios.length} municipios. Elige uno:</p>
                <div style="max-height: 300px; overflow-y: auto;">
            `;
            
            municipios.forEach((municipio, index) => {
                html += `
                    <button class="opcion-municipio" data-indice="${index}" 
                            style="display:block; width:100%; text-align:left; padding:10px; margin:5px 0;
                                   background:#f8f9fa; border:1px solid #ddd; border-radius:4px; cursor:pointer;
                                   font-size:14px; color:#2c3e50; font-weight:500;">
                        📍 ${municipio}
                    </button>
                `;
            });
            
            html += `
                </div>
                <button id="cancelarSelector" style="margin-top:10px; padding:8px 16px; background:#dc3545; 
                        color:white; border:none; border-radius:4px; cursor:pointer; width:100%;">
                    Cancelar
                </button>
            `;
            
            contenido.innerHTML = html;
            modal.appendChild(contenido);
            document.body.appendChild(modal);
            
            contenido.querySelectorAll('.opcion-municipio').forEach(btn => {
                btn.addEventListener('click', () => {
                    const indice = parseInt(btn.dataset.indice);
                    document.body.removeChild(modal);
                    resolve(municipios[indice]);
                });
            });
            
            contenido.querySelector('#cancelarSelector').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(null);
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    resolve(null);
                }
            });
        });
    }

    document.getElementById("coordenadas").addEventListener("change", e => buscarOCoordenadas(e.target.value));
    const btnLocalizar = document.getElementById("btnLocalizar");
    if (btnLocalizar) {
        btnLocalizar.addEventListener("click", () => buscarOCoordenadas(document.getElementById("coordenadas").value));
    }

    const locateButton = document.createElement("button");
    locateButton.textContent = "📍 Volver a mi ubicación";
    locateButton.type = "button";
    Object.assign(locateButton.style, { 
        marginTop: "10px", 
        marginBottom: "15px", 
        padding: "10px 15px", 
        backgroundColor: "#28a745", 
        color: "white", 
        border: "none", 
        borderRadius: "4px", 
        cursor: "pointer", 
        fontSize: "16px",
        display: "flex",
        alignItems: "center",
        gap: "5px"
    });

    locateButton.addEventListener("click", async e => {
        e.preventDefault();
        if (ultimaPosicion) {
            const [lat, lng] = ultimaPosicion;
            seguimientoActivo = true;
            forzarZoomInicial = true;
            if (marker) marker.setLatLng([lat, lng]);
            else marker = L.marker([lat, lng]).addTo(map).bindPopup("Estás aquí").openPopup();
            map.setView([lat, lng], 13);
            document.getElementById("coordenadas_mapa").value = lat.toFixed(5) + ", " + lng.toFixed(5);
            mostrarPopupYActualizarMunicipio(lat, lng);
            iniciarSeguimiento();
            return;
        }
        
        mostrarEstadoGPS('🔍 Buscando tu ubicación...', 'info');
        locateButton.disabled = true;
        locateButton.textContent = '⏳ Buscando...';
        
        try {
            const pos = await obtenerPosicionRapida();
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            ultimaPosicion = [lat, lng];
            seguimientoActivo = true;
            forzarZoomInicial = true;
            
            if (marker) marker.setLatLng([lat, lng]);
            else marker = L.marker([lat, lng]).addTo(map).bindPopup("Estás aquí").openPopup();
            map.setView([lat, lng], 13);
            document.getElementById("coordenadas_mapa").value = lat.toFixed(5) + ", " + lng.toFixed(5);
            mostrarPopupYActualizarMunicipio(lat, lng);
            mostrarEstadoGPS('✅ Ubicación encontrada', 'success');
            iniciarSeguimiento();
        } catch (err) {
            console.error("Error al obtener ubicación:", err);
            let mensaje = '❌ No se pudo obtener tu ubicación';
            if (err.code === 1) mensaje = '❌ Permiso de ubicación denegado. Actívalo en la configuración.';
            else if (err.code === 2) mensaje = '❌ No hay señal GPS. Intenta en exterior.';
            else if (err.code === 3) mensaje = '❌ Tiempo de espera agotado. Intenta de nuevo.';
            mostrarEstadoGPS(mensaje, 'error');
        } finally {
            locateButton.disabled = false;
            locateButton.textContent = "📍 Volver a mi ubicación";
        }
    });

    const mapElement = document.getElementById("map");
    mapElement.parentNode.insertBefore(locateButton, mapElement.nextSibling);

    // ============================================
    // VALIDACIÓN DE COHERENCIA: MUNICIPIO vs COORDENADAS
    // ============================================
    async function validarCoherenciaMunicipioCoordenadas(mostrarAviso = true) {
        const municipioInput = document.getElementById('municipio');
        const coordenadasMapaInput = document.getElementById('coordenadas_mapa');

        if (!municipioInput || !coordenadasMapaInput) return true;

        const municipioEscrito = municipioInput.value.trim();
        const coordenadasMapa = coordenadasMapaInput.value.trim();

        if (!municipioEscrito || !coordenadasMapa) {
            return true;
        }

        const partes = coordenadasMapa.split(',').map(v => parseFloat(v.trim()));
        if (partes.length !== 2 || isNaN(partes[0]) || isNaN(partes[1])) {
            return true;
        }

        const lat = partes[0];
        const lng = partes[1];

        try {
            const resultado = await obtenerMunicipio(lat, lng);

            if (!resultado || !resultado.municipio || 
                ["Desconocido", "No encontrado", "Error"].includes(resultado.municipio)) {
                return true;
            }

            const municipioCoordenadas = convertirAVaenciano(resultado.municipio);

            const normalizar = texto =>
                texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

            const coinciden = normalizar(municipioEscrito) === normalizar(municipioCoordenadas);

            if (!coinciden && mostrarAviso) {
                alert(
                    `⚠️ El municipio no coincide con la ubicación.\n\n` +
                    `Municipio indicado: ${municipioEscrito}\n` +
                    `Municipio según las coordenadas: ${municipioCoordenadas}\n\n` +
                    `Por favor, corrige el municipio o vuelve a localizar la ubicación en el mapa.`
                );
            }

            return coinciden;

        } catch (error) {
            console.warn("No se pudo comprobar la coherencia municipio/coordenadas:", error);
            return true;
        }
    }

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

    // NUEVO: Comprobar que el municipio coincide con la ubicación del mapa al salir del campo
    document.getElementById('municipio').addEventListener('blur', async function () {
        await validarCoherenciaMunicipioCoordenadas(true);
    });

    /* ---------- ENVÍO DEL FORMULARIO (UNIFICADO Y CORREGIDO) ---------- */
    document.getElementById("formulario").addEventListener("submit", async function (e) {
        
        // 1. PREVENIR EL ENVÍO NORMAL INMEDIATAMENTE (Necesario para validaciones async)
        e.preventDefault();

        // 2. Validación nativa del navegador (muestra "Completa este campo")
        if (!this.checkValidity()) {
            this.reportValidity();
            return;
        }

        // 3. Validaciones personalizadas de especies
        const especieComunInput = document.getElementById("especie_comun");
        const especieComunList = Array.from(document.getElementById("especies-comun-list").options).map(opt => opt.value.trim());
        if (!especieComunInput.value.trim() || !especieComunList.includes(especieComunInput.value.trim())) {
            alert("Debes seleccionar una especie (nombre común) válida.");
            especieComunInput.focus();
            return;
        }
        
        const especieCientificoInput = document.getElementById("especie_cientifico");
        const especieCientificoList = Array.from(document.getElementById("especies-cientifico-list").options).map(opt => opt.value.trim());
        if (!especieCientificoInput.value.trim() || !especieCientificoList.includes(especieCientificoInput.value.trim())) {
            alert("Debes seleccionar una especie (nombre científico) válida.");
            especieCientificoInput.focus();
            return;
        }

        // 4. NUEVO: Comprobar que el municipio coincide con las coordenadas del mapa
        const municipioCoordenadasValidas = await validarCoherenciaMunicipioCoordenadas(true);
        if (!municipioCoordenadasValidas) {
            document.getElementById('municipio').focus();
            return; // Bloquea el envío hasta que el usuario corrija la incoherencia
        }

        // 5. Si todo es válido, proceder con el envío AJAX
        localStorage.removeItem('recogidasForm');
        const btn = document.getElementById("enviarBtn");
        btn.disabled = true; 
        btn.textContent = "Enviando...";

        const fd = new FormData(this);
        
        const posibleCausaRadio = document.querySelector('input[name="posible_causa"]:checked');
        let posibleCausaValue = posibleCausaRadio?.value || "";

        if (posibleCausaValue === "Otras") {
            const otrasCausaSelect = document.getElementById('otrasCausaSelect');
            if (otrasCausaSelect?.value) {
                posibleCausaValue = otrasCausaSelect.value;
            }
        }
        
        const posibleCausaMayusculas = posibleCausaValue.toUpperCase();
        
        const observacionesTexto = (() => {
            let txt = fd.get("observaciones")?.trim() || "";
            const anillaInput = document.getElementById('anilla');
            const recuperacionChecked = document.getElementById('recuperacion')?.checked;
            if (recuperacionChecked && anillaInput) {
                const anilla = anillaInput.value.trim();
                if (anilla) txt += (txt ? " | " : "") + `Anilla: ${anilla}`;
            }
            return txt;
        })();

        let tipoSalida = "";
        const euPattern = /\([Ee][Uu]\)/;
        const muPattern = /\([Mm][Uu]\)/;

        if (euPattern.test(observacionesTexto)) {
            tipoSalida = "SACRIFICIO";
        } else if (muPattern.test(observacionesTexto)) {
            tipoSalida = "MUERTE";
        }

        const data = {
            numero_entrada: document.getElementById("numero_entrada").value,
            especie_comun: fd.get("especie_comun"),
            especie_cientifico: fd.get("especie_cientifico"),
            cantidad_animales: fd.get("cantidad_animales"),
            fecha: fd.get("fecha"),
            municipio: fd.get("municipio"),
            posible_causa: posibleCausaMayusculas,
            remitente: fd.get("remitente") || "",
            estado_animal: fd.getAll("estado_animal"),
            coordenadas: fd.get("coordenadas"),
            coordenadas_mapa: fd.get("coordenadas_mapa"),
            apoyo: fd.get("apoyo"),
            cra_km: fd.get("cra_km"),
            observaciones: observacionesTexto,
            cumplimentado_por: fd.get("cumplimentado_por"),
            telefono_remitente: fd.get("telefono_remitente"),
            foto: "",
            tipo_salida: tipoSalida
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

    async function enviarDatos(data, btn) {
        let registroPendienteId = null;
        try {
            const cantidad = Math.max(1, parseInt(data.cantidad_animales) || 1);

            const registroPendiente = {
                ...data,
                estado: "pendiente",
                id: Date.now()
            };
            registroPendienteId = registroPendiente.id;
            await guardarRegistroLocalConEstado(registroPendiente, "pendiente");

            let response;
            try {
                response = await fetch("https://script.google.com/macros/s/AKfycbxqv2WKklf0vmZVKR5qasni_oDAq4WsF23Cdjz_h7xyNK5I8xwi_KTNqXMj4cQzDhd7/exec", {
                    method: "POST",
                    mode: "cors",
                    headers: { "Content-Type": "text/plain; charset=UTF-8" },
                    body: JSON.stringify(data)
                });
            } catch (redErr) {
                const e = new Error("No hay conexión con el servidor.");
                e.tipoErrorEnvio = "red";
                throw e;
            }

            let textoRespuesta;
            try {
                textoRespuesta = await response.text();
            } catch (lecturaErr) {
                const e = new Error("Se perdió la respuesta después de enviar.");
                e.tipoErrorEnvio = "lectura";
                throw e;
            }

            let resultado;
            try {
                resultado = JSON.parse(textoRespuesta);
            } catch (parseErr) {
                const e = new Error(`El servidor no devolvió JSON válido (HTTP ${response.status}).`);
                e.tipoErrorEnvio = "respuesta";
                throw e;
            }

            if (!resultado || resultado.result !== "success") {
                const detalle = (resultado && resultado.message) ? resultado.message : `HTTP ${response.status}`;
                const e = new Error(detalle);
                e.tipoErrorEnvio = "backend";
                throw e;
            }

            const numerosAsignados = resultado.numerosAsignados;
            if (!Array.isArray(numerosAsignados) ||
                numerosAsignados.length !== cantidad ||
                !numerosAsignados.every(num => typeof num === "number" && Number.isFinite(num) && num > 0)) {
                const e = new Error(`numerosAsignados ausente o con longitud distinta de ${cantidad}.`);
                e.tipoErrorEnvio = "validacion";
                throw e;
            }
            const numeros = numerosAsignados;

            const tx = db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const getRequest = store.get(registroPendienteId);
            getRequest.onsuccess = () => {
                const reg = getRequest.result;
                if (reg) {
                    reg.estado = "enviado";
                    reg.numerosAsignados = numerosAsignados;
                    store.put(reg);
                }
            };

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
            if (err && err.tipoErrorEnvio === "red") {
                alert("❌ Sin conexión con el servidor. El registro se guardó localmente y se puede reenviar después.");
            } else if (err && err.tipoErrorEnvio === "lectura") {
                alert("⚠️ El servidor procesó el envío pero se perdió la respuesta con los números.\nRevisa \"Registros locales\" antes de reenviar, para evitar filas duplicadas.");
            } else if (err && err.tipoErrorEnvio === "backend") {
                alert("❌ El servidor ha rechazado el envío:\n" + err.message + "\n\nEl registro se guardó localmente y se puede reenviar después.");
            } else if (err && err.tipoErrorEnvio === "respuesta") {
                alert("❌ Respuesta inesperada del servidor: " + err.message + "\nEl registro se guardó localmente y se puede reenviar después.");
            } else if (err && err.tipoErrorEnvio === "validacion") {
                alert("❌ El servidor no devolvió los números asignados correctamente:\n" + err.message + "\nEl registro se guardó localmente y se puede reenviar después.");
            } else {
                alert("❌ Error al enviar. El registro se guardó localmente y se puede reenviar después.");
            }
        } finally {
            btn.disabled = false;
            btn.textContent = "Enviar";
        }
    }

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

    const form = document.getElementById("formulario");
    const telefonoInput = document.getElementById('telefono_remitente');
    if (telefonoInput) {
        telefonoInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault();
                this.blur();
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
    // ==================================================
    (function() {
        if (document.getElementById('birdAssistant')) return;

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

        const birdModalContainer = document.createElement('div');
        birdModalContainer.id = 'birdModal';
        birdModalContainer.innerHTML = `
            <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:10001; opacity:0; pointer-events:none; transition:opacity 0.3s;">
                <div style="background:#fff; border-radius:12px; width:90%; max-width:500px; max-height:80vh; overflow:auto; box-shadow:0 6px 20px rgba(0,0,0,0.3);">
                    <div style="background:#2c3e50; color:white; padding:16px; border-radius:12px 12px 0 0; font-weight:bold; display:flex; justify-content:space-between; align-items:center;">
                        🆘 ¿Necesitas ayuda?
                        <button id="closeBirdModal" style="background:none; border:none; color:white; font-size:20px; cursor:pointer;">×</button>
                    </div>
                    <div id="birdModalContent" style="padding:16px; font-size:15px; line-height:1.5; color:#2c3e50;"></div>
                </div>
            </div>
        `;
        document.body.appendChild(birdModalContainer);

        const helpSections = {
            direccionPrecisa: `<h3>📍 Cómo buscar direcciones correctamente</h3><p>Para que el mapa ubique bien la dirección, <strong>escribe siempre el nombre de la ciudad o pueblo completo</strong>.</p><ul style="padding-left:20px; margin-top:8px;"><li>✅ <strong>Bien:</strong> <code>Calle Colon</code></li><li>✅ <strong>Bien:</strong> <code>La Torre, Valencia</code></li><li>✅ <strong>Bien:</strong> <code>Urbanizacion la cañada</code></li><li>✅ <strong>Bien:</strong> <code>Plaza Mayor, Xàtiva</code></li><li>✅ <strong>Bien:</strong> <code>Avenida Elche, Alicante</code></li><li>❌ <strong>Evita:</strong> <code>La cañada</code> → no es un Municipio, el sistema puede que lo busque en otro lugar de España</li><li>❌ <strong>Evita:</strong> <code>La Torre</code> → es una pedanía de Valencia, pero el sistema busca por defecto un Municipio con ese nombre y lo encuentra en otra Provincia</li></ul><p style="margin-top:12px; font-weight:bold; color:#27ae60;">💡 Las calles y los Municipios, el sistema los busca por defecto en Valencia.</p>`,
            coordsFormat: `<h3>📍 Formatos admitidos en "Coordenadas dadas o dirección"</h3><p><strong>1. Dirección:</strong> Ej. <code>Ayuntamiento de Valencia ciudad</code></p><p><strong>2. Grados decimales:</strong> Ej. <code>39.47, -0.38</code> (usa punto como separador decimal)</p><p><strong>3. Coordenadas UTM (WGS84):</strong></p><ul style="margin-top:8px; padding-left:20px;"><li><code>731053 4413603</code> → asume zona 30N (Comunidad Valenciana)</li><li><code>731053 4413603 30N</code> → zona explícita</li><li>No uses comas decimales ni letras "E/N" sueltas</li></ul><p style="margin-top:12px;"><em>Tras escribir, pulsa ENTER o el botón "Localizar".</em></p>`,
            coordsNoMarker: `<h3>🔍 No aparece el marcador en el mapa</h3><ul style="padding-left:20px;"><li>Asegúrate de pulsar ENTER o "Localizar"</li><li>Verifica que las coordenadas estén en formato válido</li><li>Si usas UTM, deben ser números enteros (ej. 731053 4413603)</li><li>Prueba con una dirección conocida para descartar fallos de red</li></ul>`,
            especiesComo: `<h3>🦉 Cómo elegir especie común/científica</h3><p>Escribe parte del nombre común (ej. "búho") y selecciona de la lista desplegable.</p><p>El campo científico se rellena automáticamente.</p><p><strong>Importante:</strong> Solo puedes elegir especies de la lista oficial. No se admiten nombres libres.</p>`,
            especiesNoAparece: `<h3>⚠️ Mi especie no aparece en la lista</h3><ul style="padding-left:20px;"><li>Revisa ortografía</li><li>Si sigue sin aparecer, contacta con Alberto ;) para añadirla al fichero <code>especies.json</code></li></ul>`,
            numeroEntrada: `<h3>🔢 ¿Dónde está mi número de entrada?</h3><p>Se genera <strong>automáticamente tras enviar</strong> el formulario.</p><p>Aparece en la alerta de confirmación y se guarda en "Registros locales".</p>`,
            falloEnvio: `<h3>📡 ¿Qué pasa si falla el envío?</h3><p>Si no hay conexión a internet:</p><ul style="padding-left:20px;"><li>El registro se guarda <strong>localmente en tu dispositivo</strong></li><li>Puedes verlo y reenviarlo desde el botón <strong>"Ver registros guardados"</strong></li><li>¡Nunca se pierde un registro!</li></ul>`,
            registrosLocales: `<h3>💾 Cómo ver o enviar registros guardados</h3><p>Pulsa el botón <strong>"Ver registros guardados"</strong> (abajo del formulario).</p><p>Allí puedes:</p><ul style="padding-left:20px;"><li>Ver detalles completos</li><li>Eliminar registros</li><li>Reenviar a Google Sheets</li><li>Exportar/importar como copia de seguridad (JSON)</li></ul>`,
            recuperacionAnilla: `<h3>🪶 ¿Cuándo marcar "Recuperación con anilla"?</h3><p>Márcalo <strong>solo si el animal llevaba anilla identificativa</strong>.</p><p>Luego introduce el código de la anilla en el campo que aparece.</p><p>Esta información se añadirá automáticamente a "Observaciones".</p>`,
            camposAdicionales: `<h3>📋 ¿Qué poner en "Posible causa" o "Remitente"?</h3><p><strong>Posible causa:</strong> Elige una o varias opciones (ej. atropello, electrocución, colisión).</p><p><strong>Remitente:</strong> Quién encontró/comunicó el animal (ciudadano, agente forestal, veterinario, etc.).</p><p><strong>Municipio:</strong> Empieza a escribir para autocompletar (debe coincidir con la lista oficial).</p>`
        };

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
                    <div onclick="showHelp('direccionPrecisa')" style="cursor:pointer; padding:10px; background:#e8f5e9; border-radius:8px; border:1px solid #27ae60;"><strong>📍 Direcciones precisas</strong><br><small>Evita errores de ubicación</small></div>
                    <div onclick="showHelp('coordsFormat')" style="cursor:pointer; padding:10px; background:#f8f9fa; border-radius:8px; border:1px solid #ddd;"><strong>Coordenadas</strong><br><small>Formatos admitidos</small></div>
                    <div onclick="showHelp('coordsNoMarker')" style="cursor:pointer; padding:10px; background:#f8f9fa; border-radius:8px; border:1px solid #ddd;"><strong>Coordenadas</strong><br><small>No aparece marcador</small></div>
                    <div onclick="showHelp('especiesComo')" style="cursor:pointer; padding:10px; background:#f8f9fa; border-radius:8px; border:1px solid #ddd;"><strong>Especies</strong><br><small>Cómo elegir</small></div>
                    <div onclick="showHelp('especiesNoAparece')" style="cursor:pointer; padding:10px; background:#f8f9fa; border-radius:8px; border:1px solid #ddd;"><strong>Especies</strong><br><small>No aparece mi especie</small></div>
                    <div onclick="showHelp('numeroEntrada')" style="cursor:pointer; padding:10px; background:#f8f9fa; border-radius:8px; border:1px solid #ddd;"><strong>Número entrada</strong><br><small>¿Dónde está?</small></div>
                    <div onclick="showHelp('falloEnvio')" style="cursor:pointer; padding:10px; background:#f8f9fa; border-radius:8px; border:1px solid #ddd;"><strong>Fallo de envío</strong><br><small>¿Qué hago?</small></div>
                    <div onclick="showHelp('registrosLocales')" style="cursor:pointer; padding:10px; background:#f8f9fa; border-radius:8px; border:1px solid #ddd;"><strong>Registros locales</strong><br><small>Ver/reenviar</small></div>
                    <div onclick="showHelp('recuperacionAnilla')" style="cursor:pointer; padding:10px; background:#f8f9fa; border-radius:8px; border:1px solid #ddd;"><strong>Recuperación</strong><br><small>Anilla</small></div>
                    <div onclick="showHelp('camposAdicionales')" style="cursor:pointer; padding:10px; background:#f8f9fa; border-radius:8px; border:1px solid #ddd; grid-column: span 2;"><strong>Otros campos</strong><br><small>Posible causa, remitente, etc.</small></div>
                </div>
                <button onclick="closeModal()" style="width:100%; margin-top:16px; padding:8px; background:#7f8c8d; color:white; border:none; border-radius:6px; font-weight:bold;">Cerrar</button>
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

        let sonidoReproducido = false;
        function showBird() {
            if (localStorage.getItem('birdDismissed') === 'true') return;
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
                const svg = bird.querySelector('svg');
                svg.style.transition = 'transform 0.2s';
                bird.addEventListener('mouseenter', () => { svg.style.transform = 'rotate(-8deg)'; });
                bird.addEventListener('mouseleave', () => { svg.style.transform = 'rotate(0deg)'; });
            }, 50);
        }

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

(() => {
    if (!sessionStorage.getItem('formEnviadoOK')) {
        localStorage.removeItem('recogidasForm');
    }
    sessionStorage.removeItem('formEnviadoOK');
})();

document.addEventListener("DOMContentLoaded", () => {
    fetch("municipios.json")
        .then(r => r.json())
        .then(d => {
            function quitarAcentos(str) {
                return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            }
            window.municipiosData = d.municipios;
            const list = document.getElementById("municipios-list");
            d.municipios.forEach(municipio => {
                const sinAcento = quitarAcentos(municipio);
                const opt1 = document.createElement("option");
                opt1.value = sinAcento;
                list.appendChild(opt1);
                const opt2 = document.createElement("option");
                opt2.value = municipio;
                list.appendChild(opt2);
            });
            const municipioInput = document.getElementById("municipio");
            municipioInput.addEventListener("input", () => {
                const valorEscrito = municipioInput.value.trim();
                if (!valorEscrito) return;
                const encontrado = window.municipiosData.find(m => 
                    quitarAcentos(m) === quitarAcentos(valorEscrito)
                );
                if (encontrado) {
                    municipioInput.value = encontrado;
                }
            });
        })
        .catch(console.error);
});

document.addEventListener("DOMContentLoaded", () => {
    fetch("mapeo_municipios.json")
        .then(r => r.json())
        .then(d => {
            window.mapeoMunicipios = d;
        })
        .catch(console.error);
});

document.addEventListener("DOMContentLoaded", () => {
    const comInput  = document.getElementById("especie_comun");
    const cienInput = document.getElementById("especie_cientifico");
    let especiesData = [];

    function quitarAcentos(str) {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    }

    fetch("especies.json")
        .then(r => r.json())
        .then(d => {
            especiesData = d;
            const comList = document.getElementById("especies-comun-list");
            const cienList = document.getElementById("especies-cientifico-list");

            d.forEach(e => {
                const comSin  = quitarAcentos(e.nombreComun);
                const cienSin = quitarAcentos(e.nombreCientifico);

                const opt1 = document.createElement("option");
                opt1.value = comSin;
                comList.appendChild(opt1);

                const opt1b = document.createElement("option");
                opt1b.value = e.nombreComun;
                comList.appendChild(opt1b);

                const opt2 = document.createElement("option");
                opt2.value = cienSin;
                cienList.appendChild(opt2);

                const opt2b = document.createElement("option");
                opt2b.value = e.nombreCientifico;
                cienList.appendChild(opt2b);
            });

            comInput.addEventListener("input", () => {
                const found = especiesData.find(x => quitarAcentos(x.nombreComun) === quitarAcentos(comInput.value.trim()));
                if (found) {
                    comInput.value  = found.nombreComun;
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

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/Gestion-recogidas-2/service-worker.js')
        .then(() => console.log('Service Worker registrado correctamente'))
        .catch(error => console.error('Error al registrar el Service Worker:', error));
}

const btnCerrar = document.getElementById('btnCerrar');
if (btnCerrar) {
    btnCerrar.addEventListener('click', () => {
        window.close();
        if (!window.closed) {
            alert('Puedes cerrar esta pestaña desde el navegador.');
        }
    });
}

const hoy = getFechaLocalISO();
document.getElementById('fecha').value = hoy;

function actualizarFechaSiEsAnterior() {
    const fechaInput = document.getElementById('fecha');
    if (!fechaInput) return;
    const fechaActual = getFechaLocalISO();
    const fechaGuardada = fechaInput.value;
    if (fechaGuardada && fechaGuardada !== fechaActual) {
        fechaInput.value = fechaActual;
        console.log(`📅 Fecha actualizada automáticamente: ${fechaActual}`);
        fechaInput.style.borderColor = '#28a745';
        fechaInput.style.boxShadow = '0 0 0 2px rgba(40, 167, 69, 0.3)';
        setTimeout(() => {
            fechaInput.style.borderColor = '';
            fechaInput.style.boxShadow = '';
        }, 1500);
    }
}

actualizarFechaSiEsAnterior();

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        actualizarFechaSiEsAnterior();
    }
});

window.addEventListener('focus', actualizarFechaSiEsAnterior);
