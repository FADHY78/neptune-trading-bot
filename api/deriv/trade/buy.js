import { handleTradeBuy } from '../../derivBackend.js';

export default async function handler(req, res) {
  return handleTradeBuy(req, res);
}
