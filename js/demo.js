if (window.location.protocol === "file:") {
  const torneosDemo = [
    {
      nombre: "Copa Interfacultades de Fútbol",
      deporte: "Fútbol",
      imagenUrl: "",
      modalidad: "equipos",
      inscripciones_inicio: "2026-11-01",
      inscripciones_fin: "2026-11-20",
      fechaInicioInscripcion: "2026-11-01",
      fechaFinInscripcion: "2026-11-20",
      fecha_inicio: "2026-11-25",
      fecha_fin: "2026-11-28",
      cupos: 12,
      cuposTotales: 12,
      inscritosActuales: 5,
      estado: "abierto",
    },
    {
      nombre: "Torneo de Ajedrez Universitario",
      deporte: "Ajedrez",
      imagenUrl: "",
      modalidad: "individual",
      inscripciones_inicio: "2026-11-02",
      inscripciones_fin: "2026-11-22",
      fechaInicioInscripcion: "2026-11-02",
      fechaFinInscripcion: "2026-11-22",
      fecha_inicio: "2026-11-29",
      fecha_fin: "2026-11-29",
      cupos: 32,
      cuposTotales: 32,
      inscritosActuales: 8,
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

  const estadoInscripcion = (torneo) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const inicio = new Date(`${torneo.fechaInicioInscripcion}T00:00:00`);
    const fin = new Date(`${torneo.fechaFinInscripcion}T00:00:00`);
    if (hoy < inicio) return ["Próximamente", "chip-proximamente"];
    if (hoy > fin) return ["Cerrado", "chip-cerrado"];
    return ["Abierto", "chip-abierto"];
  };

  const crearImagenDeporte = (torneo) => {
    const contenedor = document.createElement("div");
    contenedor.className = "imagen-torneo";

    const respaldo = document.createElement("div");
    respaldo.className = "imagen-torneo-respaldo";
    respaldo.textContent = torneo.deporte || "Deporte";
    respaldo.setAttribute("aria-hidden", "true");
    contenedor.append(respaldo);

    if (torneo.imagenUrl) {
      const imagen = document.createElement("img");
      imagen.src = torneo.imagenUrl;
      imagen.alt = `Imagen de ${torneo.deporte || "deporte"}`;
      imagen.loading = "lazy";
      imagen.addEventListener("error", () => imagen.remove());
      contenedor.append(imagen);
    }

    return contenedor;
  };

  const crearTarjeta = (torneo) => {
    const tarjeta = document.createElement("article");
    tarjeta.className = "tarjeta-torneo";

    const titulo = document.createElement("h2");
    titulo.textContent = torneo.nombre;

    const imagenDeporte = crearImagenDeporte(torneo);
    const meta = document.createElement("dl");
    meta.className = "tarjeta-meta";
    [
      ["Deporte", torneo.deporte],
      ["Modalidad", torneo.modalidad === "equipos" ? "Por equipos" : "Individual"],
      [
        "Cupos disponibles",
        torneo.cuposTotales == null
          ? "Sin límite"
          : Math.max(0, torneo.cuposTotales - torneo.inscritosActuales) === 0
            ? "Sin cupos"
            : String(Math.max(0, torneo.cuposTotales - torneo.inscritosActuales)),
      ],
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
    const [etiquetaEstado, claseEstado] = estadoInscripcion(torneo);
    estado.className = `chip ${claseEstado}`;
    estado.textContent = etiquetaEstado;

    const inscribirse = document.createElement("button");
    inscribirse.className = "btn btn-inscribirme";
    inscribirse.type = "button";
    inscribirse.textContent =
      etiquetaEstado === "Abierto" ? "Inscribirme" : `Inscripciones ${etiquetaEstado.toLowerCase()}`;
    inscribirse.disabled = etiquetaEstado !== "Abierto";
    inscribirse.addEventListener("click", () => {
      window.location.href = "login.html";
    });

    tarjeta.append(imagenDeporte, titulo, meta, fechas, estado, inscribirse);
    return tarjeta;
  };

  mensaje.hidden = true;
  lista.replaceChildren(...torneosDemo.map(crearTarjeta));
}
