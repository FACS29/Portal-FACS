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

const TEXTO_ACTUALIZACION_NO_DISPONIBLE = "No disponible por el momento";

function mostrarUltimaActualizacion(texto) {
    const elemento = document.getElementById("ultimaActualizacion");
    if (elemento) elemento.textContent = texto;
}

async function cargarDatos() {

    // ANTES: esta función traía la tabla Creditos COMPLETA (todos los
    // créditos de todos los afiliados) en cada carga del portal público,
    // solo para guardarla en "datosGlobal" -- una variable que ningún
    // otro lugar del código llega a leer. Esa descarga solo crecerá con
    // el tiempo y no aportaba nada visible; se elimina. Lo único que
    // realmente se usa de aquí es la fecha de "última actualización".

    try {

        const configuracion = await obtenerConfiguracion();

        if (configuracion.length > 0) {

            const fecha = new Date(
                configuracion[0].Ultima_Actualizacion
            );

            ultimaActualizacionGlobal = fecha;

            window.fechaActualizacionReal =
                configuracion[0].Ultima_Actualizacion;

            // Si la fecha viene vacia o invalida se avisa en la pagina
            // (antes se mostraba una fecha de 1969).
            mostrarUltimaActualizacion(
                (!configuracion[0].Ultima_Actualizacion || isNaN(fecha))
                    ? TEXTO_ACTUALIZACION_NO_DISPONIBLE
                    : fecha.toLocaleString(
                        "es-CO",
                        {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit"
                        }
                    )
            );

        } else {

            mostrarUltimaActualizacion(TEXTO_ACTUALIZACION_NO_DISPONIBLE);

        }

    } catch (error) {

        console.error(error);

        // Sin ventana emergente: el aviso queda dentro de la pagina.
        mostrarUltimaActualizacion(TEXTO_ACTUALIZACION_NO_DISPONIBLE);

    }

}

function formatearFecha(fecha) {

    if (!fecha) return "";

    const partes = fecha.split("-");

    return `${partes[2]}/${partes[1]}/${partes[0]}`;

}

// Convierte "AAAA-MM-DD" (o "AAAA-MM-DDTHH:MM...") en una fecha LOCAL a las 00:00.
// new Date("2026-03-01") la toma como medianoche UTC, que en Colombia (UTC-5)
// cae el 28/feb a las 7 p.m. y desplaza el mes de las fechas en dia 1.
function fechaLocal(valor) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor ?? ""));
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Date(valor);
}

function escaparHtml(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML;
}

function construirResumenCopiable(vigente, nombreAfiliado, documento, mesesGraciaYParciales) {
    const documentoFormateado = formatoDocumento(documento);

    const lineas = [
        `Nombre: ${nombreAfiliado || ""}`,
        `Documento: ${documentoFormateado}`,
        `Código de crédito: ${formatoCodigoCredito(vigente["Codigo Credito"])}`,
        `Estado: ${vigente.Estado || ""}`,
        `Valor del crédito: ${formatoMoneda(vigente["Valor Credito"])}`,
        `Saldo pendiente: ${formatoMoneda(vigente["Saldo Capital"])}`,
        `Capital pagado: ${formatoMoneda(vigente["Capital Pagado"])}`,
        `Cuotas: ${vigente["Cuotas Pagadas"] || 0} de ${vigente["Cuotas Pactadas"] || 0}`,
        `Fecha inicial: ${vigente["Fecha Inicial"] || ""}`,
        `Fecha final: ${vigente["Fecha Final"] || ""}`,
        `Próximo pago: ${vigente["Proximo Pago"] || ""}`
    ];

    // "Última Actualización Portal" va antes de la Nota (la Nota queda de última).
    const fechaActualizacion = fechaActualizacionCorta();
    if (fechaActualizacion) lineas.push(`Última Actualización Portal: ${fechaActualizacion}`);

    if (mesesGraciaYParciales > 0) {
        lineas.push(
            `Nota: Este crédito registra ${formatearMeses(mesesGraciaYParciales)} mes(es) de gracia y/o pagos parciales, situación que generó una ampliación del plazo inicialmente pactado.`
        );
    }

    return lineas.join("\n");
}

// Para timestamps completos (con hora), como fecha_publicacion de
// Comunicados -- formatearFecha() se rompe con estos porque fue
// pensada solo para fechas simples "YYYY-MM-DD".
function formatearFechaHora(fechaISO) {

    if (!fechaISO) return "";

    const fecha = new Date(fechaISO);

    return fecha.toLocaleString("es-CO", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });

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

    datosPortalActual = null;
    mostrarAvisoConsultaInterna(false);

    document.getElementById("pantallaInicio").style.display = "block";
    document.body.classList.remove("modo-consulta");
    programarAjusteTitulos();

    // LIMPIAR TODOS LOS CAMPOS
    document.getElementById("documento").value = "";
    
    const inputContrasena = document.getElementById("contrasena");
    if (inputContrasena) {
        inputContrasena.value = '';
        inputContrasena.style.display = 'none';
    }
    
    // Limpiar errores
    const errorConsulta = document.getElementById('errorConsulta');
    if (errorConsulta) {
        errorConsulta.innerHTML = '';
        errorConsulta.style.display = 'none';
    }
    
    // Limpiar enlace de recuperación
    const linkRecuperacion = document.getElementById('linkRecuperacion');
    if (linkRecuperacion) {
        linkRecuperacion.style.display = 'none';
    }

    // Ocultar el botón del buzón y borrar los datos de la consulta anterior:
    // solo debe aparecer después de consultar un crédito.
    const enlaceBuzonInicio = document.getElementById('enlaceBuzon');
    if (enlaceBuzonInicio) {
        enlaceBuzonInicio.style.display = 'none';
        enlaceBuzonInicio.removeAttribute('href');
    }
    
    // Cerrar todos los modales
    const modales = ['modalPrimeraConfiguracion', 'modalRecuperacion', 'modalSolicitarReset'];
    modales.forEach(id => {
        const modal = document.getElementById(id);
        if (modal) modal.style.display = 'none';
    });
    
    // Resetear variables de autenticación
    documentoActual = null;
    intentosFallidos = 0;
    intentosFallidosRecuperacion = 0;
    esConsultaInterna = false;
    autenticacionCompleta = false;

    document.getElementById("documento").focus();

    // Los comunicados dirigidos a una persona en particular no deben
    // seguir viéndose una vez que esa persona sale de su consulta --
    // solo los generales (para todos) se quedan.
    document
        .querySelectorAll(".tarjeta-comunicado-personal")
        .forEach((el) => el.remove());

    cerrarVentanaComunicados();

    // Los generales vuelven a la zona de arriba (estaba oculta mientras se
    // veían debajo de la bienvenida); si no hay ninguno, queda oculta.
    document.getElementById("seccionComunicados").style.display =
        document.getElementById("listaComunicados").children.length ? "block" : "none";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}

function mostrarBienvenida(nombre, documento) {

    return `

        <div class="card bienvenida">

            <div class="bienvenida-saludo">
                Bienvenido (a)
            </div>

            <div class="bienvenida-nombre">
                ${escaparHtml(nombre)}
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

            <div class="item item-nombre-deudor">

                <div class="etiqueta">

                    Nombres y Apellidos del Deudor

                </div>

                <div class="valor">

                    ${escaparHtml(nombreAfiliado)}

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

function construirFechasCredito(vigente, mesesGracia) {

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
                     mesesGracia > 0
                      ? mesesGracia + " mes(es)"
                     : "No aplica"
                     }

                </div>

            </div>

        </div>

    </div>

    `;

}

// ======================================================
// VARIABLES Y FUNCIONES DE AUTENTICACIÓN
// ======================================================

let documentoActual = null;
let intentosFallidos = 0;
const MAX_INTENTOS = 3;
let intentosFallidosRecuperacion = 0;
const MAX_INTENTOS_RECUPERACION = 2;
let esConsultaInterna = false;
let autenticacionCompleta = false;

const PREGUNTAS_SECRETAS = {
    1: "¿Cómo se llamaba tu mejor amigo o amiga de la infancia?",
    2: "¿Cómo se llamaba tu profesor o profesora favorito del colegio?",
    3: "¿Qué apodo te daban de niño?",
    4: "¿Cuál era el nombre de tu primera mascota?",
    5: "¿Cuál es el nombre de tu primer colegio?",
    6: "¿En qué pueblo naciste?"
};

