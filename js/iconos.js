// Iconos de línea propios (SVG). Se pintan con el color del texto (currentColor).
const P = {
  gym: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  running: '<circle cx="15" cy="4.5" r="1.7"/><path d="M13.2 8.2l-2.3 4.8 3.1 2.6-1.2 5.4M10.9 13l-2.6 3.3-3.3-.8M7.6 10.4l5.6-2.2 2.7 3.1 2.6.6"/>',
  flex: '<circle cx="12" cy="4.8" r="1.7"/><path d="M12 8.3v5.2M4.5 19.2c2.2-3.3 4.7-4.6 7.5-4.6s5.3 1.3 7.5 4.6M7.2 11.4l4.8-1.3 4.8 1.3"/>',
  bici: '<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5l3.7-7.5h5.6l3.7 7.5M9.2 9l3.3 7.5 2.3-7.5M13.5 5.5h2.7"/>',
  nutricion: '<path d="M12 7.2c-1.8-1.6-6.5-1.3-6.5 3.8 0 3.7 2.8 8.8 4.8 8.8.9 0 1.1-.6 1.7-.6s.8.6 1.7.6c2 0 4.8-5.1 4.8-8.8 0-5.1-4.7-5.4-6.5-3.8z"/><path d="M12 7.2c.1-1.9 1-3.3 2.8-3.9"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  izq: '<path d="M14.5 6l-6 6 6 6"/>',
  der: '<path d="M9.5 6l6 6-6 6"/>',
  arriba: '<path d="M12 18V6M7 11l5-5 5 5"/>',
  abajo: '<path d="M12 6v12M7 13l5 5 5-5"/>',
  papelera: '<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l.9 12.5h9.2L17.5 7M9.5 7V4.5h5V7"/>',
  salir: '<path d="M14 4.5h4.5v15H14M10 8.5L6.5 12l3.5 3.5M6.5 12H16"/>',
  copiar: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V5.5a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"/>',
  nube: '<path d="M7 18.5h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6-1.2A4.6 4.6 0 0 0 7 18.5z"/><path d="M4 4l16 16"/>',
  calendario: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  rayo: '<path d="M13 3.5L6 13.5h5.5l-1 7 7-10H12l1-7z"/>',
};

export const icono = (nombre, clase = '') =>
  `<svg class="ico ${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[nombre] || ''}</svg>`;
