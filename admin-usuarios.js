/*
  admin-usuarios.js
  ==================
  Lectura de la lista y acciones: todo pasa por el servidor local
  (server/index.js), porque son operaciones que necesitan la clave
  service_role. Restablecer contraseña es la única excepción: se
  hace directo contra Supabase con la clave publicable (mismo
  mecanismo publico de "olvide mi contraseña").
*/

const URL_SERVIDOR_LOCAL = "http://localhost:4001";

const NOMBRES_ROLES = {
    superadministrador: "Superadministrador",
    administrador: "Administrador",
    consulta: "Consulta"
};

let esSuperadmin = false;

document.addEventListener("DOMContentLoaded", async () => {
    const sesion = await requerirSesion();
    if (!sesion) return;

    document.getElementById("nombreUsuario").textContent =
        `${sesion.perfil.nombres} (${NOMBRES_ROLES[sesion.rol] || sesion.rol})`;

    document.getElementById("btnSalir").addEventListener("click", cerrarSesion);

    esSuperadmin = sesion.rol === "superadministrador";

    if (!esSuperadmin) {
        document.getElementById("soloSuperadmin").style.display = "block";
        document.getElementById("btnNuevoAdmin").style.display = "none";
    }

    await cargarAdministradores();

    document.getElementById("btnNuevoAdmin").addEventListener("click", () => abrirModal());
    document.getElementById("btnCancelarModal").addEventListener("click", cerrarModal);
    document.getElementById("formAdmin").addEventListener("submit", guardarAdmin);
});

async function cargarAdministradores() {
    const cuerpo = document.getElementById("tablaAdminsBody");

    if (!esSuperadmin) {
        cuerpo.innerHTML = `<tr><td colspan="7">No tienes permiso para ver esta lista.</td></tr>`;
        return;
    }

    try {
        const respuesta = await fetch(`${URL_SERVIDOR_LOCAL}/api/administradores`, {
            headers: { Authorization: `Bearer ${window.sesionAdmin.token}` }
        });

        if (!respuesta.ok) throw new Error((await respuesta.json()).error || "Error al cargar.");

        const administradores = await respuesta.json();
        cuerpo.innerHTML = "";

        administradores.forEach((admin) => {
            const fila = document.createElement("tr");
            fila.innerHTML = `
                <td>${admin.nombres} ${admin.apellidos}</td>
                <td>${admin.documento}</td>
                <td>${admin.correo}</td>
                <td>${NOMBRES_ROLES[admin.rol] || "—"}</td>
                <td class="${admin.activo ? "estado-activo" : "estado-inactivo"}">
                    ${admin.activo ? "Activo" : "Inactivo"}
                </td>
                <td>${new Date(admin.creado_en).toLocaleDateString("es-CO")}</td>
                <td>
                    <button data-accion="editar">Editar</button>
                    <button data-accion="clave">Restablecer clave (correo)</button>
                    <button data-accion="claveTemporal">Nueva clave temporal</button>
                    <button data-accion="estado">${admin.activo ? "Desactivar" : "Activar"}</button>
                </td>
            `;
            fila.querySelector('[data-accion="editar"]').addEventListener("click", () => abrirModal(admin));
            fila.querySelector('[data-accion="clave"]').addEventListener("click", () => restablecerClave(admin.correo));
            fila.querySelector('[data-accion="claveTemporal"]').addEventListener("click", () => generarNuevaClaveTemporal(admin));
            fila.querySelector('[data-accion="estado"]').addEventListener("click", () => alternarActivo(admin));
            cuerpo.appendChild(fila);
        });

    } catch (error) {
        cuerpo.innerHTML = `<tr><td colspan="7">
            No se pudo conectar con el servidor local (server/index.js).
            ¿Está corriendo con "npm start"? Detalle: ${error.message}
        </td></tr>`;
    }
}

function abrirModal(admin) {
    document.getElementById("errorModal").textContent = "";
    document.getElementById("formAdmin").reset();

    if (admin) {
        document.getElementById("tituloModal").textContent = "Editar administrador";
        document.getElementById("adminUserId").value = admin.user_id;
        document.getElementById("campoNombres").value = admin.nombres;
        document.getElementById("campoApellidos").value = admin.apellidos;
        document.getElementById("campoDocumento").value = admin.documento;
        document.getElementById("campoCorreo").value = admin.correo;
        document.getElementById("campoRol").value = admin.rol;
    } else {
        document.getElementById("tituloModal").textContent = "Nuevo administrador";
        document.getElementById("adminUserId").value = "";
    }

    document.getElementById("modalAdmin").style.display = "flex";
}

function cerrarModal() {
    document.getElementById("modalAdmin").style.display = "none";
}