// Devuelve null si el documento no existe, o { tiene_clave, pregunta_secreta_id }.
// Ya NO descarga la fila del afiliado: los hashes no se exponen al navegador.
async function verificarAfiliadoExiste(documento) {
    try {
        const respuesta = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/estado_afiliado`,
            {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({ p_documento: documento })
            }
        );

        if (!respuesta.ok) return null;

        const datos = await respuesta.json();
        return datos || null;
    } catch (error) {
        console.error('Error al verificar afiliado:', error);
        return null;
    }
}

// Consulta del afiliado: Supabase verifica la contraseña (con conteo y
// bloqueo de intentos) y, SOLO si es correcta, entrega los datos de ese
// afiliado en la misma llamada. El navegador ya no lee las tablas.
// Devuelve { ok, bloqueado, segundos_restantes, intentos, nombre, creditos,
// pagos, comunicados_personales } o { error: true }.
let datosPortalActual = null;

async function consultarPortalAfiliado(documento, contrasena) {
    try {
        const respuesta = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/consultar_portal_afiliado`,
            {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({
                    p_documento: documento,
                    p_contrasena: contrasena
                })
            }
        );

        if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);
        return await respuesta.json();
    } catch (error) {
        console.error('Error al consultar el portal:', error);
        return { ok: false, bloqueado: false, segundos_restantes: 0, intentos: 0, error: true };
    }
}

// Consulta interna (documento + 000): lo mismo, con la clave del comité.
async function consultarPortalInterno(documento, claveComite) {
    try {
        const respuesta = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/consultar_portal_interno`,
            {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({
                    p_documento: documento,
                    p_clave: claveComite
                })
            }
        );

        if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);
        return await respuesta.json();
    } catch (error) {
        console.error('Error en la consulta interna:', error);
        return { ok: false, bloqueado: false, segundos_restantes: 0, intentos: 0, error: true };
    }
}

// Registra la consulta en Supabase usando la ficha de un solo uso que
// entregó consultar_portal_afiliado (sin ficha válida no se registra nada).
async function registrarConsultaSegura(token, codigoCredito) {
    if (!token) return;

    try {
        await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/registrar_consulta`,
            {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({
                    p_token: token,
                    p_codigo: codigoCredito,
                    p_navegador: navigator.userAgent,
                    p_plataforma: navigator.platform
                })
            }
        );
    } catch (error) {
        console.error('Error registrando consulta:', error);
    }
}

// Comunicados generales (los que ve cualquiera al abrir el portal).
async function listarComunicadosPublicos() {
    try {
        const respuesta = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/listar_comunicados_publicos`,
            {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({})
            }
        );

        if (!respuesta.ok) return [];
        const datos = await respuesta.json();
        return Array.isArray(datos) ? datos : [];
    } catch (error) {
        console.error('Error al listar comunicados:', error);
        return [];
    }
}

// Segundos que le faltan a un documento bloqueado (0 = libre).
async function consultarBloqueoAfiliado(documento) {
    try {
        const respuesta = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/estado_bloqueo_afiliado`,
            {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({ p_documento: documento })
            }
        );

        if (!respuesta.ok) return 0;
        const segundos = await respuesta.json();
        return Number(segundos) || 0;
    } catch (error) {
        console.error('Error al consultar bloqueo:', error);
        return 0;
    }
}

// Al recuperar la clave con la pregunta secreta, se levanta el bloqueo.
function textoEspera(segundos) {
    const minutos = Math.max(1, Math.ceil(segundos / 60));
    return minutos === 1 ? '1 minuto' : `${minutos} minutos`;
}

// Enlace "¿Olvidaste tu contraseña? Recuperar aquí" (usa la pregunta secreta).
function mostrarEnlaceRecuperacion(preguntaId) {
    const linkRecuperacion = document.getElementById('linkRecuperacion');
    if (!linkRecuperacion || !preguntaId) return;

    linkRecuperacion.style.display = 'block';
    document.getElementById('enlaceRecuperarContraseña').onclick = (e) => {
        e.preventDefault();
        mostrarModalRecuperacion(preguntaId);
    };
}

// Aviso bajo el campo de contraseña en las consultas internas (documento + 000).
// Se crea desde aquí para no depender de cambios en index.html.
function mostrarAvisoConsultaInterna(mostrar) {
    const input = document.getElementById('contrasena');
    if (!input) return;

    let aviso = document.getElementById('avisoConsultaInterna');

    if (!aviso) {
        aviso = document.createElement('div');
        aviso.id = 'avisoConsultaInterna';
        aviso.style.cssText =
            'display:none; margin-top:8px; padding:8px 12px; border-radius:8px; ' +
            'border:1px solid rgba(0,102,204,.35); background:rgba(0,102,204,.08); ' +
            'color:inherit; font-size:13px; text-align:center;';
        aviso.textContent =
            '🔑 Consulta interna: usa la misma contraseña con la que ingresas al Portal Administrativo.';
        input.insertAdjacentElement('afterend', aviso);
    }

    aviso.style.display = mostrar ? 'block' : 'none';
}

// Alerta de bloqueo: sin crear solicitud al comité. La recuperación con
// la pregunta secreta sigue disponible.
function mostrarBloqueoIntentos(segundos, preguntaId) {
    const errorConsulta = document.getElementById('errorConsulta');
    const inputContrasena = document.getElementById('contrasena');

    errorConsulta.innerHTML =
        `🔒 Por seguridad, los intentos de ingreso están bloqueados por ahora. ` +
        `Podrás volver a intentarlo en ${textoEspera(segundos)}.`;
    errorConsulta.style.display = 'block';

    if (inputContrasena) {
        inputContrasena.value = '';
        inputContrasena.style.display = 'none';
    }
    mostrarAvisoConsultaInterna(false);

    mostrarEnlaceRecuperacion(preguntaId);
}

async function guardarContraseñaYPregunta(documento, contrasena, preguntaId, respuesta) {
    try {
        const respuestaFetch = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/configurar_primera_vez`,
            {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({
                    p_documento: documento,
                    p_contrasena: contrasena,
                    p_pregunta_id: parseInt(preguntaId),
                    p_respuesta: respuesta
                })
            }
        );

        if (!respuestaFetch.ok) throw new Error('Error guardando configuración');

        const datos = await respuestaFetch.json();
        return datos === true;
    } catch (error) {
        console.error('Error al guardar contraseña y pregunta:', error);
        return false;
    }
}

// Recuperar la clave: Supabase verifica la respuesta secreta y guarda la
// nueva clave en un solo paso (con límite de intentos).
// Devuelve { ok, bloqueado, segundos_restantes, intentos } o { error: true }.
async function recuperarClaveAfiliado(documento, respuesta, nuevaContrasena) {
    try {
        const respuestaFetch = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/recuperar_clave_afiliado`,
            {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({
                    p_documento: documento,
                    p_respuesta: respuesta,
                    p_nueva: nuevaContrasena
                })
            }
        );

        if (!respuestaFetch.ok) throw new Error('HTTP ' + respuestaFetch.status);
        return await respuestaFetch.json();
    } catch (error) {
        console.error('Error al recuperar la clave:', error);
        return { ok: false, bloqueado: false, segundos_restantes: 0, intentos: 0, error: true };
    }
}

