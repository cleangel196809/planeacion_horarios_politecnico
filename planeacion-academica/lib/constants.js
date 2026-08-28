// Vocabulario controlado del formulario. Los valores (value) son los que se
// escriben tal cual en la base de datos y en el Excel exportado, replicando
// los valores reales que ya usa la institución en su plantilla PLANEACION.

const SEDES = [
  { value: "CALLE 73", label: "Calle 73" },
  { value: "NORTE", label: "Sede Norte" },
  { value: "SUR", label: "Sede Sur" },
  { value: "ASISTIDA POR TECNOLOGIA", label: "Virtual (Asistida por Tecnología)" }
];

// Rango horario sugerido por defecto para cada jornada. El decano puede
// ajustar la hora exacta de cada día si su grupo no calza con el estándar.
const JORNADAS = [
  { value: "DIURNA", label: "Diurna", horaInicio: "07:00", horaFin: "10:00" },
  { value: "ESPECIAL", label: "Especial", horaInicio: "10:00", horaFin: "13:00" },
  { value: "NOCHE", label: "Noche", horaInicio: "18:00", horaFin: "21:00" },
  {
    value: "SABADO",
    label: "Sabatina",
    // Dos franjas típicas de sabatina; se ofrecen ambas como sugerencia.
    opciones: [
      { horaInicio: "07:00", horaFin: "12:00", label: "Sabatina diurna (7:00 - 12:00)" },
      { horaInicio: "13:00", horaFin: "19:00", label: "Sabatina tarde (13:00 - 19:00)" }
    ]
  },
  // Se usa para asignaturas que se dictan de forma asistida por tecnología
  // (marcadas con FLG_VIRTUAL en el archivo base de carreras y materias).
  { value: "VIRTUAL", label: "Virtual", horaInicio: "07:00", horaFin: "09:00" }
];

// Ciclos de formación disponibles para el selector inicial del formulario
// nuevo del decano (1 a 10, tal como se manejan en los planes de estudio).
const CICLOS = Array.from({ length: 10 }, (_, i) => String(i + 1));

// Bloques de horario de 1:30 (90 min) usados por la pantalla "Programación
// del ciclo" del decano: van de 7:00 a 21:00; el último queda corto (30 min)
// para completar la franja nocturna. Cada bloque seleccionado, combinado con
// los días elegidos, genera las filas de planeacion_horario del grupo.
const BLOQUES_HORARIO = [
  { horaInicio: "07:00", horaFin: "08:30" },
  { horaInicio: "08:30", horaFin: "10:00" },
  { horaInicio: "10:00", horaFin: "11:30" },
  { horaInicio: "11:30", horaFin: "13:00" },
  { horaInicio: "13:00", horaFin: "14:30" },
  { horaInicio: "14:30", horaFin: "16:00" },
  { horaInicio: "16:00", horaFin: "17:30" },
  { horaInicio: "17:30", horaFin: "19:00" },
  { horaInicio: "19:00", horaFin: "20:30" },
  { horaInicio: "20:30", horaFin: "21:00", corto: true }
];

const ESTADOS = [
  { value: "Sin reportar", label: "Sin reportar" },
  { value: "Reportado", label: "Reportado" },
  { value: "No aplica", label: "No aplica" }
];

// Días en el orden en que se ubican en las columnas de la plantilla
// (LUN, MAR, MCL, JUE, VIE). SABADO se incluye porque la jornada "SABADO"
// existe en los datos reales, aunque la plantilla no tiene columnas propias
// para ese día — ver README para la regla de mapeo al exportar.
const DIAS = [
  { value: "LUNES", label: "Lunes", corto: "LUN" },
  { value: "MARTES", label: "Martes", corto: "MAR" },
  { value: "MIERCOLES", label: "Miércoles", corto: "MCL" },
  { value: "JUEVES", label: "Jueves", corto: "JUE" },
  { value: "VIERNES", label: "Viernes", corto: "VIE" },
  { value: "SABADO", label: "Sábado", corto: "SAB" }
];

module.exports = { SEDES, JORNADAS, ESTADOS, DIAS, CICLOS, BLOQUES_HORARIO };
