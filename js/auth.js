import { supabaseClient } from "./supabase.js";
import { puedeGestionarEventos } from "./roles.js";

const MENSAJE_CORREO_INVALIDO = "El correo electrónico no es válido.";
const MENSAJE_PASSWORD_CORTA = "La contraseña debe tener al menos 8 caracteres.";

const correoValido = (correo) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());

const mostrarMensaje = (elemento, texto, tipo = "error") => {
  if (!elemento) return;
  elemento.textContent = texto;
  elemento.classList.add("visible");
  elemento.classList.toggle("mensaje-error", tipo === "error");
  elemento.classList.toggle("mensaje-ok", tipo === "ok");
};

const limpiarMensajes = (...elementos) => {
  elementos.forEach((elemento) => {
    if (!elemento) return;
    elemento.textContent = "";
    elemento.classList.remove("visible");
  });
};

const validarCredenciales = (correo, password) => {
  if (!correoValido(correo)) {
    return MENSAJE_CORREO_INVALIDO;
  }

  if (password.length < 8) {
    return MENSAJE_PASSWORD_CORTA;
  }

  return null;
};

const formularioLogin = document.getElementById("form-login");
const formularioRegistro = document.getElementById("form-registro");

if (formularioRegistro) {
  const campoPassword = formularioRegistro.elements.password;
  const barraPassword = document.getElementById("nivel-password");
  const textoPassword = document.getElementById("nivel-password-texto");

  campoPassword.addEventListener("input", () => {
    const password = campoPassword.value;
    const tieneMayuscula = /[A-Z]/.test(password);
    const tieneMinuscula = /[a-z]/.test(password);
    const tieneNumero = /\d/.test(password);
    const tieneSimbolo = /[^A-Za-z0-9]/.test(password);
    let nivel = 0;
    let etiqueta = "Escribe una contraseña para ver su nivel.";
    let clase = "";

    if (password.length > 0 && password.length < 8) {
      nivel = 1;
      etiqueta = "Contraseña débil";
      clase = "nivel-debil";
    } else if (password.length >= 8 && tieneMayuscula && tieneMinuscula && tieneNumero && tieneSimbolo) {
      nivel = 3;
      etiqueta = "Contraseña fuerte";
      clase = "nivel-fuerte";
    } else if (password.length >= 8 && /[A-Za-z]/.test(password) && tieneNumero) {
      nivel = 2;
      etiqueta = "Contraseña media";
      clase = "nivel-medio";
    } else if (password.length >= 8) {
      nivel = 1;
      etiqueta = "Contraseña débil";
      clase = "nivel-debil";
    }

    barraPassword.className = `medidor-password-barra ${clase}`.trim();
    barraPassword.setAttribute("aria-valuenow", String(nivel));
    barraPassword.setAttribute("aria-valuetext", etiqueta);
    textoPassword.className = `medidor-password-texto ${clase}`.trim();
    textoPassword.textContent = etiqueta;
  });
}

if (formularioLogin) {
  const mensajeError = document.getElementById("mensaje-error");
  const boton = formularioLogin.querySelector('button[type="submit"]');

  formularioLogin.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarMensajes(mensajeError);

    const correo = formularioLogin.email.value.trim();
    const password = formularioLogin.password.value;
    const errorValidacion = validarCredenciales(correo, password);

    if (errorValidacion) {
      mostrarMensaje(mensajeError, errorValidacion);
      return;
    }

    boton.disabled = true;

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: correo,
        password,
      });

      if (error) {
        const mensaje = error.message.toLowerCase().includes("email not confirmed")
          ? "Debes confirmar tu correo antes de iniciar sesión."
          : error.message.toLowerCase().includes("invalid login credentials")
            ? "El correo o la contraseña no son correctos."
            : error.message;
        mostrarMensaje(mensajeError, mensaje);
        return;
      }

      if (!data.user) {
        mostrarMensaje(mensajeError, "Supabase no devolvió el usuario al iniciar sesión.");
        return;
      }

      const { data: perfil, error: errorPerfil } = await supabaseClient
        .from("perfiles")
        .select("rol")
        .eq("id", data.user.id)
        .single();

      if (errorPerfil) {
        mostrarMensaje(
          mensajeError,
          `Iniciaste sesión, pero no se pudo cargar tu perfil: ${errorPerfil.message}`
        );
        return;
      }

      window.location.href = puedeGestionarEventos(perfil.rol)
        ? "eventos.html"
        : "index.html";
    } catch (error) {
      mostrarMensaje(
        mensajeError,
        `No se pudo completar el inicio de sesión. Verifica tu conexión e inténtalo de nuevo. ${error.message}`
      );
    } finally {
      boton.disabled = false;
    }
  });
}

if (formularioRegistro) {
  const mensajeError = document.getElementById("mensaje-error");
  const mensajeOk = document.getElementById("mensaje-ok");
  const campoPrograma = formularioRegistro.elements.programa;
  const errorPrograma = document.getElementById("error-programa");

  const limpiarErrorPrograma = () => {
    errorPrograma.hidden = true;
    errorPrograma.classList.remove("visible");
    campoPrograma.setAttribute("aria-invalid", "false");
  };

  campoPrograma.addEventListener("change", limpiarErrorPrograma);

  formularioRegistro.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarMensajes(mensajeError, mensajeOk);
    limpiarErrorPrograma();

    const nombre = formularioRegistro.nombre.value.trim();
    const programa = campoPrograma.value;
    const correo = formularioRegistro.email.value.trim();
    const password = formularioRegistro.password.value;

    if (!programa) {
      errorPrograma.hidden = false;
      errorPrograma.classList.add("visible");
      campoPrograma.setAttribute("aria-invalid", "true");
      campoPrograma.focus();
      return;
    }

    const errorValidacion = validarCredenciales(correo, password);

    if (errorValidacion) {
      mostrarMensaje(mensajeError, errorValidacion);
      return;
    }

    const boton = formularioRegistro.querySelector('button[type="submit"]');
    boton.disabled = true;

    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email: correo,
        password,
        options: {
          data: { nombre, programa },
        },
      });

      if (error) {
        mostrarMensaje(mensajeError, error.message);
        return;
      }

      if (data.user) {
        const { error: errorPerfil } = await supabaseClient.from("perfiles").insert({
          id: data.user.id,
          nombre,
          programa,
          rol: "participante",
        });

        if (errorPerfil) {
          mostrarMensaje(mensajeError, `La cuenta se creó, pero no el perfil: ${errorPerfil.message}`);
          return;
        }
      }

      formularioRegistro.reset();
      mostrarMensaje(
        mensajeOk,
        "Cuenta creada. Revisa tu correo si debes confirmar el registro.",
        "ok"
      );
    } catch (error) {
      mostrarMensaje(
        mensajeError,
        `No se pudo completar el registro. Verifica tu conexión e inténtalo de nuevo. ${error.message}`
      );
    } finally {
      boton.disabled = false;
    }
  });
}
