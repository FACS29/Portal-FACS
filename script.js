// ======================================================
// PORTAL FACS v2.0
// Fondo de Ahorro y Crédito Sindical
// SINTRAPROACEITES SUBDIRECTIVA LA GLORIA
// ======================================================

// ------------------------------
// Variables globales
// ------------------------------

let datosGlobal = [];

let afiliadoActual = null;

let historialActual = [];

let creditoActual = null;

async function cargarDatos() {

    try {

        const respuesta = await fetch("datos.json");

        if (!respuesta.ok) {

            throw new Error("No fue posible cargar datos.json");

        }

        const datos = await respuesta.json();

        if (datos.ultimaActualizacion) {

            document.getElementById("ultimaActualizacion").textContent =
                datos.ultimaActualizacion;

        }

        datosGlobal = datos.registros || [];

    }

    catch (error) {

        console.error(error);

        document.getElementById("resultado").innerHTML = `

            <div class="card">

                <div class="sin-registros">

                    No fue posible cargar la información del Fondo.

                </div>

            </div>

        `;

    }

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

    document.getElementById("pantallaInicio").style.display = "block";

    document.getElementById("resultado").innerHTML = "";

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

                Bienvenido(a)

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

        </div>

    `;

}

function limpiarPantalla() {

    document.getElementById("resultado").innerHTML = "";

}

function construirDatosDeudor(vigente, esAfiliado, afiliacionTexto, afiliacionClase) {

    return `

    <div class="seccion">

        <h2>Datos del Deudor</h2>

        <div class="grid">

            <div class="item">

                <div class="etiqueta">

                    Nombres y Apellidos del Deudor

                </div>

                <div class="valor">

                    ${vigente.Nombre || ""}

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

function construirSeguimientoCuotas(vigente){

    const total = parseInt(vigente["Cuotas Pactadas"]) || 0;

    const pagadas =
    parseFloat(
    String(vigente["Cuotas Pagadas"])
    .replace(",", ".")
    ) || 0;

    const gracia = parseFloat(vigente["TGracia"]) || 0;

    let html = `

    <div class="seccion">

        <h2>Seguimiento de Cuotas</h2>

        <div class="timeline-container">

            <div class="timeline">

            <div class="timeline-inicio">

            <span class="timeline-bandera">

             🚩

            </span>

            <div class="timeline-inicio-texto">

             Inicio

            </div>

        </div>

    `;

    for(let i=1;i<=total;i++){

        let color = "timeline-gris";
let estado = "Pendiente";

// Si el crédito está cancelado completamente
if (
    vigente.Estado === "Paz y Salvo" ||
    Number(pagadas) >= total
){

    color = "timeline-verde";
    estado = "Pagada";

}
else{

    if(i <= Math.floor(pagadas)){

        color = "timeline-verde";
        estado = "Pagada";

    }
    else if(
        pagadas % 1 !== 0 &&
        i === Math.ceil(pagadas)
    ){

        color = "timeline-amarillo";
        estado = "Parcial";

    }

}

        const colorLinea =
(
    i <= Math.floor(pagadas)
)
? "timeline-linea-verde"
: "timeline-linea-gris";

html += `

    <div class="timeline-linea ${colorLinea}"></div>

    <div class="timeline-item">

        <div class="timeline-numero">

            ${i}

        </div>

        <div class="timeline-circulo ${color}"></div>

        <div class="timeline-texto">

            ${estado}

        </div>

    </div>

`;

    }

 html += `

    <div class="timeline-linea ${
        (vigente.Estado === "Paz y Salvo" || Number(pagadas) >= total)
            ? "timeline-linea-verde"
            : "timeline-linea-gris"
    }"></div>

    <div class="timeline-fin">

    <span class="${
        (vigente.Estado === "Paz y Salvo" || Number(pagadas) >= total)
            ? "timeline-trofeo-dorado"
            : "timeline-trofeo-gris"
    }">
        🏆
    </span>

    <div class="timeline-fin-texto">

        Fin

    </div>

</div>

</div>

</div>

`;   

    if(gracia>0){

        html+=`

        <div class="nota-gracia">

            <strong>Nota:</strong>
            Este crédito registra <strong>${vigente.TGracia}</strong> mes(es) de gracia, por lo cual el plazo del crédito fue ampliado durante ese período.

        </div>

        `;

    }

    html+=`

    </div>

    `;

    return html;

}

function consultar() {


const documento =
    document.getElementById("documento").value.trim();

if (!documento) return;

const registros =
    datosGlobal.filter(
        r => String(r.Documento).trim() === documento
    );

const resultado =
    document.getElementById("resultado");

document.getElementById("pantallaInicio").style.display = "none";

if (registros.length === 0) {

    document.getElementById("pantallaInicio").style.display = "block";

    resultado.innerHTML = `
        <div class="card">
            <div class="sin-registros">
                No se encontraron créditos asociados al documento consultado.
            </div>
        </div>
    `;

    document.getElementById("documento").focus();

    return;

}

const registrosOrdenados = [...registros].sort((a, b) => {

    const fechaA = new Date((a["Fecha Inicial"] || "").split("/").reverse().join("-"));
    const fechaB = new Date((b["Fecha Inicial"] || "").split("/").reverse().join("-"));

    return fechaB - fechaA;

});

const vigente =
    registrosOrdenados.find(r =>
        String(r.Estado || "")
            .toLowerCase()
            .includes("vigente")
    ) || registrosOrdenados[0];

    document.title = "FACS | " + vigente.Nombre;

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

     ${construirSeguimientoCuotas(vigente)}
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
    mostrarBienvenida(vigente.Nombre) +
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

`;

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
