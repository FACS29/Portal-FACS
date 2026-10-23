/*
  admin-guard.js
  ==============
  Se incluye en toda página del panel que requiera sesión iniciada.
  Verifica: 1) que haya una sesión válida de Supabase Auth,
  2) que el perfil en Administradores exista y esté activo.
  Si algo falla, redirige a admin-login.html.

  Expone window.sesionAdmin = { user, perfil, rol } para que cada
  página use esos datos sin repetir la consulta.
*/

const clienteAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function requerirSesion() {
    const { data: { session } } = await clienteAuth.auth.getSession();

    if (!session) {
        window.location.href = "admin-login.html";
        return null;
    }

    // "Administradores" (perfil) y "Usuarios_Roles" (rol) dependen
    // ambas de session.user.id, pero no una de la otra -- se piden
    // en paralelo. Esto corre en cada página del panel, así que es
    // el punto de la app donde más veces se repite el ahorro.
    const [
        { data: perfil, error: errorPerfil },
        { data: rolFila }
    ] = await Promise.all([
        clienteAuth
            .from("Administradores")
            .select("nombres, apellidos, correo, activo, debe_cambiar_clave")
            .eq("user_id", session.user.id)
            .single(),
        clienteAuth
            .from("Usuarios_Roles")
            .select("Roles(nombre)")
            .eq("user_id", session.user.id)
            .maybeSingle()
    ]);

    if (errorPerfil || !perfil || perfil.activo === false) {
        await clienteAuth.auth.signOut();
        window.location.href = "admin-login.html";
        return null;
    }

    const enPaginaDeClave = window.location.pathname.endsWith("set-password.html");

    if (perfil.debe_cambiar_clave && !enPaginaDeClave) {
        window.location.href = "set-password.html";
        return null;
    }

    window.sesionAdmin = {
        token: session.access_token,
        user: session.user,
        perfil,
        rol: rolFila?.Roles?.nombre || null
    };

    // La pestaña "Administradores" empieza oculta en el HTML (para
    // evitar el parpadeo mientras carga la página) y solo se muestra
    // aquí si el rol confirmado es superadministrador.
    if (window.sesionAdmin.rol === "superadministrador") {
        document.querySelectorAll("#navAdministradores")
            .forEach((enlace) => { enlace.style.display = ""; });
    }

    // Aviso de mensajes sin leer: se revisa una sola vez por sesion del navegador y
    // sin hacer esperar a la pagina (si hay mensajes sin leer, pasa a la pestana Mensajes).
    if (!enPaginaDeClave) {
        iniciarInsigniasMenu();
        revisarMensajesNoLeidosUnaVez();
    }
    return window.sesionAdmin;
}

async function cerrarSesion() {
    try { sessionStorage.removeItem(CLAVE_REVISION_MENSAJES); } catch (e) { /* sin acceso a sessionStorage */ }
    await clienteAuth.auth.signOut();
    window.location.href = "admin-login.html";
}

/* ---------- Mensajes sin leer al entrar ---------- */
const CLAVE_REVISION_MENSAJES = "facs_mensajes_revisados";

function irAPagina(url) {
    window.location.href = url;
}

// Cuenta los mensajes sin leer (leido en falso o vacio). Si no se puede leer, devuelve null.
async function contarMensajesNoLeidos() {
    const { count, error } = await clienteAuth
        .from("Mensajes")
        .select("id", { count: "exact", head: true })
        .or("leido.is.null,leido.eq.false");
    if (error) {
        console.error("No se pudieron contar los mensajes sin leer:", error);
        return null;   // null = no se pudo saber (no se toca lo que ya se muestra)
    }
    return count || 0;
}

async function revisarMensajesNoLeidosUnaVez() {
    try {
        if (sessionStorage.getItem(CLAVE_REVISION_MENSAJES)) return;
        // Se marca ANTES de consultar: asi nunca se repite ni se forma un bucle.
        sessionStorage.setItem(CLAVE_REVISION_MENSAJES, "1");
        const ruta = window.location.pathname;
        if (ruta.endsWith("admin-mensajes.html")) return;
        if (window.location.search.includes("responder=")) return;   // no interrumpir una respuesta en curso
        const noLeidos = await contarMensajesNoLeidos();
        if (noLeidos > 0) irAPagina("admin-mensajes.html");
    } catch (error) {
        console.error("No se pudo revisar si hay mensajes sin leer:", error);
    }
}

/* ---------- Insignias rojas de pendientes en el menu: se ven en TODAS las pestanas ---------- */
// Pone (o quita, si es 0) el numero rojo junto a un enlace del menu.
function ponerInsignia(selectorEnlace, idInsignia, cantidad) {
    const enlace = document.querySelector(selectorEnlace);
    if (!enlace) return;
    let insignia = document.getElementById(idInsignia);
    if (!insignia) {
        insignia = document.createElement("span");
        insignia.id = idInsignia;
        insignia.className = "badge";
        enlace.appendChild(insignia);
    }
    insignia.textContent = cantidad > 0 ? String(cantidad) : "";
    actualizarPuntoMenuMovil();
}

// En el celular el menu esta escondido tras el boton ☰: ahi se muestra el total de pendientes.
function actualizarPuntoMenuMovil() {
    const boton = document.getElementById("btnMenu");
    if (!boton) return;
    const leer = (id) => parseInt((document.getElementById(id) || {}).textContent, 10) || 0;
    const total = leer("contadorNoLeidos") + leer("contadorResetMenu");
    let punto = boton.querySelector(".punto-pendientes");
    if (!punto) {
        punto = document.createElement("span");
        punto.className = "punto-pendientes";
        boton.appendChild(punto);
    }
    punto.textContent = total > 0 ? String(total) : "";
    boton.setAttribute("aria-label", total > 0 ? `Abrir menú (${total} pendientes)` : "Abrir menú");
}

// Solicitudes de restablecimiento pendientes: se cuenta igual que la tarjeta de ese panel
// (una por documento). Solo el superadministrador puede verlas; null = no se pudo saber.
async function contarSolicitudesResetPendientes() {
    if (!window.sesionAdmin || window.sesionAdmin.rol !== "superadministrador") return 0;
    const { data, error } = await clienteAuth.rpc("listar_solicitudes_reset");
    if (error) {
        console.warn("No se pudieron contar las solicitudes de restablecimiento:", error.message);
        return null;
    }
    const documentos = new Set(
        (data || []).filter((s) => s.estado === "pendiente").map((s) => s.documento)
    );
    return documentos.size;
}

async function actualizarInsigniasMenu() {
    try {
        const [noLeidos, pendientesReset] = await Promise.all([
            contarMensajesNoLeidos(),
            contarSolicitudesResetPendientes()
        ]);
        if (noLeidos !== null) ponerInsignia('a[href="admin-mensajes.html"]', "contadorNoLeidos", noLeidos);
        if (pendientesReset !== null) ponerInsignia("#navAdministradores", "contadorResetMenu", pendientesReset);
    } catch (error) {
        console.error("No se pudieron actualizar los pendientes del menu:", error);
    }
}

function iniciarInsigniasMenu() {
    if (window.__insigniasMenuIniciadas) return;
    window.__insigniasMenuIniciadas = true;
    actualizarInsigniasMenu();
    // Se actualizan solas: cada minuto y cada vez que vuelves a esta pestana del navegador
    setInterval(actualizarInsigniasMenu, 60000);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) actualizarInsigniasMenu();
    });
}
