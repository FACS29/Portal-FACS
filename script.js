// ======================================================
// PORTAL FACS v2.0
// Fondo de Ahorro y Crédito Sindical
// SINTRAPROACEITES SUBDIRECTIVA LA GLORIA
// ======================================================

// ------------------------------
// Variables globales
// ------------------------------

let datosGlobal = [];

let ultimaActualizacionGlobal = null;

let afiliadoActual = null;

let historialActual = [];

let creditoActual = null;

async function cargarDatos() {

    try {

 const [configuracion, creditos] = await Promise.all([

    obtenerConfiguracion(),

    fetch(

        `${SUPABASE_URL}/rest/v1/Creditos`,

        {

            headers: HEADERS

        }

    ).then(r => r.json())

]);

        if (configuracion.length > 0) {

            const fecha = new Date(
                configuracion[0].Ultima_Actualizacion
            );

            ultimaActualizacionGlobal = fecha;

            window.fechaActualizacionReal =
                configuracion[0].Ultima_Actualizacion;

            document.getElementById(
                "ultimaActualizacion"
            ).textContent = fecha.toLocaleString(
                "es-CO"
            );

        }

        datosGlobal = creditos.map(c => ({

            ...c,

            "Codigo Credito": c.Codigo_Credito,

            "Fecha Inicial": formatearFecha(c.Fecha_Inicial),

            "Fecha Final": formatearFecha(c.Fecha_Final),

            "Valor Desembolsado": c.Valor_Desembolsado,

            "Valor Credito": c.Valor_Credito,

            "Cuotas Pactadas": c.Cuotas_Pactadas,

            "Cuotas Pagadas": c.Cuotas_Pagadas,

            "Porcentaje Amortizado": c.Porcentaje_Amortizado,

            "Capital Pagado": c.Capital_Pagado,

            "Interes Pagado": c.Interes_Pagado,

            "Saldo Capital": c.Saldo_Capital,

            "Porcentaje Interes": c.Porcentaje_Interes,

            "Cuotas Re": c.Cuotas_Re,

            "Ultimo Pago": formatearFecha(c.Ultimo_Pago),

            "Proximo Pago": formatearFecha(c.Proximo_Pago)

        }));

    } catch (error) {

        console.error(error);

        alert("No fue posible conectar con Supabase.");

    }

}

function formatearFecha(fecha) {

    if (!fecha) return "";

    const partes = fecha.split("-");

    return `${partes[2]}/${partes[1]}/${partes[0]}`;

}

function formatoMoneda(valor) {

    const numero = Number(valor || 0);

    return numero.toLocaleString(
        "es-CO",
        {
            style: "currency",
            currency: "COP",
            maximumFractionDigits: 0
        }
    );

}

function formatoCodigoCredito(codigo) {

    codigo = String(codigo || "").trim();

    if (codigo.length === 7) {

        return codigo.substring(0,4) + "-" + codigo.substring(4);

    }

    return codigo;

}

function formatoPorcentaje(valor) {

    let numero = Number(valor || 0);

    if (numero <= 1) {

        numero *= 100;

    }

    return numero.toFixed(
        numero === 100 ? 0 : 2
    ) + "%";

}

function formatoCodigoCredito(codigo) {

    codigo = String(codigo || "");

    if (codigo.length === 7) {

        return codigo.substring(0, 4) + "-" + codigo.substring(4);

    }

    return codigo;

}

function obtenerEstadoCredito(estado) {

    estado = String(estado || "");

    if (estado.includes("Paz y Salvo")) {

        return {
            clase:"estado-paz",
            icono:"🔵"
        };

    }

    if (estado.includes("Anulado")) {

        return {
            clase:"estado-anulado",
            icono:"⚫"
        };

    }

    return {

        clase:"estado-vigente",

        icono:"🟢"

    };

}

function mostrarBusqueda() {

    document.title = "FACS | Consulta de Créditos";

    document.getElementById("resultado").innerHTML = "";

    document.getElementById("pantallaInicio").style.display = "block";

    document.getElementById("documento").value = "";

    document.getElementById("documento").focus();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}

