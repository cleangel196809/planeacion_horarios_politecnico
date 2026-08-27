"use client";

import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import CambiarPasswordModal from "@/components/CambiarPasswordModal";

export default function AdminApp({ user }) {
  const [mostrarCambiarPassword, setMostrarCambiarPassword] = useState(
    user.debeCambiarPassword
  );

  const [periodo, setPeriodo] = useState("");
  const [archivo, setArchivo] = useState(null);
  const [importando, setImportando] = useState(false);
  const [mensajeImport, setMensajeImport] = useState(null);
  const [errorImport, setErrorImport] = useState("");

  const [usuarios, setUsuarios] = useState([]);
  const [nuevoUsuario, setNuevoUsuario] = useState({
    username: "",
    nombre: "",
    facultad: "",
    password: ""
  });
  const [errorUsuario, setErrorUsuario] = useState("");
  const [creandoUsuario, setCreandoUsuario] = useState(false);

  const [periodoResumen, setPeriodoResumen] = useState("");
  const [resumen, setResumen] = useState(null);

  function cargarUsuarios() {
    fetch("/api/admin/usuarios")
      .then((r) => r.json())
      .then((d) => setUsuarios(d.usuarios || []));
  }

  useEffect(() => {
    cargarUsuarios();
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
      setNuevoUsuario({ username: "", nombre: "", facultad: "", password: "" });
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

  async function cargarResumen() {
    if (!periodoResumen) return;
    const res = await fetch(`/api/admin/resumen?periodo=${encodeURIComponent(periodoResumen)}`);
    const data = await res.json();
    if (res.ok) setResumen(data);
  }

  useEffect(() => {
    if (periodoResumen) cargarResumen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoResumen]);

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
              {importando ? "Cargando..." : "Cargar catálogo"}
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
          <h2 className="font-semibold text-gray-900 mb-1">2. Usuarios de los decanos</h2>
          <p className="text-sm text-gray-500 mb-4">
            Crea un usuario por facultad. El decano deberá cambiar su contraseña la primera vez
            que ingrese.
          </p>
          <form onSubmit={handleCrearUsuario} className="grid sm:grid-cols-5 gap-3 items-end mb-4">
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
              {creandoUsuario ? "Creando..." : "Crear decano"}
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
                  <th className="py-1 pr-3">Estado</th>
                  <th className="py-1 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3">{u.username}</td>
                    <td className="py-1.5 pr-3">{u.nombre}</td>
                    <td className="py-1.5 pr-3">{u.rol}</td>
                    <td className="py-1.5 pr-3">{u.facultad || "—"}</td>
                    <td className="py-1.5 pr-3">
                      <span className={`badge ${u.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {u.rol === "decano" && (
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
              Ver avance
            </button>
            {periodoResumen && (
              <a
                href={`/api/admin/exportar?periodo=${encodeURIComponent(periodoResumen)}`}
                className="btn-primary"
              >
                Descargar Excel consolidado
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
      </main>
    </div>
  );
}
