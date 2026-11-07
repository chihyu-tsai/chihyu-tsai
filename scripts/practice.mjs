import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCoffeeServer } from '../server.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 3000);
createCoffeeServer({
  localDemo: true,
  adminToken: '',
  dataFile: resolve(root, 'data/runtime/practice-coffees.json'),
}).listen(port, '127.0.0.1', () => {
  console.log(`Practice editor (no key): http://localhost:${port}/coffee-admin.html`);
  console.log(`Preview: http://localhost:${port}/#coffee`);
  console.log('Localhost only. Practice cafés are stored separately in data/runtime/practice-coffees.json.');
});
