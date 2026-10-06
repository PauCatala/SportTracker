// =====================================================================
// LUMEN · Piezas del reloj y del portátil de la portada
// ---------------------------------------------------------------------
// - Números escritos "a mano" con tinta azul (trazos SVG propios, sin
//   depender de ninguna fuente): cada uno con su grosor, giro y tamaño.
// - Marcas de minutos de la esfera.
// - Teclas del portátil.
// =====================================================================
const Reloj = (() => {
  const NS = 'http://www.w3.org/2000/svg';

  // Cifras dibujadas a mano en una caja de 10 x 16 (un solo trazo cada una)
  const CIFRAS = {
    0: 'M5.2 1.3 C1.8 1.2 1.1 5.6 1.3 8.7 C1.5 12.2 2.6 15 5.1 15 C8 15 8.9 11.5 8.8 8 C8.7 4.3 7.7 1.3 5.2 1.3',
    1: 'M2.9 4.1 C4 3.3 5 2.2 5.9 1.1 C5.6 5.8 5.3 10.4 5.1 15.1',
    2: 'M1.6 4.6 C1.9 1.6 8.3 .4 8.3 4.5 C8.3 7.6 3.4 10.9 1.3 15 C3.9 14.6 6.4 14.5 9.1 14.7',
    3: 'M1.9 2.7 C4 .6 8.5 1 8.2 4.2 C7.9 6.5 5.3 7.3 3.9 7.6 C6.9 7.4 9.1 9.3 8.6 12 C8 15.2 3.1 15.8 1.2 13.3',
    4: 'M6.9 15.2 C6.8 10.4 6.7 5.6 6.7 1 C4.8 4.3 2.9 7.5 1 10.8 C3.8 10.5 6.6 10.4 9.4 10.4',
    5: 'M8.7 1.2 C6.8 1.3 4.8 1.3 2.9 1.4 C2.6 3.3 2.4 5.3 2.2 7.2 C4.6 5.6 8.6 6.2 8.8 10 C9 14 4 16 1.4 13.6',
    6: 'M7.7 1.3 C4.1 2.4 1.6 6.6 1.6 10.6 C1.6 14 4 15.4 6 15 C8.4 14.6 9 12 8.6 10.4 C8 7.8 4.4 7.6 2 10.2',
    7: 'M1.2 1.7 C3.8 1.5 6.4 1.3 9 1.2 C6.4 5 4.6 9.6 4 15.2',
    8: 'M5.2 7.6 C1.6 6.6 1.7 1.3 5.2 1.2 C8.6 1.2 8.5 6.4 5.2 7.6 C1.3 8.8 1.4 15.2 5.2 15 C9 14.8 9 8.8 5.2 7.6',
    9: 'M8.2 4.8 C7.6 .7 1.7 .8 1.8 4.8 C2 8 7.3 8.1 8.2 4.8 C8.6 8.2 7.9 12 6.6 15.2',
  };

  // Desorden inicial: un montón juguetón en la mitad baja de la esfera
  // [x, y] en fracción de la esfera, giro en grados y tamaño relativo
  const DESORDEN = {
    1: [.30, .66, -16, 1.05], 2: [.43, .79, 9, .9], 3: [.62, .63, -7, 1.18], 4: [.38, .57, 19, .78],
    5: [.55, .72, -21, 1.08], 6: [.24, .77, 13, .95], 7: [.71, .76, 27, .86], 8: [.48, .62, -9, 1.22],
    9: [.61, .85, -31, .82], 10: [.33, .87, 6, 1], 11: [.76, .66, -13, .9], 12: [.51, .91, 15, .8],
  };

  // Crea un número de tinta como <svg>
  function numero(n) {
    const txt = String(n);
    const ancho = txt.length * 8.6 + 1.8;
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', `-1 -1 ${ancho} 18`);
    s.setAttribute('class', 'cifra');
    // Cada número con su "pulso": grosor, inclinación y altura de línea distintos
    const grosor = 1.05 + Math.random() * .9;
    const incl = -9 + Math.random() * 12;
    let x = 0;
    for (const c of txt) {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('transform', `translate(${x.toFixed(2)} ${(Math.random() * .9 - .45).toFixed(2)}) skewX(${incl.toFixed(1)}) translate(${(incl * .14).toFixed(2)} 0)`);
      // Trazo principal + un segundo trazo finísimo desplazado: la tinta carga más en un lado
      for (const [dx, k, op] of [[0, 1, 1], [.28, .55, .55]]) {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', CIFRAS[c]);
        p.setAttribute('stroke-width', (grosor * k).toFixed(2));
        p.setAttribute('opacity', op);
        if (dx) p.setAttribute('transform', `translate(${dx} ${dx * .6})`);
        g.appendChild(p);
      }
      s.appendChild(g);
      x += 7.6 + Math.random() * 1.4;
    }
    s.dataset.ancho = ancho;
    return s;
  }

  // Monta las 12 horas dentro de la esfera y devuelve su información
  function montarHoras(contenedor) {
    const horas = [];
    for (let n = 1; n <= 12; n++) {
      const s = numero(n);
      contenedor.appendChild(s);
      const [x, y, giro, escala] = DESORDEN[n];
      horas.push({
        el: s, n, x, y, giro, escala,
        ancho: +s.dataset.ancho,
        tam: .095 + (Math.random() - .5) * .018,      // altura final (fracción de la esfera)
        giroFinal: (Math.random() - .5) * 9,          // ni en su sitio quedan rectos del todo
        retraso: [.30, .05, .42, .18, .58, .10, .36, .22, .50, .02, .27, .46][n - 1],
      });
    }
    return horas;
  }

  // Marcas de minutos: puntos y rayitas finas
  function montarMarcas(contenedor) {
    let html = '';
    for (let i = 0; i < 60; i++) {
      const grande = i % 5 === 0;
      html += `<i class="${grande ? 'g' : ''}" style="transform: rotate(${i * 6}deg)"></i>`;
    }
    contenedor.innerHTML = html;
  }

  // Teclado del portátil: filas con anchos reales (unidades = 1 tecla)
  function montarTeclas(contenedor) {
    const filas = [
      { alto: .55, teclas: [1.5, ...Array(12).fill(1), 1.5] },
      { alto: 1, teclas: [...Array(13).fill(1), 1.5] },
      { alto: 1, teclas: [1.5, ...Array(13).fill(1)] },
      { alto: 1, teclas: [1.8, ...Array(11).fill(1), 1.7] },
      { alto: 1, teclas: [2.3, ...Array(10).fill(1), 2.2] },
      { alto: 1, teclas: [1, 1, 1.25, 1.25, 5, 1.25, 1, 'flechas'] },
    ];
    let html = '';
    for (const f of filas) {
      html += `<div class="fila" style="flex:${f.alto}">`;
      for (const t of f.teclas) {
        html += t === 'flechas'
          ? '<span class="flechas" style="flex:3"><b></b><span><b></b><b></b></span><b></b></span>'
          : `<b style="flex:${t}"></b>`;
      }
      html += '</div>';
    }
    contenedor.innerHTML = html;
  }

  return { montarHoras, montarMarcas, montarTeclas };
})();
