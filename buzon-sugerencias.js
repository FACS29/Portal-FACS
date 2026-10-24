/*
  buzon-sugerencias.js
  =====================
  Toma documento y nombre desde la URL (?documento=...&nombre=...),
  que llegan desde el enlace que se muestra tras una consulta exitosa
  en el portal. No se le vuelve a pedir el documento al afiliado.
  Envía el mensaje con la función segura enviar_mensaje_buzon de Supabase:
  valida el documento, toma el nombre de la base de datos y limita el
  tamaño y la frecuencia de los mensajes.
*/

const parametros = new URLSearchParams(window.location.search);
const documento = parametros.get("documento") || "";
const nombre = parametros.get("nombre") || "";

document.getElementById("documentoOculto").value = documento;
document.getElementById("nombreOculto").value = nombre;

if (nombre) {
    document.getElementById("nombreMostrado").textContent = nombre;
}

const MAX_CARACTERES_MENSAJE = 1000;   // igual que en la función de Supabase
const campoMensaje = document.getElementById("mensaje");
if (campoMensaje) campoMensaje.maxLength = MAX_CARACTERES_MENSAJE;

const MENSAJES_ERROR_BUZON = {
    documento: "No se pudo identificar tu documento. Vuelve al portal y consulta tu crédito primero.",
    vacio: "Escribe tu mensaje antes de enviarlo.",
    largo: "Tu mensaje es muy largo. Acórtalo (máximo " + MAX_CARACTERES_MENSAJE + " caracteres).",
    demasiados: "Has enviado varios mensajes seguidos. Espera un rato antes de enviar otro.",
    ocupado: "El buzón está recibiendo muchos mensajes ahora. Intenta de nuevo más tarde."
};

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
        const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/rpc/enviar_mensaje_buzon`, {
            method: "POST",
            headers: HEADERS,
            body: JSON.stringify({
                p_documento: documento,
                p_mensaje: texto
            })
        });

        if (!respuesta.ok) throw new Error("Error al enviar");

        const resultado = await respuesta.json();

        if (!resultado || resultado.ok !== true) {
            mensajeError.textContent =
                MENSAJES_ERROR_BUZON[resultado && resultado.motivo] ||
                "No se pudo enviar el mensaje. Intenta de nuevo.";
            btnEnviar.disabled = false;
            btnEnviar.textContent = "Enviar mensaje";
            return;
        }

        document.getElementById("vistaFormulario").style.display = "none";
        document.getElementById("vistaExito").style.display = "block";

    } catch (error) {
        mensajeError.textContent = "No se pudo enviar el mensaje. Intenta de nuevo.";
        btnEnviar.disabled = false;
        btnEnviar.textContent = "Enviar mensaje";
    }
});
