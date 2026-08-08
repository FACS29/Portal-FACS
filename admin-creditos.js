/*
  admin-creditos.js
  ===================
  Busca créditos por nombre (cruzando con Afiliados) o documento,
  con filtros de empresa/estado/año. Al hacer clic en una fila,
  muestra el detalle completo + los pagos reales registrados.
  Todo lectura, con la clave publicable.
*/

const formateadorCOP = new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0
});
function formatearMoneda(v) { return formateadorCOP.format(v || 0); }
function formatearFecha(f) {
    if (!f) return "—";
    const [a, m, d] = f.split("-");
    return `${d}/${m}/${a}`;
}

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

let creditosCompletos = [];
let nombresPorDocumento = {};
let pagosCompletos = [];

document.addEventListener("DOMContentLoaded", async () => {
    const sesion = await requerirSesion();
    if (!sesion) return;

    document.getElementById("nombreUsuario").textContent =
        `${sesion.perfil.nombres} ${sesion.perfil.apellidos}`;
    document.getElementById("btnSalir").addEventListener("click", cerrarSesion);

    await cargarDatos();
    aplicarFiltros();

    ["buscarTexto", "filtroEmpresa", "filtroEstado", "filtroAnio"]
        .forEach((id) => document.getElementById(id).addEventListener("input", aplicarFiltros));

    document.getElementById("btnLimpiarFiltros").addEventListener("click", () => {
        document.getElementById("buscarTexto").value = "";
        document.getElementById("filtroEmpresa").value = "todas";
        document.getElementById("filtroEstado").value = "todos";
        document.getElementById("filtroAnio").value = "";
        aplicarFiltros();
    });

    document.getElementById("btnCerrarDetalle").addEventListener("click", () => {
        document.getElementById("modalDetalle").style.display = "none";
    });
});

function normalizarDocumento(valor) {
    // Quita puntos, espacios y cualquier caracter que no sea dígito,
    // para que "4.720.247" (texto) y 4720247 (número) se traten igual.
    return String(valor ?? "").replace(/[^0-9]/g, "");
}

async function traerTodasLasFilas(cliente, tabla, columnas) {
    const TAMANO_PAGINA = 1000;
    let desde = 0;
    let todas = [];
    while (true) {
        const { data, error } = await cliente
            .from(tabla)
            .select(columnas)
            .order("id", { ascending: true })
            .range(desde, desde + TAMANO_PAGINA - 1);
        if (error) return { data: null, error };
        todas = todas.concat(data || []);
        if (!data || data.length < TAMANO_PAGINA) break;
        desde += TAMANO_PAGINA;
    }
    return { data: todas, error: null };
}

async function cargarDatos() {
    const clienteAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const [afiliadosRes, creditosRes, pagosRes] = await Promise.all([
        traerTodasLasFilas(clienteAuth, "Afiliados", "Documento, Nombre"),
        traerTodasLasFilas(clienteAuth, "Creditos", "*"),
        traerTodasLasFilas(clienteAuth, "Pagos", "*")
    ]);

    if (afiliadosRes.error || creditosRes.error || pagosRes.error) {
        document.getElementById("tablaCreditosBody").innerHTML =
            `<tr><td colspan="7">No se pudieron cargar los créditos: ` +
            `${afiliadosRes.error?.message || creditosRes.error?.message || pagosRes.error?.message}</td></tr>`;
        return;
    }

    (afiliadosRes.data || []).forEach((a) => {
        nombresPorDocumento[normalizarDocumento(a.Documento)] = a.Nombre;
    });
    creditosCompletos = creditosRes.data || [];
    pagosCompletos = pagosRes.data || [];
}

