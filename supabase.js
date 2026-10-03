const SUPABASE_URL = "https://bfkckvhqjntgybjorxek.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_hkFVE7KpRsQliQx_Y5I9VQ_U1n1XZIy";

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json"
};

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