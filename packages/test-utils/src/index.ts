import { Writable } from 'node:stream';
export function captureLogs() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });
  return { stream, text: () => lines.join('') };
}
