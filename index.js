/*
  FACS - Servidor local de gestion de administradores
  =====================================================
  Corre SOLO en tu computador (node index.js). No se publica en
  GitHub. Aqui vive la clave service_role porque crear/editar
  usuarios de Supabase Auth requiere privilegios que el navegador
  nunca debe tener.
*/

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const URL_PANEL = process.env.URL_PANEL || "http://localhost:5500";

// CORS compara contra el "origen" (protocolo + dominio) que envía el
// navegador, que nunca incluye la ruta. Si URL_PANEL tiene una ruta
// (ej: https://sitio.com/Portal-FACS) la comparacion nunca coincidiria,
// asi que aqui nos quedamos solo con protocolo+dominio sin importar
// como este escrita la variable en Render.
const ORIGEN_PANEL = (() => {
    try {
        return new URL(URL_PANEL).origin;
    } catch {
        return URL_PANEL;
    }
})();
const PORT = process.env.PORT || 4001;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.includes("PON_AQUI")) {
    console.error("Falta configurar server/.env (copia .env.example y pon tu clave service_role).");
    process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const app = express();
app.use(cors({ origin: ORIGEN_PANEL }));
app.use(express.json());

async function requiereSuperadmin(req, res, next) {
    const token = (req.headers.authorization || "").replace("Bearer ", "");

    if (!token) return res.status(401).json({ error: "Falta el token de sesion." });

    const { data: { user }, error: errorUsuario } = await supabaseAdmin.auth.getUser(token);
    if (errorUsuario || !user) return res.status(401).json({ error: "Sesion invalida o expirada." });

    const { data: rolesUsuario, error: errorRol } = await supabaseAdmin
        .from("Usuarios_Roles")
        .select("Roles(nombre)")
        .eq("user_id", user.id);

    if (errorRol) return res.status(500).json({ error: "No se pudo verificar el rol." });

    const esSuperadmin = (rolesUsuario || []).some(
        (fila) => fila.Roles && fila.Roles.nombre === "superadministrador"
    );

    if (!esSuperadmin) {
        return res.status(403).json({ error: "Solo el superadministrador puede gestionar administradores." });
    }

    req.usuarioActual = user;
    next();
}

/* LISTAR */
app.get("/api/administradores", requiereSuperadmin, async (req, res) => {
    // Administradores y Usuarios_Roles no tienen una relacion (foreign
    // key) directa entre si -- ambas apuntan a auth.users, pero no una
    // a la otra -- asi que Supabase no puede cruzarlas en una sola
    // consulta automatica. Se piden por separado y se cruzan aqui,
    // en memoria, por user_id.

    // "Administradores" y "Usuarios_Roles" no dependen entre sí -- se
    // piden en paralelo en vez de uno tras otro.
    const [
        { data: administradores, error: errorAdmins },
        { data: rolesAsignados, error: errorRoles }
    ] = await Promise.all([
        supabaseAdmin
            .from("Administradores")
            .select("user_id, documento, nombres, apellidos, correo, activo, creado_en, creado_por")
            .order("creado_en", { ascending: true }),
        supabaseAdmin
            .from("Usuarios_Roles")
            .select("user_id, Roles ( nombre )")
    ]);

    if (errorAdmins) return res.status(500).json({ error: errorAdmins.message });
    if (errorRoles) return res.status(500).json({ error: errorRoles.message });

    const rolPorUsuario = {};
    (rolesAsignados || []).forEach((fila) => {
        rolPorUsuario[fila.user_id] = fila.Roles?.nombre || null;
    });

    const resultado = administradores.map((admin) => ({
        ...admin,
        rol: rolPorUsuario[admin.user_id] || null
    }));

    res.json(resultado);
});

/* CREAR */
function generarClaveTemporal() {
    const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let clave = "";
    for (let i = 0; i < 10; i++) {
        clave += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return clave;
}

app.post("/api/administradores", requiereSuperadmin, async (req, res) => {
    const { nombres, apellidos, documento, correo, rol } = req.body;

    if (!nombres || !apellidos || !documento || !correo || !rol) {
        return res.status(400).json({ error: "Todos los campos son obligatorios." });
    }

    // En vez de invitar por correo (limitado a pocos envios por hora
    // en el plan gratuito), se crea la cuenta directamente con una
    // contraseña temporal generada aqui. El superadministrador la
    // comparte manualmente (WhatsApp, de viva voz, etc.) y la persona
    // la cambia obligatoriamente en su primer ingreso.
    const claveTemporal = generarClaveTemporal();

    const { data: nuevoUsuario, error: errorCreacion } =
        await supabaseAdmin.auth.admin.createUser({
            email: correo,
            password: claveTemporal,
            email_confirm: true
        });

    if (errorCreacion) return res.status(400).json({ error: errorCreacion.message });

    const userId = nuevoUsuario.user.id;

    const { error: errorPerfil } = await supabaseAdmin
        .from("Administradores")
        .insert({
            user_id: userId, documento, nombres, apellidos, correo,
            activo: true, debe_cambiar_clave: true,
            creado_por: req.usuarioActual.id
        });

    if (errorPerfil) return res.status(400).json({ error: errorPerfil.message });

    const { data: rolFila, error: errorBuscarRol } = await supabaseAdmin
        .from("Roles").select("id").eq("nombre", rol).single();

    if (errorBuscarRol || !rolFila) return res.status(400).json({ error: "Rol no valido." });

    const { error: errorAsignarRol } = await supabaseAdmin
        .from("Usuarios_Roles").insert({ user_id: userId, rol_id: rolFila.id });

    if (errorAsignarRol) return res.status(400).json({ error: errorAsignarRol.message });

    // La clave temporal solo se devuelve UNA VEZ, en esta respuesta.
    // No queda guardada en ningun lado -- si se pierde, hay que usar
    // "Restablecer clave" para generar una nueva via correo.
    res.status(201).json({ user_id: userId, claveTemporal, documento });
});

/* EDITAR */
app.put("/api/administradores/:userId", requiereSuperadmin, async (req, res) => {
    const { userId } = req.params;
    const { nombres, apellidos, documento, correo } = req.body;

    if (correo) {
        const { error: errorCorreo } =
            await supabaseAdmin.auth.admin.updateUserById(userId, { email: correo });
        if (errorCorreo) return res.status(400).json({ error: errorCorreo.message });
    }

    const { error } = await supabaseAdmin
        .from("Administradores")
        .update({ nombres, apellidos, documento, correo })
        .eq("user_id", userId);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
});

/* ACTIVAR / DESACTIVAR */
app.post("/api/administradores/:userId/activo", requiereSuperadmin, async (req, res) => {
    const { userId } = req.params;
    const { activo } = req.body;

    if (userId === req.usuarioActual.id && activo === false) {
        return res.status(400).json({ error: "No puedes desactivar tu propia cuenta." });
    }

    const { error } = await supabaseAdmin
        .from("Administradores").update({ activo: !!activo }).eq("user_id", userId);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
});

/* ELIMINAR (solo si el perfil ya esta desactivado, como medida de
   seguridad extra contra un clic accidental) */
app.delete("/api/administradores/:userId", requiereSuperadmin, async (req, res) => {
    const { userId } = req.params;

    if (userId === req.usuarioActual.id) {
        return res.status(400).json({ error: "No puedes eliminar tu propia cuenta." });
    }

    const { data: perfil, error: errorPerfil } = await supabaseAdmin
        .from("Administradores")
        .select("activo")
        .eq("user_id", userId)
        .single();

    if (errorPerfil || !perfil) return res.status(404).json({ error: "Administrador no encontrado." });

    if (perfil.activo) {
        return res.status(400).json({ error: "Primero debes desactivar esta cuenta antes de eliminarla." });
    }

    await supabaseAdmin.from("Usuarios_Roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("Administradores").delete().eq("user_id", userId);

    const { error: errorAuth } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (errorAuth) return res.status(400).json({ error: errorAuth.message });

    res.json({ ok: true });
});

/* GENERAR NUEVA CLAVE TEMPORAL (sin correo) — para cuando se perdió
   la anterior antes del primer ingreso, o como alternativa a
   "Restablecer clave" cuando no se quiere depender del correo. */
app.post("/api/administradores/:userId/nueva-clave-temporal", requiereSuperadmin, async (req, res) => {
    const { userId } = req.params;

    const claveTemporal = generarClaveTemporal();

    const { error: errorClave } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: claveTemporal
    });

    if (errorClave) return res.status(400).json({ error: errorClave.message });

    // Vuelve a exigir que la persona defina su propia contraseña en
    // el siguiente ingreso, igual que la primera vez.
    const { error: errorPerfil } = await supabaseAdmin
        .from("Administradores")
        .update({ debe_cambiar_clave: true })
        .eq("user_id", userId);

    if (errorPerfil) return res.status(400).json({ error: errorPerfil.message });

    res.json({ claveTemporal });
});

/* CAMBIAR ROL */
app.put("/api/administradores/:userId/rol", requiereSuperadmin, async (req, res) => {
    const { userId } = req.params;
    const { rol } = req.body;

    const { data: rolFila, error: errorBuscarRol } = await supabaseAdmin
        .from("Roles").select("id").eq("nombre", rol).single();

    if (errorBuscarRol || !rolFila) return res.status(400).json({ error: "Rol no valido." });

    await supabaseAdmin.from("Usuarios_Roles").delete().eq("user_id", userId);

    const { error } = await supabaseAdmin
        .from("Usuarios_Roles").insert({ user_id: userId, rol_id: rolFila.id });

    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
});

app.listen(PORT, () => {
    console.log(`Servidor local de administracion FACS en http://localhost:${PORT}`);
});