async function crearSolicitudResetAfiliado(documento) {
    try {
        const respuesta = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/crear_solicitud_reset_afiliado`,
            {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({
                    p_documento: documento
                })
            }
        );
        
        if (!respuesta.ok) throw new Error('Error creando solicitud');
        
        return true;
    } catch (error) {
        console.error('Error creando solicitud de reset:', error);
        return false;
    }
}

// ======================================================
// FUNCIONES DE MODALES
// ======================================================

function mostrarModalPrimeraConfiguracion() {
    document.getElementById('nuevaContrasena').value = '';
    document.getElementById('repiteContrasena').value = '';
    document.getElementById('preguntaSecreta').value = '';
    document.getElementById('respuestaSecreta').value = '';
    document.getElementById('errorConfig').textContent = '';
    document.getElementById('errorConfig').style.display = 'none';
    document.getElementById('modalPrimeraConfiguracion').style.display = 'flex';
}

function ocultarModalPrimeraConfiguracion() {
    document.getElementById('modalPrimeraConfiguracion').style.display = 'none';
    document.getElementById('nuevaContrasena').value = '';
    document.getElementById('repiteContrasena').value = '';
    document.getElementById('preguntaSecreta').value = '';
    document.getElementById('respuestaSecreta').value = '';
    document.getElementById('errorConfig').textContent = '';
    document.getElementById('errorConfig').style.display = 'none';
}

function mostrarModalRecuperacion(preguntaId) {
    const pregunta = PREGUNTAS_SECRETAS[preguntaId] || 'Pregunta no encontrada';
    document.getElementById('textoPreguntaSecreta').textContent = pregunta;
    intentosFallidosRecuperacion = 0;
    document.getElementById('respuestaRecuperacion').value = '';
    document.getElementById('nuevaContrasena2').value = '';
    document.getElementById('repiteContrasena2').value = '';
    document.getElementById('errorRecupera').textContent = '';
    document.getElementById('errorRecupera').style.display = 'none';
    setTimeout(() => {
        document.getElementById('respuestaRecuperacion').focus();
    }, 100);
    document.getElementById('modalRecuperacion').style.display = 'flex';
}

function ocultarModalRecuperacion() {
    document.getElementById('modalRecuperacion').style.display = 'none';
    document.getElementById('respuestaRecuperacion').value = '';
    document.getElementById('nuevaContrasena2').value = '';
    document.getElementById('repiteContrasena2').value = '';
    document.getElementById('errorRecupera').textContent = '';
    document.getElementById('errorRecupera').style.display = 'none';
    intentosFallidosRecuperacion = 0;
}

function mostrarModalSolicitarReset() {
    document.getElementById('modalSolicitarReset').style.display = 'flex';
}

function ocultarModalSolicitarReset() {
    document.getElementById('modalSolicitarReset').style.display = 'none';
}

// ======================================================
// FUNCIÓN CONSULTAR MEJORADA
// ======================================================

// Nueva función consultar() que PRIMERO valida autenticación
async function consultar() {
    const documento = document.getElementById("documento").value.trim();
    const contrasena = document.getElementById("contrasena")?.value.trim() || '';
    const errorConsulta = document.getElementById("errorConsulta");
    const inputContrasena = document.getElementById("contrasena");
    
    if (!documento) {
        errorConsulta.innerHTML = '❌ Por favor ingresa tu documento';
        errorConsulta.style.display = 'block';
        return;
    }
    
    // Detectar consulta interna
    esConsultaInterna = documento.endsWith('000');
    documentoActual = esConsultaInterna ? documento.slice(0, -3) : documento;
    autenticacionCompleta = false;
    
    // Si contraseña NO está visible, validar documento PRIMERO
    if (!inputContrasena || inputContrasena.style.display === 'none') {
        // El contador de intentos solo se reinicia al validar el documento,
        // no cada vez que se envía la contraseña.
        intentosFallidos = 0;
        mostrarAvisoConsultaInterna(false);

        errorConsulta.innerHTML = '⏳ Validando...';
        errorConsulta.style.display = 'block';
        
        if (esConsultaInterna) {
            // Consulta interna: el documento (sin los 000) debe existir
            // ANTES de pedir la contraseña del comité.
            const afiliadoInterno = await verificarAfiliadoExiste(documentoActual);

            if (!afiliadoInterno) {
                errorConsulta.innerHTML = '❌ Documento no encontrado';
                errorConsulta.style.display = 'block';
                if (inputContrasena) inputContrasena.style.display = 'none';
                return;
            }

            errorConsulta.style.display = 'none';
            if (inputContrasena) {
                inputContrasena.style.display = 'block';
                inputContrasena.value = '';
                mostrarAvisoConsultaInterna(true);
                inputContrasena.focus();
            }
            return;
        }
        
        // Consulta de afiliado: validar que existe
        const afiliado = await verificarAfiliadoExiste(documentoActual);
        
        if (!afiliado) {
            errorConsulta.innerHTML = '❌ Documento no encontrado';
            errorConsulta.style.display = 'block';
            if (inputContrasena) inputContrasena.style.display = 'none';
            return;
        }
        
        // Documento existe: mostrar modal si es primera vez
        if (!afiliado.tiene_clave) {
            errorConsulta.style.display = 'none';
            if (inputContrasena) inputContrasena.style.display = 'none';
            mostrarModalPrimeraConfiguracion();
            return;
        }
        
        // ¿Este documento está bloqueado por intentos fallidos?
        const segundosBloqueo = await consultarBloqueoAfiliado(documentoActual);
        if (segundosBloqueo > 0) {
            mostrarBloqueoIntentos(segundosBloqueo, afiliado.pregunta_secreta_id);
            return;
        }
        
        // Mostrar campo de contraseña y, de una vez, la opción de recuperarla
        errorConsulta.style.display = 'none';
        if (inputContrasena) {
            inputContrasena.style.display = 'block';
            inputContrasena.value = '';
            inputContrasena.focus();
        }
        mostrarEnlaceRecuperacion(afiliado.pregunta_secreta_id);
        return;
    }
    
    // Campo de contraseña VISIBLE: validar contraseña
    if (!contrasena) {
        errorConsulta.innerHTML = '❌ Por favor ingresa tu contraseña';
        errorConsulta.style.display = 'block';
        return;
    }
    
    errorConsulta.innerHTML = '⏳ Verificando...';
    errorConsulta.style.display = 'block';
    
    if (esConsultaInterna) {
        // Consulta interna: la clave del comité se verifica (y se limita) en Supabase
        const acceso = await consultarPortalInterno(documentoActual, contrasena);

        if (acceso.error) {
            errorConsulta.innerHTML = '❌ No se pudo verificar en este momento. Intenta de nuevo.';
            errorConsulta.style.display = 'block';
            return;
        }

        if (!acceso.ok) {
            inputContrasena.value = '';

            if (acceso.bloqueado) {
                mostrarBloqueoIntentos(acceso.segundos_restantes, null);
                return;
            }

            intentosFallidos++;

            if (intentosFallidos < MAX_INTENTOS) {
                errorConsulta.innerHTML = `❌ Contraseña incorrecta (Intento ${intentosFallidos}/${MAX_INTENTOS})`;
                errorConsulta.style.display = 'block';
                inputContrasena.focus();
            } else {
                // Sin recuperación por pregunta: el comité no la usa.
                mostrarBusqueda();
                errorConsulta.innerHTML = '❌ Máximo de intentos excedidos. Vuelve a empezar.';
                errorConsulta.style.display = 'block';
            }
            return;
        }

        datosPortalActual = acceso;
        errorConsulta.style.display = 'none';
    } else {
        // Contraseña del afiliado: el conteo, el bloqueo y los datos viven en Supabase
        const acceso = await consultarPortalAfiliado(documentoActual, contrasena);
        
        if (acceso.error) {
            errorConsulta.innerHTML = '❌ No se pudo verificar en este momento. Intenta de nuevo.';
            errorConsulta.style.display = 'block';
            return;
        }
        
        if (!acceso.ok) {
            inputContrasena.value = '';
            const afiliado = await verificarAfiliadoExiste(documentoActual);
            const preguntaId = afiliado?.pregunta_secreta_id;
            
            if (acceso.bloqueado) {
                // Sin solicitud al comité: solo se avisa y se espera.
                mostrarBloqueoIntentos(acceso.segundos_restantes, preguntaId);
                return;
            }
            
            intentosFallidos = acceso.intentos;
            errorConsulta.innerHTML = `❌ Contraseña incorrecta (Intento ${acceso.intentos}/${MAX_INTENTOS})`;
            errorConsulta.style.display = 'block';
            mostrarEnlaceRecuperacion(preguntaId);
            inputContrasena.focus();
            return;
        }
        
        datosPortalActual = acceso;
        errorConsulta.style.display = 'none';
    }
    
    // Autenticación exitosa: mostrar créditos (los datos ya vienen en datosPortalActual)
    autenticacionCompleta = true;
    buscarCredito();
}

async function buscarCredito() {

let documento =
    document.getElementById("documento").value.trim();

if (!documento) return;

const MARCA_CONSULTA_INTERNA = /000$/;
const esConsultaInterna = MARCA_CONSULTA_INTERNA.test(documento);

if (esConsultaInterna) {
    documento = documento.replace(MARCA_CONSULTA_INTERNA, "").trim();
}

const btnConsultar = document.getElementById("btnConsultar");
const errorConsulta = document.getElementById("errorConsulta");

if (errorConsulta) errorConsulta.style.display = "none";

const textoOriginalBoton = btnConsultar.textContent;
btnConsultar.disabled = true;
btnConsultar.textContent = "Consultando...";

try {

// Los datos (nombre, créditos, pagos, comunicados personales) ya llegaron
// con la verificación de la contraseña: no se vuelve a leer ninguna tabla.
const datosPortal = datosPortalActual;

if (!datosPortal) {
    throw new Error("No hay datos de la consulta. Vuelve a ingresar tu documento y contraseña.");
}

const ultimaConsulta = datosPortal.ultima_consulta || null;

const registrosBD = datosPortal.creditos || [];

const nombreAfiliado = datosPortal.nombre || "";

const fechaRetiroSind = datosPortal.fecha_retiro_sind
    ? formatearFecha(datosPortal.fecha_retiro_sind)
    : "";

// Activar el enlace del buzon en el pie de pagina, ahora que ya
// sabemos documento y nombre (antes de consultar, permanece oculto).
const enlaceBuzon = document.getElementById("enlaceBuzon");
if (enlaceBuzon && documento) {
    enlaceBuzon.href =
        `buzon-sugerencias.html?documento=${encodeURIComponent(documento)}&nombre=${encodeURIComponent(nombreAfiliado || "")}`;
    enlaceBuzon.style.display = "inline-block";
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

const pagos = (datosPortal.pagos || [])
    .filter(p => p.Codigo_Credito === codigoCredito)
    .sort((a, b) => Number(a.Numero_cuota) - Number(b.Numero_cuota));

document.getElementById("pantallaInicio").style.display = "none";
document.body.classList.add("modo-consulta");

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

const cronograma = construirTablaAmortizacion(
    vigente,
    pagos,
    window.fechaActualizacionReal
);

const textoParaCopiar = esConsultaInterna
    ? construirResumenCopiable(vigente, nombreAfiliado, documento, cronograma.mesesGraciaYParciales)
    : "";

let html = construirResumenCredito(vigente, porcentaje) + `

<div class="card">

    <div class="estado ${estadoInfo.clase}">

        <div class="estado-titulo">
            Estado Actual del Crédito
        </div>

        <div class="estado-valor">
            ${estadoInfo.icono} ${vigente.Estado}
        </div>

    </div>

    ${esConsultaInterna ? `
    <div style="text-align:center;margin-top:14px;">
        <button id="btnCopiarDatos" type="button" class="btn-copiar-interno">📋 Copiar datos del crédito</button>
    </div>
    ` : ""}

    ${construirDatosDeudor(
    vigente,
    nombreAfiliado,
    esAfiliado,
    afiliacionTexto,
    afiliacionClase
)}

   ${construirInformacionCredito(vigente)}

   ${construirFechasCredito(vigente, cronograma.mesesGracia)}

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

                <div class="valor" style="
                    min-width:60px;
                    text-align:right;
                    font-weight:bold;
                    color:#006633;
                    font-size:18px;
                ">
                    ${porcentaje === 100 ? "100%" : porcentaje.toFixed(2) + "%"}
                </div>

            </div>

            <div class="desglose-progreso">
                <span><i class="punto punto-capital"></i> Capital pagado: ${formatoMoneda(vigente["Capital Pagado"])}</span>
                <span><i class="punto punto-interes"></i> Interés pagado: ${formatoMoneda(vigente["Interes Pagado"])}</span>
            </div>

            </div>

        </div>

    </div>

     ${cronograma.html}
     
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
    <p class="historial-ayuda">Use el ícono de documento, junto al estado, para descargar el PDF de cada crédito.</p>
    <div id="mensajePdfCredito" class="mensaje-pdf" role="status" aria-live="polite" style="display:none"></div>

    <div class="pista-scroll">↔ Desliza para ver más</div>

    <div class="tabla-scroll">
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

        <td>
            <div class="estado-con-pdf">
                <span>${escaparHtml(r["Estado"] || "")}</span>
                <button
                    type="button"
                    class="btn-pdf-credito"
                    data-codigo="${escaparHtml(String(r["Codigo Credito"] || "")).replace(/"/g, "&quot;")}"
                    title="Descargar PDF del crédito ${escaparHtml(formatoCodigoCredito(r["Codigo Credito"]))}"
                    aria-label="Descargar PDF del crédito ${escaparHtml(formatoCodigoCredito(r["Codigo Credito"]))}">
                    ${ICONO_PDF}
                </button>
            </div>
        </td>

    </tr>

    `;

});

html += `
    </table>
    </div>
