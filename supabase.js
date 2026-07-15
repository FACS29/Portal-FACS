const SUPABASE_URL = "https://bfkckvhqjntgybjorxek.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_hkFVE7KpRsQliQx_Y5I9VQ_U1n1XZIy";

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json"
};

async function registrarConsulta(
    documento,
    codigoCredito
) {

    const fechaConsulta = new Date().toISOString();

    try {

        await fetch(

            `${SUPABASE_URL}/rest/v1/Consultas_Portal`,

            {

                method: "POST",

                headers: {

                    ...HEADERS,

                    "Content-Type": "application/json"

                },

                body: JSON.stringify({

                    Documento: documento,

                    Codigo_Credito: codigoCredito,

                    Fecha_Consulta: fechaConsulta,

                    Navegador: navigator.userAgent,

                    Plataforma: navigator.platform

                })

            }

        );

    } catch (error) {

        console.error(

            "Error registrando consulta:",

            error

        );

    }

}

async function obtenerUltimaConsulta(
    documento
) {

    try {

        const respuesta = await fetch(

            `${SUPABASE_URL}/rest/v1/Consultas_Portal?Documento=eq.${documento}&order=Fecha_Consulta.desc&limit=1`,

            {

                headers: HEADERS

            }

        );

        const datos = await respuesta.json();

        return datos.length > 0

            ? datos[0].Fecha_Consulta

            : null;

    } catch (error) {

        console.error(

            "Error obteniendo última consulta:",

            error

        );

        return null;

    }

}

async function obtenerConfiguracion() {

    const respuesta = await fetch(

        `${SUPABASE_URL}/rest/v1/Configuracion?id=eq.1`,

        {

            headers: HEADERS

        }

    );

    return await respuesta.json();

}

async function buscarAfiliado(documento) {

  const respuesta = await fetch(
    `${SUPABASE_URL}/rest/v1/Afiliados?Documento=eq.${documento}`,
    {
      headers: HEADERS
    }
  );

  return await respuesta.json();
}

async function obtenerCreditos(documento) {

  const respuesta = await fetch(
    `${SUPABASE_URL}/rest/v1/Creditos?Documento=eq.${documento}`,
    {
      headers: HEADERS
    }
  );

  return await respuesta.json();
}

async function obtenerPagos(codigoCredito) {

  const respuesta = await fetch(
    `${SUPABASE_URL}/rest/v1/Pagos?Codigo_Credito=eq.${codigoCredito}&order=Numero_cuota.asc`,
    {
      headers: HEADERS
    }
  );

  return await respuesta.json();
}