"use client";

import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import CambiarPasswordModal from "@/components/CambiarPasswordModal";
import DecanoApp from "@/components/DecanoApp";
import SedesManager from "@/components/SedesManager";
import SalonesManager from "@/components/SalonesManager";
import EstudiantesManager from "@/components/EstudiantesManager";
import { IconArrowLeft, IconLogin } from "@/components/Icons";

// Panel de la secretaría académica: sedes, salones, grupos (de cualquier
// facultad, con los mismos permisos que el decano) y el archivo base de
// estudiantes.
export default function SecretariaApp({ user }) {
  const [mostrarCambiarPassword, setMostrarCambiarPassword] = useState(
    user.debeCambiarPassword
  );

  const [facultades, setFacultades] = useState([]);
  const [facultadElegida, setFacultadElegida] = useState("");
  const [modoDecano, setModoDecano] = useState(false);

  useEffect(() => {
    fetch("/api/admin/facultades")
      .then((r) => r.json())
      .then((d) => setFacultades(d.facultades || []));
  }, []);

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
