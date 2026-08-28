import "./globals.css";

export const metadata = {
  title: "Planeación Académica",
  description: "Captura de la planeación del siguiente ciclo de formación"
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
