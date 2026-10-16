/** Logotipo ENZO Producciones (versión vectorial propia para la web). */
export function Logo({ className = '', claro = true }: { className?: string; claro?: boolean }) {
  const texto = claro ? '#FFFFFF' : '#0A1B33';
  return (
    <svg viewBox="0 0 250 78" className={className} role="img" aria-label="ENZO Producciones LED & Eventos – Cañete S.A.C.">
      <path d="M2 52 28 6l10 16-14 30z" fill="#1E6FE0" />
      <path d="M20 54 44 16l12 38z" fill="#38BDF8" />
      <text x="62" y="44" fontFamily="Inter, system-ui, sans-serif" fontWeight="800" fontSize="44" letterSpacing="3" fill={texto}>ENZO</text>
      <text x="64" y="60" fontFamily="Inter, system-ui, sans-serif" fontWeight="700" fontSize="11.5" letterSpacing="4.6" fill={texto}>PRODUCCIONES</text>
      <text x="64" y="73" fontFamily="Inter, system-ui, sans-serif" fontWeight="600" fontSize="7.4" letterSpacing="0.8" fill="#38BDF8">LED &amp; EVENTOS · CAÑETE S.A.C.</text>
    </svg>
  );
}
