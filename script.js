let datosGlobal = [];

async function cargarDatos() {


try {

    const respuesta = await fetch("datos.json");

    const datos = await respuesta.json();

    if (datos.ultimaActualizacion) {

        document.getElementById("ultimaActualizacion").textContent =
            datos.ultimaActualizacion;

    }

    datosGlobal = datos.registros || datos;

}

catch (error) {

    console.error(error);

    document.getElementById("resultado").innerHTML = `
        <div class="card">
            <div class="sin-registros">
                Error cargando la información.
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

    codigo = String(codigo || "");

    if (codigo.length === 7) {

        return codigo.substring(0, 4) + "-" + codigo.substring(4);

    }

    return codigo;

}

function obtenerEstadoCredito(estado) {


let clase = "estado-vigente";
let icono = "🟢";

if ((estado || "").includes("Paz y Salvo")) {

    clase = "estado-paz";
    icono = "🔵";

}

if ((estado || "").includes("Anulado")) {

    clase = "estado-anulado";
    icono = "⚫";

}

return { clase, icono };


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

if (registros.length === 0) {

    resultado.innerHTML = `
        <div class="card">
            <div class="sin-registros">
                No se encontraron créditos asociados al documento consultado.
            </div>
        </div>
    `;

    return;

}

const vigente =
    registros.find(
        r => String(r.Estado || "")
            .toLowerCase()
            .includes("vigente")
    ) || registros[0];

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
                    ${(Number(vigente["Porcentaje Interes"] || 0) * 100).toFixed(2)}%
                </div>
            </div>

        </div>

    </div>

    <div class="seccion">

        <h2>Fechas del Crédito</h2>

        <div class="grid">

            <div class="item">
                <div class="etiqueta">
                    Fecha de Inicio de Descuentos por Nómina
                </div>
                <div class="valor">
                    ${vigente["Fecha Inicial"] || ""}
                </div>
            </div>

            <div class="item">
                <div class="etiqueta">
                    Fecha Estimada de Finalización
                </div>
                <div class="valor">
                    ${vigente["Fecha Final"] || ""}
                </div>
            </div>

            <div class="item">
                <div class="etiqueta">
                    Fecha del Último Pago Registrado
                </div>
                <div class="valor">
                    ${vigente["Ultimo Pago"] || ""}
                </div>
            </div>

            <div class="item">
                <div class="etiqueta">
                    Fecha del Próximo Descuento por Nómina
                </div>
                <div class="valor">
                    ${vigente["Proximo Pago"] || ""}
                </div>
            </div>

        </div>

    </div>

    <div class="seccion">

        <h2>Valores y Amortización</h2>

        <div class="grid">

            <div class="item">
                <div class="etiqueta">
                    Valor Inicial Desembolsado al Afiliado
                </div>
                <div class="valor">
                    ${formatoMoneda(vigente["Valor Desembolsado"])}
                </div>
            </div>

            <div class="item">
                <div class="etiqueta">
                    Valor Total del Crédito Vigente
                </div>
                <div class="valor">
                    ${formatoMoneda(vigente["Valor Credito"])}
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
                    Capital Recuperado por el Fondo
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
                    ${porcentaje.toFixed(0)}%
                </div>

            </div>

        </div>

    </div>
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
            <th>Código del Crédito</th>
            <th>Fecha de Inicio de Descuentos</th>
            <th>Valor Inicial Desembolsado</th>
            <th>Valor Total del Crédito</th>
            <th>Cuota Mensual</th>
            <th>Cuotas Pactadas</th>
            <th>Cuotas Pagadas</th>
            <th>% Amortizado</th>
            <th>Represteo</th>
            <th>Cuotas Incorporadas</th>
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

        <td>${r["Porcentaje Amortizado"] || ""}</td>

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

resultado.innerHTML = html;


}

document.addEventListener("DOMContentLoaded", async () => {


await cargarDatos();

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
