// Estilo común de todas las gráficas (Chart.js) y utilidades para crearlas.

export const C = {
  electrico: '#10069F',
  electricoSuave: 'rgba(16, 6, 159, .12)',
  pervinca: '#CFCDF9',
  pervinca2: '#E9E8FD',
  tinta: '#14163A',
  tinta2: '#565B7D',
  tinta3: '#8E93AE',
  linea: '#E4E6EF',
  ok: '#12805A',
};

let configurado = false;
export function hayChart() {
  if (typeof Chart === 'undefined') return false;
  if (!configurado) {
    Chart.defaults.locale = 'es-ES';
    Chart.defaults.font.family = "'Archivo', system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = C.tinta3;
    Chart.defaults.borderColor = C.linea;
    Object.assign(Chart.defaults.plugins.tooltip, {
      backgroundColor: C.tinta, padding: 10, cornerRadius: 10, displayColors: false,
      titleFont: { weight: '600' }, bodyFont: { size: 12.5 },
    });
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.maintainAspectRatio = false;
    configurado = true;
  }
  return true;
}

// Guardamos cada gráfica por su id para destruirla antes de volver a pintarla
const graficas = new Map();
export function grafica(canvas, config) {
  if (!canvas || !hayChart()) return null;
  graficas.get(canvas.id)?.destroy();
  const g = new Chart(canvas, config);
  graficas.set(canvas.id, g);
  return g;
}

// Ejes con el estilo de la app
export const ejeX = (extra = {}) => ({ grid: { display: false }, border: { color: C.linea }, ticks: { maxRotation: 0, autoSkipPadding: 14 }, ...extra });
export const ejeY = (extra = {}) => ({ grid: { color: C.linea }, border: { display: false }, ticks: { padding: 6 }, ...extra });

// Mezcla dos colores hex: t = 0 → a, t = 1 → b
export function mezcla(a, b, t) {
  const h = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16));
  const [r1, g1, b1] = h(a), [r2, g2, b2] = h(b);
  const m = (x, y) => Math.round(x + (y - x) * t);
  return `rgb(${m(r1, r2)}, ${m(g1, g2)}, ${m(b1, b2)})`;
}
