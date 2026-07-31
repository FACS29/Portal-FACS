document.addEventListener("DOMContentLoaded", () => {
    const btnMenu = document.getElementById("btnMenu");
    const menu = document.querySelector(".menu-lateral");
    const fondo = document.getElementById("fondoMenu");

    if (!btnMenu || !menu) return;

    function abrirMenu() {
        menu.classList.add("abierto");
        fondo?.classList.add("visible");
    }

    function cerrarMenu() {
        menu.classList.remove("abierto");
        fondo?.classList.remove("visible");
    }

    btnMenu.addEventListener("click", () => {
        menu.classList.contains("abierto") ? cerrarMenu() : abrirMenu();
    });

    fondo?.addEventListener("click", cerrarMenu);

    // Cierra el menú automáticamente al tocar una opción (útil en celular)
    menu.querySelectorAll("a").forEach((enlace) => {
        enlace.addEventListener("click", cerrarMenu);
    });
});
