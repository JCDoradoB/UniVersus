export const obtenerEstadoInscripcion = (torneo, fechaActual = new Date()) => {
  if ((torneo.estado || "").trim().toLowerCase() === "cancelado") return "cancelado";

  const hoy = new Date(
    fechaActual.getFullYear(),
    fechaActual.getMonth(),
    fechaActual.getDate()
  );
  const inicio = torneo.inscripciones_inicio
    ? new Date(`${torneo.inscripciones_inicio}T00:00:00`)
    : null;
  const fin = torneo.inscripciones_fin
    ? new Date(`${torneo.inscripciones_fin}T00:00:00`)
    : null;

  if (!inicio || Number.isNaN(inicio.getTime())) return "proximamente";
  if (hoy < inicio) return "proximamente";
  if (!fin || Number.isNaN(fin.getTime())) return "cerrado";
  if (hoy > fin) return "cerrado";
  return "abierto";
};

export const claseEstadoInscripcion = (estado) => {
  const clases = {
    proximamente: "chip chip-proximamente",
    abierto: "chip chip-abierto",
    cerrado: "chip chip-cerrado",
    cancelado: "chip chip-cancelado",
  };
  return clases[estado] || "chip";
};

export const etiquetaEstadoInscripcion = (estado) => {
  const etiquetas = {
    proximamente: "Próximamente",
    abierto: "Abierto",
    cerrado: "Cerrado",
    cancelado: "Cancelado",
  };
  return etiquetas[estado] || "Sin estado";
};

export const etiquetaCuposDisponibles = (total, inscritos) => {
  if (total == null) return "Sin límite";
  if (inscritos == null) return "—";
  const disponibles = Math.max(0, Number(total) - inscritos);
  return disponibles === 0 ? "Sin cupos" : String(disponibles);
};
