import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
// Si una pantalla falla, se muestra un mensaje con opción de recargar, en vez de dejar la app en blanco.
export default class Fallo extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(error) { console.error('[Vitaltrain] Fallo en pantalla', error); }
    render() {
        if (!this.state.error)
            return this.props.children;
        return (_jsxs("div", { className: "min-h-full flex flex-col items-center justify-center gap-4 p-8 text-center bg-fondo", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Algo ha fallado en esta pantalla" }), _jsx("p", { className: "text-texto-suave max-w-sm", children: "Lo que hayas registrado est\u00E1 guardado. Vuelve a cargar la app. Si se repite, avisa a Rub\u00E9n con una captura de este mensaje." }), _jsx("p", { className: "text-xs text-texto-suave max-w-sm break-words", children: this.state.error.message }), _jsx("button", { onClick: () => location.reload(), className: "bg-mostaza text-[#1F2424] font-bold px-6 py-3 rounded-2xl", children: "Volver a cargar" })] }));
    }
}
