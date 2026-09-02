import { handleOAuthCallback } from './derivBackend.js';

export default async function handler(req, res) {
  return handleOAuthCallback(req, res);
}
