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

    await Promise.all([cargarDatos(), cargarFechaActualizacion()]);
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

    document.getElementById("btnCopiarCredito").addEventListener("click", copiarDatosDelCredito);
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

/* ==================================================================
   Copiar datos del crédito
   ------------------------------------------------------------------
   Mismo texto que el botón "Copiar datos del crédito" de la consulta
   interna del portal público (script.js > construirResumenCopiable).
   La nota de "meses de gracia y/o pagos parciales" se calcula con la
   MISMA lógica del cronograma del portal (construirTablaAmortizacion),
   sin armar la tabla. Si cambias esa lógica en el portal público,
   cámbiala también aquí (calcularMesesGraciaYParciales).
   ================================================================== */

const TEXTO_BOTON_COPIAR = "📋 Copiar datos del crédito";
let ultimaActualizacionReal = null;   // texto tal como viene de Configuracion
let textoResumenActual = "";
let temporizadorCopiado = null;

// Fecha de "última actualización" del portal (la usa el cronograma para
// saber qué cuotas ya vencieron). Es la misma que lee el portal público.
async function cargarFechaActualizacion() {
    try {
        const { data, error } = await clienteAuth
            .from("Configuracion")
            .select("Ultima_Actualizacion")
            .eq("id", 1)
            .maybeSingle();

        if (error) throw error;
        if (!data || !data.Ultima_Actualizacion) throw new Error("Configuracion sin fecha");

        ultimaActualizacionReal = data.Ultima_Actualizacion;
    } catch (error) {
        console.error("No se pudo leer la fecha de última actualización:", error);
        ultimaActualizacionReal = null;
    }
}

function mismoMes(fecha1, fecha2) {
    return fecha1.getMonth() === fecha2.getMonth()
        && fecha1.getFullYear() === fecha2.getFullYear();
}

function formatearMesesResumen(valor) {
    return Number.isInteger(valor) ? String(valor) : valor.toFixed(1).replace(".", ",");
}

function codigoParaResumen(codigo) {
    codigo = String(codigo || "");
    if (codigo.length === 7) {
        return codigo.substring(0, 4) + "-" + codigo.substring(4);
    }
    return codigo;
}

