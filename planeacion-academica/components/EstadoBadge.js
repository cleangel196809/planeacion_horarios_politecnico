const COLORES = {
  "Reportado": "bg-green-100 text-green-700",
  "Sin reportar": "bg-amber-100 text-amber-700",
  "No aplica": "bg-gray-100 text-gray-600"
};

export default function EstadoBadge({ estado }) {
  return <span className={`badge ${COLORES[estado] || "bg-gray-100 text-gray-600"}`}>{estado}</span>;
}
