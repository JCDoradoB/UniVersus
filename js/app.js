import { supabaseClient } from "./supabase.js";

const listaTorneos = document.getElementById("lista-torneos");
const mensajeVacio = document.getElementById("mensaje-vacio");
const navCuenta = document.getElementById("nav-cuenta");
const dialogoInscripcion = document.getElementById("dialogo-inscripcion");
const formularioInscripcion = document.getElementById("form-inscripcion");
const mensajeInscripcion = document.getElementById("mensaje-inscripcion");
const grupoEquipo = document.getElementById("grupo-equipo");
const campoNombreEquipo = document.getElementById("nombre-equipo");
const campoNombreCapitan = document.getElementById("nombre-capitan");
const campoCodigoEstudiante = document.getElementById("codigo-estudiante");
const campoCorreoInstitucional = document.getElementById("correo-institucional");
const botonEnviarInscripcion = document.getElementById("enviar-inscripcion");
const nombreTorneoInscripcion = document.getElementById("nombre-torneo-inscripcion");
const mensajeInscripcionOk = document.getElementById("mensaje-inscripcion-ok");
let torneoSeleccionado = null;
const torneosInscritos = new Set();
const botonesInscripcion = new Map();

const marcarComoInscrito = (torneoId) => {
  torneosInscritos.add(torneoId);
  const boton = botonesInscripcion.get(torneoId);
  if (!boton) return;

  boton.textContent = "Ya inscrito";
  boton.disabled = true;
  boton.classList.add("btn-inscrito");
};

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

const formatearRangoFechas = (inicio, fin) =>
  `${formatearFecha(inicio)} – ${formatearFecha(fin)}`;

const mostrarErrorInscripcion = (texto) => {
  mensajeInscripcion.textContent = texto;
  mensajeInscripcion.className = "mensaje-error visible";
  mensajeInscripcion.hidden = false;
};

const limpiarMensajeInscripcion = () => {
  mensajeInscripcion.textContent = "";
  mensajeInscripcion.className = "mensaje-error";
  mensajeInscripcion.hidden = true;
};

const abrirFormularioInscripcion = async (torneo) => {
  formularioInscripcion.reset();
  torneoSeleccionado = torneo;
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;

  if (!data.session?.user) {
    window.location.href = "login.html";
    return;
  }

  nombreTorneoInscripcion.textContent = torneo.nombre || "Torneo";
  const esPorEquipos = torneo.modalidad === "equipos";
  grupoEquipo.hidden = !esPorEquipos;
  campoNombreEquipo.required = esPorEquipos;
  campoCorreoInstitucional.value = data.session.user.email || "";
  limpiarMensajeInscripcion();
  dialogoInscripcion.showModal();
  campoNombreCapitan.focus();
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

  const fechas = document.createElement("div");
  fechas.className = "torneo-fechas";

  [
    ["Inscripciones", torneo.inscripciones_inicio, torneo.inscripciones_fin],
    ["Evento", torneo.fecha_inicio, torneo.fecha_fin],
  ].forEach(([etiqueta, inicio, fin]) => {
    const bloque = document.createElement("div");
    bloque.className = "fecha-bloque";
    const encabezado = document.createElement("h3");
    encabezado.textContent = etiqueta;
    const rango = document.createElement("p");
    rango.textContent = formatearRangoFechas(inicio, fin);
    bloque.append(encabezado, rango);
    fechas.append(bloque);
  });

  const botonInscribirme = document.createElement("button");
  botonInscribirme.className = "btn btn-inscribirme";
  botonInscribirme.type = "button";
  botonesInscripcion.set(torneo.id, botonInscribirme);
  if (torneosInscritos.has(torneo.id)) {
    botonInscribirme.textContent = "Ya inscrito";
    botonInscribirme.disabled = true;
    botonInscribirme.classList.add("btn-inscrito");
  } else {
    botonInscribirme.textContent = "Inscribirme";
  }
  botonInscribirme.addEventListener("click", () => {
    if (torneosInscritos.has(torneo.id)) return;
    abrirFormularioInscripcion(torneo).catch((error) => {
      mostrarErrorInscripcion(`No se pudo abrir la inscripción. ${error.message}`);
      if (!dialogoInscripcion.open) dialogoInscripcion.showModal();
    });
  });

  articulo.append(titulo, meta, fechas, chip, botonInscribirme);
  return articulo;
};

