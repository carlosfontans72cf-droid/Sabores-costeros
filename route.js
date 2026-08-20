// API Route - Sabores Costeros
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, query: searchQuery } = req.query;

  try {
    // Búsqueda de restaurantes
    if (type === 'search' && searchQuery) {
      return res.status(200).json({ results: [], message: 'Endpoint listo' });
    }

    // Generar código de reserva
    if (type === 'generarCodigo') {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let codigo = 'SC-';
      for (let i = 0; i < 4; i++) {
        codigo += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return res.status(200).json({ codigo });
    }

    res.status(200).json({ message: 'API activa' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
