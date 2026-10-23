/*
  admin-comunicados.js
  ======================
  Crear, editar y archivar comunicados -- para todos los afiliados o
  para uno en particular (documento_destino). Todo directo contra
  Supabase con sesión autenticada: crear un comunicado es un INSERT
  normal, no requiere el servidor local ni la clave service_role.
*/

function formatearDocumento(valor) {
    const limpio = String(valor ?? "").replace(/[^0-9]/g, "");
    return limpio ? Number(limpio).toLocaleString("es-CO") : (valor || "—");
}

function escaparHtml(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML;
}
function escaparAtributo(texto) {
    return escaparHtml(texto).replace(/"/g, "&quot;");
}
let mensajeEnRespuestaId = null;
let comunicadosCompletos = [];
let afiliadosParaBuscar = [];
let esSuperadmin = false;

document.addEventListener("DOMContentLoaded", async () => {
    const sesion = await requerirSesion();
    if (!sesion) return;

    document.getElementById("nombreUsuario").textContent =
        `${sesion.perfil.nombres} ${sesion.perfil.apellidos}`;
    document.getElementById("btnSalir").addEventListener("click", cerrarSesion);

    esSuperadmin = sesion.rol === "superadministrador";

    // Ambas cargas son independientes -- van en paralelo en vez de
    // esperar una y luego la otra.
    await Promise.all([cargarComunicados(), cargarAfiliadosParaBuscar()]);
    renderizar();

    document.getElementById("btnNuevoComunicado").addEventListener("click", () => abrirModal());
    document.getElementById("btnCancelarComunicado").addEventListener("click", cerrarModal);
    document.getElementById("formComunicado").addEventListener("submit", guardarComunicado);

    document.getElementById("campoDestinatario").addEventListener("change", (e) => {
        document.getElementById("bloqueBuscarAfiliado").style.display =
            e.target.value === "uno" ? "block" : "none";
    });

    document.getElementById("buscarAfiliadoComunicado").addEventListener("input", buscarAfiliado);
    await abrirRespuestaDesdeURL();
});

async function cargarComunicados() {
    const { data, error } = await clienteAuth
        .from("Comunicados")
        .select("*")
        .order("fecha_publicacion", { ascending: false });

    if (error) {
        document.getElementById("listaComunicados").innerHTML =
            `<p>No se pudieron cargar los comunicados: ${error.message}</p>`;
        return;
    }

    comunicadosCompletos = data || [];
}

async function cargarAfiliadosParaBuscar() {
    const { data, error } = await clienteAuth.from("Afiliados").select("Documento, Nombre");
    if (!error) afiliadosParaBuscar = data || [];
}

function buscarAfiliado() {
    const texto = document.getElementById("buscarAfiliadoComunicado").value.trim().toLowerCase();
    const contenedor = document.getElementById("resultadosAfiliado");

    if (!texto) { contenedor.innerHTML = ""; return; }

    const encontrados = afiliadosParaBuscar.filter((a) =>
        (a.Nombre || "").toLowerCase().includes(texto) ||
        String(a.Documento || "").includes(texto)
    ).slice(0, 8);

    contenedor.innerHTML = encontrados.map((a) =>
        `<div data-doc="${escaparAtributo(a.Documento)}" data-nombre="${escaparAtributo(a.Nombre)}">${escaparHtml(a.Nombre)} — ${formatearDocumento(a.Documento)}</div>`
    ).join("") || "<div>Sin resultados</div>";

    contenedor.querySelectorAll("div[data-doc]").forEach((el) => {
        el.addEventListener("click", () => {
            document.getElementById("documentoDestinoSeleccionado").value = el.dataset.doc;
            document.getElementById("afiliadoSeleccionadoTexto").textContent =
                `Seleccionado: ${el.dataset.nombre} (${formatearDocumento(el.dataset.doc)})`;
            contenedor.innerHTML = "";
            document.getElementById("buscarAfiliadoComunicado").value = "";
        });
    });
}

function renderizar() {
    const contenedor = document.getElementById("listaComunicados");

    if (!comunicadosCompletos.length) {
        contenedor.innerHTML = "<p>No hay comunicados todavía.</p>";
        return;
    }

    contenedor.innerHTML = comunicadosCompletos.map((c) => `
        <div class="tarjeta-mensaje ${c.activo ? "" : "no-leido"}">
            <div class="mensaje-encabezado">
                <span class="mensaje-remitente">
                    ${escaparHtml(c.titulo)}
                    <span class="etiqueta-destinatario ${c.documento_destino ? "destinatario-uno" : "destinatario-todos"}">
                        ${c.documento_destino ? "Para " + formatearDocumento(c.documento_destino) : "Para todos"}
                    </span>
                </span>
                <span class="mensaje-fecha">${new Date(c.fecha_publicacion).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
            </div>
            <p class="mensaje-texto">${escaparHtml(c.mensaje)}</p>
            <div class="mensaje-acciones">
                <button data-accion="archivar" data-id="${c.id}">
                    ${c.activo ? "Archivar" : "Reactivar"}
                </button>
                ${esSuperadmin ? `<button data-accion="eliminar" data-id="${c.id}" class="btn-eliminar">Eliminar</button>` : ""}
            </div>
        </div>
    `).join("");

    contenedor.querySelectorAll('[data-accion="archivar"]').forEach((boton) => {
        boton.addEventListener("click", () => alternarActivo(Number(boton.dataset.id)));
    });

    contenedor.querySelectorAll('[data-accion="eliminar"]').forEach((boton) => {
        boton.addEventListener("click", () => eliminarComunicado(Number(boton.dataset.id)));
    });
}

async function eliminarComunicado(id) {
    if (!confirm("¿Eliminar este comunicado? No se puede deshacer.")) return;

    const { error } = await clienteAuth.from("Comunicados").delete().eq("id", id);

    if (error) {
        alert("No se pudo eliminar (¿tienes rol de superadministrador?): " + error.message);
        return;
    }

    comunicadosCompletos = comunicadosCompletos.filter((c) => c.id !== id);
    renderizar();
}

function abrirModal() {
    document.getElementById("formComunicado").reset();
    document.getElementById("comunicadoId").value = "";
    document.getElementById("documentoDestinoSeleccionado").value = "";
    document.getElementById("afiliadoSeleccionadoTexto").textContent = "";
    document.getElementById("resultadosAfiliado").innerHTML = "";
    document.getElementById("bloqueBuscarAfiliado").style.display = "none";
    document.getElementById("errorComunicado").textContent = "";
    mensajeEnRespuestaId = null;
    document.getElementById("tituloModalComunicado").textContent = "Nuevo comunicado";
    document.getElementById("citaMensajeOriginal").style.display = "none";
    document.getElementById("modalComunicado").style.display = "flex";
}

function cerrarModal() {
    document.getElementById("modalComunicado").style.display = "none";
    limpiarParametroResponder();
}

async function guardarComunicado(evento) {
    evento.preventDefault();

    const destinatario = document.getElementById("campoDestinatario").value;
    const documentoDestino = document.getElementById("documentoDestinoSeleccionado").value;
    const errorComunicado = document.getElementById("errorComunicado");

    if (destinatario === "uno" && !documentoDestino) {
        errorComunicado.textContent = "Busca y selecciona un afiliado antes de enviar.";
        return;
    }

    const { error } = await clienteAuth.from("Comunicados").insert({
        titulo: document.getElementById("campoTitulo").value.trim(),
        mensaje: document.getElementById("campoMensaje").value.trim(),
        documento_destino: destinatario === "uno" ? documentoDestino : null,
        activo: true
    });

    if (error) {
        errorComunicado.textContent = "No se pudo enviar: " + error.message;
        return;
    }

    const idRespondido = mensajeEnRespuestaId;
    const nombreRespondido = document.getElementById("afiliadoSeleccionadoTexto").textContent.replace("Seleccionado: ", "");
    cerrarModal();
    if (idRespondido) await confirmarRespuestaEnviada(idRespondido, nombreRespondido);
    await cargarComunicados();
    renderizar();
}

// ---------- Responder un mensaje de un afiliado (llega desde la pestana Mensajes) ----------
function limpiarParametroResponder() {
    if (window.location.search.includes("responder=")) {
        window.history.replaceState(null, "", window.location.pathname);
    }
}

function mostrarAvisoRespuesta(texto, exito) {
    const aviso = document.getElementById("avisoRespuesta");
    aviso.textContent = texto;
    aviso.classList.toggle("exito", !!exito);
    aviso.style.display = "block";
}

async function abrirRespuestaDesdeURL() {
    const id = Number(new URLSearchParams(window.location.search).get("responder"));
    if (!id) return;
    const { data: mensaje, error } = await clienteAuth
        .from("Mensajes")
        .select("id, nombre, documento, mensaje, creado_en")
        .eq("id", id)
        .maybeSingle();
    if (error || !mensaje) {
        mostrarAvisoRespuesta("No se encontro el mensaje que se queria responder.", false);
        limpiarParametroResponder();
        return;
    }
    abrirModalRespuesta(mensaje);
}

function abrirModalRespuesta(mensaje) {
    const documento = String(mensaje.documento ?? "").replace(/[^0-9]/g, "");
    if (!documento) {
        mostrarAvisoRespuesta("Este mensaje no trae documento, por eso no se puede responder desde aqui.", false);
        limpiarParametroResponder();
        return;
    }
    abrirModal();                       // deja el formulario limpio
    mensajeEnRespuestaId = mensaje.id;
    const afiliado = afiliadosParaBuscar.find((a) => String(a.Documento) === documento);
    const nombre = (afiliado && afiliado.Nombre) || mensaje.nombre || "Afiliado";
    document.getElementById("tituloModalComunicado").textContent = "Responder mensaje";
    document.getElementById("campoDestinatario").value = "uno";
    document.getElementById("bloqueBuscarAfiliado").style.display = "block";
    document.getElementById("documentoDestinoSeleccionado").value = documento;
    document.getElementById("afiliadoSeleccionadoTexto").textContent =
        `Seleccionado: ${nombre} (${formatearDocumento(documento)})`;
    document.getElementById("campoTitulo").value = "Respuesta a su mensaje";
    // El mensaje original solo se muestra como referencia (textContent: nunca se interpreta como HTML)
    document.getElementById("citaMensajeFecha").textContent = mensaje.creado_en
        ? new Date(mensaje.creado_en).toLocaleString("es-CO", {
            day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
        })
        : "";
    document.getElementById("citaMensajeTexto").textContent = mensaje.mensaje || "";
    document.getElementById("citaMensajeOriginal").style.display = "block";
    document.getElementById("campoMensaje").focus();
}

// Tras enviar la respuesta: el mensaje original queda marcado como leido y se avisa en la pagina
async function confirmarRespuestaEnviada(idMensaje, nombre) {
    mensajeEnRespuestaId = null;
    const { error } = await clienteAuth.from("Mensajes").update({ leido: true }).eq("id", idMensaje);
    if (error) console.error("No se pudo marcar el mensaje como leido:", error);
    mostrarAvisoRespuesta(
        error
            ? `Respuesta enviada a ${nombre}. No se pudo marcar el mensaje como leido; marcalo desde la pestana Mensajes.`
            : `Respuesta enviada a ${nombre}. El mensaje quedo marcado como leido.`,
        !error
    );
}


async function alternarActivo(id) {
    const comunicado = comunicadosCompletos.find((c) => c.id === id);
    if (!comunicado) return;

    const { error } = await clienteAuth
        .from("Comunicados")
        .update({ activo: !comunicado.activo })
        .eq("id", id);

    if (error) { alert("No se pudo actualizar: " + error.message); return; }

    comunicado.activo = !comunicado.activo;
    renderizar();
}
