import { supabaseClient } from "./supabase.js";

const seccionCrear = document.getElementById("seccion-crear");
const formulario = document.getElementById("form-evento");
const dialogoEvento = document.getElementById("dialogo-evento");
const mensajeEventos = document.getElementById("mensaje-eventos");
const mensajeError = document.getElementById("mensaje-error");
const mensajeOk = document.getElementById("mensaje-ok");
const listaTorneos = document.getElementById("lista-torneos");
const saludo = document.getElementById("saludo");
const seccionInscripciones = document.getElementById("seccion-inscripciones");
const mensajeInscripciones = document.getElementById("mensaje-inscripciones");
const filasInscripciones = document.getElementById("filas-inscripciones");
const tablaInscripciones = document.querySelector(".tabla-inscripciones-contenedor");
const tituloFormulario = document.getElementById("titulo-formulario");
const botonGuardar = document.getElementById("guardar-evento");
const botonAbrirFormulario = document.getElementById("abrir-formulario");
let puedeGestionarEventos = false;
let fechasDisponibles = true;
let eventoEnEdicion = null;

const mostrarMensaje = (elemento, texto) => {
  elemento.textContent = texto;
  elemento.hidden = false;
  elemento.classList.add("visible");
};

const limpiarMensaje = (elemento) => {
  elemento.textContent = "";
  elemento.hidden = true;
  elemento.classList.remove("visible");
};

document.getElementById("abrir-formulario").addEventListener("click", () => {
  eventoEnEdicion = null;
  formulario.reset();
  tituloFormulario.textContent = "Crear un evento";
  botonGuardar.textContent = "Publicar evento";
  dialogoEvento.showModal();
  document.getElementById("nombre").focus();
});

const cerrarFormulario = () => {
  dialogoEvento.close();
  limpiarMensaje(mensajeError);
  formulario.reset();
  eventoEnEdicion = null;
  tituloFormulario.textContent = "Crear un evento";
  botonGuardar.textContent = "Publicar evento";
};

document.getElementById("cerrar-formulario").addEventListener("click", cerrarFormulario);
document.getElementById("cancelar-formulario").addEventListener("click", cerrarFormulario);

dialogoEvento.addEventListener("click", (evento) => {
  if (evento.target === dialogoEvento) cerrarFormulario();
});

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

  const titulo = document.createElement("h3");
  titulo.textContent = torneo.nombre || "Evento sin nombre";

  const detalles = document.createElement("p");
  detalles.className = "tarjeta-detalle";
  detalles.textContent = `${torneo.deporte || "Deporte no especificado"} · ${
    torneo.modalidad === "equipos" ? "Por equipos" : "Individual"
  }`;

  const inscripciones = document.createElement("p");
  inscripciones.className = "tarjeta-detalle";
  inscripciones.textContent = `Inscripciones: ${formatearFecha(torneo.inscripciones_inicio)} – ${formatearFecha(torneo.inscripciones_fin)}`;

  const fechaEvento = document.createElement("p");
  fechaEvento.className = "tarjeta-detalle";
  fechaEvento.textContent = `Evento: ${formatearFecha(torneo.fecha_inicio)} – ${formatearFecha(torneo.fecha_fin)}`;

  const meta = document.createElement("p");
  meta.className = "tarjeta-detalle";
  meta.textContent = `${torneo.cupos ?? "Sin límite"} ${
    torneo.modalidad === "equipos" ? "equipos" : "cupos"
  }`;

  const estado = document.createElement("span");
  estado.className = "chip chip-abierto";
  estado.textContent = torneo.estado || "abierto";

  articulo.append(titulo, detalles, inscripciones, fechaEvento, meta, estado);

  if (puedeGestionarEventos) {
    const acciones = document.createElement("div");
    acciones.className = "acciones-torneo";

    const botonEditar = document.createElement("button");
    botonEditar.className = "btn btn-editar";
    botonEditar.type = "button";
    botonEditar.textContent = "Editar";
    botonEditar.setAttribute("aria-label", `Editar ${torneo.nombre || "evento"}`);
    botonEditar.disabled = !fechasDisponibles;
    botonEditar.title = fechasDisponibles
      ? ""
      : "Aplica la migración de fechas para poder editar eventos.";
    botonEditar.addEventListener("click", () => {
      eventoEnEdicion = torneo;
      tituloFormulario.textContent = "Editar evento";
      botonGuardar.textContent = "Guardar cambios";
      formulario.elements.nombre.value = torneo.nombre || "";
      formulario.elements.deporte.value = torneo.deporte || "";
      formulario.elements.modalidad.value = torneo.modalidad || "individual";
      formulario.elements.inscripciones_inicio.value = torneo.inscripciones_inicio || "";
      formulario.elements.inscripciones_fin.value = torneo.inscripciones_fin || "";
      formulario.elements.fecha_inicio.value = torneo.fecha_inicio || "";
      formulario.elements.fecha_fin.value = torneo.fecha_fin || "";
      formulario.elements.cupos.value = torneo.cupos ?? "";
      limpiarMensaje(mensajeError);
      dialogoEvento.showModal();
      document.getElementById("nombre").focus();
    });

    acciones.append(botonEditar);
    articulo.append(acciones);
  }

  return articulo;
};

