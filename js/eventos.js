import { supabaseClient } from "./supabase.js";

const seccionCrear = document.getElementById("seccion-crear");
const formulario = document.getElementById("form-evento");
const mensajeEventos = document.getElementById("mensaje-eventos");
const mensajeError = document.getElementById("mensaje-error");
const mensajeOk = document.getElementById("mensaje-ok");
const listaTorneos = document.getElementById("lista-torneos");
const saludo = document.getElementById("saludo");

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
  if (["organizador", "administrador"].includes(perfil.rol)) {
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
    const { error } = await supabaseClient.from("torneos").insert({
      nombre: String(datos.get("nombre")).trim(),
      deporte: String(datos.get("deporte")).trim(),
      modalidad: String(datos.get("modalidad")),
      fecha_inicio: String(datos.get("fecha_inicio")),
      cupos,
      estado: "abierto",
    });

    if (error) {
      mostrarMensaje(
        mensajeError,
        `No se pudo publicar el evento. Comprueba que la migración y las políticas RLS estén aplicadas. ${error.message}`
      );
      return;
    }

    formulario.reset();
    mostrarMensaje(mensajeOk, "Evento publicado correctamente.");
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
