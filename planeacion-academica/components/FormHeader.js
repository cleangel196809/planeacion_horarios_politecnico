// Encabezado institucional: isologo del Politécnico Internacional + nombre
// del formulario/pantalla. Se usa en el login, el panel principal y los
// formularios modales (nuevo formulario, cambiar contraseña, etc.).
export default function FormHeader({ titulo, subtitulo, size = "md" }) {
  const alturaLogo = size === "lg" ? "h-12" : "h-9";
  const tamañoTitulo = size === "lg" ? "text-xl" : "text-base";

  return (
    <div className="flex items-center gap-3">
      <img
        src="/isologo.png"
        alt="Politécnico Internacional"
        className={`${alturaLogo} w-auto shrink-0`}
      />
      {(titulo || subtitulo) && (
        <div className="min-w-0 border-l border-brand-100 pl-3">
          {titulo && (
            <h1 className={`${tamañoTitulo} font-semibold text-brand-900 leading-tight truncate`}>
              {titulo}
            </h1>
          )}
          {subtitulo && <p className="text-xs text-gray-500 leading-tight">{subtitulo}</p>}
        </div>
      )}
    </div>
  );
}