const cargarEventos = async () => {
  let { data, error } = await supabaseClient
    .from("torneos")
    .select(
      "id, nombre, deporte, modalidad, inscripciones_inicio, inscripciones_fin, fecha_inicio, fecha_fin, cupos, estado"
    )
    .order("fecha_inicio", { ascending: true });

  fechasDisponibles = true;
  if (
    error &&
    (error.code === "42703" ||
      error.code === "PGRST204" ||
      /inscripciones_inicio|inscripciones_fin|fecha_fin/i.test(error.message))
  ) {
    const resultadoAnterior = await supabaseClient
      .from("torneos")
      .select("id, nombre, deporte, modalidad, fecha_inicio, cupos, estado")
      .order("fecha_inicio", { ascending: true });
    data = resultadoAnterior.data;
    error = resultadoAnterior.error;
    fechasDisponibles = !error;
  }

  if (error) {
    mostrarMensaje(
      mensajeEventos,
      `No se pudieron cargar los eventos. Comprueba que ejecutaste la migración de base de datos. ${error.message}`
    );
    return;
  }

  botonAbrirFormulario.disabled = !fechasDisponibles;
  botonAbrirFormulario.title = fechasDisponibles
    ? ""
    : "Aplica la migración de fechas e inscripciones en Supabase antes de crear eventos.";

  if (!data || data.length === 0) {
    mostrarMensaje(
      mensajeEventos,
      fechasDisponibles
        ? "Aún no hay eventos publicados."
        : "Aún no hay eventos publicados. Aplica la migración de fechas e inscripciones en Supabase para habilitar la creación."
    );
    listaTorneos.replaceChildren();
    return;
  }

  if (fechasDisponibles) {
    limpiarMensaje(mensajeEventos);
  } else {
    mostrarMensaje(
      mensajeEventos,
      "Los eventos se muestran con el esquema anterior. Este problema afecta por igual a administradores y organizadores. Ejecuta supabase/migrations/20261104200000_inscripciones_torneos.sql en el proyecto Supabase para habilitar fechas completas, edición y nuevas inscripciones."
    );
  }
  listaTorneos.replaceChildren(...data.map(crearTarjeta));
};