async function guardarAdmin(evento) {
    evento.preventDefault();

    const userId = document.getElementById("adminUserId").value;
    const cuerpo = {
        nombres: document.getElementById("campoNombres").value.trim(),
        apellidos: document.getElementById("campoApellidos").value.trim(),
        documento: document.getElementById("campoDocumento").value.trim(),
        correo: document.getElementById("campoCorreo").value.trim(),
        rol: document.getElementById("campoRol").value
    };

    const errorModal = document.getElementById("errorModal");
    errorModal.textContent = "";

    try {
        let respuesta;

        if (userId) {
            respuesta = await fetch(`${URL_SERVIDOR_LOCAL}/api/administradores/${userId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${window.sesionAdmin.token}` },
                body: JSON.stringify(cuerpo)
            });

            if (respuesta.ok) {
                await fetch(`${URL_SERVIDOR_LOCAL}/api/administradores/${userId}/rol`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${window.sesionAdmin.token}` },
                    body: JSON.stringify({ rol: cuerpo.rol })
                });
            }
        } else {
            respuesta = await fetch(`${URL_SERVIDOR_LOCAL}/api/administradores`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${window.sesionAdmin.token}` },
                body: JSON.stringify(cuerpo)
            });
        }

        if (!respuesta.ok) {
            const datos = await respuesta.json();
            throw new Error(datos.error || "No se pudo guardar.");
        }

        const datosRespuesta = await respuesta.json().catch(() => null);

        cerrarModal();
        await cargarAdministradores();

        // Solo la creación (no la edición) devuelve una clave temporal.
        if (!userId && datosRespuesta && datosRespuesta.claveTemporal) {
            mostrarClaveTemporal(datosRespuesta.documento, datosRespuesta.claveTemporal);
        }

    } catch (error) {
        errorModal.textContent = error.message;
    }
}

function mostrarClaveTemporal(documento, clave) {
    document.getElementById("claveTempDocumento").textContent = documento;
    document.getElementById("claveTempValor").value = clave;
    document.getElementById("avisoCopiado").textContent = "";
    document.getElementById("modalClaveTemporal").style.display = "flex";

    const campoClave = document.getElementById("claveTempValor");
    campoClave.focus();
    campoClave.select();
}

document.getElementById("btnCopiarClave").addEventListener("click", async () => {
    const campoClave = document.getElementById("claveTempValor");
    campoClave.select();

    try {
        await navigator.clipboard.writeText(campoClave.value);
    } catch {
        document.execCommand("copy"); // respaldo para navegadores viejos
    }

    document.getElementById("avisoCopiado").textContent = "Copiada al portapapeles.";
});

document.getElementById("btnCerrarClaveTemporal").addEventListener("click", () => {
    document.getElementById("modalClaveTemporal").style.display = "none";
    document.getElementById("claveTempValor").value = "";
});

async function generarNuevaClaveTemporal(admin) {
    if (!confirm(
        `¿Generar una nueva clave temporal para ${admin.nombres} ${admin.apellidos}? ` +
        `La anterior (si no la usó) dejará de servir, y deberá volver a definir su contraseña al entrar.`
    )) return;

    const respuesta = await fetch(
        `${URL_SERVIDOR_LOCAL}/api/administradores/${admin.user_id}/nueva-clave-temporal`,
        {
            method: "POST",
            headers: { Authorization: `Bearer ${window.sesionAdmin.token}` }
        }
    );

    const datos = await respuesta.json();

    if (!respuesta.ok) {
        alert(datos.error || "No se pudo generar la clave temporal.");
        return;
    }

    mostrarClaveTemporal(admin.documento, datos.claveTemporal);
}

async function alternarActivo(admin) {
    const accion = admin.activo ? "desactivar" : "activar";
    if (!confirm(`¿Seguro que quieres ${accion} a ${admin.nombres} ${admin.apellidos}?`)) return;

    const respuesta = await fetch(`${URL_SERVIDOR_LOCAL}/api/administradores/${admin.user_id}/activo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${window.sesionAdmin.token}` },
        body: JSON.stringify({ activo: !admin.activo })
    });

    if (!respuesta.ok) {
        const datos = await respuesta.json();
        alert(datos.error || "No se pudo cambiar el estado.");
        return;
    }

    await cargarAdministradores();
}

async function restablecerClave(correo) {
    const clienteAuthPublico = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const { error } = await clienteAuthPublico.auth.resetPasswordForEmail(correo, {
        redirectTo: window.location.origin + "/set-password.html"
    });

    if (error) {
        alert("No se pudo enviar el correo de restablecimiento.");
        return;
    }

    alert(`Se envió un enlace de restablecimiento de contraseña a ${correo}.`);
}
