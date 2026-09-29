<div align="center">
  <img src="public/markfx.svg" width="96" height="96" alt="MarkFX logo">
  <h1>MarkFX</h1>
  <p>本地优先的桌面 Markdown 写作与绘图工具</p>

  [![Release](https://img.shields.io/github/v/release/WSYL011017/MarkFX?display_name=tag&sort=semver)](https://github.com/WSYL011017/MarkFX/releases/latest)
  [![Platform](https://img.shields.io/badge/platform-Windows-0078D4)](#系统要求)
  [![License](https://img.shields.io/github/license/WSYL011017/MarkFX)](LICENSE)
</div>

MarkFX 面向持续写作、技术文档整理和结构图绘制场景。它直接读写标准 Markdown 文件，将文字编辑、文档导航、Mermaid 图表和 Excalidraw 绘图放进同一个安静、高效的桌面工作流。

## 下载

前往 [Releases](https://github.com/WSYL011017/MarkFX/releases/latest) 下载最新版：

- `MarkFX_2.3.0_x64-setup.exe`：推荐，大多数 Windows 用户使用
- `MarkFX_2.3.0_x64_en-US.msi`：适合 MSI 部署或集中管理
- `SHA256SUMS.txt`：安装包校验和，用于验证下载完整性

## 安装与完整性验证

当前安装包未使用商业代码签名证书，因此 Windows 可能显示“未知发布者”或 SmartScreen 警告。这不是文件损坏，而是缺少签名证书所致。安装前请按下述步骤验证文件来自本仓库且未被篡改。

### 1. 校验下载文件

每个 Release 都附带 `SHA256SUMS.txt`。在下载目录打开 PowerShell，计算并比对：

```powershell
Get-FileHash .\MarkFX_2.3.0_x64-setup.exe -Algorithm SHA256
```

将输出与 `SHA256SUMS.txt` 中对应行对比。**两者一致才继续安装。** 校验和文件中的哈希为小写，对比时忽略大小写即可。不一致说明下载被篡改或损坏，请删除并重新下载。

### 2. 通过 SmartScreen 提示

1. 点击警告窗口中的“更多信息”
2. 确认程序名称为 MarkFX、发布者为“未知发布者”
3. 确认校验和已通过后，点击“仍要运行”

如果只想为当前用户静默安装，可执行：

```powershell
.\MarkFX_2.3.0_x64-setup.exe /S
```

### 3. 从源码构建（可选）

不希望信任预编译产物时，可自行构建：

```bash
npm install
npm run build
npm run tauri build
```

产物位于 `src-tauri/target/release/bundle/`。CI 流水线在 GitHub Actions 的 `windows-latest` 上执行同样的测试、构建与打包步骤，构建日志公开可查。

注意：仓库开启了自动更新工件签名，未提供签名私钥时 `tauri build` 会报错。本机发布请使用 `npm run release`（自动从 `%USERPROFILE%/.markfx` 载入私钥），或以环境变量提供 `TAURI_SIGNING_PRIVATE_KEY` 与 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。

## 功能

### Markdown 写作

- 所见即所得的 Markdown 编辑体验
- 打开、保存、另存为和最近文件记录
- 文档大纲、标题导航、代码高亮和数学公式
- Mermaid 流程图、时序图等图表渲染
- Mermaid 图表放大查看：在悬停按钮或图表上点击即可打开全屏灯箱，缩放、平移与适配窗口

### 文件安全

- 原子写入：保存时先写临时文件再整体替换，替换前保留上一版为 `.bak`，写入中断不会截断原文件
- 草稿恢复：编辑过程中自动记录草稿，异常退出后下次启动可恢复未保存的内容
- 冲突检测：文件被其他程序修改后保存会提示覆盖保存、重新载入或另存为

### 绘图工作区

- 集成 Excalidraw 手绘画布
- 在写作与绘图工作区之间快速切换
- 适合结构图、草图和思路整理

### 桌面体验

- 多套明暗主题
- 可配置快捷键，并提供冲突与无效组合提示
- 系统托盘、关闭到托盘和开机自动启动
- 双击 `.md` 文件直接打开，重复启动复用已有窗口
- 支持把文件拖入窗口打开
- 无原生窗口边框的专注界面

### 自动更新

应用启动后会检查新版本，发现更新时显示版本号与发布说明，可在应用内下载安装并自动重启。更新包使用独立的 minisign 签名校验，私钥不随仓库分发；签名不匹配的更新包会被拒绝。

<details>
<summary>发布新版本时如何配置签名</summary>

本地发布：

1. 生成密钥对（只需一次）：`npx tauri signer generate -w "%USERPROFILE%/.markfx/markfx-updater.key"`
2. 把私钥内容与密码分别放入 GitHub 仓库 Secrets：`TAURI_SIGNING_PRIVATE_KEY`、`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
3. 本地执行 `npm run release` 会自动从 `%USERPROFILE%/.markfx` 载入私钥
4. 推送 `v*` 标签触发 Release 流水线，自动产出安装包、`SHA256SUMS.txt` 与 `latest.json`

私钥与密码丢失后无法再签发可被旧版本接受的更新包，请妥善备份。

</details>

## 本地优先

MarkFX 直接读取和写入你选择的本地 Markdown 文件。主题、快捷键、最近文件和界面偏好保存在应用本地存储中。

当前版本：

- 不要求账号
- 不提供云同步
- 不主动上传文档内容
- 不包含遥测或多人协作功能

## 系统要求

- Windows 10 或 Windows 11，64 位
- Microsoft Edge WebView2 Runtime

Windows 10/11 通常已包含 WebView2；缺失时安装程序或系统会提示安装。

## 开发

### 技术栈

- [Tauri 2](https://tauri.app/) + Rust
- [Vue 3](https://vuejs.org/) + TypeScript
- [Vite](https://vite.dev/) + UnoCSS
- Milkdown、Mermaid 和 Excalidraw
- Pinia、VueUse 和 Vitest

### 环境要求

- Node.js 20 或更高版本
- npm
- Rust stable 工具链
- Visual Studio 2022 Build Tools，包含“使用 C++ 的桌面开发”
- Microsoft Edge WebView2 Runtime

### 本地运行

```bash
npm install
npm run tauri dev
```

### 检查与测试

```bash
npm test
npm run check:contrast
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

### 构建安装包

```bash
npm run release
```

该命令会从 `public/markfx.svg` 生成桌面图标、载入更新签名私钥并执行 Tauri 正式构建。Windows 安装包位于：

- `src-tauri/target/release/bundle/nsis/`
- `src-tauri/target/release/bundle/msi/`

同时会为 NSIS 安装包生成 `.sig` 更新签名，供自动更新校验使用。

## 项目结构

```text
src/                 Vue 前端、编辑器、绘图与状态管理
src-tauri/           Tauri 配置、Rust 后端与桌面图标
public/              品牌和静态资源
release/             本地整理的发布产物，不纳入版本控制
CHANGELOG.md         版本变更记录
PRODUCT.md           产品定位与设计原则
```

## 当前版本

当前版本为 `2.3.0`，详细变更参见 [CHANGELOG.md](CHANGELOG.md)。

已知限制：

- 暂不支持云同步、多人协作、插件系统和移动客户端
- 大型 Excalidraw 画布与复杂 Mermaid 文档可能占用较多内存
- 安装包尚未配置商业代码签名证书

## 安全

安全漏洞请按照 [安全策略](SECURITY.md) 私下报告，不要通过公开 Issue 发布尚未修复的漏洞细节。

## 许可证

MarkFX 基于 [MIT License](LICENSE) 开源。
