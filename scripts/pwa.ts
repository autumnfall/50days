import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Plugin } from 'vite'

export function offlineWorker(): Plugin {
  return {
    name: '50days-offline-worker',
    apply: 'build',
    async writeBundle({ dir }) {
      if (!dir) return
      const template = await readFile(new URL('./sw.js', import.meta.url), 'utf8')
      const files = (await readdir(dir, { recursive: true, withFileTypes: true }))
        .filter((entry) => entry.isFile() && entry.name !== 'sw.js')
        .map((entry) => join(entry.parentPath, entry.name))
        .sort()
      const hash = createHash('sha256').update(template)
      const assets = []
      for (const file of files) {
        const asset = file.slice(dir.length + 1).replaceAll('\\', '/')
        assets.push(asset)
        hash.update(asset).update(await readFile(file))
      }
      await writeFile(join(dir, 'sw.js'), template
        .replace('__VERSION__', hash.digest('hex').slice(0, 16))
        .replace("'__ASSETS__'", JSON.stringify(JSON.stringify(assets))))
    },
  }
}
