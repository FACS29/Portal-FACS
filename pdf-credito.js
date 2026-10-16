/*
  pdf-credito.js  -  Generador del "Estado de cuenta del credito" en PDF.

  - No usa librerias externas: arma el archivo PDF directamente.
  - Se usa asi:   PdfCredito.generar(datos)  ->  Uint8Array con el PDF.
  - El ancho de la hoja es siempre carta (612 pt); el alto se ajusta al
    contenido (maximo carta, 792 pt). Si no cabe, sigue en otra hoja.
  - Las letras usadas son las 14 estandar del PDF (Helvetica y Times),
    por eso no se incrusta ninguna tipografia.

  "datos" lleva: codigo, tipo ("vigente" | "paz" | "anulado"), estadoTexto,
  nombre, documento, generado, datosAl, tiles[[etiqueta, valor]...],
  franja{izq, valor, pct, textoPct}, filas[], totales{cap,int,vc},
  notaGracia, notaAnulado, logoFacs (Uint8Array JPEG), logoSind (Uint8Array JPEG).
*/
(function (root) {
    "use strict";

    // ---------- Anchos de letra (AFM, milesimas de em) para codigos 32..255 ----------
    var ANCHOS = {
        H: [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],
        HB: [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556],
        TI: [250,333,420,500,500,833,778,214,333,333,500,675,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,675,675,675,500,920,611,611,667,722,611,611,722,722,333,444,667,556,833,667,722,611,722,611,500,556,722,611,833,611,556,556,389,278,389,422,500,333,500,500,444,500,444,278,500,500,278,278,444,278,722,500,500,500,500,389,389,278,500,444,667,444,444,389,400,275,400,541,761,500,0,333,500,556,889,500,500,333,1000,500,333,944,0,556,0,0,333,333,556,556,350,500,889,333,980,389,333,667,0,389,556,250,389,500,500,500,500,275,500,333,760,276,500,675,333,760,333,400,675,300,300,333,500,523,250,333,300,310,500,750,750,750,500,611,611,611,611,611,611,889,667,611,611,611,611,333,333,333,333,722,667,722,722,722,722,722,675,722,722,722,722,722,556,611,500,500,500,500,500,500,500,667,444,444,444,444,444,278,278,278,278,500,500,500,500,500,500,500,675,500,500,500,500,500,444,500,444],
        TB: [250,333,555,500,500,1000,833,278,333,333,500,570,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,570,570,570,500,930,722,667,722,722,667,611,778,778,389,500,778,667,944,722,778,611,778,722,556,667,722,722,1000,722,722,667,333,278,333,581,500,333,500,556,444,556,444,333,500,556,278,333,556,278,833,556,500,556,556,444,389,333,556,500,722,500,500,444,394,220,394,520,761,500,0,333,500,500,1000,500,500,333,1000,556,333,1000,0,667,0,0,333,333,500,500,350,500,1000,333,1000,389,333,722,0,444,722,250,333,500,500,500,500,220,500,333,747,300,500,570,333,747,333,400,570,300,300,333,556,540,250,333,300,330,500,750,750,750,500,722,722,722,722,722,722,1000,722,667,667,667,667,389,389,389,389,722,722,778,778,778,778,778,570,778,722,722,722,722,722,611,556,500,500,500,500,500,500,722,444,444,444,444,444,278,278,278,278,500,556,500,500,500,500,500,570,500,556,556,556,556,500,556,500]
    };

    var FUENTES = {
        H:  { n: "F1", w: ANCHOS.H,  base: "Helvetica" },
        HB: { n: "F2", w: ANCHOS.HB, base: "Helvetica-Bold" },
        TI: { n: "F3", w: ANCHOS.TI, base: "Times-Italic" },
        TB: { n: "F4", w: ANCHOS.TB, base: "Times-Bold" }
    };

    // Logos disponibles en el PDF que se esta armando (si falta alguno, no se dibuja)
    var presentes = { ImFacs: false, ImSind: false };

    // ---------- Medidas y colores ----------
    var W = 612, M = 40, K = 1.2, VH = 792, FOOT = 88;
    var VERDE = [0, 0.40, 0.20], VERDE_OF = [0, 0.69, 0.31], ROJO_OF = [1, 0, 0];
    var GRIS = [0.35, 0.38, 0.36], TEXTO = [0.10, 0.10, 0.10], NEGRO = [0.08, 0.11, 0.09], GRIS_T = [0.25, 0.28, 0.26];
    var ORO = [0.79, 0.61, 0.25], ORO_OSC = [0.69, 0.50, 0.12];
    var ESTADOS = {
        pagada:    { txt: "Pagada",            col: [0.04, 0.48, 0.24] },
        parcial:   { txt: "Pago parcial",      col: [0.72, 0.45, 0.05] },
        gracia:    { txt: "Tiempo de gracia",  col: [0.11, 0.30, 0.65] },
        pendiente: { txt: "Pendiente",         col: [0.45, 0.45, 0.45] },
        cancelado: { txt: "Crédito cancelado", col: [0.04, 0.48, 0.24] }
    };
    var TINTES = { parcial: [1, 0.965, 0.87], gracia: [0.92, 0.945, 1] };
    var CHIPS = {
        vigente: { fondo: [0.90, 0.96, 0.92], col: [0, 0.40, 0.20] },
        paz:     { fondo: [0.90, 0.93, 0.99], col: [0.11, 0.30, 0.65] },
        anulado: { fondo: [0.93, 0.93, 0.93], col: [0.30, 0.30, 0.30] }
    };
    var COLS = [
        ["Cuota", 0.06, "c"], ["Fecha", 0.12, "c"], ["Saldo inicial", 0.14, "r"], ["Capital", 0.12, "r"],
        ["Interés", 0.10, "r"], ["Valor cuota", 0.12, "r"], ["Saldo final", 0.14, "r"], ["Estado", 0.20, "l"]
    ];
    var AVISO = "Documento informativo con los registros del Fondo a la fecha indicada. No reemplaza una certificación firmada por el comité.";

    // ---------- Texto: codificacion WinAnsi y medidas ----------
    var ESPECIALES = { 0x20AC: 0x80, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2026: 0x85, 0x2122: 0x99 };
    function winansi(c) {
        if (c === 0xA0) return 32;
        if (c < 256) return c < 32 ? 32 : c;
        return ESPECIALES[c] !== undefined ? ESPECIALES[c] : 63;
    }
    function ancho(txt, f, size, esp) {
        var t = FUENTES[f].w, w = 0, i;
        for (i = 0; i < txt.length; i++) w += t[winansi(txt.charCodeAt(i)) - 32] || 0;
        return w * size / 1000 + (esp || 0) * Math.max(txt.length - 1, 0);
    }
    function envolver(txt, f, size, max) {
        var pal = String(txt).split(/\s+/), lin = [], act = "", i, s;
        for (i = 0; i < pal.length; i++) {
            if (!pal[i]) continue;
            s = (act + " " + pal[i]).trim();
            if (ancho(s, f, size) <= max) act = s; else { if (act) lin.push(act); act = pal[i]; }
        }
        if (act) lin.push(act);
        return lin;
    }
    function ajustar(txt, f, size, max) {
        while (ancho(txt, f, size) > max && size > 5) size -= 0.3;
        return size;
    }
    function lit(txt) {          // texto -> cadena PDF (bytes WinAnsi escapados)
        var s = "(", i, c;
        for (i = 0; i < txt.length; i++) {
            c = winansi(txt.charCodeAt(i));
            if (c === 40 || c === 41 || c === 92) s += "\\";
            s += String.fromCharCode(c);
        }
        return s + ")";
    }
    function n(v) { return String(Math.round(v * 1000) / 1000); }
    function miles(v) {
        var x = Math.round(Number(v) || 0), neg = x < 0;
        var s = String(Math.abs(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return (neg ? "-" : "") + s;
    }

    // ---------- Lienzo: acumula operadores de dibujo de una hoja ----------
    function Lienzo() { this.o = []; }
    Lienzo.prototype.fill = function (c) { this.o.push(n(c[0]) + " " + n(c[1]) + " " + n(c[2]) + " rg"); };
    Lienzo.prototype.stroke = function (c) { this.o.push(n(c[0]) + " " + n(c[1]) + " " + n(c[2]) + " RG"); };
    Lienzo.prototype.rect = function (x, y, w, h, o) {
        o = o || {};
        if (o.fill) this.fill(o.fill);
        if (o.stroke) { this.stroke(o.stroke); this.o.push(n(o.lw || 1) + " w"); }
        this.o.push(n(x) + " " + n(y) + " " + n(w) + " " + n(h) + " re " + (o.fill && o.stroke ? "B" : (o.fill ? "f" : "S")));
    };
    Lienzo.prototype.linea = function (x0, y0, x1, y1, col, lw) {
        this.stroke(col); this.o.push(n(lw) + " w " + n(x0) + " " + n(y0) + " m " + n(x1) + " " + n(y1) + " l S");
    };
    function trazoCirculo(cx, cy, r) {
        var k = 0.5523 * r;
        return n(cx + r) + " " + n(cy) + " m " +
            n(cx + r) + " " + n(cy + k) + " " + n(cx + k) + " " + n(cy + r) + " " + n(cx) + " " + n(cy + r) + " c " +
            n(cx - k) + " " + n(cy + r) + " " + n(cx - r) + " " + n(cy + k) + " " + n(cx - r) + " " + n(cy) + " c " +
            n(cx - r) + " " + n(cy - k) + " " + n(cx - k) + " " + n(cy - r) + " " + n(cx) + " " + n(cy - r) + " c " +
            n(cx + k) + " " + n(cy - r) + " " + n(cx + r) + " " + n(cy - k) + " " + n(cx + r) + " " + n(cy) + " c h";
    }
    function trazoRedondeado(x, y, w, h, r) {
        var k = 0.5523 * r;
        return n(x + r) + " " + n(y) + " m " + n(x + w - r) + " " + n(y) + " l " +
            n(x + w - r + k) + " " + n(y) + " " + n(x + w) + " " + n(y + r - k) + " " + n(x + w) + " " + n(y + r) + " c " +
            n(x + w) + " " + n(y + h - r) + " l " +
            n(x + w) + " " + n(y + h - r + k) + " " + n(x + w - r + k) + " " + n(y + h) + " " + n(x + w - r) + " " + n(y + h) + " c " +
            n(x + r) + " " + n(y + h) + " l " +
            n(x + r - k) + " " + n(y + h) + " " + n(x) + " " + n(y + h - r + k) + " " + n(x) + " " + n(y + h - r) + " c " +
            n(x) + " " + n(y + r) + " l " +
            n(x) + " " + n(y + r - k) + " " + n(x + r - k) + " " + n(y) + " " + n(x + r) + " " + n(y) + " c h";
    }
    Lienzo.prototype.rombo = function (x, y, s, col) {
        this.fill(col);
        this.o.push(n(x - s) + " " + n(y) + " m " + n(x) + " " + n(y + s) + " l " + n(x + s) + " " + n(y) + " l " + n(x) + " " + n(y - s) + " l h f");
    };
    Lienzo.prototype.texto = function (x, y, txt, f, size, esp, col, al) {
        var w = ancho(txt, f, size, esp);
        if (al === "c") x -= w / 2; else if (al === "r") x -= w;
        this.o.push("BT /" + FUENTES[f].n + " " + n(size) + " Tf " + n(esp || 0) + " Tc " +
            n(col[0]) + " " + n(col[1]) + " " + n(col[2]) + " rg " + n(x) + " " + n(y) + " Td " + lit(txt) + " Tj 0 Tc ET");
        return w;
    };
    Lienzo.prototype.logo = function (nombre, cx, cy, r) {
        if (!nombre || !presentes[nombre]) return;
        this.o.push("q " + trazoCirculo(cx, cy, r) + " W n " + n(2 * r) + " 0 0 " + n(2 * r) + " " + n(cx - r) + " " + n(cy - r) + " cm /" + nombre + " Do Q");
    };
    Lienzo.prototype.barra = function (x, y, w, h, frac) {
        var r = h / 2;
        this.o.push("q"); this.fill([0.78, 0.87, 0.82]);
        this.o.push(trazoRedondeado(x, y, w, h, r) + " f");
        this.o.push(trazoRedondeado(x, y, w, h, r) + " W n"); this.fill(VERDE);
        this.o.push(n(x) + " " + n(y) + " " + n(w * frac) + " " + n(h) + " re f Q");
    };

    // ---------- Piezas del diseno (coordenadas "virtuales": hoja carta de 792 pt) ----------
    function reglas(L, x0, x1, y) {
        L.rect(x0, y, x1 - x0, 2.2, { fill: VERDE });
        L.rect(x0, y - 3.2, x1 - x0, 0.9, { fill: ORO });
    }
    function encabezado(L, d, cont) {
        var top = VH, xi = M, xd = W - M, cx = W / 2;
        if (cont) {
            var cy0 = top - 24;
            L.logo("ImFacs", xi + 11, cy0, 11);
            L.texto(xi + 28, cy0 - 3.3, "FONDO DE AHORRO Y CRÉDITO SINDICAL (FACS)", "HB", 9.2, 0.6, VERDE);
            L.texto(xd, cy0 - 3, "Crédito N.º " + d.codigo + " · continuación", "H", 8.4, 0, GRIS_T, "r");
            reglas(L, xi, xd, top - 42);
            return top - 46;
        }
        var r = 30, cy = top - 48, sal = 8;
        L.logo("ImFacs", xi - sal + r, cy, r);
        L.logo("ImSind", xd + sal - r, cy, r);
        var l1 = "Sindicato Nacional de Trabajadores de la Industria del Cultivo y Procesamiento de Aceites y Vegetales";
        L.texto(cx, top - 15, l1, "HB", ajustar(l1, "HB", 8.6, W - 2 * (M - sal) - 8), 0, NEGRO, "c");
        L.texto(cx, top - 38, "SINTRAPROACEITES", "HB", 17, 3.6, VERDE, "c");
        L.texto(cx, top - 50, "Subdirectiva La Gloria", "HB", 9.2, 2.2, ORO_OSC, "c");
        L.texto(cx, top - 63, "P. J. 04541 de 30 de diciembre de 1985 - NIT. 8 0 0 0 3 3 2 9 0 - 3", "HB", 7.8, 0, GRIS_T, "c");
        L.texto(cx, top - 73, "Barrio Brisas, Corregimiento de La Mata, Cesar.", "HB", 7.8, 0, GRIS_T, "c");
        var nombre = "FONDO DE AHORRO Y CRÉDITO SINDICAL (FACS)", tam = 11.4, esp = 2.0, yb = top - 96;
        var aw = ancho(nombre, "HB", tam, esp);
        L.texto(cx, yb, nombre, "HB", tam, esp, VERDE, "c");
        var ym = yb + 4;
        L.linea(xi, ym, cx - aw / 2 - 14, ym, ORO, 0.8);
        L.linea(cx + aw / 2 + 14, ym, xd, ym, ORO, 0.8);
        L.rombo(cx - aw / 2 - 14, ym, 3, ORO);
        L.rombo(cx + aw / 2 + 14, ym, 3, ORO);
        reglas(L, xi, xd, top - 107);
        return top - 110;
    }
    function tile(L, x, y, w, h, k, lab, val) {
        L.rect(x, y - h, w, h, { fill: [0.962, 0.974, 0.966] });
        L.texto(x + 5 * k, y - 8.2 * k, lab, "H", 6.4 * k, 0, GRIS);
        L.texto(x + 5 * k, y - h + 5.6 * k, val, "HB", ajustar(val, "HB", 9.2 * k, w - 9 * k), 0, TEXTO);
    }
    function paginaInicial(L, d) {
        var k = K, cw = W - 2 * M, y, top, i;
        y = encabezado(L, d, false);
        y -= 22; L.texto(M, y, "Estado de cuenta del crédito", "HB", 12.5 * k, 0, TEXTO);
        y -= 9; top = y;
        var wl = cw * 0.55, wr = cw - wl - 8 * k;
        var frase = "Este documento corresponde únicamente al crédito N.º " + d.codigo + ". No incluye otros créditos del afiliado.";
        var lin = envolver(frase, "H", 7.2 * k, wl - 16 * k), hA = Math.max(60 * k, (37 + 9 * lin.length) * k);
        L.rect(M, top - hA, wl, hA, { fill: [0.93, 0.97, 0.94], stroke: VERDE, lw: 1.1 });
        L.texto(M + 8 * k, top - 11 * k, "CRÉDITO N.º", "HB", 6.8 * k, 0, GRIS);
        L.texto(M + 8 * k, top - 32 * k, d.codigo, "HB", 22 * k, 0, VERDE);
        for (i = 0; i < lin.length; i++) L.texto(M + 8 * k, top - (42 + 9 * i) * k, lin[i], "H", 7.2 * k, 0, TEXTO);
        var xr = M + wl + 8 * k;
        L.texto(xr, top - 9 * k, "AFILIADO", "HB", 6.8 * k, 0, GRIS);
        var yy = top - 20 * k, nom = envolver(d.nombre || "", "HB", 9.2 * k, wr).slice(0, 2);
        for (i = 0; i < nom.length; i++) { L.texto(xr, yy, nom[i], "HB", 9.2 * k, 0, TEXTO); yy -= 11 * k; }
        L.texto(xr, yy, "Documento: " + d.documento, "H", 8.2 * k, 0, TEXTO); yy -= 14 * k;
        var chip = CHIPS[d.tipo], txt = String(d.estadoTexto || "").toUpperCase(), tw = ancho(txt, "HB", 8.6 * k) + 16 * k;
        L.rect(xr, yy - 4 * k, tw, 15 * k, { fill: chip.fondo, stroke: chip.col, lw: 0.8 });
        L.texto(xr + tw / 2, yy + 0.6 * k, txt, "HB", 8.6 * k, 0, chip.col, "c");
        L.texto(xr + tw + 5 * k, yy + 0.6 * k, "Estado del crédito", "H", 6.4 * k, 0, GRIS);
        y = top - hA - 8 * k;
        var gap = 3.4 * k, tw2 = (cw - 3 * gap) / 4, th = 22.5 * k;
        for (i = 0; i < d.tiles.length; i++) {
            tile(L, M + (i % 4) * (tw2 + gap), y - Math.floor(i / 4) * (th + gap), tw2, th, k, d.tiles[i][0], d.tiles[i][1]);
        }
        return y - Math.ceil(d.tiles.length / 4) * (th + gap);
    }
    function franja(L, y, f) {
        var k = K, cw = W - 2 * M, h = 32 * k;
        L.rect(M, y - h, cw, h, { fill: [0.90, 0.96, 0.92] });
        L.texto(M + 8 * k, y - 9.5 * k, f.izq, "H", 6.8 * k, 0, GRIS);
        L.texto(M + 8 * k, y - 26 * k, f.valor, "HB", 15 * k, 0, VERDE);
        var bw = cw * 0.42, bx = M + cw - 8 * k - bw;
        L.texto(bx, y - 11 * k, "Amortizado", "H", 6.8 * k, 0, GRIS);
        L.texto(bx + bw, y - 11 * k, f.textoPct, "HB", 9.2 * k, 0, VERDE, "r");
        L.barra(bx, y - 25 * k, bw, 7.5 * k, Math.max(0, Math.min(f.pct, 100)) / 100);
        return y - h;
    }
    function tituloCron(L, y) {
        var k = K, cw = W - 2 * M;
        L.texto(M, y, "Cronograma de pagos", "HB", 9 * k, 0, TEXTO);
        L.texto(M + cw, y, "Valores en pesos colombianos (COP)", "H", 6.4 * k, 0, GRIS, "r");
        return y - 5 * k;
    }
    function cabTabla(L, y, rh) {
        var k = K, cw = W - 2 * M, x = M, i, c, w;
        L.rect(M, y - rh, cw, rh, { fill: VERDE });
        for (i = 0; i < COLS.length; i++) {
            c = COLS[i]; w = cw * c[1];
            if (c[2] === "c") L.texto(x + w / 2, y - rh + 3.6 * k, c[0], "HB", 6.5 * k, 0, [1, 1, 1], "c");
            else if (c[2] === "r") L.texto(x + w - 4 * k, y - rh + 3.6 * k, c[0], "HB", 6.5 * k, 0, [1, 1, 1], "r");
            else L.texto(x + 6 * k, y - rh + 3.6 * k, c[0], "HB", 6.5 * k, 0, [1, 1, 1]);
            x += w;
        }
        return y - rh;
    }
    function fila(L, y, rh, f, idx) {
        var k = K, cw = W - 2 * M, x = M, i, w, v, est = ESTADOS[f.est] || ESTADOS.pendiente;
        var pend = f.est === "pendiente" || f.est === "gracia";
        L.rect(M, y - rh, cw, rh, { fill: TINTES[f.est] || (idx % 2 === 0 ? [0.975, 0.98, 0.976] : [1, 1, 1]) });
        var vals = [String(f.n), f.f];
        ["si", "cap", "int", "vc", "sf"].forEach(function (c) { vals.push(f.pago ? miles(f[c]) : "-"); });
        for (i = 0; i < 7; i++) {
            w = cw * COLS[i][1]; v = vals[i];
            if (COLS[i][2] === "c") L.texto(x + w / 2, y - rh + 3.4 * k, v, "H", 6.8 * k, 0, pend ? [0.5, 0.5, 0.5] : TEXTO, "c");
            else L.texto(x + w - 4 * k, y - rh + 3.4 * k, v, "H", 6.8 * k, 0, pend ? [0.5, 0.5, 0.5] : TEXTO, "r");
            x += w;
        }
        L.rect(x + 6 * k, y - rh + 3.4 * k, 4 * k, 4 * k, { fill: est.col });
        L.texto(x + 13 * k, y - rh + 3.4 * k, est.txt, f.est !== "pendiente" ? "HB" : "H", 6.6 * k, 0, est.col);
    }
    function totales(L, y, rh, t) {
        var k = K, cw = W - 2 * M, x = M + cw * (0.06 + 0.12 + 0.14), w;
        L.rect(M, y - rh, cw, rh, { fill: [0.90, 0.96, 0.92] });
        L.texto(M + 6 * k, y - rh + 3.5 * k, "Totales", "HB", 6.9 * k, 0, TEXTO);
        [[0.12, t.cap], [0.10, t.int], [0.12, t.vc]].forEach(function (p) {
            w = cw * p[0]; L.texto(x + w - 4 * k, y - rh + 3.5 * k, miles(p[1]), "HB", 6.9 * k, 0, TEXTO, "r"); x += w;
        });
        return y - rh;
    }
    function nota(L, y, texto) {
        var k = K, cw = W - 2 * M, lin = envolver(texto, "H", 6.8 * k, cw - 14 * k), h = (8 + 8.4 * lin.length) * k, i;
        L.rect(M, y - h, cw, h, { fill: [0.97, 0.97, 0.97], stroke: [0.75, 0.75, 0.75], lw: 0.6 });
        for (i = 0; i < lin.length; i++) L.texto(M + 7 * k, y - (9.5 + 8.4 * i) * k, lin[i], "H", 6.8 * k, 0, TEXTO);
        return y - h;
    }
    function pie(L, anchoHoja, pag, tot, d) {
        var cw = anchoHoja - 2 * M, y0 = 14, i, x, partes, lineas = [], ya;
        partes = [["TI", "Página "], ["TB", String(pag)], ["TI", " de "], ["TB", String(tot)]];
        var aw = 0; partes.forEach(function (p) { aw += ancho(p[1], p[0], 9.5); });
        x = anchoHoja / 2 - aw / 2;
        partes.forEach(function (p) { L.texto(x, y0, p[1], p[0], 9.5, 0, [0, 0, 0]); x += ancho(p[1], p[0], 9.5); });
        L.rect(M, y0 + 14.5, cw, 3, { fill: VERDE_OF });
        L.rect(M, y0 + 13, cw, 1.5, { fill: ROJO_OF });
        var gen = "Generado el " + d.generado + ". Datos del Fondo actualizados al " + d.datosAl + ".";
        [gen, AVISO].forEach(function (t) { lineas = lineas.concat(envolver(t, "H", 7.2, cw)); });
        ya = y0 + 24;
        for (i = lineas.length - 1; i >= 0; i--) { L.texto(M, ya, lineas[i], "H", 7.2, 0, GRIS); ya += 8.6; }
    }

    // ---------- Contenido de cada hoja y paginacion ----------
    function contenido(L, d, pi, filas, ultima) {
        var k = K, rh = 9.9 * k, cw = W - 2 * M, y, i, ln, h;
        if (pi === 0) {
            y = paginaInicial(L, d);
            if (d.tipo === "anulado") {
                y -= 4 * k;
                ln = envolver(d.notaAnulado || "", "H", 9 * k, cw - 20 * k); h = (14 + 12 * ln.length) * k;
                L.rect(M, y - h, cw, h, { fill: [0.96, 0.96, 0.96], stroke: [0.7, 0.7, 0.7], lw: 0.8 });
                for (i = 0; i < ln.length; i++) L.texto(M + 10 * k, y - (15 + 12 * i) * k, ln[i], "H", 9 * k, 0, TEXTO);
                return y - h;
            }
            y = franja(L, y, d.franja) - 11 * k;
        } else {
            y = encabezado(L, d, true) - 14 * k;
        }
        y = tituloCron(L, y); y = cabTabla(L, y - 3 * k, rh);
        for (i = 0; i < filas.length; i++) { fila(L, y, rh, filas[i], i); y -= rh; }
        if (ultima) {
            y = totales(L, y, rh, d.totales);
            if (d.notaGracia) y = nota(L, y - 5 * k, d.notaGracia);
        }
        return y;
    }
    function planificar(d) {
        var k = K, rh = 9.9 * k, cw = W - 2 * M;
        if (d.tipo === "anulado") return [[]];
        var L0 = new Lienzo(), y1 = paginaInicial(L0, d);
        y1 = franja(L0, y1, d.franja) - 11 * k;
        y1 = y1 - 5 * k - 3 * k - rh;
        var avail1 = y1 - FOOT, availN = (VH - 46 - 14 * k - 5 * k - 3 * k - rh) - FOOT;
        var nl = d.notaGracia ? envolver(d.notaGracia, "H", 6.8 * k, cw - 14 * k).length : 0;
        var notaH = nl ? ((8 + 8.4 * nl) * k + 5 * k) : 0;
        var paginas = [], idx = 0, primera = true, av, resto, cap, tomar, filas = d.filas || [];
        if (!filas.length) return [[]];
        while (idx < filas.length) {
            av = primera ? avail1 : availN; resto = filas.length - idx; cap = Math.floor(av / rh);
            if (resto * rh + rh + notaH <= av) tomar = resto;
            else if (resto <= cap) tomar = Math.max(resto - 3, 1);
            else tomar = cap;
            paginas.push(filas.slice(idx, idx + tomar)); idx += tomar; primera = false;
        }
        return paginas;
    }

    // ---------- Escritura del archivo PDF ----------
    function bytes(s) { var a = new Uint8Array(s.length), i; for (i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; }
    function infoJpeg(b) {
        var i = 2, m, len;
        if (b[0] !== 0xFF || b[1] !== 0xD8) throw new Error("La imagen del logo no es un JPEG valido");
        while (i < b.length) {
            if (b[i] !== 0xFF) { i++; continue; }
            m = b[i + 1];
            if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
                return { alto: (b[i + 5] << 8) | b[i + 6], ancho: (b[i + 7] << 8) | b[i + 8], comps: b[i + 9] };
            }
            len = (b[i + 2] << 8) | b[i + 3]; i += 2 + len;
        }
        throw new Error("No se pudo leer el logo");
    }
    function generar(d) {
        presentes.ImFacs = !!d.logoFacs;
        presentes.ImSind = !!d.logoSind;
        var paginas = planificar(d), total = paginas.length, hojas = [], pi, L, yf, alto, ops, dy;
        var totalesFilas = d.totales || { cap: 0, int: 0, vc: 0 };
        for (pi = 0; pi < total; pi++) {
            L = new Lienzo();
            yf = contenido(L, d, pi, paginas[pi], pi === total - 1);
            alto = (pi < total - 1) ? VH : Math.min(VH, Math.max(300, Math.ceil(VH - yf + FOOT + 10)));
            dy = alto - VH;
            var P = new Lienzo();
            P.o.push("q 1 0 0 1 0 " + n(dy) + " cm"); P.o = P.o.concat(L.o); P.o.push("Q");
            pie(P, W, pi + 1, total, d);
            hojas.push({ alto: alto, ops: P.o.join("\n") });
        }
        // objetos: 1 catalogo, 2 paginas, 3-6 fuentes, 7 logo FACS, 8 logo sindicato, 9 info, luego (contenido, pagina) por hoja
        var objs = [], offs = [], partes = [], pos = 0;
        function emitir(u8) { partes.push(u8); pos += u8.length; }
        function objeto(id, dict, stream) {
            offs[id] = pos;
            emitir(bytes(id + " 0 obj\n" + dict + (stream ? "\nstream\n" : "\n")));
            if (stream) { emitir(stream); emitir(bytes("\nendstream\n")); }
            emitir(bytes("endobj\n"));
        }
        emitir(bytes("%PDF-1.4\n")); emitir(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
        var idPag = [], idCont = [], sig = 10, i;
        for (i = 0; i < total; i++) { idCont.push(sig++); idPag.push(sig++); }
        var tieneFacs = !!d.logoFacs, tieneSind = !!d.logoSind;
        objeto(1, "<< /Type /Catalog /Pages 2 0 R >>");
        objeto(2, "<< /Type /Pages /Kids [" + idPag.map(function (x) { return x + " 0 R"; }).join(" ") + "] /Count " + total + " >>");
        ["H", "HB", "TI", "TB"].forEach(function (f, j) {
            objeto(3 + j, "<< /Type /Font /Subtype /Type1 /BaseFont /" + FUENTES[f].base + " /Encoding /WinAnsiEncoding >>");
        });
        function imagen(id, u8) {
            var inf = infoJpeg(u8), cs = inf.comps === 1 ? "/DeviceGray" : "/DeviceRGB";
            objeto(id, "<< /Type /XObject /Subtype /Image /Width " + inf.ancho + " /Height " + inf.alto + " /ColorSpace " + cs +
                " /BitsPerComponent 8 /Filter /DCTDecode /Length " + u8.length + " >>", u8);
        }
        if (tieneFacs) imagen(7, d.logoFacs); else objeto(7, "<< >>");
        if (tieneSind) imagen(8, d.logoSind); else objeto(8, "<< >>");
        objeto(9, "<< /Title " + lit("Estado de cuenta credito " + d.codigo) + " /Producer (Portal FACS) >>");
        var recursos = "/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> /XObject << " +
            (tieneFacs ? "/ImFacs 7 0 R " : "") + (tieneSind ? "/ImSind 8 0 R " : "") + ">> >>";
        for (i = 0; i < total; i++) {
            var cont = bytes(hojas[i].ops);
            objeto(idCont[i], "<< /Length " + cont.length + " >>", cont);
            objeto(idPag[i], "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + W + " " + hojas[i].alto + "] " + recursos + " /Contents " + idCont[i] + " 0 R >>");
        }
        var totalObj = sig, xref = pos, s = "xref\n0 " + totalObj + "\n0000000000 65535 f \n";
        for (i = 1; i < totalObj; i++) s += ("0000000000" + offs[i]).slice(-10) + " 00000 n \n";
        s += "trailer\n<< /Size " + totalObj + " /Root 1 0 R /Info 9 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
        emitir(bytes(s));
        var out = new Uint8Array(pos), o = 0;
        partes.forEach(function (p) { out.set(p, o); o += p.length; });
        return out;
    }

    var API = { generar: generar, _medidas: { ancho: ancho, miles: miles, planificar: planificar } };
    if (typeof module !== "undefined" && module.exports) module.exports = API;
    root.PdfCredito = API;
})(typeof window !== "undefined" ? window : globalThis);
