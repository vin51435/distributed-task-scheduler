import axios from 'axios';

module.exports = async function () {
  const host = process.env.HOST ?? 'localhost';
  const port = process.env.WORKER_PORT ?? '3005';
  axios.defaults.baseURL = `http://${host}:${port}`;
};
