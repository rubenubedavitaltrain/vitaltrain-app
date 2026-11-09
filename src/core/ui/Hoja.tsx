// Hoja inferior (en móvil) o ventana centrada (en ordenador). Común a varios módulos.

export function Hoja({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-6" onClick={onCerrar}>
      <div className="bg-fondo w-full sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-bold">{titulo}</h3>
          <button onClick={onCerrar} className="text-petroleo font-bold px-2">Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  );
}
