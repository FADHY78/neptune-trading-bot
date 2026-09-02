import { handleOAuthStart } from '../../derivBackend.js';

export default async function handler(req, res) {
  return handleOAuthStart(req, res);
}