</div>
`;

contextoPdf = {
    registros,
    pagos: datosPortal.pagos || [],
    nombre: nombreAfiliado,
    documento
};
resultado.innerHTML =
    mostrarBienvenida(nombreAfiliado, documento) +
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

instalarDescargaPdf();
ajustarTitulosUnaLinea();
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

if (!esConsultaInterna) {
    await registrarConsultaSegura(
        datosPortal.token_consulta,
        vigente["Codigo Credito"]
    );
}

 // Los comunicados dirigidos a esta persona van justo DEBAJO de la bienvenida,
 // que es donde el portal deja la pantalla después de consultar.
 await mostrarComunicadosDebajoDeBienvenida(
     datosPortal.comunicados_personales || [],
     { conVentana: !esConsultaInterna }
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

const btnCopiarDatos = document.getElementById("btnCopiarDatos");

if (btnCopiarDatos) {
    btnCopiarDatos.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(textoParaCopiar);
            btnCopiarDatos.textContent = "✅ Copiado";
        } catch (error) {
            btnCopiarDatos.textContent = "No se pudo copiar";
        }

        setTimeout(() => {
            btnCopiarDatos.textContent = "📋 Copiar datos del crédito";
        }, 2000);
    });
}

} catch (error) {

    console.error("Error al consultar el crédito:", error);

    if (errorConsulta) {
        errorConsulta.textContent =
            "No fue posible completar la consulta. Verifica tu conexión a internet e inténtalo de nuevo.";
        errorConsulta.style.display = "block";
    }

} finally {

    btnConsultar.disabled = false;
    btnConsultar.textContent = textoOriginalBoton;

}

}

document.addEventListener("DOMContentLoaded", async () => {

    await cargarDatos();

    mostrarBusqueda();

    cargarComunicados();

    const btnVolverArriba = document.getElementById("btnVolverArriba");

    if (btnVolverArriba) {

        window.addEventListener("scroll", () => {
            btnVolverArriba.classList.toggle("visible", window.scrollY > 400);
        });

        btnVolverArriba.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });

    }

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

    // Si cambian el documento cuando ya se ve el campo de contraseña o el enlace
    // de recuperación, se vuelve a validar desde cero (evita recuperar la clave
    // de otro documento).
    document
        .getElementById("documento")
        .addEventListener("input", function () {
            const campoClave = document.getElementById("contrasena");
            const enlaceRecuperar = document.getElementById("linkRecuperacion");
            const claveVisible = campoClave && campoClave.style.display !== "none";
            const enlaceVisible = enlaceRecuperar && enlaceRecuperar.style.display === "block";
            if (!claveVisible && !enlaceVisible) return;

            if (campoClave) {
                campoClave.value = "";
                campoClave.style.display = "none";
            }
            if (enlaceRecuperar) enlaceRecuperar.style.display = "none";
            mostrarAvisoConsultaInterna(false);
            const errorDoc = document.getElementById("errorConsulta");
            if (errorDoc) {
                errorDoc.innerHTML = "";
                errorDoc.style.display = "none";
            }
            intentosFallidos = 0;
        });

    // Agregar listener para ENTER en campo de contraseña
    const inputContrasena = document.getElementById("contrasena");
    if (inputContrasena) {
        inputContrasena.addEventListener("keypress", function(e){
            if(e.key === "Enter"){
                consultar();
            }
        });
    }

});

function formatearMeses(valor) {
    return Number.isInteger(valor) ? String(valor) : valor.toFixed(1).replace(".", ",");
}

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

        <div class="pista-scroll">↔ Desliza para ver más</div>

    <div class="tabla-scroll">
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

    const fechaInicio = fechaLocal(vigente.Fecha_Inicial);

    const diaPago = vigente.Empresa === "ELG" ? 25 : 30;

    // Determina si un pago concreto fue parcial (mismo criterio que se
    // usaba adentro del bucle, ahora también se necesita ANTES de
    // empezar a recorrer el cronograma, para saber cuántas filas extra
    // hacen falta en total).
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

    // Los pagos parciales corresponden a quincenas -- se emparejan de a
    // dos (sin importar el orden ni si están seguidos) porque dos
    // parciales juntos ya completan una cuota normal y no necesitan
    // fila extra propia. Solo cuando el total de parciales es IMPAR
    // sobra una quincena suelta, y esa es la que agrega 1 fila extra al
    // final del cronograma, cerrando en día 15 en vez del día normal.
    const totalParciales = pagos.filter(esPagoParcial).length;
    const extraPorParciales = Math.ceil(totalParciales / 2);
    const cierraEnQuince = totalParciales % 2 === 1;

    let cuotasExtra = extraPorParciales;
    let mesesGraciaCompleta = 0;
    let mesesPagoParcial = 0;
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

    // Las filas se arman en memoria primero (no directo a HTML) porque
    // solo al terminar el bucle se sabe cuál termina siendo la ÚLTIMA
    // fila real -- y es únicamente esa última fila la que debe caer en
    // día 15 (ver "cierraEnQuince" arriba).
    const filas = [];

    while (

    numeroCuota <= cuotasPactadas + cuotasExtra

    &&

    !(creditoAnulado && numeroCuota > pagos.length)

    &&

    !finalizarCronograma

        ) {

     detenerDespuesDeEstaFila = false;

    // Antes esto hacía setMonth() y luego setDate(diaPago) por
    // separado -- si el mes resultante no tiene ese día (ej. febrero
    // no tiene 30), el 30 "desbordaba" hacia el mes siguiente ANTES de
    // que setDate volviera a fijar el día, saltándose un mes entero.
    // Se arma la fecha directo en el día 1 del mes destino (siempre
    // válido) y se recorta el día al último día real de ese mes si
    // diaPago no le cabe.
    const mesObjetivo = fechaInicio.getMonth() + (numeroCuota - 1);
    const fechaCuota = new Date(fechaInicio.getFullYear(), mesObjetivo, 1);
    const ultimoDiaDelMes = new Date(fechaCuota.getFullYear(), fechaCuota.getMonth() + 1, 0).getDate();

    fechaCuota.setDate(Math.min(diaPago, ultimoDiaDelMes));

    const pago = pagos.find(p => {

        const fechaPago = fechaLocal(p.Fecha);

    return mismoMes(fechaPago, fechaCuota);

});

    let estado = "";

if (pago) {

    totalCapital += Number(pago.Capital_Pagado || 0);

    totalInteres += Number(pago.Interes_Pagado || 0);

    totalCuota += Number(pago.Valor_Cuota || 0);

    if (esPagoParcial(pago)) {

    estado = "🟡 Pago Parcial";

    mesesPagoParcial++;

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
    mesesGraciaCompleta++;
    
} else {

    estado = "⚪ Pendiente";

}
    
}

    filas.push({ numeroCuota, fechaCuota, pago, estado });

    if (detenerDespuesDeEstaFila) {

    finalizarCronograma = true;

    }

    numeroCuota++;

}

// Si el cronograma se amplió (hay más filas que cuotas pactadas) y la
// última fila es una proyección sin pago real todavía registrado, esa
// última fila cierra en día 15 solo cuando el total de pagos parciales
// es impar (queda una quincena suelta sin pareja). Si es par (todos los
// parciales se emparejaron) o si la ampliación vino de tiempos de
// gracia, la fila de cierre se deja en el día normal (25 o 30).
if (filas.length > 0) {

    const ultima = filas[filas.length - 1];

    const seAmplioElCronograma = ultima.numeroCuota > cuotasPactadas;

    if (seAmplioElCronograma && !ultima.pago && cierraEnQuince) {

        ultima.fechaCuota.setDate(15);

    }

}

filas.forEach(({ numeroCuota, fechaCuota, pago, estado }) => {

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

});

html += `

    <tr class="fila-totales" style="font-weight:bold;">

            <td colspan="3">Totales</td>

        <td>${formatoMoneda(totalCapital)}</td>

        <td>${formatoMoneda(totalInteres)}</td>

        <td>${formatoMoneda(totalCuota)}</td>
        
        <td></td>
 <td>

            ${creditoAnulado ? "❌ Crédito Anulado" : ""}

        </td>

            </tr>

