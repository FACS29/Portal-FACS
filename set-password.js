/*
  Panel Administrativo — FACS — Definir contraseña
  ==================================================
  Sirve para dos casos: 1) enlaces de invitacion/recuperacion por
  correo (Supabase deja una sesion temporal via el token de la URL),
  y 2) alguien ya con sesion iniciada con su clave temporal, a quien
  admin-guard.js trajo aqui obligatoriamente (debe_cambiar_clave).
  En ambos casos, si hay sesion, se puede definir la contraseña.
*/

const clienteAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const subtitulo = document.getElementById("subtitulo");
const formClave = document.getElementById("formClave");
const divMensaje = document.getElementById("mensaje");

function mostrarMensaje(texto, tipo) {
    divMensaje.textContent = texto;
    divMensaje.className = "mensaje " + tipo;
}

(async function verificarEnlace() {
    const { data: { session } } = await clienteAuth.auth.getSession();

    if (!session) {
        subtitulo.textContent =
            "Este enlace ya no es válido o expiró. Pide uno nuevo desde la pantalla de inicio de sesión.";
        return;
    }

    subtitulo.textContent = "Escribe tu nueva contraseña.";
    formClave.style.display = "block";
})();

formClave.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    const clave1 = document.getElementById("clave1").value;
    const clave2 = document.getElementById("clave2").value;

    if (clave1 !== clave2) {
        mostrarMensaje("Las dos contraseñas no coinciden.", "error");
        return;
    }

    const { error: errorClave } = await clienteAuth.auth.updateUser({ password: clave1 });

    if (errorClave) {
        mostrarMensaje("No se pudo guardar la contraseña: " + errorClave.message, "error");
        return;
    }

    // Marca la cuenta como "ya no pendiente" -- funcion segura que
    // solo puede tocar la propia fila del usuario autenticado.
    await clienteAuth.rpc("marcar_clave_actualizada");

    mostrarMensaje("Contraseña guardada. Entrando al panel...", "exito");

    setTimeout(function () {
        window.location.href = "admin-panel.html";
    }, 1200);
});
