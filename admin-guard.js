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

    const { data: perfil, error: errorPerfil } = await clienteAuth
        .from("Administradores")
        .select("nombres, apellidos, correo, activo")
        .eq("user_id", session.user.id)
        .single();

    if (errorPerfil || !perfil || perfil.activo === false) {
        await clienteAuth.auth.signOut();
        window.location.href = "admin-login.html";
        return null;
    }

    const { data: rolFila } = await clienteAuth
        .from("Usuarios_Roles")
        .select("Roles(nombre)")
        .eq("user_id", session.user.id)
        .maybeSingle();

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