const formatearFechaInscripcion = (fecha) => {
  if (!fecha) return "Sin fecha";
  const fechaLocal = new Date(fecha);
  if (Number.isNaN(fechaLocal.getTime())) return fecha;
  return fechaLocal.toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const cargarInscripciones = async () => {
  mensajeInscripciones.textContent = "Cargando inscripciones...";
  tablaInscripciones.hidden = true;

  const { data: inscripciones, error } = await supabaseClient
    .from("inscripciones")
    .select(
      "id, torneo_id, nombre_equipo, nombre_capitan, codigo_estudiante, correo_institucional, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    mostrarMensaje(
      mensajeInscripciones,
      `No se pudieron cargar las inscripciones. Comprueba que ejecutaste la migración de inscripciones y la política de lectura para organizadores. ${error.message}`
    );
    return;
  }

  if (!inscripciones?.length) {
    mostrarMensaje(mensajeInscripciones, "Todavía no hay personas inscritas.");
    filasInscripciones.replaceChildren();
    return;
  }

  const torneoIds = [...new Set(inscripciones.map((inscripcion) => inscripcion.torneo_id))];
  const { data: torneos, error: errorTorneos } = await supabaseClient
    .from("torneos")
    .select("id, nombre")
    .in("id", torneoIds);

  if (errorTorneos) {
    mostrarMensaje(
      mensajeInscripciones,
      `No se pudieron asociar las inscripciones con sus eventos. ${errorTorneos.message}`
    );
    return;
  }

  const nombresTorneos = new Map(torneos.map((torneo) => [torneo.id, torneo.nombre]));
  const filas = inscripciones.map((inscripcion) => {
    const fila = document.createElement("tr");
    const valores = [
      nombresTorneos.get(inscripcion.torneo_id) || "Evento eliminado",
      inscripcion.nombre_equipo || "Individual",
      inscripcion.nombre_capitan,
      inscripcion.codigo_estudiante,
      inscripcion.correo_institucional,
      formatearFechaInscripcion(inscripcion.created_at),
    ];

    valores.forEach((valor) => {
      const celda = document.createElement("td");
      celda.textContent = valor || "—";
      fila.append(celda);
    });

    return fila;
  });

  filasInscripciones.replaceChildren(...filas);
  tablaInscripciones.hidden = false;
  limpiarMensaje(mensajeInscripciones);
};