function mostrarBienvenida(nombre) {

    return `

        <div class="card bienvenida">

            <div class="bienvenida-saludo">
                Bienvenido (a)
            </div>

            <div class="bienvenida-nombre">
                ${nombre}
            </div>

            <div class="bienvenida-mensaje">
                Su información financiera se encuentra actualizada
            </div>

            <div class="bienvenida-texto">
                Gracias por utilizar el Portal del Fondo de Ahorro y Crédito Sindical
            </div>

            <p
                id="ultimaConsultaUsuario"
                class="bienvenida-ultima-consulta">
            </p>

        </div>

    `;

}

function limpiarPantalla() {

    document.getElementById("resultado").innerHTML = "";

}

function construirDatosDeudor(
    vigente,
    nombreAfiliado,
    esAfiliado,
    afiliacionTexto,
    afiliacionClase
) {

    return `

    <div class="seccion">

        <h2>Datos del Deudor</h2>

        <div class="grid">

            <div class="item">

                <div class="etiqueta">

                    Nombres y Apellidos del Deudor

                </div>

                <div class="valor">

                    ${nombreAfiliado || ""}

                </div>

            </div>

            <div class="item ${afiliacionClase}">

                <div class="etiqueta">

                    Estado de Afiliación Sindical

                </div>

                <div class="valor">

                    ${afiliacionTexto}

                </div>

            </div>

            ${
                !esAfiliado && vigente["Fecha Retiro Sind"]

                ?

                `

                <div class="item">

                    <div class="etiqueta">

                        Fecha de Retiro del Sindicato

                    </div>

                    <div class="valor">

                        ${vigente["Fecha Retiro Sind"]}

                    </div>

                </div>

                `

                : ""

            }

        </div>

    </div>

    `;

}

function construirInformacionCredito(vigente) {

    return `

    <div class="seccion">

        <h2>Información General del Crédito</h2>

        <div class="grid">

            <div class="item">

                <div class="etiqueta">

                    Código Único del Crédito

                </div>

                <div class="valor">

                    ${formatoCodigoCredito(vigente["Codigo Credito"])}

                </div>

            </div>

            <div class="item">

                <div class="etiqueta">

                    Estado Actual del Crédito

                </div>

                <div class="valor">

                    ${vigente.Estado || ""}

                </div>

            </div>

            <div class="item">

                <div class="etiqueta">

                    Tasa de Interés Aplicada

                </div>

                <div class="valor">

                    ${formatoPorcentaje(vigente["Porcentaje Interes"])}

                </div>

            </div>

        </div>

    </div>

    `;

}

function construirFechasCredito(vigente) {

    return `

    <div class="seccion">

        <h2>Fechas del Crédito</h2>

        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));">

            <div class="item">

                <div class="etiqueta">
                    Fecha Inicial
                </div>

                <div class="valor">
                    ${vigente["Fecha Inicial"] || ""}
                </div>

            </div>

            <div class="item">

                <div class="etiqueta">
                    Fecha Final
                </div>

                <div class="valor">
                    ${vigente["Fecha Final"] || ""}
                </div>

            </div>

            <div class="item">

                <div class="etiqueta">
                    Último Pago
                </div>

                <div class="valor">
                    ${vigente["Ultimo Pago"] || ""}
                </div>

            </div>

            <div class="item">

                <div class="etiqueta">
                    Próximo Pago
                </div>

                <div class="valor">
                    ${vigente["Proximo Pago"] || ""}
                </div>

            </div>

            <div class="item">

                 <div class="etiqueta">
                     Tiempo de gracia
                </div>

                <div class="valor">

                     ${
                     Number(vigente.TGracia) > 0
                      ? vigente.TGracia + " mes(es)"
                     : "No aplica"
                     }

                </div>

            </div>

        </div>

    </div>

    `;

}

