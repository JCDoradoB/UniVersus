import { supabaseClient } from "./supabase.js";
import { puedeGestionarEventos } from "./roles.js";

const elementoNombre = document.getElementById("perfil-nombre");
const elementoCorreo = document.getElementById("perfil-correo");
const elementoPrograma = document.getElementById("perfil-programa");
const elementoEstado = document.getElementById("perfil-estado");
const elementoRol = document.getElementById("perfil-rol");
const mensajePerfil = document.getElementById("mensaje-perfil");
const mensajeError = document.getElementById("mensaje-error-password");
const mensajeOk = document.getElementById("mensaje-ok-password");
const formulario = document.getElementById("form-cambiar-password");
const botonGuardar = document.getElementById("guardar-password");
const enlaceCrearEvento = document.getElementById("crear-evento-nav");

const mostrarMensaje = (elemento, texto) => {
  elemento.textContent = texto;
  elemento.hidden = false;
  elemento.classList.add("visible");
};

const limpiarMensajes = () => {
  [mensajePerfil, mensajeError, mensajeOk].forEach((elemento) => {
    elemento.textContent = "";
    elemento.hidden = true;
    elemento.classList.remove("visible");
  });
};

const cargarPerfil = async () => {
  const { data: sesionData, error: errorSesion } = await supabaseClient.auth.getSession();
  if (errorSesion) throw errorSesion;

  const usuario = sesionData.session?.user;
  if (!usuario) {
    window.location.replace("login.html");
    return null;
  }

  const { data: perfil, error } = await supabaseClient
    .from("perfiles")
    .select("nombre, programa, rol")
    .eq("id", usuario.id)
    .single();
  if (error) throw error;

  enlaceCrearEvento.hidden = !puedeGestionarEventos(perfil.rol);
  elementoNombre.textContent = perfil.nombre || "Sin nombre";
  elementoCorreo.textContent = usuario.email || "Sin correo";
  elementoPrograma.textContent = perfil.programa || "Sin especificar";
  elementoRol.textContent = perfil.rol || "Participante";

  const correoConfirmado = Boolean(usuario.email_confirmed_at);
  elementoEstado.textContent = correoConfirmado
    ? "Cuenta activa"
    : "Correo pendiente de confirmar";
  elementoEstado.classList.toggle("estado-cuenta-activa", correoConfirmado);
  elementoEstado.classList.toggle("estado-cuenta-pendiente", !correoConfirmado);

  return usuario;
};

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  limpiarMensajes();

  if (!formulario.reportValidity()) return;

  const passwordActual = formulario.elements.password_actual.value;
  const passwordNueva = formulario.elements.password_nueva.value;
  const passwordConfirmar = formulario.elements.password_confirmar.value;

  if (passwordNueva !== passwordConfirmar) {
    mostrarMensaje(mensajeError, "La nueva contraseña y su confirmación no coinciden.");
    formulario.elements.password_confirmar.focus();
    return;
  }

  if (passwordNueva.length < 8) {
    mostrarMensaje(mensajeError, "La nueva contraseña debe tener al menos 8 caracteres.");
    formulario.elements.password_nueva.focus();
    return;
  }

  if (passwordNueva === passwordActual) {
    mostrarMensaje(mensajeError, "La nueva contraseña debe ser diferente a la actual.");
    formulario.elements.password_nueva.focus();
    return;
  }

  botonGuardar.disabled = true;
  try {
    const { data: sesionData, error: errorSesion } = await supabaseClient.auth.getSession();
    if (errorSesion) throw errorSesion;

    const usuario = sesionData.session?.user;
    if (!usuario?.email) {
      window.location.replace("login.html");
      return;
    }

    const { error: errorValidar } = await supabaseClient.auth.signInWithPassword({
      email: usuario.email,
      password: passwordActual,
    });
    if (errorValidar) {
      mostrarMensaje(mensajeError, "La contraseña actual no es correcta.");
      formulario.elements.password_actual.focus();
      return;
    }

    const { error: errorActualizar } = await supabaseClient.auth.updateUser({
      password: passwordNueva,
    });
    if (errorActualizar) throw errorActualizar;

    formulario.reset();
    mostrarMensaje(mensajeOk, "Tu contraseña se cambió correctamente.");
  } catch (error) {
    mostrarMensaje(mensajeError, `No se pudo cambiar la contraseña. ${error.message}`);
  } finally {
    botonGuardar.disabled = false;
  }
});

document.getElementById("cerrar-sesion").addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    mostrarMensaje(mensajeError, `No se pudo cerrar sesión. ${error.message}`);
    return;
  }
  window.location.replace("login.html");
});

cargarPerfil().catch((error) => {
  mostrarMensaje(mensajePerfil, `No se pudo cargar tu perfil. ${error.message}`);
  [elementoNombre, elementoCorreo, elementoPrograma, elementoEstado, elementoRol].forEach(
    (elemento) => {
      elemento.textContent = "No disponible";
    }
  );
});