const mostrarError = (texto) => {
  if (!mensajeVacio) return;
  mensajeVacio.hidden = false;
  mensajeVacio.textContent = texto;
};

const cargarTorneos = async () => {
  if (!listaTorneos) return;

  torneosInscritos.clear();
  botonesInscripcion.clear();
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

  let errorVerificacion = null;
  const { data: sesion, error: errorSesion } = await supabaseClient.auth.getSession();
  if (errorSesion) {
    errorVerificacion = `No pudimos comprobar tus inscripciones. ${errorSesion.message}`;
  } else if (sesion.session?.user) {
    const { data: inscripciones, error } = await supabaseClient
      .from("inscripciones")
      .select("torneo_id")
      .eq("usuario_id", sesion.session.user.id);

    if (error) {
      errorVerificacion = `No pudimos comprobar tus inscripciones. ${error.message}`;
    } else {
      inscripciones.forEach((inscripcion) => torneosInscritos.add(inscripcion.torneo_id));
    }
  }

  listaTorneos.replaceChildren(...data.map(crearTarjeta));
  if (errorVerificacion) {
    mostrarError(errorVerificacion);
  } else if (mensajeVacio) {
    mensajeVacio.hidden = true;
  }
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

const cerrarDialogoInscripcion = () => {
  dialogoInscripcion.close();
  formularioInscripcion.reset();
  torneoSeleccionado = null;
  limpiarMensajeInscripcion();
};

dialogoInscripcion.addEventListener("close", () => {
  formularioInscripcion.reset();
  torneoSeleccionado = null;
  limpiarMensajeInscripcion();
});

document.getElementById("cerrar-inscripcion").addEventListener("click", cerrarDialogoInscripcion);
document.getElementById("cancelar-inscripcion").addEventListener("click", cerrarDialogoInscripcion);
dialogoInscripcion.addEventListener("click", (evento) => {
  if (evento.target === dialogoInscripcion) cerrarDialogoInscripcion();
});

formularioInscripcion.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  limpiarMensajeInscripcion();

  if (!torneoSeleccionado || !formularioInscripcion.reportValidity()) return;

  botonEnviarInscripcion.disabled = true;
  try {
    const { data: sesion, error: errorSesion } = await supabaseClient.auth.getSession();
    if (errorSesion) throw errorSesion;
    if (!sesion.session?.user) {
      window.location.href = "login.html";
      return;
    }

    const { error } = await supabaseClient.rpc("registrar_inscripcion", {
      p_torneo_id: torneoSeleccionado.id,
      p_nombre_equipo: grupoEquipo.hidden ? null : campoNombreEquipo.value.trim(),
      p_nombre_capitan: campoNombreCapitan.value.trim(),
      p_codigo_estudiante: campoCodigoEstudiante.value.trim(),
      p_correo_institucional: campoCorreoInstitucional.value.trim(),
    });

    if (error) {
      const yaInscrito = error.code === "23505" || error.message.includes("Ya tienes una inscripción");
      if (yaInscrito) marcarComoInscrito(torneoSeleccionado.id);
      const mensaje = yaInscrito
        ? "Ya tienes una inscripción para este torneo."
        : error.code === "PGRST202" || error.message.includes("registrar_inscripcion")
          ? "Supabase no encuentra registrar_inscripcion. Ejecuta completo el SQL de supabase/migrations/20261104212000_reparar_tabla_inscripciones.sql en el proyecto conectado, revisa que termine sin error y vuelve a intentar."
          : error.message;
      mostrarErrorInscripcion(`No se pudo enviar la inscripción. ${mensaje}`);
      return;
    }

    marcarComoInscrito(torneoSeleccionado.id);
    cerrarDialogoInscripcion();
    mensajeInscripcionOk.textContent = "Tu inscripción fue enviada correctamente.";
    mensajeInscripcionOk.hidden = false;
    mensajeInscripcionOk.classList.add("visible");
  } catch (error) {
    mostrarErrorInscripcion(`No se pudo enviar la inscripción. ${error.message}`);
  } finally {
    botonEnviarInscripcion.disabled = false;
  }
});

cargarTorneos();
actualizarNavegacion();
