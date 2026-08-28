/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: { bodySizeLimit: "15mb" }
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // El driver "serverless" de Neon (@neondatabase/serverless) usa el
      // paquete "ws" para hablar el protocolo de Postgres por WebSocket.
      // "ws" intenta usar, de forma opcional, los paquetes nativos
      // "bufferutil"/"utf-8-validate" si están instalados; como aquí no lo
      // están, deben quedar fuera del empaquetado de webpack ("externals")
      // para que Node los resuelva en tiempo de ejecución de la forma
      // normal. Si webpack los empaqueta, "ws" se rompe al enviar datos
      // con el error "TypeError: bufferUtil.mask is not a function".
      config.externals.push("bufferutil", "utf-8-validate");
    }
    return config;
  }
};

module.exports = nextConfig;
