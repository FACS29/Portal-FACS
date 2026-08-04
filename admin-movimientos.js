/*
  admin-movimientos.js
  ======================
  Une Capital_Semilla (Aportes), Creditos (Desembolsos, con Vr_Real),
  Pagos (Pagos recibidos) y Creditos_Anulados (Devolución al deudor +
  Retorno del crédito) en una sola lista cronológica, filtrable y
  agrupable. Todo lectura, con la clave publicable.

  IMPORTANTE: las fechas de las distintas tablas pueden venir con
  formato distinto (algunas como "2024-01-15", otras como
  "2024-01-15T00:00:00+00:00" si la columna es timestamptz en vez de
  date). Sin normalizar, un mismo día se partía en varias "fechas"
  distintas al agrupar, y las fechas se mostraban mal. Por eso TODA
  fecha pasa por normalizarFecha() apenas se lee.
*/

const formateadorCOP = new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0
});
function formatearMoneda(v) { return formateadorCOP.format(v || 0); }

function normalizarFecha(valor) {
    if (!valor) return null;
    return String(valor).slice(0, 10); // siempre "YYYY-MM-DD", sin hora/zona
}

function formatearFecha(f) {
    if (!f) return "—";
    const [a, m, d] = f.split("-");
    return `${d}/${m}/${a}`;
}

function formatearCodigo(codigo) {
    const texto = String(codigo || "");
    if (texto.includes("-")) return texto;
    if (texto.length <= 4) return texto;
    return texto.slice(0, 4) + "-" + texto.slice(4);
}

let movimientosCompletos = [];

document.addEventListener("DOMContentLoaded", async () => {
    const sesion = await requerirSesion();
    if (!sesion) return;

    document.getElementById("nombreUsuario").textContent =
        `${sesion.perfil.nombres} ${sesion.perfil.apellidos}`;
    document.getElementById("btnSalir").addEventListener("click", cerrarSesion);

    const cargaExitosa = await cargarMovimientos();
    if (cargaExitosa) aplicarFiltros();

    ["filtroTipo", "filtroEmpresa", "filtroDesde", "filtroHasta", "filtroOrden", "filtroAgrupar"]
        .forEach((id) => document.getElementById(id).addEventListener("change", aplicarFiltros));

    document.getElementById("btnLimpiarFiltros").addEventListener("click", () => {
        document.getElementById("filtroTipo").value = "todos";
        document.getElementById("filtroEmpresa").value = "todas";
        document.getElementById("filtroDesde").value = "";
        document.getElementById("filtroHasta").value = "";
        document.getElementById("filtroOrden").value = "desc";
        document.getElementById("filtroAgrupar").value = "ninguno";
        aplicarFiltros();
    });

    document.getElementById("btnCerrarGrupo").addEventListener("click", () => {
        document.getElementById("modalGrupo").style.display = "none";
    });
});

async function cargarMovimientos() {
    const clienteAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const [capitalRes, creditosRes, pagosRes, anuladosRes] = await Promise.all([
        clienteAuth.from("Capital_Semilla").select("fecha, empresa, valor"),
        clienteAuth.from("Creditos").select("Codigo_Credito, Empresa, Vr_Real, Fecha_Credito"),
        clienteAuth.from("Pagos").select("Codigo_Credito, Capital_Pagado, Interes_Pagado, Fecha"),
        clienteAuth.from("Creditos_Anulados").select(
            `"Fecha", "Codigo_Credito", "Empresa", "Valor_Credito", "Capital_Devuelto", "Interes_Devuelto"`
        )
    ]);

    if (capitalRes.error || creditosRes.error || pagosRes.error) {
        document.getElementById("tablaMovimientosBody").innerHTML =
            `<tr><td colspan="7">No se pudieron cargar los movimientos: ` +
            `${capitalRes.error?.message || creditosRes.error?.message || pagosRes.error?.message}</td></tr>`;
        return false;
    }

    const codigoAEmpresa = {};
    (creditosRes.data || []).forEach((c) => { codigoAEmpresa[c.Codigo_Credito] = c.Empresa; });

    const aportes = (capitalRes.data || []).map((f) => ({
        fecha: normalizarFecha(f.fecha), tipo: "Aporte", empresa: f.empresa,
        referencia: "Capital Semilla", valor: Number(f.valor || 0)
    }));

    const desembolsos = (creditosRes.data || []).map((c) => ({
        fecha: normalizarFecha(c.Fecha_Credito), tipo: "Desembolso", empresa: c.Empresa,
        referencia: formatearCodigo(c.Codigo_Credito), valor: -Number(c.Vr_Real || 0)
    }));

    const pagos = (pagosRes.data || []).map((p) => ({
        fecha: normalizarFecha(p.Fecha), tipo: "Pago", empresa: codigoAEmpresa[p.Codigo_Credito] || "—",
        referencia: formatearCodigo(p.Codigo_Credito),
        valor: Number(p.Capital_Pagado || 0) + Number(p.Interes_Pagado || 0)
    }));

    movimientosCompletos = [...aportes, ...desembolsos, ...pagos].filter((m) => m.fecha);

    if (anuladosRes.error) {
        console.error("Creditos_Anulados:", anuladosRes.error.message);
        document.getElementById("resumenFiltros").textContent =
            "Aviso: no se pudieron cargar los movimientos de créditos anulados. Detalle: " +
            anuladosRes.error.message;
    } else {
        const devoluciones = (anuladosRes.data || []).map((a) => ({
            fecha: normalizarFecha(a["Fecha"]), tipo: "Devolución", empresa: a["Empresa"],
            referencia: formatearCodigo(a["Codigo_Credito"]),
            valor: -(Number(a["Capital_Devuelto"] || 0) + Number(a["Interes_Devuelto"] || 0))
        }));
        const retornos = (anuladosRes.data || []).map((a) => ({
            fecha: normalizarFecha(a["Fecha"]), tipo: "Retorno", empresa: a["Empresa"],
            referencia: formatearCodigo(a["Codigo_Credito"]), valor: Number(a["Valor_Credito"] || 0)
        }));
        movimientosCompletos = [...movimientosCompletos, ...devoluciones, ...retornos].filter((m) => m.fecha);
    }

    return true;
}