function fechaParaResumen(fecha) {
    if (!fecha) return "";
    const partes = fecha.split("-");
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// Misma cuenta que construirTablaAmortizacion() del portal público:
// devuelve (meses de gracia) + (pagos parciales × 0.5).
function calcularMesesGraciaYParciales(credito, pagos, ultimaActualizacion) {
    const vigente = { ...credito, "Cuota Original": credito.Cuota_Original };

    const fechaActual = new Date(String(ultimaActualizacion).replace(" ", "T"));
    fechaActual.setHours(23, 59, 59, 999);

    const cuotasPactadas = Number(vigente.Cuotas_Pactadas);
    const cuotasPagadas = Number(vigente.Cuotas_Pagadas || 0);
    const fechaInicio = new Date(vigente.Fecha_Inicial);
    const diaPago = vigente.Empresa === "ELG" ? 25 : 30;

    function esPagoParcial(pago) {
        const valorPagado = Number(pago.Valor_Cuota || 0);
        let cuotaEsperada = Number(vigente.Cuota || 0);

        if (vigente.Afiliado === "No" && Number(vigente["Cuota Original"] || 0) > 0) {
            const cuotaOriginal = Number(vigente["Cuota Original"]);
            const cuotaActual = Number(vigente.Cuota);
            const diferenciaOriginal = Math.abs(valorPagado - cuotaOriginal);
            const diferenciaActual = Math.abs(valorPagado - cuotaActual);
            cuotaEsperada = diferenciaOriginal <= diferenciaActual ? cuotaOriginal : cuotaActual;
        }

        return valorPagado < cuotaEsperada;
    }

    const totalParciales = pagos.filter(esPagoParcial).length;
    let cuotasExtra = Math.ceil(totalParciales / 2);
    let mesesGraciaCompleta = 0;
    let mesesPagoParcial = 0;
    let numeroCuota = 1;
    let finalizarCronograma = false;
    const creditoAnulado = String(vigente.Estado || "").toLowerCase().includes("anulado");

    while (
        numeroCuota <= cuotasPactadas + cuotasExtra
        && !(creditoAnulado && numeroCuota > pagos.length)
        && !finalizarCronograma
    ) {
        let detenerDespuesDeEstaFila = false;

        const mesObjetivo = fechaInicio.getMonth() + (numeroCuota - 1);
        const fechaCuota = new Date(fechaInicio.getFullYear(), mesObjetivo, 1);
        const ultimoDiaDelMes = new Date(fechaCuota.getFullYear(), fechaCuota.getMonth() + 1, 0).getDate();
        fechaCuota.setDate(Math.min(diaPago, ultimoDiaDelMes));

        const pago = pagos.find(p => mismoMes(new Date(p.Fecha), fechaCuota));

        if (pago) {
            if (esPagoParcial(pago)) {
                mesesPagoParcial++;
            }

            if (pago.Saldo_Final !== null && pago.Saldo_Final !== "" && Number(pago.Saldo_Final) === 0) {
                detenerDespuesDeEstaFila = true;
            }
        } else {
            const yaPaso = fechaCuota.getTime() <= fechaActual.getTime();

            if (yaPaso && numeroCuota <= cuotasPagadas + cuotasExtra + 1) {
                cuotasExtra++;
                mesesGraciaCompleta++;
            }
        }

        if (detenerDespuesDeEstaFila) {
            finalizarCronograma = true;
        }

        numeroCuota++;
    }

    return mesesGraciaCompleta + mesesPagoParcial * 0.5;
}

function construirResumenCopiable(credito, mesesGraciaYParciales) {
    const documento = normalizarDocumento(credito.Documento);
    const documentoFormateado = Number.isFinite(Number(documento))
        ? Number(documento).toLocaleString("es-CO")
        : documento;

    const nombre = nombresPorDocumento[documento] || "";

    const lineas = [
        `Nombre: ${nombre}`,
        `Documento: ${documentoFormateado}`,
        `Código de crédito: ${codigoParaResumen(credito.Codigo_Credito)}`,
        `Estado: ${credito.Estado || ""}`,
        `Valor del crédito: ${formatearMoneda(credito.Valor_Credito)}`,
        `Saldo pendiente: ${formatearMoneda(credito.Saldo_Capital)}`,
        `Capital pagado: ${formatearMoneda(credito.Capital_Pagado)}`,
        `Cuotas: ${credito.Cuotas_Pagadas || 0} de ${credito.Cuotas_Pactadas || 0}`,
        `Fecha inicial: ${fechaParaResumen(credito.Fecha_Inicial)}`,
        `Fecha final: ${fechaParaResumen(credito.Fecha_Final)}`,
        `Próximo pago: ${fechaParaResumen(credito.Proximo_Pago)}`
    ];

    if (mesesGraciaYParciales > 0) {
        lineas.push(
            `Nota: Este crédito registra ${formatearMesesResumen(mesesGraciaYParciales)} mes(es) de gracia y/o pagos parciales, situación que generó una ampliación del plazo inicialmente pactado.`
        );
    }

    return lineas.join("\n");
}

function prepararBotonCopiar(credito) {
    const boton = document.getElementById("btnCopiarCredito");

    clearTimeout(temporizadorCopiado);
    boton.textContent = TEXTO_BOTON_COPIAR;

    if (!ultimaActualizacionReal) {
        textoResumenActual = "";
        boton.disabled = true;
        boton.title = "No se pudo leer la fecha de última actualización (tabla Configuracion).";
        return;
    }

    // Mismo orden que usa el portal público: por número de cuota
    const pagosParaCalculo = pagosCompletos
        .filter((p) => p.Codigo_Credito === credito.Codigo_Credito)
        .sort((a, b) => Number(a.Numero_cuota) - Number(b.Numero_cuota));

    const meses = calcularMesesGraciaYParciales(credito, pagosParaCalculo, ultimaActualizacionReal);

    textoResumenActual = construirResumenCopiable(credito, meses);
    boton.disabled = false;
    boton.title = "";
}

async function copiarDatosDelCredito() {
    const boton = document.getElementById("btnCopiarCredito");
    if (!textoResumenActual) return;

    let copiado = false;

    try {
        await navigator.clipboard.writeText(textoResumenActual);
        copiado = true;
    } catch {
        // Respaldo para navegadores o conexiones sin permiso de portapapeles
        const area = document.createElement("textarea");
        area.value = textoResumenActual;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        try { copiado = document.execCommand("copy"); } catch { copiado = false; }
        area.remove();
    }

    boton.textContent = copiado ? "✅ Copiado" : "No se pudo copiar";

    clearTimeout(temporizadorCopiado);
    temporizadorCopiado = setTimeout(() => {
        boton.textContent = TEXTO_BOTON_COPIAR;
    }, 2000);
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
    document.getElementById("detFechaFinal").textContent = formatearFecha(credito.Fecha_Final);
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

    prepararBotonCopiar(credito);

    document.getElementById("modalDetalle").style.display = "flex";
}
