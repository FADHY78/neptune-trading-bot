import { handleAuthStatus } from '../../derivBackend.js';

export default async function handler(req, res) {
  return handleAuthStatus(req, res);
}
