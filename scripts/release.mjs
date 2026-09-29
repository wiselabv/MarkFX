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

function run(command) {
  // 单条命令字符串 + shell，避免 Windows 上直接 spawn npm.cmd 报 EINVAL，
  // 也避免 Node 对「参数数组 + shell」发出的 DEP0190 告警。命令均为固定字面量。
  const result = spawnSync(command, { stdio: 'inherit', env, shell: true })
  if (result.status !== 0)
    process.exit(result.status ?? 1)
}

run('npm run icons')
run('npx tauri build')
