/** Elementos visuais compartilhados pelo mapa de salas dos perfis autorizados. */

export type MapaStatus = '' | 'livre' | 'ocupada' | 'iminente';

export interface MapaContadores {
  livre: number;
  ocupada: number;
  iminente: number;
}

export function renderMapaChips(
  contadores: MapaContadores,
  selecionado: MapaStatus,
): string {
  const chips = [
    { status: '', label: 'Todas', count: contadores.livre + contadores.ocupada + contadores.iminente, cls: 'todas' },
    { status: 'livre', label: 'Livre', count: contadores.livre, cls: 'livre' },
    { status: 'ocupada', label: 'Ocupada', count: contadores.ocupada, cls: 'ocupada' },
    { status: 'iminente', label: 'Em breve', count: contadores.iminente, cls: 'iminente' },
  ];

  return chips
    .map(
      (chip) =>
        `<button type="button" class="mapa-status-chip ${chip.cls}${selecionado === chip.status ? ' selecionado' : ''}" data-action="mapaChipStatus" data-arg="${chip.status || 'todas'}" aria-pressed="${selecionado === chip.status}">` +
        `<span class="mapa-chip-dot"></span><span>${chip.label}</span><strong>${chip.count}</strong></button>`,
    )
    .join('');
}
