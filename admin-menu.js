document.addEventListener("DOMContentLoaded", () => {
    // ---- Boton SALIR dentro del menu, al final (el del encabezado se oculta con CSS) ----
    const menuNav = document.querySelector(".menu-lateral");
    if (menuNav && !document.getElementById("btnSalirMenu")) {
        const salir = document.createElement("button");
        salir.type = "button";
        salir.id = "btnSalirMenu";
        salir.className = "menu-salir";
        salir.textContent = "Salir";
        salir.addEventListener("click", () => {
            if (typeof cerrarSesion === "function") cerrarSesion();
        });
        menuNav.appendChild(salir);
    }

    // ---- "x" para borrar rapido lo escrito en las barras de busqueda ----
    // Solo aparece cuando hay texto. Al borrar, se avisa a la pagina con el evento
    // "input" para que la lista se vuelva a filtrar igual que si se hubiera borrado a mano.
    function agregarBotonBorrar(input) {
        if (input.dataset.conBorrar) return;
        input.dataset.conBorrar = "1";
        const envoltorio = document.createElement("div");
        envoltorio.className = "campo-con-borrar";
        input.parentNode.insertBefore(envoltorio, input);
        envoltorio.appendChild(input);
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "btn-borrar-busqueda";
        boton.title = "Borrar lo escrito";
        boton.setAttribute("aria-label", "Borrar lo escrito");
        boton.innerHTML = "&times;";
        envoltorio.appendChild(boton);
        const actualizar = () => boton.classList.toggle("visible", input.value.length > 0);
        input.addEventListener("input", actualizar);
        // Si otro codigo cambia el valor (por ejemplo "Limpiar filtros"), la x tambien se actualiza
        const original = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
        Object.defineProperty(input, "value", {
            configurable: true,
            get() { return original.get.call(this); },
            set(v) { original.set.call(this, v); actualizar(); }
        });
        if (input.form) input.form.addEventListener("reset", () => setTimeout(actualizar, 0));
        boton.addEventListener("click", () => {
            input.value = "";
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.focus();
        });
        actualizar();
    }
    document.querySelectorAll('input[id^="buscar"]').forEach(agregarBotonBorrar);

    const btnVolverArriba = document.getElementById("btnVolverArriba");

    if (btnVolverArriba) {
        window.addEventListener("scroll", () => {
            btnVolverArriba.classList.toggle("visible", window.scrollY > 400);
        });

        btnVolverArriba.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

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