`;

html += `

        </table>
        </div>

`;

 if (cuotasExtra > 0) {

    html += `

    <div class="nota-gracia">

        <strong>Nota:</strong>

        Este crédito registra <strong>${formatearMeses(mesesGraciaCompleta + mesesPagoParcial * 0.5)}</strong> mes(es) de gracia y/o pagos parciales, situación que generó una ampliación del plazo inicialmente pactado.

    </div>

    `;

}

html += `

    </div>

`;

return {
    html,
    mesesGracia: mesesGraciaCompleta,
    mesesGraciaYParciales: mesesGraciaCompleta + mesesPagoParcial * 0.5,
    // Datos de las filas: los usa el PDF para que salga igual que el portal.
    filas,
    totalCapital,
    totalInteres,
    totalCuota,
    cuotasExtra
};

}
/*
  Comunicados dirigidos a UN documento en particular. Se piden aparte
  de los generales, y solo después de una consulta exitosa (antes no
  se sabe el documento). Nota de seguridad: al igual que el resto del
  portal, esto se filtra por parámetro en la consulta, no por sesión
  -- es el mismo modelo de confianza que ya tiene la consulta de
  créditos por documento (ver diagnóstico original).
*/
// ======================================================
// DOCUMENTO CON SEPARADORES, RESUMEN DEL CREDITO Y PDF POR CREDITO
// ======================================================

let contextoPdf = null;
let pdfListenerInstalado = false;
let logosPdfCache = null;
// El logo del FACS es un archivo propio; el del sindicato NO: se toma de la misma
// imagen que ya muestra el encabezado del portal (logo.png), sin duplicarla.
const LOGOS_PDF = {
    facs: "logo-facs-pdf.jpg?v=1"
};
const ICONO_PDF = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 11v6"/><path d="M9.5 14.5 12 17l2.5-2.5"/></svg>`;

// 1234567890 -> 1.234.567.890 (si trae letras u otros signos, se deja igual)
function formatoDocumento(doc) {
    const s = String(doc == null ? "" : doc).trim();
    return /^\d+$/.test(s) ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : s;
}