// Agrupa y GUARDA los movimientos originales de cada grupo (para el
// detalle al hacer clic), en vez de descartarlos.
function agruparMovimientos(lista, modo) {
    if (modo === "ninguno") return lista.map((m) => ({ ...m, original: [m] }));

    const grupos = {};
    lista.forEach((m) => {
        let clave = m.fecha;
        if (modo === "fecha-empresa") clave += "|" + m.empresa;
        if (modo === "fecha-concepto") clave += "|" + m.tipo;

        if (!grupos[clave]) {
            grupos[clave] = {
                fecha: m.fecha,
                tipo: modo === "fecha-concepto" ? m.tipo : "Varios",
                empresa: modo === "fecha-empresa" ? m.empresa : "Varias",
                valor: 0, original: []
            };
        }
        grupos[clave].valor += m.valor;
        grupos[clave].original.push(m);
    });

    return Object.values(grupos).map((g) => ({ ...g, referencia: `${g.original.length} movimiento(s)` }));
}

// Calcula SubTotal (acumulado por empresa) y Total (acumulado general),
// SIEMPRE en orden cronológico ascendente, sin importar el orden que
// se vaya a mostrar en la tabla después.
function calcularAcumulados(lista) {
    const paraCalculo = [...lista].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const subtotalPorEmpresa = {};
    let totalAcumulado = 0;

    paraCalculo.forEach((m) => {
        const claveEmpresa = m.empresa || "Sin dato";
        subtotalPorEmpresa[claveEmpresa] = (subtotalPorEmpresa[claveEmpresa] || 0) + m.valor;
        totalAcumulado += m.valor;
        m.subtotalEmpresa = subtotalPorEmpresa[claveEmpresa];
        m.totalGeneral = totalAcumulado;
    });

    return lista; // mismos objetos, ya con subtotalEmpresa/totalGeneral asignados
}

function aplicarFiltros() {
    const tipo = document.getElementById("filtroTipo").value;
    const empresa = document.getElementById("filtroEmpresa").value;
    const desde = document.getElementById("filtroDesde").value;
    const hasta = document.getElementById("filtroHasta").value;
    const orden = document.getElementById("filtroOrden").value;
    const agrupar = document.getElementById("filtroAgrupar").value;

    let filtrados = movimientosCompletos.filter((m) => {
        if (tipo !== "todos" && m.tipo !== tipo) return false;
        if (empresa !== "todas" && m.empresa !== empresa) return false;
        if (desde && m.fecha < desde) return false;
        if (hasta && m.fecha > hasta) return false;
        return true;
    });

    filtrados = agruparMovimientos(filtrados, agrupar);
    filtrados = calcularAcumulados(filtrados);

    filtrados.sort((a, b) => orden === "asc"
        ? new Date(a.fecha) - new Date(b.fecha)
        : new Date(b.fecha) - new Date(a.fecha));

    document.getElementById("resumenFiltros").textContent =
        agrupar === "ninguno"
            ? `${filtrados.length} movimientos encontrados.`
            : `${filtrados.length} filas agrupadas.`;

    const cuerpo = document.getElementById("tablaMovimientosBody");

    if (!filtrados.length) {
        cuerpo.innerHTML = `<tr><td colspan="7">No hay movimientos con estos filtros.</td></tr>`;
        return;
    }

    cuerpo.innerHTML = filtrados.map((m, indice) => `
        <tr data-indice="${indice}" ${agrupar !== "ninguno" ? 'class="fila-clicable"' : ""}>
            <td>${formatearFecha(m.fecha)}</td>
            <td><span class="etiqueta-tipo etiqueta-${m.tipo}">${m.tipo}</span></td>
            <td>${m.empresa}</td>
            <td>${m.referencia}</td>
            <td class="valor">${m.valor < 0 ? "− " : ""}${formatearMoneda(Math.abs(m.valor))}</td>
            <td class="valor">${formatearMoneda(m.subtotalEmpresa)}</td>
            <td class="valor">${formatearMoneda(m.totalGeneral)}</td>
        </tr>
    `).join("");

    if (agrupar !== "ninguno") {
        cuerpo.querySelectorAll("tr[data-indice]").forEach((fila) => {
            fila.addEventListener("click", () => mostrarGrupo(filtrados[Number(fila.dataset.indice)]));
        });
    }
}

function mostrarGrupo(grupo) {
    document.getElementById("grupoSubtitulo").textContent =
        `${formatearFecha(grupo.fecha)} · ${grupo.original.length} movimiento(s) · Neto: ${formatearMoneda(grupo.valor)}`;

    document.getElementById("tablaGrupoBody").innerHTML = grupo.original.map((m) => `
        <tr>
            <td>${formatearFecha(m.fecha)}</td>
            <td><span class="etiqueta-tipo etiqueta-${m.tipo}">${m.tipo}</span></td>
            <td>${m.empresa}</td>
            <td>${m.referencia}</td>
            <td>${m.valor < 0 ? "− " : ""}${formatearMoneda(Math.abs(m.valor))}</td>
        </tr>
    `).join("");

    document.getElementById("modalGrupo").style.display = "flex";
}
