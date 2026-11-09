import { Component, type ReactNode } from 'react';

// Si una pantalla falla, se muestra un mensaje con opción de recargar, en vez de dejar la app en blanco.
export default class Fallo extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('[Vitaltrain] Fallo en pantalla', error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-4 p-8 text-center bg-fondo">
        <h1 className="text-2xl font-bold">Algo ha fallado en esta pantalla</h1>
        <p className="text-texto-suave max-w-sm">Lo que hayas registrado está guardado. Vuelve a cargar la app. Si se repite, avisa a Rubén con una captura de este mensaje.</p>
        <p className="text-xs text-texto-suave max-w-sm break-words">{this.state.error.message}</p>
        <button onClick={() => location.reload()} className="bg-mostaza text-[#1F2424] font-bold px-6 py-3 rounded-2xl">Volver a cargar</button>
      </div>
    );
  }
}
