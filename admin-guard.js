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

    return window.sesionAdmin;
}

async function cerrarSesion() {
    await clienteAuth.auth.signOut();
    window.location.href = "admin-login.html";
}
