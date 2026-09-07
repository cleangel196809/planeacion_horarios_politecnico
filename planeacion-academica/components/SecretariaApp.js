"use client";

import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import CambiarPasswordModal from "@/components/CambiarPasswordModal";
import DecanoApp from "@/components/DecanoApp";
import SedesManager from "@/components/SedesManager";
import SalonesManager from "@/components/SalonesManager";
import EstudiantesManager from "@/components/EstudiantesManager";
import { IconArrowLeft, IconLogin, IconMail } from "@/components/Icons";

const DESTINATARIOS_DEFAULT = { docentes: true, decanos: true, estudiantes: true };

// Panel de la secretaría académica: sedes, salones, grupos (de cualquier
// facultad, con los mismos permisos que el decano), el archivo base de
// estudiantes y el envío masivo del horario por correo.
export default function SecretariaApp({ user }) {
  const [mostrarCambiarPassword, setMostrarCambiarPassword] = useState(
    user.debeCambiarPassword
  );

  const [facultades, setFacultades] = useState([]);
  const [facultadElegida, setFacultadElegida] = useState("");
  const [modoDecano, setModoDecano] = useState(false);

  // --- Envío masivo de horarios por correo ---
  const [periodos, setPeriodos] = useState([]);
  const [periodoEnvio, setPeriodoEnvio] = useState("");
  const [facultadEnvio, setFacultadEnvio] = useState("");
  const [destinatarios, setDestinatarios] = useState(DESTINATARIOS_DEFAULT);
  const [enviando, setEnviando] = useState(false);
  const [resultadoEnvio, setResultadoEnvio] = useState(null);
  const [errorEnvio, setErrorEnvio] = useState("");

  useEffect(() => {
    fetch("/api/admin/facultades")
      .then((r) => r.json())
      .then((d) => setFacultades(d.facultades || []));
    fetch("/api/periodos")
      .then((r) => r.json())
      .then((d) => {
        const lista = d.periodos || [];
        setPeriodos(lista);
        if (lista.length > 0) setPeriodoEnvio(lista[0]);
      });
  }, []);

  function toggleDestinatario(tipo) {
    setDestinatarios((prev) => ({ ...prev, [tipo]: !prev[tipo] }));
  }

  async function enviarHorarios() {
    const tipos = Object.entries(destinatarios)
      .filter(([, activo]) => activo)
      .map(([tipo]) => tipo);

    if (!periodoEnvio) {
      setErrorEnvio("Selecciona el período a enviar.");
      return;
    }
    if (tipos.length === 0) {
      setErrorEnvio("Selecciona al menos un tipo de destinatario.");
      return;
    }
    const destino = facultadEnvio || "TODAS las facultades";
    if (
      !confirm(
        `¿Enviar el horario de ${periodoEnvio} (${destino}) por correo a: ${tipos.join(", ")}? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    setEnviando(true);
    setErrorEnvio("");
    setResultadoEnvio(null);
    try {
      const res = await fetch("/api/secretaria/enviar-horarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodo: periodoEnvio,
          facultad: facultadEnvio || null,
          destinatarios: tipos
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResultadoEnvio(data);
    } catch (err) {
      setErrorEnvio(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (modoDecano && facultadElegida) {
    return (
      <div className="min-h-screen">
        <div className="bg-brand-50 border-b border-brand-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-brand-700">
            Viendo y diligenciando como decano de <strong>{facultadElegida}</strong> (puedes crear,
            editar y eliminar grupos igual que su decano).
          </p>
          <button className="btn-secondary" onClick={() => setModoDecano(false)}>
            <IconArrowLeft /> Volver a secretaría académica
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
      <TopBar user={user} titulo="Secretaría académica" />

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <section className="card">
          <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <IconMail className="w-4 h-4 text-brand-600" /> Enviar horarios por correo
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Envía el horario del período por correo, de forma masiva, a docentes, decanos y
            estudiantes. Cada persona recibe únicamente lo suyo: un docente ve solo sus clases, un
            estudiante solo las materias en las que está matriculado, y un decano el horario
            completo de su facultad.
          </p>

          <div className="flex flex-wrap items-end gap-3 mb-3">
            <div className="min-w-[160px]">
              <label className="label">Período</label>
              <select
                className="input"
                value={periodoEnvio}
                onChange={(e) => setPeriodoEnvio(e.target.value)}
              >
                {periodos.length === 0 && <option value="">Sin períodos cargados</option>}
                {periodos.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[220px]">
              <label className="label">Facultad</label>
              <select
                className="input"
                value={facultadEnvio}
                onChange={(e) => setFacultadEnvio(e.target.value)}
              >
                <option value="">Todas las facultades</option>
                {facultades.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <label className="checkbox-pill">
              <input
                type="checkbox"
                className="accent-brand-600"
                checked={destinatarios.docentes}
                onChange={() => toggleDestinatario("docentes")}
              />
              Docentes
            </label>
            <label className="checkbox-pill">
              <input
                type="checkbox"
                className="accent-brand-600"
                checked={destinatarios.decanos}
                onChange={() => toggleDestinatario("decanos")}
              />
              Decanos
            </label>
            <label className="checkbox-pill">
              <input
                type="checkbox"
                className="accent-brand-600"
                checked={destinatarios.estudiantes}
                onChange={() => toggleDestinatario("estudiantes")}
              />
              Estudiantes
            </label>
          </div>

          {errorEnvio && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
              {errorEnvio}
            </p>
          )}

          <button className="btn-primary" onClick={enviarHorarios} disabled={enviando}>
            <IconMail /> {enviando ? "Enviando..." : "Enviar horarios"}
          </button>

          {resultadoEnvio && (
            <div className="mt-4 space-y-2">
              {!resultadoEnvio.smtpConfigurado && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  El servidor de correo (SMTP) todavía no está configurado en este entorno, así que
                  no se envió ningún correo de verdad. El conteo de abajo muestra a cuántas
                  personas se les habría enviado.
                </p>
              )}
              <div className="table-sap-wrap">
                <table className="table-sap">
                  <thead>
                    <tr>
                      <th>Destinatario</th>
                      <th>Enviados</th>
                      <th>Omitidos</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(resultadoEnvio.resultado || {}).map(([tipo, r]) => (
                      <tr key={tipo}>
                        <td className="capitalize">{tipo}</td>
                        <td>{r.enviados}</td>
                        <td>{r.omitidos}</td>
                        <td>{r.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <SedesManager />

        <SalonesManager />

        <section className="card">
          <h2 className="font-semibold text-gray-900 mb-1">Grupos</h2>
          <p className="text-sm text-gray-500 mb-4">
            Entra a la planeación de cualquier facultad para ver, crear, editar o eliminar sus
            grupos (sede, jornada, horario, docente y salón), exactamente igual que su decano.
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
                {facultades.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              {facultades.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Todavía no hay facultades con decano/coordinador creado.
                </p>
              )}
            </div>
            <button
              className="btn-primary"
              disabled={!facultadElegida}
              onClick={() => setModoDecano(true)}
            >
              <IconLogin /> Entrar a los grupos de esta facultad
            </button>
          </div>
        </section>

        <EstudiantesManager />
      </main>
    </div>
  );
}
