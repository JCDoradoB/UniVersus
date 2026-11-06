export const normalizarRol = (rol) => {
  const valor = String(rol || "").trim().toLowerCase();
  if (valor === "admin" || valor === "administrador") return "administrador";
  if (valor === "organizador") return "organizador";
  return "participante";
};

export const puedeGestionarEventos = (rol) =>
  ["administrador", "organizador"].includes(normalizarRol(rol));
