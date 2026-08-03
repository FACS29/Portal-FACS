/*
  admin-dashboard.js
  ===================
  Modelo financiero (confirmado con el usuario, ambas fórmulas
  coinciden en su Excel):

  Total desembolsado   = suma de Creditos.Vr_Real (lo que realmente
                          salió del Fondo, ya contempla represtamos).
  Capital recuperado   = suma de Pagos.Capital_Pagado (TODOS los pagos,
                          incluidos los de créditos hoy anulados) MENOS
                          Creditos_Anulados.Capital_Devuelto (lo que se
                          le devolvió al deudor al anular).
  Intereses generados  = mismo criterio, con Interes_Pagado /
                          Interes_Devuelto.
  Dinero prestado (hoy) = suma de Saldo_Capital de créditos
                          "Crédito Vigente" únicamente (los anulados
                          nunca cuentan aquí).
  Capital disponible    = Capital Semilla + Intereses generados −
                          Dinero prestado (hoy).
    (el valor de un crédito anulado no se resta aparte: su efecto neto
    ya es cero, porque el capital/interés devuelto ya se restó de lo
    recuperado, y el valor del crédito no cuenta como prestado por no
    ser "Crédito Vigente")

  Si alguna consulta a Creditos_Anulados falla, revisa que los nombres
  de columna coincidan exactamente con los de tu tabla en Supabase --
  se usaron los nombres tal como los describiste: Fecha, Código,
  Empresa, Valor_crédito, Cápital_Devuelto, Interés_Devuelto.
*/

const formateadorCOP = new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0
});
function formatearMoneda(v) { return formateadorCOP.format(v || 0); }

function formatearDocumento(valor) {
    const limpio = String(valor ?? "").replace(/[^0-9]/g, "");
    return limpio ? Number(limpio).toLocaleString("es-CO") : (valor || "—");
}

// Igual que en Movimientos: algunas columnas de fecha pueden venir
// con hora/zona horaria pegada (timestamptz en vez de date), lo que
// rompe el agrupado por fecha si no se recorta a "YYYY-MM-DD".
function normalizarFecha(valor) {
    if (!valor) return null;
    return String(valor).slice(0, 10);
}

function formatearFechaCorta(fechaISO) {
    const [anio, mes] = fechaISO.split("-");
    const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    return `${meses[parseInt(mes, 10) - 1]} ${anio}`;
}

function formatearFecha(f) {
    if (!f) return "—";
    const [a, m, d] = f.split("-");
    return `${d}/${m}/${a}`;
}

function generarLeyendaConPorcentaje(chart) {
    const data = chart.data;
    const valores = data.datasets[0].data;
    const total = valores.reduce((s, v) => s + Number(v || 0), 0);

    return data.labels.map((label, i) => {
        const porcentaje = total ? ((Number(valores[i] || 0) / total) * 100).toFixed(0) : 0;
        return {
            text: `${label} (${porcentaje}%)`,
            fillStyle: data.datasets[0].backgroundColor[i],
            strokeStyle: data.datasets[0].backgroundColor[i],
            hidden: false,
            index: i
        };
    });
}

function formatearCuotas(pagadas, pactadas) {
    const formatearParte = (valor) => {
        const n = Number(valor || 0);
        return Number.isInteger(n) ? String(n).padStart(2, "0") : n.toFixed(1).replace(".", ",");
    };
    return `${formatearParte(pagadas)}/${formatearParte(pactadas)}`;
}

const PALETA_EMPRESAS = { ELG: "#006633", HLG: "#C99B3F", HSL: "#5B6B62" };
const ESTADO_VIGENTE = "Crédito Vigente";
const ESTADO_ANULADO = "Crédito Anulado";
const ESTADO_PAZ_SALVO = "Paz y Salvo";
const PALETA_ESTADOS = {
    [ESTADO_VIGENTE]: "#006633", [ESTADO_PAZ_SALVO]: "#C99B3F", [ESTADO_ANULADO]: "#B03A2E"
};

