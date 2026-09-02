import { handleLogout } from '../../derivBackend.js';

export default async function handler(req, res) {
  return handleLogout(req, res);
}
