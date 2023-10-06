import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const absolutePath = {
  pathname(importMetaUrl) {
    return fileURLToPath(importMetaUrl);
  },
  dirname(importMetaUrl) {
    return path.dirname(this.pathname(importMetaUrl));
  },
};

export function readJsonFileSync(filepath) {
  return JSON.parse(fs.readFileSync(filepath), 'utf-8');
}

export function writeJsonFileSync(filepath, data) {
  return fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
}
