import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const keyDir = join(homedir(), '.markfx')
const keyPath = join(keyDir, 'markfx-updater.key')
const passwordPath = join(keyDir, 'updater-key-password.txt')

const env = { ...process.env }

if (!env.TAURI_SIGNING_PRIVATE_KEY) {
  if (!existsSync(keyPath)) {
    console.error(`未找到更新签名私钥：${keyPath}`)
    console.error('可用 `npx tauri signer generate -w "%USERPROFILE%/.markfx/markfx-updater.key"` 生成，')
    console.error('或设置 TAURI_SIGNING_PRIVATE_KEY 环境变量后再运行。')
    process.exit(1)
  }

  env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(keyPath, 'utf8').trim()
  if (!env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD && existsSync(passwordPath))
    env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = readFileSync(passwordPath, 'utf8').trim()

  console.log(`已从 ${keyDir} 载入更新签名密钥`)
}

function run(command, args) {
  const executable = process.platform === 'win32' ? `${command}.cmd` : command
  const result = spawnSync(executable, args, { stdio: 'inherit', env, shell: false })
  if (result.status !== 0)
    process.exit(result.status ?? 1)
}

run('npm', ['run', 'icons'])
run('npx', ['tauri', 'build'])
