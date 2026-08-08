/*
  admin-consultas.js
  ====================
  Lectura de Consultas_Portal, cruzando Documento con Afiliados para
  mostrar el nombre. Todo lectura, directo contra Supabase con sesión
  autenticada (clienteAuth ya declarado en admin-guard.js).
*/

function normalizarDocumento(valor) {
    return String(valor ?? "").replace(/[^0-9]/g, "");
}

function formatearDocumento(valor) {
    const limpio = normalizarDocumento(valor);
    return limpio ? Number(limpio).toLocaleString("es-CO") : (valor || "—");
}

function formatearCodigo(codigo) {
    const texto = String(codigo || "");
    if (texto.includes("-")) return texto;
    if (texto.length <= 4) return texto;
    return texto.slice(0, 4) + "-" + texto.slice(4);
}

function formatearFechaHora(f) {
    if (!f) return "—";
    return new Date(f).toLocaleString("es-CO", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

let consultasCompletas = [];
let nombresPorDocumento = {};

document.addEventListener("DOMContentLoaded", async () => {
    const sesion = await requerirSesion();
    if (!sesion) return;

    document.getElementById("nombreUsuario").textContent =
        `${sesion.perfil.nombres} ${sesion.perfil.apellidos}`;
    document.getElementById("btnSalir").addEventListener("click", cerrarSesion);

    await cargarDatos();
    aplicarFiltros();

    ["buscarTexto", "filtroDesde", "filtroHasta"]
        .forEach((id) => document.getElementById(id).addEventListener("input", aplicarFiltros));

    document.getElementById("btnLimpiarFiltros").addEventListener("click", () => {
        document.getElementById("buscarTexto").value = "";
        document.getElementById("filtroDesde").value = "";
        document.getElementById("filtroHasta").value = "";
        aplicarFiltros();
    });
});

async function traerTodasLasFilas(cliente, tabla, columnas, ordenarPor, ascendente) {
    const TAMANO_PAGINA = 1000;
    let desde = 0;
    let todas = [];
    while (true) {
        const { data, error } = await cliente
            .from(tabla)
            .select(columnas)
            .order(ordenarPor || "id", { ascending: ascendente !== false })
            .range(desde, desde + TAMANO_PAGINA - 1);
        if (error) return { data: null, error };
        todas = todas.concat(data || []);
        if (!data || data.length < TAMANO_PAGINA) break;
        desde += TAMANO_PAGINA;
    }
    return { data: todas, error: null };
}

async function cargarDatos() {
    const [afiliadosRes, consultasRes] = await Promise.all([
        traerTodasLasFilas(clienteAuth, "Afiliados", "Documento, Nombre"),
        traerTodasLasFilas(clienteAuth, "Consultas_Portal", "*", "Fecha_Consulta", false)
    ]);

    if (consultasRes.error) {
        document.getElementById("tablaConsultasBody").innerHTML =
            `<tr><td colspan="4">No se pudieron cargar las consultas: ${consultasRes.error.message}</td></tr>`;
        return;
    }

    if (!afiliadosRes.error) {
        (afiliadosRes.data || []).forEach((a) => {
            nombresPorDocumento[normalizarDocumento(a.Documento)] = a.Nombre;
        });
    }

    consultasCompletas = consultasRes.data || [];
}

function aplicarFiltros() {
    const texto = document.getElementById("buscarTexto").value.trim().toLowerCase();
    const desde = document.getElementById("filtroDesde").value;
    const hasta = document.getElementById("filtroHasta").value;

    const filtradas = consultasCompletas.filter((c) => {
        const nombre = (nombresPorDocumento[normalizarDocumento(c.Documento)] || "").toLowerCase();
        const documento = String(c.Documento || "").toLowerCase();

        if (texto && !nombre.includes(texto) && !documento.includes(texto)) return false;

        const fecha = (c.Fecha_Consulta || "").slice(0, 10);
        if (desde && fecha < desde) return false;
        if (hasta && fecha > hasta) return false;
        return true;
    });

    document.getElementById("resumenFiltros").textContent = `${filtradas.length} consultas encontradas.`;

    const cuerpo = document.getElementById("tablaConsultasBody");

    if (!filtradas.length) {
        cuerpo.innerHTML = `<tr><td colspan="4">No hay consultas con estos filtros.</td></tr>`;
        return;
    }

    cuerpo.innerHTML = filtradas.map((c) => `
        <tr>
            <td>${formatearFechaHora(c.Fecha_Consulta)}</td>
            <td>${nombresPorDocumento[normalizarDocumento(c.Documento)] || "—"}</td>
            <td>${formatearDocumento(c.Documento)}</td>
            <td>${formatearCodigo(c.Codigo_Credito)}</td>
        </tr>
    `).join("");
}
