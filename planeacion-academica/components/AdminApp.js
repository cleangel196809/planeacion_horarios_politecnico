"use client";

import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import CambiarPasswordModal from "@/components/CambiarPasswordModal";
import DecanoApp from "@/components/DecanoApp";
import { SEDES } from "@/lib/constants";
import {
  IconArrowLeft,
  IconUpload,
  IconUserPlus,
  IconChart,
  IconDownload,
  IconLogin,
  IconSave,
  IconPlus,
  IconX,
  IconTrash
} from "@/components/Icons";

export default function AdminApp({ user }) {
  const [mostrarCambiarPassword, setMostrarCambiarPassword] = useState(
    user.debeCambiarPassword
  );

  // El admin puede "entrar" a la vista de un decano para cualquier
  // facultad: ve y diligencia el mismo formulario que vería esa facultad,
  // con los mismos permisos de crear/editar/eliminar (el backend ya lo
  // permite para el rol admin; esto solo faltaba en la interfaz).
  const [facultadElegida, setFacultadElegida] = useState("");
  const [modoDecano, setModoDecano] = useState(false);

  const [periodo, setPeriodo] = useState("");
  const [archivo, setArchivo] = useState(null);
  const [importando, setImportando] = useState(false);
  const [mensajeImport, setMensajeImport] = useState(null);
  const [errorImport, setErrorImport] = useState("");

  const [periodoReal, setPeriodoReal] = useState("");
  const [archivoReal, setArchivoReal] = useState(null);
  const [importandoReal, setImportandoReal] = useState(false);
  const [mensajeImportReal, setMensajeImportReal] = useState(null);
  const [errorImportReal, setErrorImportReal] = useState("");

  const [usuarios, setUsuarios] = useState([]);
  const [nuevoUsuario, setNuevoUsuario] = useState({
    username: "",
    nombre: "",
    facultad: "",
    email: "",
    rol: "decano",
    password: ""
  });
  const [errorUsuario, setErrorUsuario] = useState("");
  const [creandoUsuario, setCreandoUsuario] = useState(false);

  const [periodoResumen, setPeriodoResumen] = useState("");
  const [resumen, setResumen] = useState(null);

  const [docentes, setDocentes] = useState([]);
  const [nuevoDocente, setNuevoDocente] = useState({
    documento: "",
    nombre_completo: "",
    facultad: "",
    correo_institucional: ""
  });
  const [errorDocente, setErrorDocente] = useState("");
  const [guardandoDocente, setGuardandoDocente] = useState(false);
  const [archivoDocentes, setArchivoDocentes] = useState(null);
  const [importandoDocentes, setImportandoDocentes] = useState(false);
  const [mensajeDocentes, setMensajeDocentes] = useState(null);
  const [errorImportDocentes, setErrorImportDocentes] = useState("");
  const [filtroFacultadDocente, setFiltroFacultadDocente] = useState("");

  const [salones, setSalones] = useState([]);
  const [nuevoSalon, setNuevoSalon] = useState({
    id: null,
    sede: SEDES[0]?.value || "",
    nombre: "",
    planta: "",
    capacidad: "",
    identificador: "",
    observaciones: ""
  });
  const [errorSalon, setErrorSalon] = useState("");
  const [guardandoSalon, setGuardandoSalon] = useState(false);
  const [archivoSalones, setArchivoSalones] = useState(null);
  const [importandoSalones, setImportandoSalones] = useState(false);
  const [mensajeSalones, setMensajeSalones] = useState(null);
  const [errorImportSalones, setErrorImportSalones] = useState("");
  const [filtroSedeSalon, setFiltroSedeSalon] = useState("");

  const facultadesDisponibles = useMemo(() => {
    const set = new Set(
      usuarios
        .filter((u) => u.rol === "decano" || u.rol === "coordinador")
        .map((u) => u.facultad)
        .filter(Boolean)
    );
    return [...set].sort();
  }, [usuarios]);

  function cargarUsuarios() {
    fetch("/api/admin/usuarios")
      .then((r) => r.json())
      .then((d) => setUsuarios(d.usuarios || []));
  }

  function cargarDocentes() {
    fetch("/api/admin/docentes")
      .then((r) => r.json())
      .then((d) => setDocentes(d.docentes || []));
  }

  function cargarSalones() {
    fetch("/api/admin/salones")
      .then((r) => r.json())
      .then((d) => setSalones(d.salones || []));
  }

  useEffect(() => {
    cargarUsuarios();
    cargarDocentes();
    cargarSalones();
    // Recuerda el último período consultado en "Avance por facultad" para
    // que no se sienta como si hubiera que volver a cargar todo al recargar
    // la página.
    try {
      const recordado = window.localStorage.getItem("planeacion_periodo_resumen_admin");
      if (recordado) setPeriodoResumen(recordado);
    } catch (e) {
      /* localStorage no disponible: seguimos sin recordar, sin romper nada */
    }
  }, []);

  async function handleImportar(e) {
    e.preventDefault();
    setErrorImport("");
    setMensajeImport(null);
    if (!archivo || !periodo) {
      setErrorImport("Selecciona el archivo y escribe el período.");
      return;
    }
    setImportando(true);
    try {
      const formData = new FormData();
      formData.append("archivo", archivo);
      formData.append("periodo", periodo);
      const res = await fetch("/api/admin/importar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMensajeImport(data);
      setPeriodoResumen(periodo);
    } catch (err) {
      setErrorImport(err.message);
    } finally {
      setImportando(false);
    }
  }

  async function handleImportarReal(e) {
    e.preventDefault();
    setErrorImportReal("");
    setMensajeImportReal(null);
    if (!archivoReal || !periodoReal) {
      setErrorImportReal("Selecciona el archivo y escribe el período.");
      return;
    }
    setImportandoReal(true);
    try {
      const formData = new FormData();
      formData.append("archivo", archivoReal);
      formData.append("periodo", periodoReal);
      const res = await fetch("/api/admin/importar-real", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMensajeImportReal(data);
      cargarUsuarios();
    } catch (err) {
      setErrorImportReal(err.message);
    } finally {
      setImportandoReal(false);
    }
  }

  async function handleCrearUsuario(e) {
    e.preventDefault();
    setErrorUsuario("");
    setCreandoUsuario(true);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoUsuario)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNuevoUsuario({ username: "", nombre: "", facultad: "", email: "", rol: "decano", password: "" });
      cargarUsuarios();
    } catch (err) {
      setErrorUsuario(err.message);
    } finally {
      setCreandoUsuario(false);
    }
  }

  async function toggleActivo(id, activo) {
    await fetch("/api/admin/usuarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, activo: !activo })
    });
    cargarUsuarios();
  }

  async function actualizarEmail(id, email) {
    await fetch("/api/admin/usuarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, email })
    });
    cargarUsuarios();
  }

  async function handleCrearDocente(e) {
    e.preventDefault();
    setErrorDocente("");
    setGuardandoDocente(true);
    try {
      const res = await fetch("/api/admin/docentes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoDocente)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNuevoDocente({ documento: "", nombre_completo: "", facultad: "", correo_institucional: "" });
      cargarDocentes();
    } catch (err) {
      setErrorDocente(err.message);
    } finally {
      setGuardandoDocente(false);
    }
  }

  async function eliminarDocente(documento) {
    if (!confirm(`¿Eliminar al docente ${documento} del catálogo?`)) return;
    await fetch("/api/admin/docentes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documento })
    });
    cargarDocentes();
  }

  function editarDocente(d) {
    setNuevoDocente({
      documento: d.documento,
      nombre_completo: d.nombre_completo,
      facultad: d.facultad || "",
      correo_institucional: d.correo_institucional || ""
    });
  }

  async function handleImportarDocentes(e) {
    e.preventDefault();
    setErrorImportDocentes("");
    setMensajeDocentes(null);
    if (!archivoDocentes) {
      setErrorImportDocentes("Selecciona el archivo Excel de docentes.");
      return;
    }
    setImportandoDocentes(true);
    try {
      const formData = new FormData();
      formData.append("archivo", archivoDocentes);
      const res = await fetch("/api/admin/docentes/importar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMensajeDocentes(data);
      cargarDocentes();
    } catch (err) {
      setErrorImportDocentes(err.message);
    } finally {
      setImportandoDocentes(false);
    }
  }

  async function handleGuardarSalon(e) {
    e.preventDefault();
    setErrorSalon("");
    setGuardandoSalon(true);
    try {
      const res = await fetch("/api/admin/salones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoSalon)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNuevoSalon({
        id: null,
        sede: SEDES[0]?.value || "",
        nombre: "",
        planta: "",
        capacidad: "",
        identificador: "",
        observaciones: ""
      });
      cargarSalones();
    } catch (err) {
      setErrorSalon(err.message);
    } finally {
      setGuardandoSalon(false);
    }
  }

  async function eliminarSalon(id, nombre) {
    if (!confirm(`¿Eliminar el salón "${nombre}"?`)) return;
    await fetch("/api/admin/salones", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    cargarSalones();
  }

  // Borra de un solo golpe todos los salones cargados para una sede (por
  // ejemplo, para limpiar una sede cargada por error antes de reimportarla).
  async function eliminarSalonesDeSede(sede, cantidad) {
    if (
      !confirm(
        `¿Eliminar los ${cantidad} salones de "${sede}"? Esta acción no se puede deshacer.`
      )
    )
      return;
    setErrorSalon("");
    try {
      const res = await fetch("/api/admin/salones", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sede })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFiltroSedeSalon("");
      cargarSalones();
    } catch (err) {
      setErrorSalon(err.message);
    }
  }

  function editarSalon(s) {
    setNuevoSalon({
      id: s.id,
      sede: s.sede,
      nombre: s.nombre,
      planta: s.planta || "",
      capacidad: s.capacidad ?? "",
      identificador: s.identificador || "",
      observaciones: s.observaciones || ""
    });
  }

  async function handleImportarSalones(e) {
    e.preventDefault();
    setErrorImportSalones("");
    setMensajeSalones(null);
    if (!archivoSalones) {
      setErrorImportSalones("Selecciona el archivo Excel de salones.");
      return;
    }
    setImportandoSalones(true);
    try {
      const formData = new FormData();
      formData.append("archivo", archivoSalones);
      const res = await fetch("/api/admin/salones/importar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMensajeSalones(data);
      cargarSalones();
    } catch (err) {
      setErrorImportSalones(err.message);
    } finally {
      setImportandoSalones(false);
    }
  }

  const sedesSalones = useMemo(() => {
    const set = new Set(salones.map((s) => s.sede).filter(Boolean));
    return [...set].sort();
  }, [salones]);

  const salonesFiltrados = useMemo(() => {
    if (!filtroSedeSalon) return salones;
    return salones.filter((s) => s.sede === filtroSedeSalon);
  }, [salones, filtroSedeSalon]);

  const facultadesDocentes = useMemo(() => {
    const set = new Set(docentes.map((d) => d.facultad).filter(Boolean));
    return [...set].sort();
  }, [docentes]);

  const docentesFiltrados = useMemo(() => {
    if (!filtroFacultadDocente) return docentes;
    return docentes.filter((d) => d.facultad === filtroFacultadDocente);
  }, [docentes, filtroFacultadDocente]);

  async function cargarResumen() {
    if (!periodoResumen) return;
    const res = await fetch(`/api/admin/resumen?periodo=${encodeURIComponent(periodoResumen)}`);
    const data = await res.json();
    if (res.ok) setResumen(data);
  }

  useEffect(() => {
    if (periodoResumen) {
      cargarResumen();
      try {
        window.localStorage.setItem("planeacion_periodo_resumen_admin", periodoResumen);
      } catch (e) {
        /* localStorage no disponible: no pasa nada, solo no se recuerda */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoResumen]);

  if (modoDecano && facultadElegida) {
    return (
      <div className="min-h-screen">
        <div className="bg-brand-50 border-b border-brand-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-brand-700">
            Viendo y diligenciando como decano de <strong>{facultadElegida}</strong> (modo
            administrador: puedes crear, editar y eliminar grupos igual que su decano).
          </p>
          <button className="btn-secondary" onClick={() => setModoDecano(false)}>
            <IconArrowLeft /> Volver a Administración
          </button>
        </div>
        <DecanoApp
          user={{ ...user, facultad: facultadElegida, debeCambiarPassword: false }}
          facultadOverride={facultadElegida}
          titulo={`Planeación de ${facultadElegida}`}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {mostrarCambiarPassword && (
        <CambiarPasswordModal onDone={() => setMostrarCambiarPassword(false)} />
      )}
      <TopBar user={user} titulo="Administración de la planeación" />

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <section className="card">
          <h2 className="font-semibold text-gray-900 mb-1">1. Cargar catálogo base del ciclo</h2>
          <p className="text-sm text-gray-500 mb-4">
            Sube el Excel con la hoja PLANEACION (facultad, programa, plan, asignatura, ciclo,
            créditos) para habilitar el formulario de los decanos en ese período. Puedes volver a
            subirlo si necesitas actualizar el catálogo.
          </p>
          <form onSubmit={handleImportar} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">Período</label>
              <input
                className="input"
                placeholder="Ej: 2026-2T"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Archivo Excel</label>
              <input
                type="file"
                accept=".xlsx"
                className="input"
                onChange={(e) => setArchivo(e.target.files?.[0] || null)}
              />
            </div>
            <button className="btn-primary" disabled={importando}>
              <IconUpload /> {importando ? "Cargando..." : "Cargar catálogo"}
            </button>
          </form>
          {errorImport && <p className="text-sm text-red-600 mt-3">{errorImport}</p>}
          {mensajeImport && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-3">
              Catálogo cargado: {mensajeImport.asignaturasCargadas} asignaturas y{" "}
              {mensajeImport.docentesCargados} docentes para el período {mensajeImport.periodo}.
              Facultades: {mensajeImport.facultades.join(", ")}.
            </p>
          )}
        </section>

        <section className="card">
          <h2 className="font-semibold text-gray-900 mb-1">
            1b. Cargar catálogo real (carreras y materias)
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Sube el archivo real de carreras y materias (facultad, plan, ciclo, grupo, jornada y
            sede ya vienen en el archivo). Por cada facultad nueva que aparezca se crea
            automáticamente un usuario decano con una contraseña temporal, que verás aquí abajo
            solo esta vez.
          </p>
          <form onSubmit={handleImportarReal} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">Período</label>
              <input
                className="input"
                placeholder="Ej: 2026-3T"
                value={periodoReal}
                onChange={(e) => setPeriodoReal(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Archivo Excel</label>
              <input
                type="file"
                accept=".xlsx"
                className="input"
                onChange={(e) => setArchivoReal(e.target.files?.[0] || null)}
              />
            </div>
            <button className="btn-primary" disabled={importandoReal}>
              <IconUpload /> {importandoReal ? "Cargando..." : "Cargar catálogo real"}
            </button>
          </form>
          {errorImportReal && <p className="text-sm text-red-600 mt-3">{errorImportReal}</p>}
          {mensajeImportReal && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                Catálogo cargado: {mensajeImportReal.asignaturasCargadas} filas para el período{" "}
                {mensajeImportReal.periodo}. Facultades: {mensajeImportReal.facultades.join(", ")}.
              </p>
              {mensajeImportReal.jornadasNoReconocidas?.length > 0 && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Aviso: el archivo trae jornadas que no se reconocieron y quedaron sin asignar (el
                  decano las podrá elegir manualmente al confirmar la fila):{" "}
                  {mensajeImportReal.jornadasNoReconocidas.join(", ")}.
                </p>
              )}
              {mensajeImportReal.nuevosDecanos?.length > 0 && (
                <div className="bg-brand-50 border border-brand-200 rounded-lg px-3 py-3">
                  <p className="text-sm font-medium text-brand-700 mb-2">
                    Se crearon {mensajeImportReal.nuevosDecanos.length} usuario(s) decano. Guarda
                    estas contraseñas: no se volverán a mostrar.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="py-1 pr-3">Facultad</th>
                          <th className="py-1 pr-3">Usuario</th>
                          <th className="py-1 pr-3">Contraseña</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mensajeImportReal.nuevosDecanos.map((d) => (
                          <tr key={d.username} className="border-b last:border-0">
                            <td className="py-1.5 pr-3">{d.facultad}</td>
                            <td className="py-1.5 pr-3 font-mono">{d.username}</td>
                            <td className="py-1.5 pr-3 font-mono">{d.password}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="font-semibold text-gray-900 mb-1">2. Usuarios de decanos y coordinadores</h2>
          <p className="text-sm text-gray-500 mb-4">
            Crea un usuario por facultad, como decano (puede diligenciar la planeación) o como
            coordinador (solo puede consultar los datos de esa facultad, sin editarlos). Deberá
            cambiar su contraseña la primera vez que ingrese. El correo es opcional, pero sin él
            no podrá usar &quot;¿Olvidaste tu contraseña?&quot; para recuperar el acceso.
          </p>
          <form onSubmit={handleCrearUsuario} className="grid sm:grid-cols-7 gap-3 items-end mb-4">
            <div>
              <label className="label">Usuario</label>
              <input
                className="input"
                value={nuevoUsuario.username}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, username: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Nombre</label>
              <input
                className="input"
                value={nuevoUsuario.nombre}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, nombre: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Facultad</label>
              <input
                className="input"
                value={nuevoUsuario.facultad}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, facultad: e.target.value })}
                placeholder="Como aparece en el Excel"
                required
              />
            </div>
            <div>
              <label className="label">Rol</label>
              <select
                className="input"
                value={nuevoUsuario.rol}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, rol: e.target.value })}
              >
                <option value="decano">Decano</option>
                <option value="coordinador">Coordinador (solo consulta)</option>
              </select>
            </div>
            <div>
              <label className="label">Correo (recomendado)</label>
              <input
                type="email"
                className="input"
                value={nuevoUsuario.email}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, email: e.target.value })}
                placeholder="correo@pi.edu.co"
              />
            </div>
            <div>
              <label className="label">Contraseña inicial</label>
              <input
                type="text"
                className="input"
                value={nuevoUsuario.password}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })}
                required
              />
            </div>
            <button className="btn-primary" disabled={creandoUsuario}>
              <IconUserPlus /> {creandoUsuario ? "Creando..." : "Crear usuario"}
            </button>
          </form>
          {errorUsuario && <p className="text-sm text-red-600 mb-3">{errorUsuario}</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-1 pr-3">Usuario</th>
                  <th className="py-1 pr-3">Nombre</th>
                  <th className="py-1 pr-3">Rol</th>
                  <th className="py-1 pr-3">Facultad</th>
                  <th className="py-1 pr-3">Correo</th>
                  <th className="py-1 pr-3">Estado</th>
                  <th className="py-1 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3">{u.username}</td>
                    <td className="py-1.5 pr-3">{u.nombre}</td>
                    <td className="py-1.5 pr-3">
                      {u.rol === "admin"
                        ? "Administrador"
                        : u.rol === "coordinador"
                        ? "Coordinador"
                        : "Decano"}
                    </td>
                    <td className="py-1.5 pr-3">{u.facultad || "—"}</td>
                    <td className="py-1.5 pr-3">
                      {u.rol === "decano" || u.rol === "coordinador" ? (
                        <input
                          type="email"
                          defaultValue={u.email || ""}
                          placeholder="Sin correo"
                          className="input py-1 text-xs w-40"
                          onBlur={(e) => {
                            if (e.target.value !== (u.email || "")) {
                              actualizarEmail(u.id, e.target.value);
                            }
                          }}
                        />
                      ) : (
                        u.email || "—"
                      )}
                    </td>
                    <td className="py-1.5 pr-3">
                      <span className={`badge ${u.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {(u.rol === "decano" || u.rol === "coordinador") && (
                        <button
                          className="text-brand-600 text-xs font-medium"
                          onClick={() => toggleActivo(u.id, u.activo)}
                        >
                          {u.activo ? "Desactivar" : "Activar"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2 className="font-semibold text-gray-900 mb-1">3. Avance por facultad y exportación</h2>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="label">Período</label>
              <input
                className="input"
                placeholder="Ej: 2026-2T"
                value={periodoResumen}
                onChange={(e) => setPeriodoResumen(e.target.value)}
              />
            </div>
            <button className="btn-secondary" onClick={cargarResumen}>
              <IconChart /> Ver avance
            </button>
            {periodoResumen && (
              <a
                href={`/api/admin/exportar?periodo=${encodeURIComponent(periodoResumen)}`}
                className="btn-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconDownload /> Descargar Excel consolidado
              </a>
            )}
          </div>

          {resumen && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-1 pr-3">Facultad</th>
                    <th className="py-1 pr-3">Asignaturas en catálogo</th>
                    <th className="py-1 pr-3">Grupos creados</th>
                    <th className="py-1 pr-3">Reportados</th>
                    <th className="py-1 pr-3">Sin reportar</th>
                    <th className="py-1 pr-3">No aplica</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.facultades.map((f) => (
                    <tr key={f.facultad} className="border-b last:border-0">
                      <td className="py-1.5 pr-3 font-medium">{f.facultad}</td>
                      <td className="py-1.5 pr-3">{f.totalCatalogo}</td>
                      <td className="py-1.5 pr-3">{f.totalGrupos}</td>
                      <td className="py-1.5 pr-3 text-green-700">{f.reportados}</td>
                      <td className="py-1.5 pr-3 text-amber-700">{f.sinReportar}</td>
                      <td className="py-1.5 pr-3 text-gray-500">{f.noAplica}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="font-semibold text-gray-900 mb-1">
            4. Diligenciar o consultar como una facultad
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Como administrador puedes entrar a la planeación de cualquier facultad y ver, crear,
            editar o eliminar sus grupos exactamente igual que su decano (esto también cubre todo
            lo que puede hacer un coordinador, que solo consulta).
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px]">
              <label className="label">Facultad</label>
              <select
                className="input"
                value={facultadElegida}
                onChange={(e) => setFacultadElegida(e.target.value)}
              >
                <option value="">Selecciona una facultad...</option>
                {facultadesDisponibles.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              {facultadesDisponibles.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Todavía no hay usuarios decano/coordinador creados (crea uno arriba, o carga el
                  catálogo real que los crea automáticamente).
                </p>
              )}
            </div>
            <button
              className="btn-primary"
              disabled={!facultadElegida}
              onClick={() => setModoDecano(true)}
            >
              <IconLogin /> Entrar como decano de esta facultad
            </button>
          </div>
        </section>

        <section className="card">
          <h2 className="font-semibold text-gray-900 mb-1">5. Docentes</h2>
          <p className="text-sm text-gray-500 mb-4">
            El catálogo de docentes alimenta la lista desplegable que ven los decanos al asignar el
            docente de un grupo, filtrada por su facultad. Puedes cargar un Excel con varios
            docentes a la vez o agregar/editar uno por uno.
          </p>

          <form onSubmit={handleImportarDocentes} className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="label">Archivo Excel de docentes</label>
              <input
                type="file"
                accept=".xlsx"
                className="input"
                onChange={(e) => setArchivoDocentes(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-gray-400 mt-1">
                Columnas reconocidas: Documento (o Cédula/NIT), Nombre (completo), Correo y
                Facultad. Puede venir en una hoja llamada &quot;DOCENTES&quot; o en la primera hoja
                del archivo.
              </p>
            </div>
            <button className="btn-primary" disabled={importandoDocentes}>
              <IconUpload /> {importandoDocentes ? "Cargando..." : "Cargar docentes"}
            </button>
          </form>
          {errorImportDocentes && <p className="text-sm text-red-600 mb-3">{errorImportDocentes}</p>}
          {mensajeDocentes && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
              {mensajeDocentes.docentesCargados} docente(s) cargado(s)
              {mensajeDocentes.facultades.length > 0 &&
                ` · Facultades: ${mensajeDocentes.facultades.join(", ")}`}
              .
            </p>
          )}

          <form
            onSubmit={handleCrearDocente}
            className="grid sm:grid-cols-5 gap-3 items-end mb-4 border-t border-gray-200 pt-4"
          >
            <div>
              <label className="label">Documento</label>
              <input
                className="input"
                value={nuevoDocente.documento}
                onChange={(e) => setNuevoDocente({ ...nuevoDocente, documento: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Nombre completo</label>
              <input
                className="input"
                value={nuevoDocente.nombre_completo}
                onChange={(e) => setNuevoDocente({ ...nuevoDocente, nombre_completo: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Facultad</label>
              <input
                className="input"
                value={nuevoDocente.facultad}
                onChange={(e) => setNuevoDocente({ ...nuevoDocente, facultad: e.target.value })}
                placeholder="Como aparece en el catálogo"
                required
              />
            </div>
            <div>
              <label className="label">Correo institucional</label>
              <input
                type="email"
                className="input"
                value={nuevoDocente.correo_institucional}
                onChange={(e) =>
                  setNuevoDocente({ ...nuevoDocente, correo_institucional: e.target.value })
                }
              />
            </div>
            <button className="btn-primary" disabled={guardandoDocente}>
              <IconSave /> {guardandoDocente ? "Guardando..." : "Guardar docente"}
            </button>
          </form>
          {errorDocente && <p className="text-sm text-red-600 mb-3">{errorDocente}</p>}

          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Filtrar por facultad</label>
            <select
              className="input max-w-xs"
              value={filtroFacultadDocente}
              onChange={(e) => setFiltroFacultadDocente(e.target.value)}
            >
              <option value="">Todas ({docentes.length})</option>
              {facultadesDocentes.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-1 pr-3">Documento</th>
                  <th className="py-1 pr-3">Nombre</th>
                  <th className="py-1 pr-3">Facultad</th>
                  <th className="py-1 pr-3">Correo</th>
                  <th className="py-1 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {docentesFiltrados.map((d) => (
                  <tr key={d.documento} className="border-b last:border-0">
                    <td className="py-1.5 pr-3">{d.documento}</td>
                    <td className="py-1.5 pr-3">{d.nombre_completo}</td>
                    <td className="py-1.5 pr-3">{d.facultad || "—"}</td>
                    <td className="py-1.5 pr-3">{d.correo_institucional || "—"}</td>
                    <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                      <button
                        className="text-brand-600 text-xs font-medium mr-3"
                        onClick={() => editarDocente(d)}
                      >
                        Editar
                      </button>
                      <button
                        className="text-red-600 text-xs font-medium"
                        onClick={() => eliminarDocente(d.documento)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {docentesFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-gray-400">
                      Todavía no hay docentes cargados{filtroFacultadDocente ? " para esta facultad" : ""}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2 className="font-semibold text-gray-900 mb-1">6. Salones por sede</h2>
          <p className="text-sm text-gray-500 mb-4">
            El catálogo de salones alimenta la lista desplegable que ven los decanos al asignar el
            salón de una clase, filtrada por la sede del grupo. Puedes cargar el Excel con una hoja
            por sede (el nombre de la hoja se toma como la sede) o agregar/editar un salón a la vez.
          </p>

          <form onSubmit={handleImportarSalones} className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="label">Archivo Excel de salones</label>
              <input
                type="file"
                accept=".xlsx"
                className="input"
                onChange={(e) => setArchivoSalones(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-gray-400 mt-1">
                Una hoja por sede (el nombre de la hoja = la sede), con columnas Planta, Nombre de
                salón, Capacidad, Identificador y Observaciones. Las demás hojas del archivo se
                ignoran automáticamente.
              </p>
            </div>
            <button className="btn-primary" disabled={importandoSalones}>
              <IconUpload /> {importandoSalones ? "Cargando..." : "Cargar salones"}
            </button>
          </form>
          {errorImportSalones && <p className="text-sm text-red-600 mb-3">{errorImportSalones}</p>}
          {mensajeSalones && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
              {mensajeSalones.salonesCargados} salón(es) cargado(s) · Sedes: {mensajeSalones.sedes.join(", ")}.
              {mensajeSalones.hojasIgnoradas?.length > 0 &&
                ` Hojas ignoradas (no tenían columnas de salón): ${mensajeSalones.hojasIgnoradas.join(", ")}.`}
            </p>
          )}

          <form
            onSubmit={handleGuardarSalon}
            className="grid sm:grid-cols-6 gap-3 items-end mb-4 border-t border-gray-200 pt-4"
          >
            <div>
              <label className="label">Sede</label>
              <select
                className="input"
                value={nuevoSalon.sede}
                onChange={(e) => setNuevoSalon({ ...nuevoSalon, sede: e.target.value })}
              >
                {SEDES.filter((s) => s.value !== "ASISTIDA POR TECNOLOGIA").map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Nombre del salón</label>
              <input
                className="input"
                value={nuevoSalon.nombre}
                onChange={(e) => setNuevoSalon({ ...nuevoSalon, nombre: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Planta</label>
              <input
                className="input"
                value={nuevoSalon.planta}
                onChange={(e) => setNuevoSalon({ ...nuevoSalon, planta: e.target.value })}
                placeholder="Piso 1"
              />
            </div>
            <div>
              <label className="label">Capacidad</label>
              <input
                type="number"
                min="0"
                className="input"
                value={nuevoSalon.capacidad}
                onChange={(e) => setNuevoSalon({ ...nuevoSalon, capacidad: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Identificador</label>
              <input
                className="input"
                value={nuevoSalon.identificador}
                onChange={(e) => setNuevoSalon({ ...nuevoSalon, identificador: e.target.value })}
                placeholder="COC 1"
              />
            </div>
            <div className="sm:col-span-5">
              <label className="label">Observaciones</label>
              <input
                className="input"
                value={nuevoSalon.observaciones}
                onChange={(e) => setNuevoSalon({ ...nuevoSalon, observaciones: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" disabled={guardandoSalon}>
                {nuevoSalon.id ? <IconSave /> : <IconPlus />}{" "}
                {guardandoSalon ? "Guardando..." : nuevoSalon.id ? "Guardar cambios" : "Agregar salón"}
              </button>
              {nuevoSalon.id && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    setNuevoSalon({
                      id: null,
                      sede: SEDES[0]?.value || "",
                      nombre: "",
                      planta: "",
                      capacidad: "",
                      identificador: "",
                      observaciones: ""
                    })
                  }
                >
                  <IconX /> Cancelar
                </button>
              )}
            </div>
          </form>
          {errorSalon && <p className="text-sm text-red-600 mb-3">{errorSalon}</p>}

          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <label className="label mb-0">Filtrar por sede</label>
              <select
                className="input max-w-xs"
                value={filtroSedeSalon}
                onChange={(e) => setFiltroSedeSalon(e.target.value)}
              >
                <option value="">Todas ({salones.length})</option>
                {sedesSalones.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            {filtroSedeSalon && (
              <button
                type="button"
                className="btn-danger"
                onClick={() => eliminarSalonesDeSede(filtroSedeSalon, salonesFiltrados.length)}
              >
                <IconTrash /> Eliminar todos los de {filtroSedeSalon} ({salonesFiltrados.length})
              </button>
            )}
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-1 pr-3">Sede</th>
                  <th className="py-1 pr-3">Salón</th>
                  <th className="py-1 pr-3">Planta</th>
                  <th className="py-1 pr-3">Capacidad</th>
                  <th className="py-1 pr-3">Identificador</th>
                  <th className="py-1 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {salonesFiltrados.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3">{s.sede}</td>
                    <td className="py-1.5 pr-3">{s.nombre}</td>
                    <td className="py-1.5 pr-3">{s.planta || "—"}</td>
                    <td className="py-1.5 pr-3">{s.capacidad ?? "—"}</td>
                    <td className="py-1.5 pr-3">{s.identificador || "—"}</td>
                    <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                      <button
                        className="text-brand-600 text-xs font-medium mr-3"
                        onClick={() => editarSalon(s)}
                      >
                        Editar
                      </button>
                      <button
                        className="text-red-600 text-xs font-medium"
                        onClick={() => eliminarSalon(s.id, s.nombre)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {salonesFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-gray-400">
                      Todavía no hay salones cargados{filtroSedeSalon ? " para esta sede" : ""}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
