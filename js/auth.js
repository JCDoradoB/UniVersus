import { supabaseClient } from "./supabase.js";

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

      window.location.href = ["organizador", "administrador"].includes(perfil.rol)
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

  formularioRegistro.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarMensajes(mensajeError, mensajeOk);

    const nombre = formularioRegistro.nombre.value.trim();
    const programa = formularioRegistro.programa.value.trim();
    const correo = formularioRegistro.email.value.trim();
    const password = formularioRegistro.password.value;
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
