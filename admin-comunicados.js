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

    await cargarComunicados();
    await cargarAfiliadosParaBuscar();
    renderizar();

    document.getElementById("btnNuevoComunicado").addEventListener("click", () => abrirModal());
    document.getElementById("btnCancelarComunicado").addEventListener("click", cerrarModal);
    document.getElementById("formComunicado").addEventListener("submit", guardarComunicado);

    document.getElementById("campoDestinatario").addEventListener("change", (e) => {
        document.getElementById("bloqueBuscarAfiliado").style.display =
            e.target.value === "uno" ? "block" : "none";
    });

    document.getElementById("buscarAfiliadoComunicado").addEventListener("input", buscarAfiliado);
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
        `<div data-doc="${a.Documento}" data-nombre="${a.Nombre}">${a.Nombre} — ${formatearDocumento(a.Documento)}</div>`
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
                    ${c.titulo}
                    <span class="etiqueta-destinatario ${c.documento_destino ? "destinatario-uno" : "destinatario-todos"}">
                        ${c.documento_destino ? "Para " + formatearDocumento(c.documento_destino) : "Para todos"}
                    </span>
                </span>
                <span class="mensaje-fecha">${new Date(c.fecha_publicacion).toLocaleDateString("es-CO")}</span>
            </div>
            <p class="mensaje-texto">${c.mensaje}</p>
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
    document.getElementById("modalComunicado").style.display = "flex";
}

function cerrarModal() {
    document.getElementById("modalComunicado").style.display = "none";
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

    cerrarModal();
    await cargarComunicados();
    renderizar();
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
