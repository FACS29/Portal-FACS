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

    const correo = await resolverCorreo(documento);

    // Mismo mensaje exista o no el documento, para no revelar cual
    // de las dos cosas fallo.
    if (!correo) {
        mostrarMensaje(
            "Si el documento está registrado, te llegará un enlace de recuperación.",
            "exito"
        );
        return;
    }

    const { error } = await clienteAuth.auth.resetPasswordForEmail(correo, {
        redirectTo: new URL("set-password.html", window.location.href).href
    });

    if (error) {
        mostrarMensaje("No fue posible enviar el correo de recuperación.", "error");
        return;
    }

    mostrarMensaje(
        "Si el documento está registrado, te llegará un enlace de recuperación.",
        "exito"
    );
});
