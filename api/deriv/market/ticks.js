import { handleMarketTicksSSE } from '../../derivBackend.js';

export default async function handler(req, res) {
  return handleMarketTicksSSE(req, res);
}
