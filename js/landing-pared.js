// =====================================================================
// LUMEN · La pared de papel de la portada
// ---------------------------------------------------------------------
// Dibuja en un SVG (en píxeles reales) una pared mate color hueso que:
//   1. se agrieta con grietas finas que se ramifican desde el centro,
//   2. se rasga por la grieta principal con bordes fibrosos y labios
//      curvados que proyectan sombra sobre el hueco.
// Uso: Pared.montar(svg) una vez y Pared.pintar(grietas, rasgado) en cada
// fotograma (los dos valores van de 0 a 1).
// =====================================================================
const Pared = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const PASO = 4;                 // separación vertical entre puntos del borde (px)
  let svg, W, H, x0, ys, datos, ramas, el, ultimo = '';

  const azar = (a, b) => a + Math.random() * (b - a);
  const limitar = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const suave = t => 1 - Math.pow(1 - t, 3);
  const suaveIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // Ruido suave: suma de ondas con fases al azar ([frecuencia, amplitud])
  function ondas(n, capas) {
    const fases = capas.map(() => azar(0, Math.PI * 2));
    return Array.from({ length: n }, (_, i) =>
      capas.reduce((s, [f, a], k) => s + a * Math.sin(f * Math.PI * 2 * i / n + fases[k]), 0));
  }

  // Textura de papel/yeso: grano fino + manchas suaves. Se pinta una vez en un canvas.
  function crearGrano(lado = 320) {
    const c = document.createElement('canvas');
    c.width = c.height = lado;
    const g = c.getContext('2d');
    // Manchas grandes y muy suaves (el yeso nunca es plano)
    for (let i = 0; i < 60; i++) {
      const x = azar(0, lado), y = azar(0, lado), r = azar(30, 110);
      const claro = Math.random() < .5;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, claro ? 'rgba(255,255,255,.035)' : 'rgba(120,105,80,.012)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      // Se repite en las 4 esquinas para que el mosaico no tenga costuras
      for (const dx of [-lado, 0, lado]) for (const dy of [-lado, 0, lado]) {
        g.save(); g.translate(dx, dy); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
      }
    }
    // Grano fino
    const img = g.getImageData(0, 0, lado, lado);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random();
      if (v < .5) {
        const oscuro = Math.random() < .55;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = oscuro ? 90 : 255;
        img.data[i + 3] = Math.max(img.data[i + 3], Math.floor(v * (oscuro ? 14 : 18)));
      }
    }
    g.putImageData(img, 0, 0);
    // Alguna fibra suelta muy tenue
    g.strokeStyle = 'rgba(110,95,70,.045)'; g.lineWidth = .6;
    for (let i = 0; i < 40; i++) {
      const x = azar(0, lado), y = azar(0, lado), a = azar(0, Math.PI), l = azar(4, 14);
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * l / 2 + azar(-2, 2), y + Math.sin(a) * l / 2 + azar(-2, 2), x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    return c.toDataURL();
  }

  const nuevo = (tipo, attrs = {}, padre) => {
    const n = document.createElementNS(NS, tipo);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (padre) padre.appendChild(n);
    return n;
  };

  // ---------------------------------------------------------------
  // Preparar: datos aleatorios del borde, ramas de grietas y capas SVG
  // ---------------------------------------------------------------
  function montar(elSvg, grano) {
    svg = elSvg;
    W = innerWidth; H = innerHeight; x0 = W / 2;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '';

    const n = Math.ceil((H + 40) / PASO) + 1;
    ys = Array.from({ length: n }, (_, i) => -20 + i * PASO);

    // Grieta principal (por donde se rasga): ondulación suave + dientes pequeños
    const baja = ondas(n, [[1.2, 3.5], [3.5, 2.4], [9, 1.6], [23, 1.1]]);
    const diente = () => { const o = ondas(n, [[31, .8], [57, .6]]); return o.map(v => v + azar(-1.4, 1.4)); };
    const fleco = () => { const o = ondas(n, [[5, 1], [13, .8], [37, .6]]); return o.map(v => .8 + 5.5 * Math.max(0, v) + azar(0, 1.6)); };
    const labio = () => ondas(n, [[2, .35], [6, .2]]).map(v => .75 + v);
    const asim = () => ondas(n, [[1.6, .07], [4, .05], [11, .03]]);
    const tronco = baja.map((v, i) => v + azar(-1, 1));
    datos = {
      tronco,
      izq: { diente: diente(), fleco: fleco(), labio: labio(), asim: asim() },
      der: { diente: diente(), fleco: fleco(), labio: labio(), asim: asim() },
    };
    // Fibras: pelillos que asoman del borde rasgado
    for (const lado of ['izq', 'der']) {
      datos[lado].fibras = Array.from({ length: Math.round(H / 5) }, () => ({
        i: Math.floor(azar(2, n - 2)), largo: azar(1.5, 6), ang: azar(-.9, .9), curva: azar(-2, 2), gris: Math.random() < .3,
      }));
    }

    // Ramas de grietas: nacen en la grieta principal y se abren hacia los lados
    ramas = [];
    const crecerRama = (x, y, ang, largo, ancho, lado, inicio, nivel) => {
      const pts = [[x, y]];
      const pasos = Math.max(3, Math.round(largo / 9));
      for (let k = 0; k < pasos; k++) {
        ang += azar(-.6, .6);
        x += Math.cos(ang) * largo / pasos; y += Math.sin(ang) * largo / pasos;
        pts.push([x, y]);
        if (nivel < 2 && Math.random() < .12)
          crecerRama(x, y, ang + azar(.5, 1.1) * (Math.random() < .5 ? -1 : 1), largo * azar(.3, .5), ancho * .7, lado, inicio + .12 * (k / pasos), nivel + 1);
      }
      ramas.push({ pts, lado, inicio, ancho });
    };
    const cuantas = W < 700 ? 6 : 9;
    for (let k = 0; k < cuantas; k++) {
      const y = H / 2 + azar(-.42, .42) * H;
      const i = Math.round((y + 20) / PASO);
      const lado = k % 2 ? 1 : -1;
      const x = x0 + tronco[limitar(i, 0, n - 1)];
      const ang = (lado > 0 ? 0 : Math.PI) + azar(-.9, .9);
      crecerRama(x, y, ang, azar(.035, .09) * Math.max(W, 600), azar(.6, .9), lado, Math.abs(y - H / 2) / (H / 2) * .6, 0);
    }

    // ---- Capas del SVG ----
    const defs = nuevo('defs', {}, svg);
    for (const lado of ['izq', 'der']) {
      const pat = nuevo('pattern', { id: `grano-${lado}`, patternUnits: 'userSpaceOnUse', width: 320, height: 320 }, defs);
      nuevo('rect', { width: 320, height: 320, fill: '#F4F0E8' }, pat);
      nuevo('image', { href: grano, width: 320, height: 320 }, pat);
    }
    // Luz suave desde arriba a la izquierda
    const luz = nuevo('linearGradient', { id: 'luz-papel', gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: W, y2: H }, defs);
    nuevo('stop', { offset: 0, 'stop-color': '#FFFFFF', 'stop-opacity': .32 }, luz);
    nuevo('stop', { offset: .55, 'stop-color': '#FFFFFF', 'stop-opacity': 0 }, luz);
    nuevo('stop', { offset: 1, 'stop-color': '#6E604A', 'stop-opacity': .07 }, luz);
    // Bulto: el reloj empuja el papel desde detrás antes de romperlo
    for (const [id, color, op] of [['bulto-luz', '#FFFFFF', .55], ['bulto-sombra', '#5E523E', .10]]) {
      const g = nuevo('radialGradient', { id }, defs);
      nuevo('stop', { offset: 0, 'stop-color': color, 'stop-opacity': op }, g);
      nuevo('stop', { offset: 1, 'stop-color': color, 'stop-opacity': 0 }, g);
    }
    // Desenfoques (solo sobre franjas estrechas junto al borde)
    for (const [id, d] of [['des-1', 1.2], ['des-3', 3], ['des-10', 10]]) {
      const f = nuevo('filter', { id, x: '-40%', y: '-2%', width: '180%', height: '104%' }, defs);
      nuevo('feGaussianBlur', { stdDeviation: d }, f);
    }

    el = {};
    const capa = (nombre, attrs) => (el[nombre] = nuevo('path', attrs, svg));
    // 1. Sombras sobre el hueco (debajo del papel)
    capa('sombraAnchaI', { fill: 'rgba(52,44,32,.2)', filter: 'url(#des-10)' });
    capa('sombraI', { fill: 'rgba(52,44,32,.38)', filter: 'url(#des-3)' });
    capa('sombraAnchaD', { fill: 'rgba(52,44,32,.07)', filter: 'url(#des-10)' });
    capa('sombraD', { fill: 'rgba(52,44,32,.14)', filter: 'url(#des-3)' });
    // 2. Fleco blanco: el alma del papel que asoma al romperse la capa de color
    capa('flecoI', { fill: '#FFFEFB' });
    capa('flecoD', { fill: '#FFFEFB' });
    capa('contornoI', { fill: 'none', stroke: 'rgba(120,108,88,.28)', 'stroke-width': .6 });
    capa('contornoD', { fill: 'none', stroke: 'rgba(120,108,88,.22)', 'stroke-width': .6 });
    capa('fibrasI', { fill: 'none', stroke: '#FFFEFB', 'stroke-width': .6, 'stroke-linecap': 'round' });
    capa('fibrasD', { fill: 'none', stroke: '#FFFEFB', 'stroke-width': .6, 'stroke-linecap': 'round' });
    capa('fibrasGrisI', { fill: 'none', stroke: 'rgba(150,140,120,.45)', 'stroke-width': .45, 'stroke-linecap': 'round' });
    capa('fibrasGrisD', { fill: 'none', stroke: 'rgba(150,140,120,.45)', 'stroke-width': .45, 'stroke-linecap': 'round' });
    // 3. Las dos mitades del papel
    capa('papelI', { fill: 'url(#grano-izq)' });
    capa('papelD', { fill: 'url(#grano-der)' });
    capa('luzI', { fill: 'url(#luz-papel)' });
    capa('luzD', { fill: 'url(#luz-papel)' });
    // 4. Labios curvados: pliegue en sombra + borde que coge la luz
    capa('pliegueI', { fill: 'rgba(92,78,56,.16)', filter: 'url(#des-3)' });
    capa('pliegueD', { fill: 'rgba(92,78,56,.22)', filter: 'url(#des-3)' });
    capa('brilloI', { fill: 'rgba(255,255,255,.55)', filter: 'url(#des-1)' });
    capa('brilloD', { fill: 'rgba(255,255,255,.75)', filter: 'url(#des-1)' });
    // Mover el fleco encima del papel (va por fuera del borde, así no tapa nada)
    for (const k of ['flecoI', 'flecoD', 'contornoI', 'contornoD', 'fibrasGrisI', 'fibrasGrisD', 'fibrasI', 'fibrasD']) svg.appendChild(el[k]);
    // 5. Bulto
    el.bultoLuz = nuevo('ellipse', { fill: 'url(#bulto-luz)' }, svg);
    el.bultoSombra = nuevo('ellipse', { fill: 'url(#bulto-sombra)' }, svg);
    // 6. Grietas finas: sombra, línea oscura y filo de luz
    el.grietas = nuevo('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    const trazos = [];
    const grieta = (rama) => {
      const g = nuevo('g', {}, el.grietas);
      const p = [
        nuevo('path', { stroke: 'rgba(70,60,45,.06)', 'stroke-width': 2.6 * rama.ancho, pathLength: 1 }, g),
        nuevo('path', { stroke: 'rgba(255,255,255,.85)', 'stroke-width': .7, pathLength: 1, transform: 'translate(.7 .8)' }, g),
        nuevo('path', { stroke: 'rgba(84,74,58,.5)', 'stroke-width': rama.ancho, pathLength: 1 }, g),
      ];
      p.forEach(c => c.setAttribute('stroke-dasharray', '1 1'));
      trazos.push({ rama, g, p });
    };
    // Grieta principal: dos mitades que crecen desde el centro
    const mitad = Math.round((H / 2 + 20) / PASO);
    const arriba = [], abajo = [];
    for (let i = mitad; i >= 0; i--) arriba.push([x0 + tronco[i], ys[i]]);
    for (let i = mitad; i < n; i++) abajo.push([x0 + tronco[i], ys[i]]);
    el.tronco = [];
    for (const pts of [arriba, abajo]) {
      const r = { pts, lado: 0, inicio: 0, ancho: 1.1, tronco: true };
      grieta(r); el.tronco.push(trazos[trazos.length - 1]);
    }
    ramas.forEach(grieta);
    el.trazos = trazos;
    ultimo = '';
  }

  // Cuánto se ha separado cada lado del papel a una altura dada
  let A = 0, B = 0, alcance = 0;
  function apertura(i, lado) {
    const u = (ys[i] - H / 2) / (alcance / 2 || 1);
    const lente = Math.abs(u) < 1 ? Math.pow(Math.cos(u * Math.PI / 2), 1.3) : 0;
    return (A * lente + B) * (1 + datos[lado].asim[i]);
  }
  const indice = y => limitar(Math.round((y + 20) / PASO), 0, ys.length - 1);
  const f1 = v => v.toFixed(1);

  // ---------------------------------------------------------------
  // Pintar un fotograma. gr: grietas (0-1) · r: rasgado (0-1)
  // ---------------------------------------------------------------
  function pintar(gr, r) {
    const clave = gr.toFixed(4) + '|' + r.toFixed(4);
    if (clave === ultimo) return;          // nada ha cambiado: no repintar
    ultimo = clave;

    const movil = W < 700;
    alcance = H * 1.6 * suave(limitar(r / .38));
    A = (movil ? .13 : .12) * W * suaveIO(limitar(r / .8));
    B = (movil ? .36 : .155) * W * suaveIO(limitar((r - .22) / .78));

    const n = ys.length;
    const bordes = {};
    for (const lado of ['izq', 'der']) {
      const s = lado === 'izq' ? -1 : 1, d = datos[lado];
      const borde = [], fuera = [], dentroL = [], medioL = [], sombra = [], ancha = [], abierto = [];
      for (let i = 0; i < n; i++) {
        const ab = apertura(i, lado);
        const k = limitar(ab / 8);                 // 0 = aún cerrado aquí, 1 = abierto
        const x = x0 + datos.tronco[i] + s * ab + d.diente[i] * k;
        const L = Math.min(24, 4 + ab * .09) * d.labio[i] * k;   // anchura del labio curvado
        borde.push(x);
        fuera.push(x + s * d.fleco[i] * k);
        medioL.push(x - s * L * .42);
        dentroL.push(x - s * L);
        sombra.push(x + s * (3 + L * .55) * k);
        ancha.push(x + s * 26 * k);
        abierto.push(k);
      }
      bordes[lado] = { borde, fuera, abierto, s };

      const linea = xs => xs.map((x, i) => `${f1(x)} ${ys[i]}`).join(' L');
      const vuelta = xs => xs.map((x, i) => [x, ys[i]]).reverse().map(([x, y]) => `${f1(x)} ${y}`).join(' L');
      const banda = (a, b) => `M${linea(a)} L${vuelta(b)} Z`;
      const lejos = s < 0 ? -60 : W + 60;
      const papel = `M${lejos} ${ys[0]} L${linea(borde)} L${lejos} ${ys[n - 1]} Z`;
      const L = lado === 'izq' ? 'I' : 'D';

      el['papel' + L].setAttribute('d', papel);
      el['luz' + L].setAttribute('d', papel);
      el['fleco' + L].setAttribute('d', banda(borde.map(x => x - s * 1.2), fuera));
      el['contorno' + L].setAttribute('d', `M${linea(fuera)}`);
      el['pliegue' + L].setAttribute('d', banda(dentroL, medioL));
      el['brillo' + L].setAttribute('d', banda(medioL, borde));
      el['sombra' + L].setAttribute('d', banda(borde, sombra));
      el['sombraAncha' + L].setAttribute('d', banda(borde, ancha));
      // El grano viaja con el papel
      document.getElementById(`grano-${lado}`).setAttribute('patternTransform', `translate(${f1(s * B)} 0)`);

      // Fibras
      let blancas = '', grises = '';
      for (const f of d.fibras) {
        if (abierto[f.i] < .3) continue;
        const x = fuera[f.i], y = ys[f.i];
        const a = f.ang + (s < 0 ? 0 : Math.PI);
        const l = f.largo * abierto[f.i];
        const t = `M${f1(x - s * .8)} ${f1(y)} q${f1(Math.cos(a) * l / 2)} ${f1(Math.sin(a) * l / 2 + f.curva)} ${f1(Math.cos(a) * l)} ${f1(Math.sin(a) * l)}`;
        if (f.gris) grises += t; else blancas += t;
      }
      el['fibras' + L].setAttribute('d', blancas || 'M0 0');
      el['fibrasGris' + L].setAttribute('d', grises || 'M0 0');
    }

    // Bulto: aparece mientras se agrieta y se va al rasgarse
    const bulto = gr * (1 - limitar(r * 4));
    const rx = Math.min(W * .2, 190), ry = Math.min(H * .28, 230);
    el.bultoLuz.setAttribute('cx', x0 - 18); el.bultoLuz.setAttribute('cy', H / 2 - 22);
    el.bultoSombra.setAttribute('cx', x0 + 24); el.bultoSombra.setAttribute('cy', H / 2 + 30);
    for (const e of [el.bultoLuz, el.bultoSombra]) { e.setAttribute('rx', rx); e.setAttribute('ry', ry); e.setAttribute('opacity', f1(bulto * 10) / 10); }

    // Grietas: crecen desde el centro; las ramas viajan con su mitad del papel
    for (const t of el.trazos) {
      const { rama } = t;
      const crece = rama.tronco ? suave(gr) : suave(limitar((gr - rama.inicio) / .35));
      const off = String(1 - crece);
      t.p.forEach(c => c.setAttribute('stroke-dashoffset', off));
      t.g.setAttribute('opacity', crece > 0 ? 1 : 0);
      if (rama.tronco) t.g.setAttribute('opacity', crece > 0 ? 1 - limitar(r * 12) : 0);
      else t.g.setAttribute('opacity', crece > 0 ? 1 - .45 * limitar(r * 2) : 0);
      const lado = rama.lado < 0 ? 'izq' : 'der';
      const d = 'M' + rama.pts.map(([x, y]) => {
        const dx = rama.tronco ? 0 : rama.lado * apertura(indice(y), lado);
        return `${f1(x + dx)} ${f1(y)}`;
      }).join(' L');
      t.p.forEach(c => c.setAttribute('d', d));
    }
  }

  return { montar, pintar, crearGrano };
})();
