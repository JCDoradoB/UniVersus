if (window.location.protocol === "file:") {
  const torneosDemo = [
    {
      nombre: "Copa Interfacultades de Fútbol",
      deporte: "Fútbol",
      modalidad: "equipos",
      inscripciones_inicio: "2026-11-01",
      inscripciones_fin: "2026-11-20",
      fecha_inicio: "2026-11-25",
      fecha_fin: "2026-11-28",
      cupos: 12,
      estado: "abierto",
    },
    {
      nombre: "Torneo de Ajedrez Universitario",
      deporte: "Ajedrez",
      modalidad: "individual",
      inscripciones_inicio: "2026-11-02",
      inscripciones_fin: "2026-11-22",
      fecha_inicio: "2026-11-29",
      fecha_fin: "2026-11-29",
      cupos: 32,
      estado: "abierto",
    },
  ];

  const lista = document.getElementById("lista-torneos");
  const mensaje = document.getElementById("mensaje-vacio");

  const fecha = (valor) => {
    if (!valor) return "Por definir";
    return new Date(`${valor}T00:00:00`).toLocaleDateString("es-CO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const crearTarjeta = (torneo) => {
    const tarjeta = document.createElement("article");
    tarjeta.className = "tarjeta-torneo";

    const titulo = document.createElement("h2");
    titulo.textContent = torneo.nombre;

    const meta = document.createElement("dl");
    meta.className = "tarjeta-meta";
    [
      ["Deporte", torneo.deporte],
      ["Modalidad", torneo.modalidad === "equipos" ? "Por equipos" : "Individual"],
      ["Cupos", torneo.cupos],
    ].forEach(([etiqueta, valor]) => {
      const termino = document.createElement("dt");
      termino.textContent = etiqueta;
      const descripcion = document.createElement("dd");
      descripcion.textContent = String(valor);
      meta.append(termino, descripcion);
    });

    const fechas = document.createElement("div");
    fechas.className = "torneo-fechas";
    [
      ["Inscripciones", torneo.inscripciones_inicio, torneo.inscripciones_fin],
      ["Evento", torneo.fecha_inicio, torneo.fecha_fin],
    ].forEach(([nombre, inicio, fin]) => {
      const bloque = document.createElement("div");
      bloque.className = "fecha-bloque";
      const encabezado = document.createElement("h3");
      encabezado.textContent = nombre;
      const rango = document.createElement("p");
      rango.textContent = `${fecha(inicio)} – ${fecha(fin)}`;
      bloque.append(encabezado, rango);
      fechas.append(bloque);
    });

    const estado = document.createElement("span");
    estado.className = "chip chip-abierto";
    estado.textContent = torneo.estado;

    const inscribirse = document.createElement("button");
    inscribirse.className = "btn btn-inscribirme";
    inscribirse.type = "button";
    inscribirse.textContent = "Inscribirme";
    inscribirse.addEventListener("click", () => {
      window.location.href = "login.html";
    });

    tarjeta.append(titulo, meta, fechas, estado, inscribirse);
    return tarjeta;
  };

  mensaje.hidden = true;
  lista.replaceChildren(...torneosDemo.map(crearTarjeta));
}
