import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
// Instrucciones para añadir la app a la pantalla de inicio. Se ocultan si ya está instalada.
function esApple() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function instalada() {
    return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}
export default function Instalar() {
    const [yaInstalada, setYaInstalada] = useState(false);
    useEffect(() => setYaInstalada(instalada()), []);
    if (yaInstalada)
        return null;
    return (_jsxs("section", { className: "bg-white rounded-2xl p-5 flex flex-col gap-2", "aria-labelledby": "instalar", children: [_jsx("h2", { id: "instalar", className: "text-lg font-bold", children: "A\u00F1\u00E1dela a tu pantalla de inicio" }), esApple() ? (_jsxs("ol", { className: "list-decimal pl-5 text-base leading-relaxed", children: [_jsx("li", { children: "Abre esta p\u00E1gina en Safari." }), _jsx("li", { children: "Pulsa el bot\u00F3n Compartir, abajo." }), _jsx("li", { children: "Elige \u00ABA\u00F1adir a pantalla de inicio\u00BB." })] })) : (_jsxs("ol", { className: "list-decimal pl-5 text-base leading-relaxed", children: [_jsx("li", { children: "Abre esta p\u00E1gina en Chrome." }), _jsx("li", { children: "Pulsa el men\u00FA de los tres puntos, arriba." }), _jsx("li", { children: "Elige \u00ABInstalar aplicaci\u00F3n\u00BB o \u00ABA\u00F1adir a pantalla de inicio\u00BB." })] }))] }));
}