const iniciar = async () => {
  const { data: sesionData, error: errorSesion } = await supabaseClient.auth.getSession();
  if (errorSesion) {
    mostrarMensaje(mensajeEventos, `No se pudo verificar la sesión: ${errorSesion.message}`);
    return;
  }

  const usuario = sesionData.session?.user;
  if (!usuario) {
    window.location.replace("login.html");
    return;
  }

  const { data: perfil, error: errorPerfil } = await supabaseClient
    .from("perfiles")
    .select("nombre, rol")
    .eq("id", usuario.id)
    .single();

  if (errorPerfil) {
    mostrarMensaje(
      mensajeEventos,
      `No se pudo cargar tu perfil. Comprueba que la política de lectura de perfiles esté aplicada. ${errorPerfil.message}`
    );
    return;
  }

  saludo.textContent = `Hola, ${perfil.nombre || usuario.email}.`;
  puedeGestionarEventos = ["organizador", "administrador"].includes(perfil.rol);
  if (puedeGestionarEventos) {
    seccionCrear.hidden = false;
    seccionInscripciones.hidden = false;
  } else {
    mostrarMensaje(mensajeEventos, "Tu cuenta no tiene permisos de organizador para crear eventos.");
  }

  await cargarEventos();
  if (puedeGestionarEventos) await cargarInscripciones();
};

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  limpiarMensaje(mensajeError);
  limpiarMensaje(mensajeOk);

  if (!fechasDisponibles) {
    mostrarMensaje(
      mensajeError,
      "La base de datos aún no tiene las columnas de fechas. Este cambio aplica tanto a administradores como a organizadores. Ejecuta supabase/migrations/20261104200000_inscripciones_torneos.sql en Supabase."
    );
    return;
  }

  if (!formulario.reportValidity()) return;

  const datos = new FormData(formulario);
  const cupos = Number(datos.get("cupos"));
  if (!Number.isInteger(cupos) || cupos < 1) {
    mostrarMensaje(mensajeError, "Los cupos deben ser un número entero mayor que cero.");
    return;
  }

  const inicioInscripciones = String(datos.get("inscripciones_inicio"));
  const finInscripciones = String(datos.get("inscripciones_fin"));
  const inicioEvento = String(datos.get("fecha_inicio"));
  const finEvento = String(datos.get("fecha_fin"));
  if (inicioInscripciones > finInscripciones || inicioEvento > finEvento) {
    mostrarMensaje(mensajeError, "La fecha de inicio no puede ser posterior a la fecha de fin.");
    return;
  }
  if (finInscripciones > inicioEvento) {
    mostrarMensaje(mensajeError, "Las inscripciones deben finalizar antes de que comience el evento.");
    return;
  }

  const boton = formulario.querySelector('button[type="submit"]');
  boton.disabled = true;

  try {
    const { data: sesionData, error: errorSesion } = await supabaseClient.auth.getSession();
    if (errorSesion || !sesionData.session?.user) {
      mostrarMensaje(
        mensajeError,
        "Tu sesión de Supabase no está activa. Cierra sesión, vuelve a ingresar y prueba otra vez."
      );
      return;
    }

    const datosEvento = {
      nombre: String(datos.get("nombre")).trim(),
      deporte: String(datos.get("deporte")).trim(),
      modalidad: String(datos.get("modalidad")),
      inscripciones_inicio: inicioInscripciones,
      inscripciones_fin: finInscripciones,
      fecha_inicio: inicioEvento,
      fecha_fin: finEvento,
      cupos,
    };

    const resultado = eventoEnEdicion
      ? await supabaseClient
          .from("torneos")
          .update(datosEvento)
          .eq("id", eventoEnEdicion.id)
          .select("id")
      : await supabaseClient
          .from("torneos")
          .insert({ ...datosEvento, estado: "abierto" });
    const error = resultado.error;

    if (error) {
      const mensaje = /fecha_fin|inscripciones_inicio|inscripciones_fin/i.test(error.message)
        ? "Supabase aún no reconoce las columnas nuevas de fechas. Este problema afecta tanto a administradores como a organizadores. Ejecuta supabase/migrations/20261104200000_inscripciones_torneos.sql en el SQL Editor del proyecto conectado y vuelve a intentar."
        : /permission denied for table torneos/i.test(error.message)
          ? `Falta el permiso SQL ${eventoEnEdicion ? "UPDATE" : "INSERT"} en public.torneos. Ejecuta la migración correspondiente en el proyecto conectado ${error.code ? `(código ${error.code})` : ""}.`
          : /row-level security|new row violates/i.test(error.message)
            ? `La política RLS rechazó la operación. Verifica que el perfil asociado a esta sesión tenga rol administrador u organizador y que aplicaste la migración para editar eventos. ${error.message}`
            : `No se pudo ${eventoEnEdicion ? "guardar los cambios" : "publicar el evento"}. ${error.message}`;

      mostrarMensaje(mensajeError, mensaje);
      return;
    }

    if (eventoEnEdicion && (!resultado.data || resultado.data.length === 0)) {
      mostrarMensaje(
        mensajeError,
        "No se actualizó ningún evento. Verifica que la política RLS de actualización esté aplicada y permita editar este registro."
      );
      return;
    }

    const estabaEditando = Boolean(eventoEnEdicion);
    formulario.reset();
    dialogoEvento.close();
    eventoEnEdicion = null;
    tituloFormulario.textContent = "Crear un evento";
    botonGuardar.textContent = "Publicar evento";
    mostrarMensaje(
      mensajeOk,
      estabaEditando ? "Cambios guardados correctamente." : "Evento publicado correctamente."
    );
    await cargarEventos();
  } catch (error) {
    mostrarMensaje(
      mensajeError,
      `No se pudo ${eventoEnEdicion ? "guardar los cambios" : "publicar el evento"}: ${error.message}`
    );
  } finally {
    boton.disabled = false;
  }
});

document.getElementById("cerrar-sesion").addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    mostrarMensaje(mensajeEventos, `No se pudo cerrar sesión: ${error.message}`);
    return;
  }
  window.location.replace("login.html");
});

iniciar().catch((error) => {
  mostrarMensaje(mensajeEventos, `No se pudo cargar el panel: ${error.message}`);
});
