/*
  admin-usuarios.js
  ==================
  Lectura de la lista y acciones: todo pasa por el servidor local
  (server/index.js), porque son operaciones que necesitan la clave
  service_role. Restablecer contraseña es la única excepción: se
  hace directo contra Supabase con la clave publicable (mismo
  mecanismo publico de "olvide mi contraseña").
*/

const URL_SERVIDOR_LOCAL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:4001"
    : "https://portal-facs.onrender.com";

const NOMBRES_ROLES = {
    superadministrador: "Superadministrador",
    administrador: "Administrador",
    consulta: "Consulta"
};

function formatearDocumento(valor) {
    const limpio = String(valor ?? "").replace(/[^0-9]/g, "");
    return limpio ? Number(limpio).toLocaleString("es-CO") : (valor || "—");
}

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

    if (esSuperadmin) {
        document.getElementById("seccionRestablecimiento").style.display = "block";
        document.getElementById("buscarReset").addEventListener("input", aplicarFiltrosReset);
        document.getElementById("filtroEstadoReset").addEventListener("change", aplicarFiltrosReset);
        await cargarSolicitudesReset();
    }

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

    cuerpo.innerHTML = `<tr><td colspan="7">Cargando administradores...</td></tr>`;

    try {
        const respuesta = await fetch(`${URL_SERVIDOR_LOCAL}/api/administradores`, {
            headers: { Authorization: `Bearer ${window.sesionAdmin.token}` }
        });

        if (!respuesta.ok) throw new Error((await respuesta.json()).error || "Error al cargar.");

        const administradores = await respuesta.json();
        cuerpo.innerHTML = "";

        if (administradores.length === 0) {
            cuerpo.innerHTML = `<tr><td colspan="7">No hay administradores registrados todavía.</td></tr>`;
            return;
        }

        administradores.forEach((admin) => {
            const fila = document.createElement("tr");
            fila.innerHTML = `
                <td>${admin.nombres} ${admin.apellidos}</td>
                <td>${formatearDocumento(admin.documento)}</td>
                <td>${admin.correo}</td>
                <td>${NOMBRES_ROLES[admin.rol] || "—"}</td>
                <td class="${admin.activo ? "estado-activo" : "estado-inactivo"}">
                    ${admin.activo ? "Activo" : "Inactivo"}
                </td>
                <td>${new Date(admin.creado_en).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" })}</td>
                <td>
                    <button data-accion="editar">Editar</button>
                    <button data-accion="clave">Restablecer clave (correo)</button>
                    <button data-accion="claveTemporal">Nueva clave temporal</button>
                    <button data-accion="estado">${admin.activo ? "Desactivar" : "Activar"}</button>
                    ${!admin.activo ? `<button data-accion="eliminar" class="btn-eliminar">Eliminar</button>` : ""}
                </td>
            `;
            fila.querySelector('[data-accion="editar"]').addEventListener("click", () => abrirModal(admin));
            fila.querySelector('[data-accion="clave"]').addEventListener("click", () => restablecerClave(admin.correo));
            fila.querySelector('[data-accion="claveTemporal"]').addEventListener("click", () => generarNuevaClaveTemporal(admin));
            fila.querySelector('[data-accion="estado"]').addEventListener("click", () => alternarActivo(admin));
            fila.querySelector('[data-accion="eliminar"]')?.addEventListener("click", () => eliminarAdmin(admin));
            cuerpo.appendChild(fila);
        });

    } catch (error) {
        cuerpo.innerHTML = `<tr><td colspan="7">
            No se pudo conectar con el servidor de administración.
            Verifica tu conexión a internet e inténtalo de nuevo. Detalle: ${error.message}
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

async function eliminarAdmin(admin) {
    const nombreCompleto = `${admin.nombres} ${admin.apellidos}`;

    if (!confirm(
        `¿Eliminar PERMANENTEMENTE a ${nombreCompleto}? Esta acción no se puede deshacer.`
    )) return;

    if (!confirm(
        `Última confirmación: se borrará por completo el acceso y el perfil de ${nombreCompleto}. ¿Continuar?`
    )) return;

    try {
        const respuesta = await fetch(`${URL_SERVIDOR_LOCAL}/api/administradores/${admin.user_id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${window.sesionAdmin.token}` }
        });

        if (!respuesta.ok) {
            let mensaje = `No se pudo eliminar (código ${respuesta.status}).`;
            try {
                const datos = await respuesta.json();
                mensaje = datos.error || mensaje;
            } catch {
                // La respuesta no era JSON (ej. una pagina de error del servidor).
                // Nos quedamos con el mensaje generico que ya incluye el codigo.
            }
            alert(mensaje);
            return;
        }

        await cargarAdministradores();
    } catch (error) {
        alert(
            "No se pudo conectar con el servidor de administración. " +
            "Verifica tu conexión a internet e inténtalo de nuevo. Detalle: " + error.message
        );
    }
}

async function restablecerClave(correo) {
    const clienteAuthPublico = clienteAuth; // misma conexión de admin-guard.js (evita instancias duplicadas)

    const { error } = await clienteAuthPublico.auth.resetPasswordForEmail(correo, {
        redirectTo: new URL("set-password.html", window.location.href).href
    });

    if (error) {
        alert("No se pudo enviar el correo de restablecimiento.");
        return;
    }

    alert(`Se envió un enlace de restablecimiento de contraseña a ${correo}.`);
}


/* ==================================================================
   Restablecimiento de afiliados (solo Superadministrador)
   Todo pasa por funciones de Supabase (listar_solicitudes_reset y
   restablecer_afiliado), que vuelven a verificar el rol en el
   servidor. No depende de Render.
   ================================================================== */

let solicitudesReset = [];

// Los datos vienen de una tabla que llena el portal público, así que
// se escapan antes de pintarlos en el panel.
function escaparHtml(valor) {
    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function normalizarTextoReset(valor) {
    return String(valor ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

// Las columnas son "timestamp sin zona": se leen como hora UTC y se
// muestran en hora de Colombia.
function formatearFechaHoraReset(valor) {
    if (!valor) return "—";
    const texto = String(valor).replace(" ", "T");
    const conZona = /(Z|[+-]\d{2}(:?\d{2})?)$/.test(texto);
    const fecha = new Date(conZona ? texto : texto + "Z");
    if (isNaN(fecha)) return "—";
    return fecha.toLocaleString("es-CO", {
        timeZone: "America/Bogota",
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

function mostrarMensajeReset(texto, tipo) {
    const p = document.getElementById("mensajeReset");
    p.textContent = texto;
    p.className = "mensaje " + (tipo || "");
}

async function cargarSolicitudesReset() {
    const cuerpo = document.getElementById("tablaResetBody");
    cuerpo.innerHTML = `<tr><td colspan="7">Cargando solicitudes...</td></tr>`;

    const { data, error } = await clienteAuth.rpc("listar_solicitudes_reset");

    if (error) {
        cuerpo.innerHTML = `<tr><td colspan="7">No se pudieron cargar las solicitudes: ${escaparHtml(error.message)}</td></tr>`;
        return;
    }

    solicitudesReset = data || [];
    aplicarFiltrosReset();
}

function aplicarFiltrosReset() {
    const texto = normalizarTextoReset(document.getElementById("buscarReset").value.trim());
    const estadoElegido = document.getElementById("filtroEstadoReset").value;
    const cuerpo = document.getElementById("tablaResetBody");

    // Cuántas solicitudes pendientes tiene cada documento, para mostrar
    // una sola fila (la más antigua) con la nota "N solicitudes".
    const pendientesPorDocumento = {};
    solicitudesReset.forEach((s) => {
        if (s.estado === "pendiente") {
            pendientesPorDocumento[s.documento] = (pendientesPorDocumento[s.documento] || 0) + 1;
        }
    });

    const yaVistos = new Set();
    let visibles = solicitudesReset.filter((s) => {
        if (s.estado !== "pendiente") return true;
        if (yaVistos.has(s.documento)) return false;
        yaVistos.add(s.documento);
        return true;
    });

    const totalPendientes = Object.keys(pendientesPorDocumento).length;
    document.getElementById("contadorPendientes").textContent = totalPendientes || "";

    visibles = visibles.filter((s) => {
        if (estadoElegido !== "todas" && s.estado !== estadoElegido) return false;
        if (texto) {
            const nombre = normalizarTextoReset(s.nombre);
            const documento = String(s.documento ?? "").toLowerCase();
            if (!nombre.includes(texto) && !documento.includes(texto)) return false;
        }
        return true;
    });

    // Pendientes primero (la más antigua arriba); luego las atendidas,
    // la más reciente arriba.
    visibles.sort((a, b) => {
        const aPend = a.estado === "pendiente";
        const bPend = b.estado === "pendiente";
        if (aPend !== bPend) return aPend ? -1 : 1;
        if (aPend) return new Date(a.fecha_solicitud) - new Date(b.fecha_solicitud);
        return new Date(b.fecha_atendida || b.fecha_solicitud) - new Date(a.fecha_atendida || a.fecha_solicitud);
    });

    document.getElementById("resumenReset").textContent =
        `${visibles.length} solicitud(es) mostrada(s). Pendientes por atender: ${totalPendientes}.`;

    if (!visibles.length) {
        cuerpo.innerHTML = `<tr><td colspan="7">No hay solicitudes con este filtro.</td></tr>`;
        return;
    }

    cuerpo.innerHTML = "";

    visibles.forEach((s) => {
        const pendiente = s.estado === "pendiente";
        const veces = pendientesPorDocumento[s.documento] || 0;
        const notaRepetida = pendiente && veces > 1
            ? `<span class="nota-repetida">${veces} solicitudes</span>` : "";

        const atendida = s.fecha_atendida
            ? formatearFechaHoraReset(s.fecha_atendida) +
              (s.atendida_por_nombre ? `<br><small>${escaparHtml(s.atendida_por_nombre)}</small>` : "")
            : "—";

        const fila = document.createElement("tr");
        fila.innerHTML = `
            <td>${s.nombre ? escaparHtml(s.nombre) : "<em>No está en Afiliados</em>"}</td>
            <td>${escaparHtml(formatearDocumento(s.documento))}</td>
            <td>${escaparHtml(s.empresa || "—")}</td>
            <td>${formatearFechaHoraReset(s.fecha_solicitud)}${notaRepetida}</td>
            <td class="${pendiente ? "estado-pendiente" : (s.estado === "descartada" ? "estado-descartada" : "estado-activo")}">
                ${pendiente ? "Pendiente" : (s.estado === "descartada" ? "Descartada" : "Atendida")}
            </td>
            <td>${atendida}</td>
            <td>${pendiente
                ? `<button type="button" class="btn-restablecer">Restablecer</button>
                   <button type="button" class="btn-descartar">Descartar</button>`
                : ""}</td>
        `;

        fila.querySelector(".btn-restablecer")?.addEventListener("click", (evento) =>
            restablecerAfiliado(s, evento.currentTarget));
        fila.querySelector(".btn-descartar")?.addEventListener("click", (evento) =>
            descartarSolicitud(s, evento.currentTarget));

        cuerpo.appendChild(fila);
    });
}

async function restablecerAfiliado(solicitud, boton) {
    const quien = solicitud.nombre
        ? `${solicitud.nombre} (documento ${formatearDocumento(solicitud.documento)})`
        : `el documento ${formatearDocumento(solicitud.documento)}`;

    if (!confirm(
        `¿Restablecer la configuración de ${quien}?\n\n` +
        `Se borrarán su contraseña y su pregunta secreta, y tendrá que configurarlas ` +
        `de nuevo la próxima vez que entre al portal.`
    )) return;

    boton.disabled = true;
    boton.textContent = "Restableciendo...";
    mostrarMensajeReset("", "");

    const { error } = await clienteAuth.rpc("restablecer_afiliado", {
        p_solicitud_id: solicitud.id
    });

    if (error) {
        boton.disabled = false;
        boton.textContent = "Restablecer";
        mostrarMensajeReset("No se pudo restablecer: " + error.message, "error");
        return;
    }

    mostrarMensajeReset(`Listo: se restableció la configuración de ${quien}.`, "exito");
    await cargarSolicitudesReset();
}

// Descartar: la solicitud queda en el historial como "descartada"; NO se
// toca la contraseña ni la pregunta del afiliado.
async function descartarSolicitud(solicitud, boton) {
    const quien = solicitud.nombre
        ? `${solicitud.nombre} (documento ${formatearDocumento(solicitud.documento)})`
        : `el documento ${formatearDocumento(solicitud.documento)}`;

    if (!confirm(
        `¿Descartar la solicitud de ${quien}?\n\n` +
        `No se restablece su configuración. La solicitud queda guardada en el ` +
        `historial como "descartada".`
    )) return;

    boton.disabled = true;
    boton.textContent = "Descartando...";
    mostrarMensajeReset("", "");

    const { error } = await clienteAuth.rpc("descartar_solicitud_reset", {
        p_solicitud_id: solicitud.id
    });

    if (error) {
        boton.disabled = false;
        boton.textContent = "Descartar";
        mostrarMensajeReset("No se pudo descartar: " + error.message, "error");
        return;
    }

    mostrarMensajeReset(`Listo: se descartó la solicitud de ${quien}.`, "exito");
    await cargarSolicitudesReset();
}
