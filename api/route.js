// API Serverless - Sabores Costeros
// Por ahora no se usa, toda la lógica está del lado del cliente con Firebase

export default function handler(req, res) {
  res.status(200).json({ message: 'Sabores Costeros API', status: 'ok' });
}