// Miles con punto, siempre (tambien en cifras de 4 digitos). Se usa en el PDF.
function milesPdf(valor) {
    const x = Math.round(Number(valor) || 0);
    return (x < 0 ? "-" : "") + String(Math.abs(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// "vigente" | "paz" | "anulado", con el mismo criterio de obtenerEstadoCredito()
function tipoCredito(estado) {
    const clase = obtenerEstadoCredito(estado).clase;
    if (clase === "estado-paz") return "paz";
    if (clase === "estado-anulado") return "anulado";
    return "vigente";
}

function porcentajeAmortizado(c) {
    let p = parseFloat(
        String(c["Porcentaje Amortizado"] || "0").replace("%", "").replace(",", ".")
    ) || 0;
    if (p <= 1) p = p * 100;
    return p;
}

function textoPorcentajeComa(p) {
    return (p === 100 ? "100" : p.toFixed(2).replace(".", ",")) + " %";
}

function textoTasaComa(valor) {
    let numero = Number(valor || 0);
    if (numero <= 1) numero *= 100;
    return (numero === 100 ? "100" : numero.toFixed(2).replace(".", ",")) + " %";
}

function fechaActualizacionCorta() {
    if (!window.fechaActualizacionReal) return "";
    const f = new Date(String(window.fechaActualizacionReal).replace(" ", "T"));
    if (isNaN(f)) return "";
    return f.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Tarjeta "Resumen del Crédito", al inicio de la consulta (vigente, paz y salvo o anulado)
function construirResumenCredito(c, porcentaje) {
    const tipo = tipoCredito(c.Estado);
    const info = obtenerEstadoCredito(c.Estado);
    const codigo = formatoCodigoCredito(c["Codigo Credito"]);
    const pagadas = Number(c["Cuotas Pagadas"] || 0);
    const pactadas = Number(c["Cuotas Pactadas"] || 0);
    const pct = Math.max(0, Math.min(100, Number(porcentaje) || 0));
    const fechaAct = fechaActualizacionCorta();
    let cuerpo = "";

    if (tipo === "paz") {
        const totalPagado = Number(c["Capital Pagado"] || 0) + Number(c["Interes Pagado"] || 0);
        cuerpo = `
            <div class="resumen-titulo">Crédito cancelado</div>
            <p class="resumen-texto">No hay saldo pendiente en este crédito.</p>
            <div class="progreso"><div class="barra" style="width:100%"></div></div>
            <div class="resumen-barra-texto">
                <span>${pagadas} de ${pactadas} cuotas pagadas</span>
                <span>100% amortizado</span>
            </div>
            <div class="grid resumen-grid">
                <div class="item">
                    <div class="etiqueta">Último Pago</div>
                    <div class="valor">${escaparHtml(c["Ultimo Pago"] || "-")}</div>
                </div>
                <div class="item">
                    <div class="etiqueta">Total Pagado</div>
                    <div class="valor">${formatoMoneda(totalPagado)}</div>
                </div>
            </div>`;
    } else if (tipo === "anulado") {
        cuerpo = `
            <div class="resumen-titulo">Crédito anulado</div>
            <p class="resumen-texto">Este crédito figura como anulado. Para más información, comuníquese con el comité.</p>
            <div class="grid resumen-grid">
                <div class="item">
                    <div class="etiqueta">Fecha de Inicio</div>
                    <div class="valor">${escaparHtml(c["Fecha Inicial"] || "-")}</div>
                </div>
                <div class="item">
                    <div class="etiqueta">Valor del Crédito</div>
                    <div class="valor">${formatoMoneda(c["Valor Credito"])}</div>
                </div>
            </div>`;
    } else {
        cuerpo = `
            <div class="resumen-saldo">
                <div class="etiqueta">Saldo de Capital Pendiente</div>
                <div class="resumen-saldo-valor">${formatoMoneda(c["Saldo Capital"])}</div>
            </div>
            <div class="progreso"><div class="barra" style="width:${pct}%"></div></div>
            <div class="resumen-barra-texto">
                <span>${pagadas} de ${pactadas} cuotas pagadas</span>
                <span>${pct === 100 ? "100" : pct.toFixed(2)}% amortizado</span>
            </div>
            <div class="grid resumen-grid">
                <div class="item">
                    <div class="etiqueta">Próxima Cuota</div>
                    <div class="valor">${escaparHtml(c["Proximo Pago"] || "-")}</div>
                </div>
                <div class="item">
                    <div class="etiqueta">Valor de la Cuota</div>
                    <div class="valor">${formatoMoneda(c["Cuota"])}</div>
                </div>
            </div>`;
    }

    return `
    <div class="card resumen-credito">
        <div class="seccion">
            <h2>Resumen del Crédito</h2>
            <div class="resumen-cabecera">
                <span class="resumen-insignia resumen-insignia-${tipo}">${info.icono} ${escaparHtml(c.Estado || "")}</span>
                <span class="resumen-codigo">Crédito ${escaparHtml(codigo)}</span>
            </div>
            ${cuerpo}
            ${fechaAct ? `<div class="resumen-actualizacion">Datos actualizados: ${fechaAct}</div>` : ""}
        </div>
    </div>
    `;
}

// ---------- PDF del credito ----------

function fechaDDMMAAAA(f) {
    return `${String(f.getDate()).padStart(2, "0")}/${String(f.getMonth() + 1).padStart(2, "0")}/${f.getFullYear()}`;
}

function estadoFilaPdf(estado) {
    const e = String(estado || "");
    if (e.includes("Cancelado")) return "cancelado";
    if (e.includes("Parcial")) return "parcial";
    if (e.includes("Gracia")) return "gracia";
    if (e.includes("Pagada")) return "pagada";
    return "pendiente";
}

function construirDatosPdf(c, ctx) {
    const tipo = tipoCredito(c.Estado);
    const dinero = v => "$ " + milesPdf(v);
    const texto = v => (v === null || v === undefined || v === "") ? "-" : String(v);
    const estadoTexto = String(c.Estado || "").trim();
    const fechaDatos = window.fechaActualizacionReal
        ? new Date(String(window.fechaActualizacionReal).replace(" ", "T"))
        : null;

    const datos = {
        codigo: formatoCodigoCredito(c["Codigo Credito"]),
        tipo,
        estadoTexto: (estadoTexto && estadoTexto.length <= 20)
            ? estadoTexto
            : (tipo === "paz" ? "Paz y Salvo" : tipo === "anulado" ? "Anulado" : "Vigente"),
        nombre: ctx.nombre || "",
        documento: formatoDocumento(ctx.documento),
        generado: new Date().toLocaleString("es-CO", {
            timeZone: "America/Bogota",
            day: "numeric", month: "long", year: "numeric",
            hour: "numeric", minute: "2-digit", hour12: true
        }).replace(/[\u00A0\u202F]/g, " ") + " (hora de Colombia)",
        datosAl: (fechaDatos && !isNaN(fechaDatos))
            ? fechaDatos.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })
            : "la última actualización del Fondo"
    };

    if (tipo === "anulado") {
        datos.tiles = [
            ["Fecha de inicio", texto(c["Fecha Inicial"])],
            ["Valor del crédito", dinero(c["Valor Credito"])],
            ["Cuotas pactadas", texto(c["Cuotas Pactadas"])]
        ];
        datos.notaAnulado = "Este crédito figura como anulado en los registros del Fondo. Para más información, comuníquese con el comité.";
        return datos;
    }

    // El cronograma sale de la MISMA funcion que usa el portal en pantalla.
    const pagosCredito = (ctx.pagos || [])
        .filter(p => p.Codigo_Credito === c["Codigo Credito"])
        .sort((a, b) => Number(a.Numero_cuota) - Number(b.Numero_cuota));
    const cron = construirTablaAmortizacion(
        c,
        pagosCredito,
        window.fechaActualizacionReal || new Date().toISOString()
    );
    datos.filas = cron.filas.map(f => ({
        n: f.numeroCuota,
        f: fechaDDMMAAAA(f.fechaCuota),
        est: estadoFilaPdf(f.estado),
        pago: !!f.pago,
        si: f.pago ? Number(f.pago.Saldo_Inicial || 0) : 0,
        cap: f.pago ? Number(f.pago.Capital_Pagado || 0) : 0,
        int: f.pago ? Number(f.pago.Interes_Pagado || 0) : 0,
        vc: f.pago ? Number(f.pago.Valor_Cuota || 0) : 0,
        sf: f.pago ? Number(f.pago.Saldo_Final || 0) : 0
    }));
    datos.totales = { cap: cron.totalCapital, int: cron.totalInteres, vc: cron.totalCuota };
    datos.notaGracia = cron.cuotasExtra > 0
        ? `Nota: Este crédito registra ${formatearMeses(cron.mesesGraciaYParciales)} mes(es) de gracia y/o pagos parciales, situación que generó una ampliación del plazo inicialmente pactado.`
        : null;

    const pct = porcentajeAmortizado(c);
    const cuotas = `${c["Cuotas Pagadas"] || 0} de ${c["Cuotas Pactadas"] || 0}`;
    const tasa = textoTasaComa(c["Porcentaje Interes"]);

    if (tipo === "paz") {
        const total = Number(c["Capital Pagado"] || 0) + Number(c["Interes Pagado"] || 0);
        datos.tiles = [
            ["Fecha de inicio", texto(c["Fecha Inicial"])],
            ["Fecha final", texto(c["Fecha Final"])],
            ["Último pago", texto(c["Ultimo Pago"])],
            ["Cuotas pagadas", cuotas],
            ["Valor inicial desembolsado", dinero(c["Valor Desembolsado"])],
            ["Valor total del crédito", dinero(c["Valor Credito"])],
            ["Cuota mensual", dinero(c["Cuota"])],
            ["Tasa de interés aplicada", tasa],
            ["Capital pagado", dinero(c["Capital Pagado"])],
            ["Intereses pagados", dinero(c["Interes Pagado"])],
            ["Porcentaje amortizado", "100 %"],
            ["Total pagado", dinero(total)]
        ];
        datos.franja = { izq: "Crédito cancelado · sin saldo pendiente", valor: "$ 0", pct: 100, textoPct: "100 %" };
    } else {
        datos.tiles = [
            ["Fecha de inicio", texto(c["Fecha Inicial"])],
            ["Fecha final", texto(c["Fecha Final"])],
            ["Último pago", texto(c["Ultimo Pago"])],
            ["Próximo pago", texto(c["Proximo Pago"])],
            ["Valor inicial desembolsado", dinero(c["Valor Desembolsado"])],
            ["Valor total del crédito", dinero(c["Valor Credito"])],
            ["Cuota mensual", dinero(c["Cuota"])],
            ["Tasa de interés aplicada", tasa],
            ["Cuotas pagadas", cuotas],
            ["Porcentaje amortizado", textoPorcentajeComa(pct)],
            ["Capital pagado", dinero(c["Capital Pagado"])],
            ["Intereses pagados", dinero(c["Interes Pagado"])]
        ];
        datos.franja = {
            izq: "Saldo de capital pendiente",
            valor: dinero(c["Saldo Capital"]),
            pct,
            textoPct: textoPorcentajeComa(pct)
        };
    }
    return datos;
}

// Toma la imagen del encabezado (la misma ruta que ya usa la pagina), la pasa a JPEG
// y la deja lista para el PDF. Si el navegador no puede (por ejemplo, al abrir la
// pagina como archivo local sin servidor), devuelve null y el PDF sale sin ese logo.
async function logoSindicatoComoJpeg() {
    const origen = document.querySelector("img.logo");
    const ruta = origen ? (origen.currentSrc || origen.src) : "logo.png";
    const img = new Image();
    await new Promise((ok, mal) => {
        img.onload = ok;
        img.onerror = () => mal(new Error("No se pudo cargar el logo del sindicato"));
        img.src = ruta;
    });
    // Sin agrandar: si el logo es pequeno, se conserva su tamano (maximo 320).
    const lado = Math.min(320, Math.max(img.naturalWidth, img.naturalHeight));
    const lienzo = document.createElement("canvas");
    lienzo.width = lado;
    lienzo.height = lado;
    const ctx = lienzo.getContext("2d");
    ctx.fillStyle = "#ffffff";                     // el fondo transparente pasa a blanco
    ctx.fillRect(0, 0, lado, lado);
    const escala = Math.min(lado / img.naturalWidth, lado / img.naturalHeight);
    const ancho = img.naturalWidth * escala;
    const alto = img.naturalHeight * escala;
    ctx.drawImage(img, (lado - ancho) / 2, (lado - alto) / 2, ancho, alto);
    const blob = await new Promise((ok, mal) => {
        lienzo.toBlob(
            b => (b ? ok(b) : mal(new Error("No se pudo convertir el logo del sindicato"))),
            "image/jpeg",
            0.92
        );
    });
    return new Uint8Array(await blob.arrayBuffer());
}

async function cargarLogosPdf() {
    if (logosPdfCache) return logosPdfCache;
    const [facs, sindicato] = await Promise.all([
        fetch(LOGOS_PDF.facs)
            .then(r => {
                if (!r.ok) throw new Error("No se pudo cargar el logo del FACS");
                return r.arrayBuffer();
            })
            .then(b => new Uint8Array(b))
            .catch(error => { console.error(error); return null; }),
        logoSindicatoComoJpeg()
            .catch(error => { console.error(error); return null; })
    ]);
    const logos = { facs, sindicato };
    if (facs && sindicato) logosPdfCache = logos;   // solo se guarda si cargaron los dos
    return logos;
}

function mostrarMensajePdf(texto, esError) {
    const caja = document.getElementById("mensajePdfCredito");
    if (!caja) return;
    caja.textContent = texto;
    caja.classList.toggle("es-error", !!esError);
    caja.style.display = "block";
}

async function descargarPdfCredito(codigoCredito) {
    try {
        if (!contextoPdf) throw new Error("No hay datos de la consulta");
        if (!window.PdfCredito) throw new Error("El generador de PDF no está cargado");
        const c = contextoPdf.registros.find(
            r => String(r["Codigo Credito"]) === String(codigoCredito)
        );
        if (!c) throw new Error("Crédito no encontrado");
        const codigoVisible = formatoCodigoCredito(c["Codigo Credito"]);
        mostrarMensajePdf(`Generando el PDF del crédito ${codigoVisible}...`, false);

        const logos = await cargarLogosPdf();
        const datos = construirDatosPdf(c, contextoPdf);
        datos.logoFacs = logos.facs;
        datos.logoSind = logos.sindicato;

        const bytes = window.PdfCredito.generar(datos);
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = `FACS_Estado_de_cuenta_credito_${codigoVisible}.pdf`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);

        mostrarMensajePdf(
            (logos.facs && logos.sindicato)
                ? `PDF del crédito ${codigoVisible} generado. Revise sus descargas.`
                : `PDF del crédito ${codigoVisible} generado, pero sin alguno de los logos (no se pudo cargar). Revise sus descargas.`,
            false
        );
    } catch (error) {
        console.error(error);
        mostrarMensajePdf("No fue posible generar el PDF de este crédito. Intente de nuevo.", true);
    }
}

function instalarDescargaPdf() {
    if (pdfListenerInstalado) return;
    const zona = document.getElementById("resultado");
    if (!zona) return;
    zona.addEventListener("click", evento => {
        const boton = evento.target.closest(".btn-pdf-credito");
        if (!boton) return;
        evento.preventDefault();
        descargarPdfCredito(boton.dataset.codigo);
    });
    pdfListenerInstalado = true;
}

// ======================================================
// TITULOS Y NOMBRE EN UNA SOLA LINEA (SOLO EN CELULAR)
// ======================================================
// El CSS ya da un tamano que casi siempre cabe. Esto es la red de seguridad: si por la
// tipografia o por un nombre muy largo no cupiera, se achica la letra hasta que quepa.
// El nombre de la persona, si aun asi no cabe en su tamano minimo, pasa a dos lineas.
const MEDIA_CELULAR = "(max-width: 600px)";
let temporizadorAjusteTitulos = null;

function ajustarUnaLinea(elemento, minimoPx, permitirSalto) {
    elemento.style.fontSize = "";
    elemento.style.whiteSpace = "";
    if (!window.matchMedia || !window.matchMedia(MEDIA_CELULAR).matches) return;
    let tamano = parseFloat(window.getComputedStyle(elemento).fontSize);
    let vueltas = 80;
    while (elemento.scrollWidth > elemento.clientWidth + 1 && tamano > minimoPx && vueltas-- > 0) {
        tamano = Math.max(minimoPx, tamano - 0.5);
        elemento.style.fontSize = tamano + "px";
    }
    if (permitirSalto && elemento.scrollWidth > elemento.clientWidth + 1) {
        elemento.style.whiteSpace = "normal";
    }
}

function ajustarTitulosUnaLinea() {
    document.querySelectorAll(".encabezado-portal h1, .encabezado-portal h2")
        .forEach(el => ajustarUnaLinea(el, 9, false));
    document.querySelectorAll(".bienvenida-nombre")
        .forEach(el => ajustarUnaLinea(el, 15, true));
    document.querySelectorAll(".seccion h2")
        .forEach(el => ajustarUnaLinea(el, 12, false));
}

function programarAjusteTitulos() {
    clearTimeout(temporizadorAjusteTitulos);
    temporizadorAjusteTitulos = setTimeout(ajustarTitulosUnaLinea, 60);
}

window.addEventListener("resize", programarAjusteTitulos);
window.addEventListener("orientationchange", programarAjusteTitulos);
if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(ajustarTitulosUnaLinea);   // cuando ya cargaron las tipografias
}
ajustarTitulosUnaLinea();

