import { runChecks } from './checks/index.js';

const target = process.argv[2] ?? 'https://example.com';
console.log(JSON.stringify(await runChecks(target), null, 2));