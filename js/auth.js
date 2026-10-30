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

    const boton = formularioLogin.querySelector('button[type="submit"]');
    boton.disabled = true;

    const { error } = await supabaseClient.auth.signInWithPassword({
      email: correo,
      password,
    });

    boton.disabled = false;

    if (error) {
      mostrarMensaje(mensajeError, error.message);
      return;
    }

    window.location.href = "index.html";
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

    const { data, error } = await supabaseClient.auth.signUp({
      email: correo,
      password,
      options: {
        data: { nombre, programa },
      },
    });

    if (error) {
      boton.disabled = false;
      mostrarMensaje(mensajeError, error.message);
      return;
    }

    if (data.user) {
      await supabaseClient.from("perfiles").insert({
        id: data.user.id,
        nombre,
        programa,
        rol: "participante",
      });
    }

    boton.disabled = false;
    formularioRegistro.reset();
    mostrarMensaje(
      mensajeOk,
      "Cuenta creada. Revisa tu correo si debes confirmar el registro.",
      "ok"
    );
  });
}
