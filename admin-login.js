/*
  Panel Administrativo — FACS — Login por numero de documento
  =============================================================
  Supabase solo sabe autenticar por correo, asi que aqui se hace la
  "traduccion": se pide el correo asociado al documento (funcion
  correo_desde_documento, sin exponer el resto de la tabla) y con ese
  correo se valida la contraseña. La persona nunca ve ni escribe su
  correo en este formulario.
*/

const clienteAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const formLogin = document.getElementById("formLogin");
const btnEntrar = document.getElementById("btnEntrar");
const btnRecuperar = document.getElementById("btnRecuperar");
const divMensaje = document.getElementById("mensaje");

function mostrarMensaje(texto, tipo) {
    divMensaje.textContent = texto;
    divMensaje.className = "mensaje " + tipo;
}

async function resolverCorreo(documento) {
    const { data, error } = await clienteAuth.rpc("correo_desde_documento", {
        p_documento: documento
    });

    if (error) return null;
    return data; // null si el documento no existe o esta inactivo
}

// Solo para "Olvide mi contraseña": a diferencia de resolverCorreo(),
// esta version solo devuelve el correo si el documento pertenece a un
// superadministrador. Los demas perfiles deben pedirle al
// superadministrador una clave temporal en vez de recuperarla por correo.
async function resolverCorreoParaRecuperacion(documento) {
    const { data, error } = await clienteAuth.rpc("correo_recuperacion_clave", {
        p_documento: documento
    });

    if (error) return null;
    return data;
}

formLogin.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    const documento = document.getElementById("documento").value.trim();
    const clave = document.getElementById("clave").value;

    btnEntrar.disabled = true;
    btnEntrar.textContent = "Entrando...";
    mostrarMensaje("", "");

    const correo = await resolverCorreo(documento);

    if (!correo) {
        btnEntrar.disabled = false;
        btnEntrar.textContent = "Entrar";
        // Mensaje generico a proposito: no decimos si el documento
        // existe o no, para no dar pistas de mas.
        mostrarMensaje("Documento o contraseña incorrectos.", "error");
        return;
    }

    const { error } = await clienteAuth.auth.signInWithPassword({
        email: correo,
        password: clave
    });

    btnEntrar.disabled = false;
    btnEntrar.textContent = "Entrar";

    if (error) {
        mostrarMensaje("Documento o contraseña incorrectos.", "error");
        return;
    }

    // Dashboard es la pagina de aterrizaje para todos los roles --
    // Administradores solo lo ve el superadministrador, y se le
    // muestra en el menu una vez confirmado su rol (admin-guard.js).
    window.location.href = "admin-dashboard.html";
});

btnRecuperar.addEventListener("click", async function () {
    const documento = document.getElementById("documento").value.trim();

    if (!documento) {
        mostrarMensaje("Escribe tu número de documento arriba primero.", "error");
        return;
    }

    const correo = await resolverCorreoParaRecuperacion(documento);

    // Mismo mensaje exista o no el documento (y tambien si existe pero
    // no es superadministrador), para no revelar cual de esas cosas
    // paso -- pero ahora orienta a los demas perfiles hacia el camino
    // correcto: pedirle al superadministrador una clave temporal.
    if (!correo) {
        mostrarMensaje(
            "Si tu documento corresponde a un superadministrador, te llegará un enlace de recuperación. " +
            "Los demás perfiles deben solicitar una clave temporal al superadministrador.",
            "exito"
        );
        return;
    }

    const { error } = await clienteAuth.auth.resetPasswordForEmail(correo, {
        redirectTo: new URL("set-password.html", window.location.href).href
    });

    if (error) {
        console.error("Error al enviar correo de recuperación:", error);

        const esLimiteDeCorreos =
            /rate limit/i.test(error.message) || error.status === 429;

        mostrarMensaje(
            esLimiteDeCorreos
                ? "Se alcanzó el límite de correos que Supabase permite enviar por hora. Espera unos minutos y vuelve a intentarlo."
                : "No fue posible enviar el correo de recuperación. Detalle: " + error.message,
            "error"
        );
        return;
    }

    mostrarMensaje(
        "Si el documento está registrado, te llegará un enlace de recuperación.",
        "exito"
    );
});
