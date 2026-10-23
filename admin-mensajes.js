/*
  admin-mensajes.js
  ===================
  Lectura, marcado de "leído" y eliminación (solo superadministrador,
  verificado también en la base de datos vía RLS -- no solo aquí).
*/

function formatearFechaHora(f) {
    if (!f) return "—";
    const fecha = new Date(f);
    return fecha.toLocaleString("es-CO", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

function formatearDocumento(valor) {
    const limpio = String(valor ?? "").replace(/[^0-9]/g, "");
    return limpio ? Number(limpio).toLocaleString("es-CO") : (valor || "—");
}

function escaparHtml(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML;
}

let mensajesCompletos = [];
let esSuperadmin = false;

document.addEventListener("DOMContentLoaded", async () => {
    const sesion = await requerirSesion();
    if (!sesion) return;

    document.getElementById("nombreUsuario").textContent =
        `${sesion.perfil.nombres} ${sesion.perfil.apellidos}`;
    document.getElementById("btnSalir").addEventListener("click", cerrarSesion);

    esSuperadmin = sesion.rol === "superadministrador";
    instalarAccionesMensajes();

    await cargarMensajes();
    renderizar();

    document.getElementById("filtroLeido").addEventListener("change", renderizar);
    document.getElementById("ordenMensajes").addEventListener("change", renderizar);
});

async function cargarMensajes() {
    const { data, error } = await clienteAuth
        .from("Mensajes")
        .select("*")
        .order("creado_en", { ascending: false });

    if (error) {
        document.getElementById("listaMensajes").innerHTML =
            `<p>No se pudieron cargar los mensajes: ${error.message}</p>`;
        return;
    }

    mensajesCompletos = data || [];
    actualizarContador();
}

function actualizarContador() {
    const noLeidos = mensajesCompletos.filter((m) => !m.leido).length;
    document.getElementById("contadorNoLeidos").textContent = noLeidos > 0 ? noLeidos : "";
}

function renderizar() {
    const filtro = document.getElementById("filtroLeido").value;
    const orden = document.getElementById("ordenMensajes").value;

    let lista = mensajesCompletos;
    if (filtro === "no-leidos") lista = lista.filter((m) => !m.leido);
    if (filtro === "leidos") lista = lista.filter((m) => m.leido);

    lista = [...lista].sort((a, b) => orden === "antiguos"
        ? new Date(a.creado_en) - new Date(b.creado_en)
        : new Date(b.creado_en) - new Date(a.creado_en));

    const contenedor = document.getElementById("listaMensajes");

    if (!lista.length) {
        contenedor.innerHTML = mensajesCompletos.length === 0
            ? `<p>No hay mensajes registrados todavía.</p>`
            : "<p>No hay mensajes para mostrar con este filtro.</p>";
        return;
    }

    contenedor.innerHTML = lista.map((m) => `
        <div class="tarjeta-mensaje ${m.leido ? "" : "no-leido"}">
            <div class="mensaje-encabezado">
                <span class="mensaje-remitente">
                    ${escaparHtml(m.nombre) || "Afiliado"} · Documento ${formatearDocumento(m.documento)}
                </span>
                <span class="mensaje-fecha">${formatearFechaHora(m.creado_en)}</span>
            </div>
            <p class="mensaje-texto">${escaparHtml(m.mensaje)}</p>
            <div class="mensaje-acciones">
                <button type="button" data-accion="responder" data-id="${m.id}" class="btn-responder"
                    ${tieneDocumento(m) ? "" : 'disabled title="Este mensaje no trae documento, no se puede responder desde aqui"'}>
                    Responder
                </button>
                <button type="button" data-accion="copiar" data-id="${m.id}" title="Copiar nombre, fecha y mensaje">
                    &#128203; Copiar
                </button>
                <button data-accion="leido" data-id="${m.id}">
                    ${m.leido ? "Marcar como no leído" : "Marcar como leído"}
                </button>
                ${esSuperadmin ? `<button data-accion="eliminar" data-id="${m.id}" class="btn-eliminar">Eliminar</button>` : ""}
            </div>
        </div>
    `).join("");

    contenedor.querySelectorAll('[data-accion="leido"]').forEach((boton) => {
        boton.addEventListener("click", () => alternarLeido(Number(boton.dataset.id)));
    });

    contenedor.querySelectorAll('[data-accion="eliminar"]').forEach((boton) => {
        boton.addEventListener("click", () => eliminarMensaje(Number(boton.dataset.id)));
    });
}

function tieneDocumento(m) {
    return String(m.documento ?? "").replace(/[^0-9]/g, "") !== "";
}

// Texto que se copia: solo nombre, fecha y mensaje (sin documento ni otros datos).
function textoParaCopiar(m) {
    return [
        `Nombre: ${m.nombre || "Afiliado"}`,
        `Fecha: ${formatearFechaHora(m.creado_en)}`,
        `Mensaje: ${m.mensaje || ""}`
    ].join("\n");
}

async function copiarTexto(texto) {
    try {
        await navigator.clipboard.writeText(texto);
        return true;
    } catch (e) {
        // Respaldo para navegadores o conexiones sin permiso de portapapeles
        const area = document.createElement("textarea");
        area.value = texto;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        let ok = false;
        try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
        area.remove();
        return ok;
    }
}

function irAResponder(id) {
    window.location.href = "admin-comunicados.html?responder=" + encodeURIComponent(id);
}

// Un solo escucha para todos los botones "Copiar" y "Responder" de la lista
function instalarAccionesMensajes() {
    document.getElementById("listaMensajes").addEventListener("click", async (evento) => {
        const boton = evento.target.closest("button[data-accion]");
        if (!boton || boton.disabled) return;
        const accion = boton.dataset.accion;
        if (accion !== "copiar" && accion !== "responder") return;
        const mensaje = mensajesCompletos.find((m) => m.id === Number(boton.dataset.id));
        if (!mensaje) return;
        if (accion === "responder") {
            irAResponder(mensaje.id);
            return;
        }
        const original = boton.innerHTML;
        const copiado = await copiarTexto(textoParaCopiar(mensaje));
        boton.textContent = copiado ? "\u2705 Copiado" : "No se pudo copiar";
        setTimeout(() => { boton.innerHTML = original; }, 2000);
    });
}

async function alternarLeido(id) {
    const mensaje = mensajesCompletos.find((m) => m.id === id);
    if (!mensaje) return;

    const { error } = await clienteAuth
        .from("Mensajes")
        .update({ leido: !mensaje.leido })
        .eq("id", id);

    if (error) {
        alert("No se pudo actualizar: " + error.message);
        return;
    }

    mensaje.leido = !mensaje.leido;
    actualizarContador();
    renderizar();
}

async function eliminarMensaje(id) {
    if (!confirm("¿Eliminar este mensaje? No se puede deshacer.")) return;

    const { error } = await clienteAuth.from("Mensajes").delete().eq("id", id);

    if (error) {
        alert("No se pudo eliminar (¿tienes rol de superadministrador?): " + error.message);
        return;
    }

    mensajesCompletos = mensajesCompletos.filter((m) => m.id !== id);
    actualizarContador();
    renderizar();
}
