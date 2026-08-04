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
// esta version devuelve el correo Y el rol del documento (o null si no
// existe / esta inactivo), para poder responder distinto segun el caso:
// superadministrador -> se le envia el correo; cualquier otro rol -> se
// le indica que pida clave temporal; no existe -> mensaje neutro.
async function resolverPerfilParaRecuperacion(documento) {
    const { data, error } = await clienteAuth.rpc("perfil_para_recuperacion", {
        p_documento: documento
    });

    if (error || !data || data.length === 0) return null;
    return data[0]; // { correo, rol }
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

    const perfil = await resolverPerfilParaRecuperacion(documento);

    if (!perfil) {
        mostrarMensaje("No encontramos un perfil activo con ese número de documento.", "error");
        return;
    }

    if (perfil.rol !== "superadministrador") {
        mostrarMensaje(
            "Este perfil no puede recuperar la clave por correo. Pide una clave temporal al Superadministrador.",
            "error"
        );
        return;
    }

    const { error } = await clienteAuth.auth.resetPasswordForEmail(perfil.correo, {
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
        "Te enviamos un enlace de recuperación a tu correo registrado. Revisa tu bandeja de entrada.",
        "exito"
    );
});
