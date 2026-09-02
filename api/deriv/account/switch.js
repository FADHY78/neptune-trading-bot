import { handleAccountSwitch } from '../../derivBackend.js';

export default async function handler(req, res) {
  return handleAccountSwitch(req, res);
}
