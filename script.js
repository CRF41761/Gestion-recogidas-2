Actualiza mi script y enviamelo tambien completo:  /* ============================================
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
        const partes = raw.includes(",") ? raw.split(",").map(n => n.trim()) : raw.split(" ").map(n => n.trim());
        if (partes.length === 2 && !isNaN(parseFloat(partes[0])) && !isNaN(parseFloat(partes[1]))) {
            const lat = parseFloat(partes[0]);
            const lng = parseFloat(partes[1]);
            detenerSeguimiento();
            if (marker) marker.setLatLng([lat, lng]);
            else marker = L.marker([lat, lng]).addTo(map);
            map.setView([lat, lng], 13);
            document.getElementById("coordenadas_mapa").value = lat.toFixed(5) + ", " + lng.toFixed(5);
            return;
        }
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=   ${encodeURIComponent(raw)}`;
        fetch(url)
            .then(r => r.json())
            .then(data => {
                if (!data || data.length === 0) {
                    alert("No se ha encontrado la dirección.");
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

    // ✅ URL NUEVA con CORS configurado
    fetch("https://script.google.com/macros/s/AKfycbxsmC4P-kHO83lOYR1rzyGO57CIzkJgq5biivg5YB9bi3rXWavlf7seIGxmg2bTJ1wA/exec?getNumeroEntrada")
        .then(r => r.json()).then(d => document.getElementById("numero_entrada").value = d.numero_entrada)
        .catch(console.error);

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

        // ✅ URL NUEVA con CORS configurado
        const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbxsmC4P-kHO83lOYR1rzyGO57CIzkJgq5biivg5YB9bi3rXWavlf7seIGxmg2bTJ1wA/exec";

        const fd = new FormData(this);
        const data = {
            numero_entrada: document.getElementById("numero_entrada").value,
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

    async function enviarDatos(data, btn) {
        try {
            await fetch(URL_SCRIPT, {
                method: "POST",
                mode: "no-cors",  // ← mantén esto para envío
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            try {
                await guardarRegistroLocal(data);
                console.log('Registro guardado localmente sin número de entrada');
            } catch (dbError) {
                console.error('Error guardando en IndexedDB:', dbError);
            }
            const response = await fetch(`${URL_SCRIPT}?getNumeroEntrada`);
            const d = await response.json();
            alert(`✅ Número de entrada asignado: ${d.numeroEntrada}`);
            sessionStorage.setItem('formEnviadoOK', '1');
            document.getElementById("formulario").reset();
            const hoy = new Date().toISOString().split('T')[0];
            document.getElementById('fecha').value = hoy;
        } catch (err) {
            console.error(err);
            alert("❌ Error al enviar. Los datos no se guardaron en la tablet.");
        } finally {
            btn.disabled = false;
            btn.textContent = "Enviar";
        }
    }

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

            // Autocompletado cruzado (común ↔ científico)
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
const hoy = new Date().toISOString().split('T')[0];
document.getElementById('fecha').value = hoy;



















