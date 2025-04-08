document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("recogidasForm").addEventListener("submit", async function (event) {
        event.preventDefault();

        // Función para obtener valores de los checkboxes seleccionados
        function getCheckedValues(name) {
            return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
                .map(input => input.value)
                .join(", ");
        }

        // Obtener valores del formulario
        const formData = {
            especie_comun: document.getElementById("especie_comun").value,
            especie_cientifico: document.getElementById("especie_cientifico").value,
            fecha: document.getElementById("fecha").value,
            municipio: document.getElementById("municipio").value,
            posible_causa: getCheckedValues("posible_causa"),
            posible_causa_otras: document.querySelector("input[name='posible_causa_otras']")?.value || "",
            remitente: getCheckedValues("remitente"),
            remitente_otras: document.querySelector("input[name='remitente_otras']")?.value || "",
            estado_animal: getCheckedValues("estado_animal")
        };

        try {
            const response = await fetch("https://script.google.com/macros/s/AKfycbzUmVu-dKTNUu-L8tVFKkEFUrzAy5sKXPKYZ3JMw4tyCm7NS7MGRW3gP7qPleZgwX0/exec", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            if (result.success) {
                alert("Datos enviados correctamente");
                document.getElementById("recogidasForm").reset();
            } else {
                alert("Error al enviar los datos");
            }
        } catch (error) {
            console.error("Error al enviar los datos:", error);
            alert("Hubo un problema al enviar el formulario.");
        }
    });
});