async function consultar() {

const documento =
    document.getElementById("documento").value.trim();

if (!documento) return;

const ultimaConsulta = await obtenerUltimaConsulta(
    documento
);

const respuesta = await fetch(

    `${SUPABASE_URL}/rest/v1/Creditos?Documento=eq.${documento}`,

    {

        headers: HEADERS

    }

);

const registrosBD = await respuesta.json();

console.log(registrosBD);
console.log(registrosBD.length);

let nombreAfiliado = "";
let fechaRetiroSind = "";

if (registrosBD.length > 0) {

    const documentoAfiliado = registrosBD[0].Documento;

    const respuestaAfiliado = await fetch(

        `${SUPABASE_URL}/rest/v1/Afiliados?Documento=eq.${documentoAfiliado}`,

        {

            headers: HEADERS

        }

    );
    
    const afiliadoBD = await respuestaAfiliado.json();

    if (afiliadoBD.length > 0) {

        nombreAfiliado = afiliadoBD[0].Nombre;

        fechaRetiroSind = afiliadoBD[0].Fecha_Retiro_Sind
            ? formatearFecha(afiliadoBD[0].Fecha_Retiro_Sind)
            : "";
       
    }

}

const registros = registrosBD.map(c => ({

    ...c,

    "Estado": c.Estado,

    "Nombre": c.Nombre,

    "Codigo Credito": c.Codigo_Credito,

    "Afiliado": c.Afiliado,

    "Fecha Retiro Sind": fechaRetiroSind,

    "Fecha Inicial": formatearFecha(c.Fecha_Inicial),

    "Fecha Final": formatearFecha(c.Fecha_Final),

    "Valor Desembolsado": c.Valor_Desembolsado,

    "Valor Credito": c.Valor_Credito,

    "Porcentaje Interes": c.Porcentaje_Interes,

    "Cuota Original": c.Cuota_Original,

    "Cuotas Pactadas": c.Cuotas_Pactadas,

    "Cuotas Pagadas": c.Cuotas_Pagadas,

    "Porcentaje Amortizado": c.Porcentaje_Amortizado,

    "Capital Pagado": c.Capital_Pagado,

    "Interes Pagado": c.Interes_Pagado,

    "Saldo Capital": c.Saldo_Capital,

    "Cuotas Re": c.Cuotas_Re,

    "Ultimo Pago": formatearFecha(c.Ultimo_Pago),

    "Proximo Pago": formatearFecha(c.Proximo_Pago)

}));

const resultado =
    document.getElementById("resultado");

if (registros.length === 0) {

    resultado.innerHTML = `

        <div class="card">

            <div class="sin-registros">

                No se encontraron créditos asociados al documento consultado.

            </div>

        </div>

    `;

    document.getElementById("resultado").scrollIntoView({

        behavior: "smooth"

    });

    return;
}

const registrosOrdenados = [...registros].sort((a, b) => {

    const fechaA = new Date(
        a.Fecha_Inicial.split("/").reverse().join("-")
    );

    const fechaB = new Date(
        b.Fecha_Inicial.split("/").reverse().join("-")
    );

    return fechaB - fechaA;

});

const vigente =

    registrosOrdenados.find(

        r =>

            String(r.Estado || "")
                .trim()
                .toLowerCase()
                .includes("vigente")

    )

    ||

    registrosOrdenados[0];

const codigoCredito = vigente["Codigo Credito"];

const respuestaPagos = await fetch(

    `${SUPABASE_URL}/rest/v1/Pagos?Codigo_Credito=eq.${codigoCredito}&order=Numero_cuota.asc`,

    {

        headers: HEADERS

    }

);

const pagos = await respuestaPagos.json();

document.getElementById("pantallaInicio").style.display = "none";

const estadoInfo =
    obtenerEstadoCredito(vigente.Estado);

const esAfiliado =
    String(vigente.Afiliado || "")
        .toLowerCase()
        .includes("si") ||
    String(vigente.Afiliado || "")
        .toLowerCase()
        .includes("sí");

const afiliacionTexto =
    esAfiliado
        ? "🟢 Afiliado Activo"
        : "🟠 Retirado del Sindicato";

const afiliacionClase =
    esAfiliado
        ? "afiliado-activo"
        : "afiliado-retirado";

let porcentaje =
    parseFloat(
        String(vigente["Porcentaje Amortizado"] || "0")
            .replace("%", "")
            .replace(",", ".")
    ) || 0;

if (porcentaje <= 1) {
    porcentaje = porcentaje * 100;
}

let html = `

<div class="card">

    <div class="estado ${estadoInfo.clase}">

        <div class="estado-titulo">
            Estado Actual del Crédito
        </div>

        <div class="estado-valor">
            ${estadoInfo.icono} ${vigente.Estado}
        </div>

    </div>

    ${construirDatosDeudor(
    vigente,
    nombreAfiliado,
    esAfiliado,
    afiliacionTexto,
    afiliacionClase
)}

   ${construirInformacionCredito(vigente)}

   ${construirFechasCredito(vigente)}

      <div class="seccion">

        <h2>Valores y Amortización</h2>

        <div class="grid">

            <div class="item">
                <div class="etiqueta">
                    Valor Inicial Desembolsado
                </div>
                <div class="valor">
                    ${formatoMoneda(vigente["Valor Desembolsado"])}
                </div>
            </div>

            <div class="item">
                <div class="etiqueta">
                    Valor de la Cuota Mensual
                </div>
                <div class="valor">
                    ${formatoMoneda(vigente["Cuota"])}
                </div>
            </div>

            <div class="item">
                <div class="etiqueta">
                    Número Total de Cuotas Pactadas
                </div>
                <div class="valor">
                    ${vigente["Cuotas Pactadas"] || ""}
                </div>
            </div>

            <div class="item">
                <div class="etiqueta">
                    Cuotas Pagadas a la Fecha
                </div>
                <div class="valor">
                    ${vigente["Cuotas Pagadas"] || "0"} de ${vigente["Cuotas Pactadas"] || "0"}
                </div>
            </div>

            <div class="item">
                <div class="etiqueta">
                    Capital Pagado a la Fecha
                </div>
                <div class="valor">
                    ${formatoMoneda(vigente["Capital Pagado"])}
                </div>
            </div>

            <div class="item">
                <div class="etiqueta">
                    Intereses Pagados a la Fecha
                </div>
                <div class="valor">
                    ${formatoMoneda(vigente["Interes Pagado"])}
                </div>
            </div>

            <div class="item saldo-destacado">
                <div class="etiqueta">
                    Saldo de Capital Pendiente por Pagar
                </div>
                <div class="valor">
                    ${formatoMoneda(vigente["Saldo Capital"])}
                </div>
            </div>

        </div>

        <div style="margin-top:25px;">

            <div class="etiqueta">
                Porcentaje de Amortización del Crédito
            </div>

            <div style="display:flex;align-items:center;gap:12px;">

                <div class="progreso" style="flex:1;">
                    <div
                        class="barra"
                        style="width:${porcentaje}%">
                    </div>
                </div>

                <div style="
                    min-width:60px;
                    text-align:right;
                    font-weight:bold;
                    color:#006633;
                    font-size:18px;
                ">
                    ${porcentaje === 100 ? "100%" : porcentaje.toFixed(2) + "%"}
                </div>

            </div>

        </div>

    </div>

     ${construirTablaAmortizacion(
     vigente,
     pagos,
     window.fechaActualizacionReal
     )}
     
     `;

if (String(vigente.Represteo || "").toLowerCase().includes("si") ||
    String(vigente.Represteo || "").toLowerCase().includes("sí")) {

    html += `

    <div class="seccion">

        <h2>Información de Represteo</h2>

        <div class="grid">

            <div class="item">
                <div class="etiqueta">
                    Crédito Reestructurado mediante Represteo
                </div>
                <div class="valor">
                    Sí
                </div>
            </div>

            <div class="item">
                <div class="etiqueta">
                    Cuotas Pendientes Incorporadas al Represteo
                </div>
                <div class="valor">
                    ${vigente["Cuotas Re"] || ""}
                </div>
            </div>

        </div>

    </div>
    `;
}

html += `

</div>

<div class="card">

    <h2>Historial de Créditos del Afiliado</h2>

    <table>

        <tr>
            <th>Código Crédito</th>
            <th>Fecha de Inicio</th>
            <th>Valor Inicial Desembolsado</th>
            <th>Valor Total del Crédito</th>
            <th>Cuota Mensual</th>
            <th>Cuotas Pactadas</th>
            <th>Cuotas Pagadas</th>
            <th>Porcentaje Amortizado</th>
            <th>Represteo</th>
            <th>Cuotas Descontadas</th>
            <th>Estado</th>
        </tr>
`;

registros.forEach(r => {

    html += `

    <tr>

        <td>${formatoCodigoCredito(r["Codigo Credito"])}</td>

        <td>${r["Fecha Inicial"] || ""}</td>

        <td>${formatoMoneda(r["Valor Desembolsado"])}</td>

        <td>${formatoMoneda(r["Valor Credito"])}</td>

        <td>${formatoMoneda(r["Cuota"])}</td>

        <td>${r["Cuotas Pactadas"] || ""}</td>

        <td>${r["Cuotas Pagadas"] || ""}</td>

        <td>${
    (() => {
        let p = parseFloat(String(r["Porcentaje Amortizado"] || "0").replace(",", "."));
        if (p <= 1) p *= 100;
        return p === 100 ? "100%" : p.toFixed(2) + "%";
    })()
}</td>

        <td>${r["Represteo"] || ""}</td>

        <td>${r["Cuotas Re"] || ""}</td>

        <td>${r["Estado"] || ""}</td>

    </tr>

    `;

});

html += `
    </table>
</div>
`;

resultado.innerHTML =
    mostrarBienvenida(nombreAfiliado) +
    html +
    `
   
 <div style="text-align:center;margin-top:35px;">

    <div class="card" style="text-align:center;">

    <button
        id="btnNuevaConsulta"
        class="btn-nueva-consulta">

        NUEVA CONSULTA

    </button>

 </div>
 </div>

 `;

const textoUltimaConsulta =
    document.getElementById(
        "ultimaConsultaUsuario"
    );

if (textoUltimaConsulta) {

   textoUltimaConsulta.textContent = ultimaConsulta

    ? `Última consulta: ${new Date(
          ultimaConsulta
      ).toLocaleString("es-CO", {

          timeZone: "America/Bogota",

          day: "2-digit",
          month: "2-digit",
          year: "2-digit",

          hour: "numeric",
          minute: "2-digit",

          hour12: true

      })}`

    : "Esta es su primera consulta.";

}

await registrarConsulta(
    documento,
    vigente["Codigo Credito"]
);

 const bienvenida = document.querySelector(".bienvenida");

if (bienvenida) {

    const y = bienvenida.getBoundingClientRect().top + window.scrollY - 20;

    window.scrollTo({

        top: y,

        behavior: "smooth"

    });

}

 document
    .getElementById("btnNuevaConsulta")
    .addEventListener("click", mostrarBusqueda);

}