const graficasActivas = {};
function crearOActualizarGrafica(idCanvas, config) {
    if (graficasActivas[idCanvas]) graficasActivas[idCanvas].destroy();
    graficasActivas[idCanvas] = new Chart(document.getElementById(idCanvas), config);
}

let datosCompletos = null;

document.addEventListener("DOMContentLoaded", async () => {
    const sesion = await requerirSesion();
    if (!sesion) return;

    document.getElementById("nombreUsuario").textContent =
        `${sesion.perfil.nombres} ${sesion.perfil.apellidos}`;
    document.getElementById("btnSalir").addEventListener("click", cerrarSesion);

    await cargarDatos();
    recalcularYRenderizar("todo");

    document.getElementById("selectorPeriodo").addEventListener("change", (evento) => {
        recalcularYRenderizar(evento.target.value);
    });
});

function animarCifra(elemento, valorFinal, formatear) {
    const duracionMs = 900;
    const inicio = performance.now();
    function paso(ahora) {
        const progreso = Math.min((ahora - inicio) / duracionMs, 1);
        elemento.textContent = formatear(valorFinal * (1 - Math.pow(1 - progreso, 3)));
        if (progreso < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
}

function sumarPorEmpresa(lista, campoEmpresa, campoValor) {
    const resultado = {};
    lista.forEach((fila) => {
        const empresa = fila[campoEmpresa] || "Sin dato";
        const valor = campoValor ? Number(fila[campoValor] || 0) : 1;
        resultado[empresa] = (resultado[empresa] || 0) + valor;
    });
    return resultado;
}

function restarPorEmpresa(base, aRestar) {
    const resultado = { ...base };
    Object.keys(aRestar).forEach((e) => { resultado[e] = (resultado[e] || 0) - aRestar[e]; });
    return resultado;
}

function sumarValoresPorEmpresa(base, aSumar) {
    const resultado = { ...base };
    Object.keys(aSumar).forEach((e) => { resultado[e] = (resultado[e] || 0) + aSumar[e]; });
    return resultado;
}

function pintarDesglose(idContenedor, datosPorEmpresa, formatear, comoTexto = false) {
    const contenedor = document.getElementById(idContenedor);
    if (!contenedor) return;
    const empresasEnOrden = ["ELG", "HLG", "HSL", ...Object.keys(datosPorEmpresa)
        .filter((e) => !["ELG", "HLG", "HSL"].includes(e))];

    contenedor.innerHTML = empresasEnOrden
        .filter((e) => datosPorEmpresa[e] !== undefined)
        .map((empresa) => {
            const valor = formatear(datosPorEmpresa[empresa] || 0);
            const color = PALETA_EMPRESAS[empresa] || "#999";
            if (comoTexto) return `<div class="item-desglose"><b>${valor}</b>${empresa}</div>`;
            return `<div class="fila-desglose">
                <span class="etiqueta-empresa">
                    <span class="punto-empresa" style="background:${color}"></span>${empresa}
                </span>
                <span>${valor}</span>
            </div>`;
        }).join("");
}

function filtrarPorPeriodo(lista, campoFecha, periodo) {
    if (periodo === "todo") return lista;
    const ahora = new Date();
    return lista.filter((fila) => {
        if (!fila[campoFecha]) return false;
        const fecha = new Date(fila[campoFecha]);
        if (periodo === "anio") return fecha.getFullYear() === ahora.getFullYear();
        if (periodo === "mes") return fecha.getFullYear() === ahora.getFullYear() && fecha.getMonth() === ahora.getMonth();
        return true;
    });
}

async function cargarDatos() {
    const clienteAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const [capitalRes, creditosRes, pagosRes, afiliadosRes] = await Promise.all([
        clienteAuth.from("Capital_Semilla").select("fecha, empresa, valor").order("fecha"),
        clienteAuth.from("Creditos").select(
            "Codigo_Credito, Documento, Empresa, Vr_Real, Valor_Credito, " +
            "Saldo_Capital, Capital_Pagado, Cuotas_Pactadas, Cuotas_Pagadas, " +
            "Estado, Fecha_Credito, Fecha_Inicial, Fecha_Final"
        ),
        clienteAuth.from("Pagos").select("Codigo_Credito, Capital_Pagado, Interes_Pagado, Fecha"),
        clienteAuth.from("Afiliados").select("Documento, Nombre, Afiliado, Fecha_Retiro_Sind")
    ]);

    if (capitalRes.error || creditosRes.error || pagosRes.error) {
        document.getElementById("cargando").textContent =
            "No se pudieron cargar los datos: " +
            (capitalRes.error?.message || creditosRes.error?.message || pagosRes.error?.message);
        throw new Error("fallo carga");
    }

    // Creditos_Anulados aparte: si falla, el resto del dashboard igual
    // se muestra (con los créditos anulados en cero), y se avisa.
    const anuladosRes = await clienteAuth.from("Creditos_Anulados").select(
        `"Fecha", "Codigo_Credito", "Empresa", "Valor_Credito", "Capital_Devuelto", "Interes_Devuelto"`
    );

    let anuladosDatos = [];
    if (anuladosRes.error) {
        console.error("Creditos_Anulados:", anuladosRes.error.message);
        const aviso = document.getElementById("avisoAnulados");
        aviso.textContent =
            "Aviso: no se pudo leer Creditos_Anulados (revisa los nombres de columna) -- " +
            "el resto del dashboard se muestra igual. Detalle: " + anuladosRes.error.message;
        aviso.style.display = "block";
    } else {
        anuladosDatos = anuladosRes.data || [];
    }

    let afiliadosDatos = [];
    if (afiliadosRes.error) {
        console.error("Afiliados:", afiliadosRes.error.message);
    } else {
        afiliadosDatos = afiliadosRes.data || [];
    }

    datosCompletos = {
        capital: (capitalRes.data || []).map((f) => ({ ...f, fecha: normalizarFecha(f.fecha) })),
        creditos: (creditosRes.data || []).map((c) => ({
            ...c,
            Fecha_Credito: normalizarFecha(c.Fecha_Credito),
            Fecha_Inicial: normalizarFecha(c.Fecha_Inicial),
            Fecha_Final: normalizarFecha(c.Fecha_Final)
        })),
        pagos: (pagosRes.data || []).map((p) => ({ ...p, Fecha: normalizarFecha(p.Fecha) })),
        afiliados: afiliadosDatos,
        anulados: anuladosDatos.map((a) => ({
            fecha: normalizarFecha(a["Fecha"]), codigo: a["Codigo_Credito"], empresa: a["Empresa"],
            valorCredito: Number(a["Valor_Credito"] || 0),
            capitalDevuelto: Number(a["Capital_Devuelto"] || 0),
            interesDevuelto: Number(a["Interes_Devuelto"] || 0)
        }))
    };
}

function recalcularYRenderizar(periodo) {
    const { capital: capitalTodo, creditos: creditosTodo, pagos: pagosTodo, anulados: anuladosTodo } = datosCompletos;

    const codigoAEmpresa = {};
    creditosTodo.forEach((c) => { codigoAEmpresa[c.Codigo_Credito] = c.Empresa; });

    // ---- "A hoy" (no cambian con el periodo) ----
    const creditosVigentesHoy = creditosTodo.filter((c) => c.Estado === ESTADO_VIGENTE);
    const carteraVigenteHoy = creditosVigentesHoy.reduce((s, c) => s + Number(c.Saldo_Capital || 0), 0);
    const carteraVigentePorEmpresaHoy = sumarPorEmpresa(creditosVigentesHoy, "Empresa", "Saldo_Capital");
    const vigentesPorEmpresaHoy = sumarPorEmpresa(creditosVigentesHoy, "Empresa");
    const capitalTotalHoy = capitalTodo.reduce((s, f) => s + Number(f.valor || 0), 0);
    const capitalPorEmpresaHoy = sumarPorEmpresa(capitalTodo, "empresa", "valor");

    // Intereses/recuperado "a hoy" (histórico completo, para el capital disponible)
    const interesesBrutoTodo = pagosTodo.reduce((s, p) => s + Number(p.Interes_Pagado || 0), 0);
    const interesDevueltoTodo = anuladosTodo.reduce((s, a) => s + a.interesDevuelto, 0);
    const interesesNetoTodo = interesesBrutoTodo - interesDevueltoTodo;

    const disponibleEstimado = capitalTotalHoy + interesesNetoTodo - carteraVigenteHoy;

    const interesDevueltoPorEmpresaTodo = sumarPorEmpresa(anuladosTodo, "empresa", "interesDevuelto");
    const interesesBrutoPorEmpresaTodo = sumarPorEmpresa(
        pagosTodo.map((p) => ({ ...p, Empresa: codigoAEmpresa[p.Codigo_Credito] })), "Empresa", "Interes_Pagado"
    );
    const interesesNetoPorEmpresaTodo = restarPorEmpresa(interesesBrutoPorEmpresaTodo, interesDevueltoPorEmpresaTodo);

    const disponiblePorEmpresa = {};
    ["ELG", "HLG", "HSL"].forEach((e) => {
        disponiblePorEmpresa[e] =
            (capitalPorEmpresaHoy[e] || 0) + (interesesNetoPorEmpresaTodo[e] || 0) - (carteraVigentePorEmpresaHoy[e] || 0);
    });

    // ---- Filtrado por periodo (indicadores de flujo) ----
    const capital = filtrarPorPeriodo(capitalTodo, "fecha", periodo);
    const creditos = filtrarPorPeriodo(creditosTodo, "Fecha_Credito", periodo);
    const pagos = filtrarPorPeriodo(pagosTodo, "Fecha", periodo);
    const anulados = filtrarPorPeriodo(anuladosTodo, "fecha", periodo);

    const creditosPagados = creditos.filter((c) => c.Estado === ESTADO_PAZ_SALVO);
    const creditosAnuladosPeriodo = creditos.filter((c) => c.Estado === ESTADO_ANULADO);

    const capitalTotal = capital.reduce((s, f) => s + Number(f.valor || 0), 0);
    const desembolsado = creditos.reduce((s, c) => s + Number(c.Vr_Real || 0), 0);
    const desembolsadoPorEmpresa = sumarPorEmpresa(creditos, "Empresa", "Vr_Real");

    const recuperadoBruto = pagos.reduce((s, p) => s + Number(p.Capital_Pagado || 0), 0);
    const capitalDevuelto = anulados.reduce((s, a) => s + a.capitalDevuelto, 0);
    const valorCreditoRetornado = anulados.reduce((s, a) => s + a.valorCredito, 0);
    const recuperado = recuperadoBruto - capitalDevuelto + valorCreditoRetornado;

    const interesesBruto = pagos.reduce((s, p) => s + Number(p.Interes_Pagado || 0), 0);
    const interesDevuelto = anulados.reduce((s, a) => s + a.interesDevuelto, 0);
    const intereses = interesesBruto - interesDevuelto;

    const valorPromedio = creditos.length ? desembolsado / creditos.length : 0;

    const pagosConEmpresa = pagos.map((p) => ({ ...p, Empresa: codigoAEmpresa[p.Codigo_Credito] || "Sin dato" }));
    const recuperadoBrutoPorEmpresa = sumarPorEmpresa(pagosConEmpresa, "Empresa", "Capital_Pagado");
    const capitalDevueltoPorEmpresa = sumarPorEmpresa(anulados, "empresa", "capitalDevuelto");
    const valorCreditoPorEmpresa = sumarPorEmpresa(anulados, "empresa", "valorCredito");
    const recuperadoPorEmpresa = restarPorEmpresa(
        sumarValoresPorEmpresa(recuperadoBrutoPorEmpresa, valorCreditoPorEmpresa),
        capitalDevueltoPorEmpresa
    );

    const interesesBrutoPorEmpresa = sumarPorEmpresa(pagosConEmpresa, "Empresa", "Interes_Pagado");
    const interesDevueltoPorEmpresa = sumarPorEmpresa(anulados, "empresa", "interesDevuelto");
    const interesesPorEmpresa = restarPorEmpresa(interesesBrutoPorEmpresa, interesDevueltoPorEmpresa);

    const cantidadPagadosPorEmpresa = sumarPorEmpresa(creditosPagados, "Empresa");
    const cantidadAnuladosPorEmpresa = sumarPorEmpresa(creditosAnuladosPeriodo, "Empresa");

    const totalCreditosPorEmpresa = sumarPorEmpresa(creditos, "Empresa");
    const promedioPorEmpresa = {};
    Object.keys(desembolsadoPorEmpresa).forEach((e) => {
        promedioPorEmpresa[e] = totalCreditosPorEmpresa[e] ? desembolsadoPorEmpresa[e] / totalCreditosPorEmpresa[e] : 0;
    });

    // ==================== RENDER ====================
    animarCifra(document.getElementById("heroCifra"), disponibleEstimado, formatearMoneda);
    const porcentajeCapitalUsado = capitalTotalHoy ? (carteraVigenteHoy / capitalTotalHoy) * 100 : 0;
    document.getElementById("heroDelta").textContent =
        `${porcentajeCapitalUsado.toFixed(1)}% del capital semilla está hoy prestado (vigente)`;
    pintarDesglose("heroDesglose", disponiblePorEmpresa, formatearMoneda);

    document.getElementById("kpiCapitalTotal").textContent = formatearMoneda(capitalTotal);
    pintarDesglose("desgloseCapitalTotal", sumarPorEmpresa(capital, "empresa", "valor"), formatearMoneda);

    document.getElementById("kpiDesembolsado").textContent = formatearMoneda(desembolsado);
    pintarDesglose("desgloseDesembolsado", desembolsadoPorEmpresa, formatearMoneda);

    document.getElementById("kpiRecuperado").textContent = formatearMoneda(recuperado);
    pintarDesglose("desgloseRecuperado", recuperadoPorEmpresa, formatearMoneda);

    document.getElementById("kpiIntereses").textContent = formatearMoneda(intereses);
    pintarDesglose("desgloseIntereses", interesesPorEmpresa, formatearMoneda);

    document.getElementById("kpiValorPromedio").textContent = formatearMoneda(valorPromedio);
    pintarDesglose("desgloseValorPromedio", promedioPorEmpresa, formatearMoneda);

    document.getElementById("kpiPrestado").textContent = formatearMoneda(carteraVigenteHoy);
    pintarDesglose("desglosePrestado", carteraVigentePorEmpresaHoy, formatearMoneda);

    document.getElementById("kpiCreditosVigentes").textContent = creditosVigentesHoy.length;
    pintarDesglose("desgloseCreditosVigentes", vigentesPorEmpresaHoy, (v) => String(v));

    document.getElementById("kpiPagados").textContent = creditosPagados.length;
    pintarDesglose("desglosePagados", cantidadPagadosPorEmpresa, (v) => String(v));

    document.getElementById("kpiAnuladosCantidad").textContent = creditosAnuladosPeriodo.length;
    pintarDesglose("desgloseAnuladosCantidad", cantidadAnuladosPorEmpresa, (v) => String(v));

    const porcentajeRecuperado = desembolsado ? Math.min((recuperado / desembolsado) * 100, 100) : 0;
    document.getElementById("textoSaludCartera").textContent =
        `${porcentajeRecuperado.toFixed(0)}% recuperado — de cada $100 prestados en el periodo, se han recuperado ${porcentajeRecuperado.toFixed(0)} pesos (neto de anulados).`;
    setTimeout(() => { document.getElementById("barraSaludRelleno").style.width = porcentajeRecuperado + "%"; }, 150);

    const saludPorEmpresa = {};
    Object.keys(desembolsadoPorEmpresa).forEach((e) => {
        const desemb = desembolsadoPorEmpresa[e] || 0;
        const recup = recuperadoPorEmpresa[e] || 0;
        const pct = desemb ? Math.min((recup / desemb) * 100, 100) : 0;
        saludPorEmpresa[e] = `${pct.toFixed(0)}% (${formatearMoneda(recup)} de ${formatearMoneda(desemb)})`;
    });
    pintarDesglose("desgloseSaludCartera", saludPorEmpresa, (v) => v);

    // ---- Gráficas ----
    const fechasUnicas = [...new Set(capitalTodo.map((f) => f.fecha))].sort((a, b) => new Date(a) - new Date(b));
    let acumuladoTotal = 0;
    const valoresAcumuladosTotal = fechasUnicas.map((fecha) => {
        acumuladoTotal += capitalTodo.filter((f) => f.fecha === fecha).reduce((s, f) => s + Number(f.valor || 0), 0);
        return acumuladoTotal;
    });

    crearOActualizarGrafica("graficaSparkline", {
        type: "line",
        data: { labels: fechasUnicas, datasets: [{
            data: valoresAcumuladosTotal, borderColor: "#C99B3F",
            backgroundColor: "rgba(201,155,63,0.15)", fill: true, tension: 0.35,
            pointRadius: 0, borderWidth: 2
        }]},
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false } }
        }
    });

    const empresasCapital = Object.keys(capitalPorEmpresaHoy);
    document.getElementById("textoComposicion").textContent =
        empresasCapital.map((e) => `${e}: ${((capitalPorEmpresaHoy[e] / capitalTotalHoy) * 100).toFixed(0)}%`).join(" · ");

    crearOActualizarGrafica("graficaDonutEmpresa", {
        type: "doughnut",
        data: { labels: empresasCapital, datasets: [{
            data: empresasCapital.map((e) => capitalPorEmpresaHoy[e]),
            backgroundColor: empresasCapital.map((e) => PALETA_EMPRESAS[e] || "#999"), borderWidth: 0
        }]},
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { font: { family: "IBM Plex Sans" }, generateLabels: generarLeyendaConPorcentaje }
                },
                tooltip: { callbacks: { label: (ctx) => formatearMoneda(ctx.raw) } }
            }, cutout: "68%"
        }
    });

    const porEstado = {};
    creditosTodo.forEach((c) => {
        const estado = c.Estado || "Sin estado";
        porEstado[estado] = (porEstado[estado] || 0) + 1;
    });
    const estados = Object.keys(porEstado);
    document.getElementById("textoEstados").textContent =
        `${creditosTodo.length} créditos en total (histórico). ` + estados.map((e) => `${e}: ${porEstado[e]}`).join(" · ");

    crearOActualizarGrafica("graficaDonutEstados", {
        type: "doughnut",
        data: { labels: estados, datasets: [{
            data: estados.map((e) => porEstado[e]),
            backgroundColor: estados.map((e) => PALETA_ESTADOS[e] || "#999"), borderWidth: 0
        }]},
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { font: { family: "IBM Plex Sans" }, generateLabels: generarLeyendaConPorcentaje }
                }
            },
            cutout: "68%"
        }
    });

    const empresasTodas = [...new Set(capitalTodo.map((f) => f.empresa))];
    const datasetsEvolucion = empresasTodas.map((empresa) => {
        let acum = 0;
        const serie = fechasUnicas.map((fecha) => {
            acum += capitalTodo.filter((f) => f.fecha === fecha && f.empresa === empresa)
                .reduce((s, f) => s + Number(f.valor || 0), 0);
            return acum;
        });
        return {
            label: empresa, data: serie, borderColor: PALETA_EMPRESAS[empresa] || "#999",
            backgroundColor: (PALETA_EMPRESAS[empresa] || "#999") + "22",
            fill: false, tension: 0.25, pointRadius: 0, borderWidth: 2
        };
    });

    crearOActualizarGrafica("graficaEvolucion", {
        type: "line",
        data: { labels: fechasUnicas.map(formatearFechaCorta), datasets: datasetsEvolucion },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: "bottom", labels: { font: { family: "IBM Plex Sans" } } } },
            scales: { y: { beginAtZero: true, ticks: { callback: (v) => formatearMoneda(v) } } }
        }
    });

    const porEmpresaCreditos = {};
    Object.keys(desembolsadoPorEmpresa).forEach((e) => {
        porEmpresaCreditos[e] = { desembolsado: desembolsadoPorEmpresa[e] || 0, recuperado: recuperadoPorEmpresa[e] || 0 };
    });
    const empresasCreditos = Object.keys(porEmpresaCreditos);

    crearOActualizarGrafica("graficaCreditosPorEmpresa", {
        type: "bar",
        data: {
            labels: empresasCreditos,
            datasets: [
                { label: "Desembolsado", data: empresasCreditos.map((e) => porEmpresaCreditos[e].desembolsado),
                  backgroundColor: "#0B4228", borderRadius: 6 },
                { label: "Recuperado", data: empresasCreditos.map((e) => porEmpresaCreditos[e].recuperado),
                  backgroundColor: "#C99B3F", borderRadius: 6 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: "bottom", labels: { font: { family: "IBM Plex Sans" } } } },
            scales: { y: { beginAtZero: true, ticks: { callback: (v) => formatearMoneda(v) } } }
        }
    });

    // ==================== INDICADORES ADICIONALES ====================
    const { afiliados: afiliadosTodo } = datosCompletos;

    // Rentabilidad: intereses generados / capital semilla, histórico
    const rentabilidad = capitalTotalHoy ? (interesesNetoTodo / capitalTotalHoy) * 100 : 0;
    document.getElementById("kpiRentabilidad").textContent = rentabilidad.toFixed(1) + "%";

    // Rotación de cartera: cuántas veces se ha "recirculado" el capital
    // (recuperado histórico total / capital semilla). No incluye el
    // valor retornado de anulados aparte porque ya está implícito en
    // interesesNetoTodo/recuperado -- aquí se usa el recuperado bruto
    // de TODOS los pagos como aproximación simple.
    const recuperadoHistoricoTotal = pagosTodo.reduce((s, p) => s + Number(p.Capital_Pagado || 0), 0);
    const rotacion = capitalTotalHoy ? recuperadoHistoricoTotal / capitalTotalHoy : 0;
    document.getElementById("kpiRotacion").textContent = rotacion.toFixed(2) + "x";

    // Afiliados activos vs retirados
    const activos = afiliadosTodo.filter((a) => !a.Fecha_Retiro_Sind).length;
    const retirados = afiliadosTodo.filter((a) => !!a.Fecha_Retiro_Sind).length;
    document.getElementById("kpiAfiliadosActivos").textContent = activos;
    document.getElementById("kpiAfiliadosRetirados").textContent = retirados;

    // Comparativo de aportes: año actual vs año anterior
    const anioActual = new Date().getFullYear();
    const anioAnterior = anioActual - 1;
    const aportesPorAnio = { [anioAnterior]: 0, [anioActual]: 0 };
    capitalTodo.forEach((f) => {
        const anio = Number((f.fecha || "").slice(0, 4));
        if (aportesPorAnio[anio] !== undefined) aportesPorAnio[anio] += Number(f.valor || 0);
    });
    document.getElementById("textoComparativoAnios").textContent =
        `${anioAnterior}: ${formatearMoneda(aportesPorAnio[anioAnterior])} · ` +
        `${anioActual}: ${formatearMoneda(aportesPorAnio[anioActual])}`;

    crearOActualizarGrafica("graficaComparativoAnios", {
        type: "bar",
        data: {
            labels: [String(anioAnterior), String(anioActual)],
            datasets: [{
                data: [aportesPorAnio[anioAnterior], aportesPorAnio[anioActual]],
                backgroundColor: ["#5B6B62", "#006633"], borderRadius: 6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { callback: (v) => formatearMoneda(v) } } }
        }
    });

    // Créditos nuevos por mes (según Fecha_Credito -- fecha real del crédito)
    const creditosPorMes = {};
    creditosTodo.forEach((c) => {
        if (!c.Fecha_Credito) return;
        const clave = c.Fecha_Credito.slice(0, 7); // "YYYY-MM"
        creditosPorMes[clave] = (creditosPorMes[clave] || 0) + 1;
    });
    const mesesOrdenados = Object.keys(creditosPorMes).sort();

    crearOActualizarGrafica("graficaCreditosPorMes", {
        type: "bar",
        data: {
            labels: mesesOrdenados.map(formatearFechaCorta),
            datasets: [{ data: mesesOrdenados.map((m) => creditosPorMes[m]), backgroundColor: "#C99B3F", borderRadius: 6 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // Top 5 represtamos: más créditos históricos por documento
    const nombresPorDoc = {};
    afiliadosTodo.forEach((a) => { nombresPorDoc[String(a.Documento || "").replace(/\D/g, "")] = a.Nombre; });

    const creditosPorDocumento = {};
    creditosTodo.forEach((c) => {
        const doc = String(c.Documento || "").replace(/\D/g, "");
        if (!doc) return;
        creditosPorDocumento[doc] = (creditosPorDocumento[doc] || 0) + 1;
    });

    const topRepresteos = Object.entries(creditosPorDocumento)
        .filter(([, cantidad]) => cantidad > 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const cuerpoRepresteos = document.getElementById("tablaRepresteosBody");
    cuerpoRepresteos.innerHTML = topRepresteos.length
        ? topRepresteos.map(([doc, cantidad]) => `
            <tr>
                <td>${nombresPorDoc[doc] || "—"}</td>
                <td>${formatearDocumento(doc)}</td>
                <td class="col-cantidad">${cantidad}</td>
            </tr>
        `).join("")
        : `<tr><td colspan="3">No hay afiliados con más de un crédito.</td></tr>`;

    document.getElementById("cargando").style.display = "none";
    document.getElementById("cuerpoDashboard").style.display = "block";

    // Créditos próximos a terminar (vigentes, 2 cuotas o menos por pagar)
    const proximosATerminar = creditosVigentesHoy
        .map((c) => ({
            ...c,
            cuotasRestantes: Number(c.Cuotas_Pactadas || 0) - Number(c.Cuotas_Pagadas || 0)
        }))
        .filter((c) => c.cuotasRestantes > 0 && c.cuotasRestantes <= 2)
        .sort((a, b) => a.cuotasRestantes - b.cuotasRestantes);

    const cuerpoProximos = document.getElementById("tablaProximosTerminarBody");
    if (cuerpoProximos) {
        cuerpoProximos.innerHTML = proximosATerminar.length
            ? proximosATerminar.map((c) => `
                <tr>
                    <td>${nombresPorDoc[String(c.Documento || "").replace(/\D/g, "")] || "—"}</td>
                    <td>${formatearDocumento(c.Documento)}</td>
                    <td>${c.Empresa || "—"}</td>
                    <td>${formatearCuotas(c.Cuotas_Pagadas, c.Cuotas_Pactadas)}</td>
                    <td>${formatearMoneda(c.Saldo_Capital)}</td>
                </tr>
            `).join("")
            : `<tr><td colspan="5">No hay créditos a punto de terminar.</td></tr>`;
    }

    // Personal desafiliado con crédito vigente
    const documentosDesafiliados = new Set(
        afiliadosTodo
            .filter((a) => !!a.Fecha_Retiro_Sind)
            .map((a) => String(a.Documento || "").replace(/\D/g, ""))
    );

    const desafiliadosConCredito = creditosVigentesHoy.filter((c) =>
        documentosDesafiliados.has(String(c.Documento || "").replace(/\D/g, ""))
    );

    const cuerpoDesafiliados = document.getElementById("tablaDesafiliadosBody");
    if (cuerpoDesafiliados) {
        cuerpoDesafiliados.innerHTML = desafiliadosConCredito.length
            ? desafiliadosConCredito.map((c) => `
                <tr>
                    <td>${nombresPorDoc[String(c.Documento || "").replace(/\D/g, "")] || "—"}</td>
                    <td>${formatearMoneda(c.Valor_Credito)}</td>
                    <td>${formatearMoneda(c.Saldo_Capital)}</td>
                    <td>${formatearMoneda(c.Capital_Pagado)}</td>
                    <td>${formatearCuotas(c.Cuotas_Pagadas, c.Cuotas_Pactadas)}</td>
                    <td>${formatearFecha(c.Fecha_Inicial)}</td>
                    <td>${formatearFecha(c.Fecha_Final)}</td>
                </tr>
            `).join("")
            : `<tr><td colspan="7">No hay personal desafiliado con crédito vigente.</td></tr>`;
    }
}
