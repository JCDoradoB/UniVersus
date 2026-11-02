import { supabaseClient } from "./supabase.js";

const seccionCrear = document.getElementById("seccion-crear");
const formulario = document.getElementById("form-evento");
const dialogoEvento = document.getElementById("dialogo-evento");
const mensajeEventos = document.getElementById("mensaje-eventos");
const mensajeError = document.getElementById("mensaje-error");
const mensajeOk = document.getElementById("mensaje-ok");
const listaTorneos = document.getElementById("lista-torneos");
const saludo = document.getElementById("saludo");
const tituloFormulario = document.getElementById("titulo-formulario");
const botonGuardar = document.getElementById("guardar-evento");
let puedeGestionarEventos = false;
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

  const meta = document.createElement("p");
  meta.className = "tarjeta-detalle";
  meta.textContent = `${formatearFecha(torneo.fecha_inicio)} · ${torneo.cupos ?? "Sin límite"} ${
    torneo.modalidad === "equipos" ? "equipos" : "cupos"
  }`;

  const estado = document.createElement("span");
  estado.className = "chip chip-abierto";
  estado.textContent = torneo.estado || "abierto";

  articulo.append(titulo, detalles, meta, estado);

  if (puedeGestionarEventos) {
    const acciones = document.createElement("div");
    acciones.className = "acciones-torneo";

    const botonEditar = document.createElement("button");
    botonEditar.className = "btn btn-editar";
    botonEditar.type = "button";
    botonEditar.textContent = "Editar";
    botonEditar.setAttribute("aria-label", `Editar ${torneo.nombre || "evento"}`);
    botonEditar.addEventListener("click", () => {
      eventoEnEdicion = torneo;
      tituloFormulario.textContent = "Editar evento";
      botonGuardar.textContent = "Guardar cambios";
      formulario.elements.nombre.value = torneo.nombre || "";
      formulario.elements.deporte.value = torneo.deporte || "";
      formulario.elements.modalidad.value = torneo.modalidad || "individual";
      formulario.elements.fecha_inicio.value = torneo.fecha_inicio || "";
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
  const { data, error } = await supabaseClient
    .from("torneos")
    .select("id, nombre, deporte, modalidad, fecha_inicio, cupos, estado")
    .order("fecha_inicio", { ascending: true });

  if (error) {
    mostrarMensaje(
      mensajeEventos,
      `No se pudieron cargar los eventos. Comprueba que ejecutaste la migración de base de datos. ${error.message}`
    );
    return;
  }

  if (!data || data.length === 0) {
    mostrarMensaje(mensajeEventos, "Aún no hay eventos publicados.");
    listaTorneos.replaceChildren();
    return;
  }

  limpiarMensaje(mensajeEventos);
  listaTorneos.replaceChildren(...data.map(crearTarjeta));
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
  } else {
    mostrarMensaje(mensajeEventos, "Tu cuenta no tiene permisos de organizador para crear eventos.");
  }

  await cargarEventos();
};

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  limpiarMensaje(mensajeError);
  limpiarMensaje(mensajeOk);

  if (!formulario.reportValidity()) return;

  const datos = new FormData(formulario);
  const cupos = Number(datos.get("cupos"));
  if (!Number.isInteger(cupos) || cupos < 1) {
    mostrarMensaje(mensajeError, "Los cupos deben ser un número entero mayor que cero.");
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
      fecha_inicio: String(datos.get("fecha_inicio")),
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
      const mensaje = /permission denied for table torneos/i.test(error.message)
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
    mostrarMensaje(mensajeError, `No se pudo publicar el evento: ${error.message}`);
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
