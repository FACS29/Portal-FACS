/*
  buzon-sugerencias.js
  =====================
  Toma documento y nombre desde la URL (?documento=...&nombre=...),
  que llegan desde el enlace que se muestra tras una consulta exitosa
  en el portal. No se le vuelve a pedir el documento al afiliado.
  Envía el mensaje con la clave publicable (insert-only, según la
  política de la tabla Mensajes).
*/

const parametros = new URLSearchParams(window.location.search);
const documento = parametros.get("documento") || "";
const nombre = parametros.get("nombre") || "";

document.getElementById("documentoOculto").value = documento;
document.getElementById("nombreOculto").value = nombre;

if (nombre) {
    document.getElementById("nombreMostrado").textContent = nombre;
}

const formMensaje = document.getElementById("formMensaje");
const btnEnviar = document.getElementById("btnEnviar");
const mensajeError = document.getElementById("mensajeError");

formMensaje.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    if (!documento) {
        mensajeError.textContent =
            "No se pudo identificar tu documento. Vuelve al portal y consulta tu crédito primero.";
        return;
    }

    const texto = document.getElementById("mensaje").value.trim();
    if (!texto) return;

    btnEnviar.disabled = true;
    btnEnviar.textContent = "Enviando...";
    mensajeError.textContent = "";

    try {
        const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/Mensajes`, {
            method: "POST",
            headers: HEADERS,
            body: JSON.stringify({
                documento: documento,
                nombre: nombre,
                mensaje: texto
            })
        });

        if (!respuesta.ok) throw new Error("Error al enviar");

        document.getElementById("vistaFormulario").style.display = "none";
        document.getElementById("vistaExito").style.display = "block";

    } catch (error) {
        mensajeError.textContent = "No se pudo enviar el mensaje. Intenta de nuevo.";
        btnEnviar.disabled = false;
        btnEnviar.textContent = "Enviar mensaje";
    }
});
