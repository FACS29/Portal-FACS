/*
  modo-oscuro.js
  ===============
  Interruptor de modo oscuro para el portal del afiliado. Se recuerda
  en este navegador (localStorage) -- no se guarda en Supabase, es
  solo una preferencia visual local de quien lo usa.
*/
(function () {

    const CLAVE = "facs_modo_oscuro";

    function aplicarPreferencia() {
        const activo = localStorage.getItem(CLAVE) === "si";
        document.body.classList.toggle("oscuro", activo);
        actualizarIcono(activo);
    }

    function actualizarIcono(activo) {
        const boton = document.getElementById("btnModoOscuro");
        if (boton) boton.textContent = activo ? "☀️" : "🌙";
    }

    function alternar() {
        const activo = !document.body.classList.contains("oscuro");
        document.body.classList.toggle("oscuro", activo);
        localStorage.setItem(CLAVE, activo ? "si" : "no");
        actualizarIcono(activo);
    }

    document.addEventListener("DOMContentLoaded", function () {
        aplicarPreferencia();
        const boton = document.getElementById("btnModoOscuro");
        if (boton) boton.addEventListener("click", alternar);
    });

})();