document.addEventListener("DOMContentLoaded", async () => {

    await cargarDatos();

    mostrarBusqueda();

    document
        .getElementById("btnConsultar")
        .addEventListener("click", consultar);

    document
        .getElementById("documento")
        .addEventListener("keypress", function(e){

            if(e.key === "Enter"){

                consultar();

            }

        });

});

function mismoMes(fecha1, fecha2) {

    return (

        fecha1.getMonth() === fecha2.getMonth()

        &&

        fecha1.getFullYear() === fecha2.getFullYear()

    );

}

function construirTablaAmortizacion(
    vigente,
    pagos,
    ultimaActualizacion
 ) {

 const fechaActual = new Date(
    ultimaActualizacion
        .replace(" ", "T")
 );

    fechaActual.setHours(23, 59, 59, 999);

    let html = `

    <div class="seccion">

        <h2>Cronograma de Pagos y Amortización</h2>

        <table>

            <tr>

                <th>Cuota</th>

                <th>Fecha</th>

                <th>Saldo inicial</th>

                <th>Capital</th>

                <th>Interés</th>

                <th>Valor cuota</th>

                <th>Saldo final</th>

                <th>Estado</th>

            </tr>

    `;

    const cuotasPactadas = Number(vigente.Cuotas_Pactadas);

    const cuotasPagadas = Number(vigente.Cuotas_Pagadas || 0);

    const fechaInicio = new Date(vigente.Fecha_Inicial);

    const diaPago = vigente.Empresa === "ELG" ? 25 : 30;

    let cuotasExtra = 0;
    let totalCapital = 0;
    let totalInteres = 0;
    let totalCuota = 0;
    let numeroCuota = 1;

    let finalizarCronograma = false;

     const creditoAnulado =

        String(vigente.Estado || "")
            .toLowerCase()
            .includes("anulado");

    let detenerDespuesDeEstaFila = false;

    while (

    numeroCuota <= cuotasPactadas + cuotasExtra

    &&

    !(creditoAnulado && numeroCuota > pagos.length)

    &&

    !finalizarCronograma

        ) {

     detenerDespuesDeEstaFila = false;

    const fechaCuota = new Date(fechaInicio);

    fechaCuota.setMonth(
        fechaInicio.getMonth() + (numeroCuota - 1)
    );

    fechaCuota.setDate(diaPago);

    const pago = pagos.find(p => {

        const fechaPago = new Date(p.Fecha);

    return mismoMes(fechaPago, fechaCuota);

});

    let estado = "";

if (pago) {

    totalCapital += Number(pago.Capital_Pagado || 0);

    totalInteres += Number(pago.Interes_Pagado || 0);

    totalCuota += Number(pago.Valor_Cuota || 0);

    const valorPagado = Number(pago.Valor_Cuota || 0);

let cuotaEsperada = Number(vigente.Cuota || 0);

if (

    vigente.Afiliado === "No"

    &&

    Number(vigente["Cuota Original"] || 0) > 0

) {

    const cuotaOriginal = Number(

        vigente["Cuota Original"]

    );

    const cuotaActual = Number(

        vigente.Cuota

    );

    const diferenciaOriginal = Math.abs(

        valorPagado - cuotaOriginal

    );

    const diferenciaActual = Math.abs(

        valorPagado - cuotaActual

    );

    cuotaEsperada =

        diferenciaOriginal <= diferenciaActual

            ? cuotaOriginal

            : cuotaActual;

}
    
    if (valorPagado < cuotaEsperada) {

    estado = "🟡 Pago Parcial";

    cuotasExtra++;

    } else {

    estado = "🟢 Pagada";

    }


    if (

    pago.Saldo_Final !== null

    &&

    pago.Saldo_Final !== ""

    &&

    Number(pago.Saldo_Final) === 0

) {

    estado = "✅ Crédito Cancelado";

    detenerDespuesDeEstaFila = true;

}

} else {

const yaPaso =

    fechaCuota.getTime() <= fechaActual.getTime();
    

    if (

    yaPaso

    &&

    numeroCuota <= cuotasPagadas + cuotasExtra + 1

) {

    estado = "🔵 Tiempo de Gracia";

    cuotasExtra++;
    
} else {

    estado = "⚪ Pendiente";

}
    
}

    html += `

        <tr>

            <td>${numeroCuota}</td>

            <td>${`${String(fechaCuota.getDate()).padStart(2, "0")}/${
                  String(fechaCuota.getMonth() + 1).padStart(2, "0")
            }/${
                fechaCuota.getFullYear()
            }`}</td>

            <td>${pago ? formatoMoneda(pago.Saldo_Inicial) : "-"}</td>

            <td>${pago ? formatoMoneda(pago.Capital_Pagado) : "-"}</td>

            <td>${pago ? formatoMoneda(pago.Interes_Pagado) : "-"}</td>

            <td>${pago ? formatoMoneda(pago.Valor_Cuota) : "-"}</td>

            <td>${pago ? formatoMoneda(pago.Saldo_Final) : "-"}</td>

            <td>${estado}</td>

        </tr>

    `;

    if (detenerDespuesDeEstaFila) {

    finalizarCronograma = true;

    }

    numeroCuota++;

}

html += `

    <tr style="font-weight:bold;background:#f5f5f5;">

            <td colspan="3">Totales</td>

        <td>${formatoMoneda(totalCapital)}</td>

        <td>${formatoMoneda(totalInteres)}</td>

        <td>${formatoMoneda(totalCuota)}</td>
        
        <td></td>
 <td colspan="3">

            ${creditoAnulado ? "❌ Crédito Anulado" : "Totales"}

        </td>

            </tr>

`;

html += `

        </table>

`;

 if (cuotasExtra > 0) {

    html += `

    <div class="nota-gracia">

        <strong>Nota:</strong>

        Este crédito registra <strong>${vigente.TGracia}</strong> mes(es) de gracia y/o pagos parciales, situación que generó una ampliación del plazo inicialmente pactado.

    </div>

    `;

}

html += `

    </div>

`;

return html;

}