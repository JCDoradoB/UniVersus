import { supabaseClient } from "./supabase.js";

const listaTorneos = document.getElementById("lista-torneos");
const mensajeVacio = document.getElementById("mensaje-vacio");
const navCuenta = document.getElementById("nav-cuenta");

const claseChip = (estado) => {
  const valor = (estado || "").toLowerCase().trim();

  if (valor === "abierto") return "chip chip-abierto";
  if (valor === "en curso") return "chip chip-en-curso";
  if (valor === "finalizado") return "chip chip-finalizado";
  return "chip";
};

const formatearFecha = (fecha) => {
  if (!fecha) return "Por definir";

  const fechaLocal = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(fechaLocal.getTime())) return fecha;

  return fechaLocal.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const crearTarjeta = (torneo) => {
  const articulo = document.createElement("article");
  articulo.className = "tarjeta-torneo";

  const titulo = document.createElement("h2");
  titulo.textContent = torneo.nombre || "Torneo sin nombre";

  const meta = document.createElement("dl");
  meta.className = "tarjeta-meta";

  const campos = [
    ["Deporte", torneo.deporte || "No especificado"],
    ["Modalidad", torneo.modalidad === "equipos" ? "Por equipos" : "Individual"],
    ["Fecha", formatearFecha(torneo.fecha_inicio)],
    ["Cupos", torneo.cupos ?? "Sin límite"],
  ];

  campos.forEach(([etiqueta, valor]) => {
    const dt = document.createElement("dt");
    dt.textContent = etiqueta;
    const dd = document.createElement("dd");
    dd.textContent = String(valor);
    meta.append(dt, dd);
  });

  const chip = document.createElement("span");
  chip.className = claseChip(torneo.estado);
  chip.textContent = torneo.estado || "Sin estado";

  articulo.append(titulo, meta, chip);
  return articulo;
};

const mostrarError = (texto) => {
  if (!mensajeVacio) return;
  mensajeVacio.hidden = false;
  mensajeVacio.textContent = texto;
};

const cargarTorneos = async () => {
  if (!listaTorneos) return;

  if (mensajeVacio) {
    mensajeVacio.hidden = false;
    mensajeVacio.textContent = "Cargando torneos...";
  }

  const { data, error } = await supabaseClient.from("torneos").select("*").order("fecha_inicio", {
    ascending: true,
  });

  if (error) {
    mostrarError("No pudimos cargar los torneos. Revisa tu conexión y las credenciales de Supabase.");
    return;
  }

  if (!data || data.length === 0) {
    mostrarError("Aún no hay torneos publicados. Vuelve pronto para inscribirte.");
    return;
  }

  if (mensajeVacio) mensajeVacio.hidden = true;
  listaTorneos.replaceChildren(...data.map(crearTarjeta));
};

const actualizarNavegacion = async () => {
  if (!navCuenta) return;

  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) return;

  const usuario = data.session.user;
  const { data: perfil } = await supabaseClient
    .from("perfiles")
    .select("nombre, rol")
    .eq("id", usuario.id)
    .maybeSingle();

  const enlaceEventos = document.createElement("a");
  enlaceEventos.href = "eventos.html";
  enlaceEventos.textContent = ["organizador", "administrador"].includes(perfil?.rol)
    ? "Crear evento"
    : "Eventos";

  const nombre = document.createElement("span");
  nombre.className = "nav-saludo";
  nombre.textContent = perfil?.nombre || usuario.email;

  const cerrarSesion = document.createElement("button");
  cerrarSesion.className = "btn-enlace";
  cerrarSesion.type = "button";
  cerrarSesion.textContent = "Cerrar sesión";
  cerrarSesion.addEventListener("click", async () => {
    const { error: errorSalida } = await supabaseClient.auth.signOut();
    if (errorSalida) {
      mostrarError(`No se pudo cerrar sesión: ${errorSalida.message}`);
      return;
    }
    window.location.reload();
  });

  navCuenta.replaceChildren(enlaceEventos, nombre, cerrarSesion);
};

cargarTorneos();
actualizarNavegacion();