function aplicarFiltros() {
    const texto = document.getElementById("buscarTexto").value.trim().toLowerCase();
    const empresa = document.getElementById("filtroEmpresa").value;
    const estado = document.getElementById("filtroEstado").value;
    const anio = document.getElementById("filtroAnio").value;

    const filtrados = creditosCompletos.filter((c) => {
        const nombre = (nombresPorDocumento[normalizarDocumento(c.Documento)] || "").toLowerCase();
        const documento = String(c.Documento || "").toLowerCase();

        if (texto && !nombre.includes(texto) && !documento.includes(texto)) return false;
        if (empresa !== "todas" && c.Empresa !== empresa) return false;
        if (estado !== "todos" && c.Estado !== estado) return false;
        // El año se toma de Fecha_Credito (fecha real de creación del
        // crédito, ya exportada) -- ya no hace falta aproximar con
        // el código ni con la fecha de la primera cuota.
        if (anio && (!c.Fecha_Credito || !c.Fecha_Credito.startsWith(anio))) return false;
        return true;
    });

    document.getElementById("resumenFiltros").textContent = `${filtrados.length} créditos encontrados.`;

    const cuerpo = document.getElementById("tablaCreditosBody");

    if (!filtrados.length) {
        cuerpo.innerHTML = `<tr><td colspan="7">No hay créditos con estos filtros.</td></tr>`;
        return;
    }

    cuerpo.innerHTML = filtrados.map((c) => `
        <tr data-codigo="${c.Codigo_Credito}">
            <td>${formatearCodigo(c.Codigo_Credito)}</td>
            <td>${nombresPorDocumento[normalizarDocumento(c.Documento)] || "—"}</td>
            <td>${formatearDocumento(c.Documento)}</td>
            <td>${c.Empresa || "—"}</td>
            <td>${c.Estado || "—"}</td>
            <td>${formatearMoneda(c.Valor_Credito)}</td>
            <td>${formatearMoneda(c.Saldo_Capital)}</td>
        </tr>
    `).join("");

    cuerpo.querySelectorAll("tr[data-codigo]").forEach((fila) => {
        fila.addEventListener("click", () => mostrarDetalle(fila.dataset.codigo));
    });
}

function mostrarDetalle(codigo) {
    const credito = creditosCompletos.find((c) => c.Codigo_Credito === codigo);
    if (!credito) return;

    const nombre = nombresPorDocumento[normalizarDocumento(credito.Documento)] || "Nombre no encontrado en Afiliados";

    document.getElementById("detalleNombre").textContent = nombre;
    document.getElementById("detalleSubtitulo").textContent =
        `${formatearCodigo(credito.Codigo_Credito)} · Documento ${formatearDocumento(credito.Documento)}`;

    document.getElementById("detEmpresa").textContent = credito.Empresa || "—";
    document.getElementById("detEstado").textContent = credito.Estado || "—";
    document.getElementById("detFechaCredito").textContent = formatearFecha(credito.Fecha_Credito);
    document.getElementById("detFechaInicial").textContent = formatearFecha(credito.Fecha_Inicial);
    document.getElementById("detValorCredito").textContent = formatearMoneda(credito.Valor_Credito);
    document.getElementById("detVrReal").textContent = formatearMoneda(credito.Vr_Real);
    document.getElementById("detSaldo").textContent = formatearMoneda(credito.Saldo_Capital);
    document.getElementById("detCuota").textContent = formatearMoneda(credito.Cuota);

    const pactadas = Number(credito.Cuotas_Pactadas || 0);
    const pagadas = Number(credito.Cuotas_Pagadas || 0);
    document.getElementById("detCuotas").textContent = `${pagadas} / ${pactadas}`;
    document.getElementById("detCuotasPendientes").textContent =
        Math.max(pactadas - pagadas, 0) + " (estimado, no es un calendario)";

    document.getElementById("detCapitalPagado").textContent = formatearMoneda(credito.Capital_Pagado);
    document.getElementById("detInteresPagado").textContent = formatearMoneda(credito.Interes_Pagado);
    document.getElementById("detRepresteo").textContent = credito.Represteo || "No";

    const pagosDelCredito = pagosCompletos
        .filter((p) => p.Codigo_Credito === codigo)
        .sort((a, b) => new Date(a.Fecha) - new Date(b.Fecha));

    const cuerpoPagos = document.getElementById("tablaPagosBody");
    if (!pagosDelCredito.length) {
        cuerpoPagos.innerHTML = `<tr><td colspan="5">Sin pagos registrados todavía.</td></tr>`;
    } else {
        cuerpoPagos.innerHTML = pagosDelCredito.map((p) => `
            <tr>
                <td>${formatearFecha(p.Fecha)}</td>
                <td>${p.Numero_cuota ?? "—"}</td>
                <td>${formatearMoneda(p.Capital_Pagado)}</td>
                <td>${formatearMoneda(p.Interes_Pagado)}</td>
                <td>${formatearMoneda(p.Saldo_Final)}</td>
            </tr>
        `).join("");
    }

    document.getElementById("modalDetalle").style.display = "flex";
}
