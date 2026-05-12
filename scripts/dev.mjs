import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const viteBin = join('node_modules', 'vite', 'bin', 'vite.js');
if (!existsSync(viteBin)) {
  console.error('Vite is not installed yet. Run: npm install');
  process.exit(1);
}

const commands = [
  ['api', process.execPath, ['server/server.js']],
  ['web', process.execPath, [viteBin, '--host', '127.0.0.1', '--port', '3000', '--configLoader', 'native']]
];

for (const [name, cmd, args] of commands) {
  const child = spawn(cmd, args, { stdio: 'inherit', shell: false });
  child.on('exit', code => {
    if (code) console.error(`${name} exited with ${code}`);
  });
}
