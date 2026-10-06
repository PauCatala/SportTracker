// Estilo común de todas las gráficas (Chart.js) y utilidades para crearlas.

export const C = {
  // Mismos colores que css/tokens.css (paleta pastel mate)
  electrico: '#2D3B5C',
  electricoSuave: 'rgba(45, 59, 92, .10)',
  pervinca: '#BBD3E8',
  pervinca2: '#DCE8F3',
  medio: '#8DB2D6',
  acero: '#CDC9C0',
  tinta: '#1D2538',
  tinta2: '#5A6070',
  tinta3: '#9A9A96',
  linea: '#E3DED3',
  ok: '#4E9576',
};

let configurado = false;
export function hayChart() {
  if (typeof Chart === 'undefined') return false;
  if (!configurado) {
    Chart.defaults.locale = 'es-ES';
    Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', Arial, sans-serif";
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