// ---------- Comunicados debajo de la bienvenida + ventana emergente ----------

const CLAVE_COMUNICADOS_ENTENDIDOS = "facs_comunicados_entendidos";

function leerComunicadosEntendidos() {
    try {
        const guardado = JSON.parse(localStorage.getItem(CLAVE_COMUNICADOS_ENTENDIDOS) || "[]");
        return Array.isArray(guardado) ? guardado : [];
    } catch (error) {
        return []; // sin almacenamiento disponible: se mostrará la ventana siempre
    }
}

function guardarComunicadosEntendidos(ids) {
    try {
        const todos = leerComunicadosEntendidos().concat(ids);
        const sinRepetir = [...new Set(todos)].slice(-200);
        localStorage.setItem(CLAVE_COMUNICADOS_ENTENDIDOS, JSON.stringify(sinRepetir));
    } catch (error) {
        // si no se puede guardar, no pasa nada: solo volverá a aparecer la ventana
    }
}

function htmlTarjetaComunicado(c, esPersonal) {
    return `
        <div class="tarjeta-comunicado${esPersonal ? " tarjeta-comunicado-personal" : ""}">
            <div class="comunicado-titulo">${esPersonal ? "📩 Mensaje para ti: " : ""}${escaparHtml(c.titulo)}</div>
            <div class="comunicado-texto">${escaparHtml(c.mensaje)}</div>
            <div class="comunicado-fecha">${formatearFechaHora(c.fecha_publicacion)}</div>
        </div>
    `;
}

function cerrarVentanaComunicados() {
    const ventana = document.getElementById("modalComunicados");
    if (ventana) ventana.remove();
}

// Ventana emergente con los mensajes que esta persona todavía no ha marcado
// como "Entendido" en este dispositivo. Los mensajes siguen apareciendo
// siempre debajo de la bienvenida; la ventana solo avisa de los nuevos.
function mostrarVentanaComunicados(personales, generales) {
    const entendidos = leerComunicadosEntendidos();

    const nuevos = [
        ...personales.map(c => ({ ...c, esPersonal: true })),
        ...generales.map(c => ({ ...c, esPersonal: false }))
    ].filter(c => !entendidos.includes(c.id));

    if (!nuevos.length) return;

    cerrarVentanaComunicados();

    const fondo = document.createElement("div");
    fondo.id = "modalComunicados";
    fondo.className = "modal-fondo";
    fondo.setAttribute("role", "dialog");
    fondo.setAttribute("aria-modal", "true");
    fondo.setAttribute("aria-labelledby", "tituloModalComunicados");

    fondo.innerHTML = `
        <div class="modal-caja" style="max-height:85vh; overflow-y:auto; text-align:left;">
            <h2 id="tituloModalComunicados">📩 ${nuevos.length === 1 ? "Tiene un mensaje del Fondo" : "Tiene mensajes del Fondo"}</h2>
            ${nuevos.map(c => htmlTarjetaComunicado(c, c.esPersonal)).join("")}
            <div class="modal-botones">
                <button type="button" id="btnEntendidoComunicados" class="btn-primario">Entendido</button>
            </div>
        </div>
    `;

    document.body.appendChild(fondo);

    const alTeclear = (evento) => {
        if (evento.key === "Escape") cerrar();
    };

    function cerrar() {
        guardarComunicadosEntendidos(nuevos.map(c => c.id));
        document.removeEventListener("keydown", alTeclear);
        fondo.remove();
    }

    document.addEventListener("keydown", alTeclear);

    const boton = document.getElementById("btnEntendidoComunicados");
    boton.addEventListener("click", cerrar);
    boton.focus();
}

// Pone TODOS los comunicados (personales y generales) justo debajo de la
// tarjeta de bienvenida, que es donde el portal deja la pantalla después de
// consultar, y avisa con una ventana emergente de los que sean nuevos.
async function mostrarComunicadosDebajoDeBienvenida(personales, opciones) {

    try {

        personales = personales || [];
        const conVentana = !opciones || opciones.conVentana !== false;

        let generales = comunicadosGeneralesActuales;
        if (generales === null) generales = await listarComunicadosPublicos();

        if (!personales.length && !generales.length) return;

        const bienvenida = document.querySelector(".bienvenida");

        if (bienvenida) {
            const anterior = document.getElementById("comunicadosPersonalesResultado");
            if (anterior) anterior.remove();

            const bloque = document.createElement("div");
            bloque.id = "comunicadosPersonalesResultado";
            bloque.style.margin = "18px 0";
            bloque.innerHTML =
                personales.map(c => htmlTarjetaComunicado(c, true)).join("") +
                generales.map(c => htmlTarjetaComunicado(c, false)).join("");
            bienvenida.insertAdjacentElement("afterend", bloque);

            // Ya se muestran aquí: se oculta la zona de comunicados de arriba
            document.getElementById("seccionComunicados").style.display = "none";
        } else if (personales.length) {
            // Respaldo: si no hay bienvenida en pantalla, van arriba como antes
            const contenedor = document.getElementById("listaComunicados");
            contenedor.innerHTML =
                personales.map(c => htmlTarjetaComunicado(c, true)).join("") + contenedor.innerHTML;
            document.getElementById("seccionComunicados").style.display = "block";
        }

        // Registra la vista de cada comunicado personal que se acaba
        // de mostrar -- a la segunda vez, se desactiva solo (ver
        // registrar_vista_comunicado en Supabase). No importa cuánto
        // tiempo pase entre una consulta y otra.
        personales.forEach((c) => {
            fetch(`${SUPABASE_URL}/rest/v1/rpc/registrar_vista_comunicado`, {
                method: "POST",
                headers: HEADERS,
                body: JSON.stringify({ p_id: c.id })
            }).catch(() => {}); // si falla, no debe romper el portal
        });

        if (conVentana && bienvenida) {
            mostrarVentanaComunicados(personales, generales);
        }

    } catch (error) {
        console.error("No se pudieron mostrar los comunicados:", error);
    }

}

