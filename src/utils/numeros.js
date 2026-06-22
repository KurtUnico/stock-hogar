// Pequeño helper compartido para no repetir "Math.max(0, Number(x) || 0)"
// en cada lugar donde se guarda una cantidad o un precio. Cualquier valor
// inválido, vacío o negativo se normaliza a 0. Preserva decimales.
export function numeroPositivo(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