/*
  Comunicados del Fondo -- visibles para cualquiera que abra el
  portal, sin necesidad de consultar su crédito. Usa la misma clave
  publicable (RLS ya limita a solo los comunicados activos).
*/
// Comunicados generales ya descargados (null = todavía no se han cargado)
let comunicadosGeneralesActuales = null;

async function cargarComunicados() {

    try {

        const comunicados = await listarComunicadosPublicos();
        comunicadosGeneralesActuales = comunicados;

        if (!comunicados.length) return;

        const contenedor = document.getElementById("listaComunicados");

        contenedor.innerHTML = comunicados.map(c => `
            <div class="tarjeta-comunicado">
                <div class="comunicado-titulo">${escaparHtml(c.titulo)}</div>
                <div class="comunicado-texto">${escaparHtml(c.mensaje)}</div>
                <div class="comunicado-fecha">${formatearFechaHora(c.fecha_publicacion)}</div>
            </div>
        `).join("");

        document.getElementById("seccionComunicados").style.display = "block";

    } catch (error) {
        // Si falla, simplemente no se muestran comunicados -- no debe
        // romper el resto del portal.
        console.error("No se pudieron cargar los comunicados:", error);
    }

}

// ======================================================
// LISTENERS DE MODALES Y FORMULARIOS
// ======================================================

document.addEventListener('DOMContentLoaded', () => {
    // Función auxiliar para mostrar/ocultar contraseña
    window.toggleMostrarContraseña = function(idInput) {
        const input = document.getElementById(idInput);
        const tipo = input.type === 'password' ? 'text' : 'password';
        input.type = tipo;
    };
    
    // Las respuestas secretas solo admiten MAYÚSCULAS y sin tildes (la Ñ SÍ se
    // conserva): se corrige mientras se escribe (no solo visualmente).
    // Supabase (normalizar_respuesta) compara Ñ como N, así que NIÑO y NINO
    // coinciden y las respuestas ya guardadas siguen funcionando.
    ['respuestaSecreta', 'respuestaRecuperacion'].forEach((id) => {
        const campo = document.getElementById(id);
        if (!campo) return;

        campo.addEventListener('input', (e) => {
            if (e.isComposing) return;
            const limpio = campo.value
                .normalize('NFD')
                .replace(/n\u0303/gi, 'Ñ')          // conserva la Ñ (ya compuesta)
                .replace(/[\u0300-\u036f]/g, '')   // quita las demás tildes
                .toUpperCase();

            if (limpio !== campo.value) {
                const posicion = campo.selectionStart;
                const diferencia = campo.value.length - limpio.length;
                campo.value = limpio;
                const nueva = Math.max(0, (posicion || 0) - Math.max(0, diferencia));
                campo.setSelectionRange(nueva, nueva);
            }
        });
    });
    
    // ========== MODAL PRIMERA CONFIGURACIÓN ==========
    const formPrimeraConfig = document.getElementById('formPrimeraConfiguracion');
    const btnCancelarConfig = document.getElementById('btnCancelarConfig');
    const errorConfig = document.getElementById('errorConfig');
    
    if (formPrimeraConfig) {
        formPrimeraConfig.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nueva = document.getElementById('nuevaContrasena').value;
            const repite = document.getElementById('repiteContrasena').value;
            const preguntaId = document.getElementById('preguntaSecreta').value;
            const respuesta = document.getElementById('respuestaSecreta').value.toUpperCase();
            
            if (nueva !== repite) {
                errorConfig.textContent = 'Las contraseñas no coinciden';
                errorConfig.style.display = 'block';
                return;
            }
            if (nueva.length < 8) {
                errorConfig.textContent = 'La contraseña debe tener al menos 8 caracteres';
                errorConfig.style.display = 'block';
                return;
            }
            errorConfig.textContent = '⏳ Guardando...';
            errorConfig.style.display = 'block';
            const exito = await guardarContraseñaYPregunta(documentoActual, nueva, preguntaId, respuesta);
            if (exito) {
                const acceso = await consultarPortalAfiliado(documentoActual, nueva);
                ocultarModalPrimeraConfiguracion();
                document.getElementById('errorConsulta').style.display = 'none';

                if (acceso && acceso.ok) {
                    datosPortalActual = acceso;
                    autenticacionCompleta = true;
                    buscarCredito();
                } else {
                    mostrarBusqueda();
                }
            } else {
                errorConfig.textContent = 'Error al guardar. Intenta nuevamente.';
            }
        });
        
        btnCancelarConfig.addEventListener('click', () => {
            ocultarModalPrimeraConfiguracion();
            mostrarBusqueda();
        });
    }
    
    // ========== MODAL RECUPERACIÓN ==========
    const formRecuperacion = document.getElementById('formRecuperacion');
    const btnCancelarRecupera = document.getElementById('btnCancelarRecupera');
    const errorRecupera = document.getElementById('errorRecupera');
    
    if (formRecuperacion) {
        formRecuperacion.addEventListener('submit', async (e) => {
            e.preventDefault();
            const respuesta = document.getElementById('respuestaRecuperacion').value.toUpperCase();
            const nueva = document.getElementById('nuevaContrasena2').value;
            const repite = document.getElementById('repiteContrasena2').value;
            
            if (nueva !== repite) {
                errorRecupera.textContent = 'Las contraseñas no coinciden';
                errorRecupera.style.display = 'block';
                return;
            }
            if (nueva.length < 8) {
                errorRecupera.textContent = 'La contraseña debe tener al menos 8 caracteres';
                errorRecupera.style.display = 'block';
                return;
            }
            
            errorRecupera.textContent = '⏳ Verificando...';
            errorRecupera.style.display = 'block';
            
            const resultado = await recuperarClaveAfiliado(documentoActual, respuesta, nueva);
            
            if (resultado.error) {
                errorRecupera.textContent = 'No se pudo completar. Intenta nuevamente.';
                return;
            }
            
            if (!resultado.ok) {
                intentosFallidosRecuperacion++;
                const ofrecerComite = resultado.bloqueado || intentosFallidosRecuperacion >= MAX_INTENTOS_RECUPERACION;
                
                let mensaje;
                if (resultado.bloqueado) {
                    mensaje = `🔒 Por seguridad, la recuperación está bloqueada por ahora. Podrás volver a intentarlo en ${textoEspera(resultado.segundos_restantes)}.`;
                } else if (ofrecerComite) {
                    mensaje = '❌ Respuesta incorrecta.';
                } else {
                    mensaje = `❌ Respuesta incorrecta (Intento ${intentosFallidosRecuperacion}/${MAX_INTENTOS_RECUPERACION})`;
                }
                
                if (ofrecerComite) {
                    errorRecupera.innerHTML = `${mensaje}<br><a href="#" id="enlacePedirResetAdmin" style="color: #0066cc; text-decoration: underline;">Pedir al comité que resetee</a>`;
                    document.getElementById('enlacePedirResetAdmin').onclick = async (e) => {
                        e.preventDefault();
                        await crearSolicitudResetAfiliado(documentoActual);
                        ocultarModalRecuperacion();
                        mostrarModalSolicitarReset();
                    };
                } else {
                    errorRecupera.textContent = mensaje;
                }
                return;
            }
            
            // Contraseña cambiada: se reinicia el portal para que quede como
            // la primera vez (sin datos escritos antes).
            errorRecupera.textContent = '✅ Contraseña cambiada. Reiniciando el portal...';
            setTimeout(() => {
                window.location.replace(window.location.pathname);
            }, 1200);
        });
        
        btnCancelarRecupera.addEventListener('click', () => {
            ocultarModalRecuperacion();
        });
    }
    
    // ========== MODAL SOLICITAR RESET ==========
    const btnCerrarSolicitud = document.getElementById('btnCerrarSolicitud');
    if (btnCerrarSolicitud) {
        btnCerrarSolicitud.addEventListener('click', () => {
            ocultarModalSolicitarReset();
            mostrarBusqueda();
        });
    }
});
