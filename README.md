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

- `MarkFX_2.0.0_x64-setup.exe`：推荐，大多数 Windows 用户使用
- `MarkFX_2.0.0_x64_en-US.msi`：适合 MSI 部署或集中管理

当前安装包未使用商业代码签名证书。Windows 可能显示“未知发布者”或 SmartScreen 提示，请确认下载地址来自本仓库。

## 功能

### Markdown 写作

- 所见即所得的 Markdown 编辑体验
- 打开、保存、另存为和最近文件记录
- 文档大纲、标题导航、代码高亮和数学公式
- Mermaid 流程图、时序图等图表渲染

### 绘图工作区

- 集成 Excalidraw 手绘画布
- 在写作与绘图工作区之间快速切换
- 适合结构图、草图和思路整理

### 桌面体验

- 多套明暗主题
- 可配置快捷键，并提供冲突与无效组合提示
- 系统托盘、关闭到托盘和开机自动启动
- 无原生窗口边框的专注界面

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
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

### 构建安装包

```bash
npm run release
```

该命令会从 `public/markfx.svg` 生成桌面图标并执行 Tauri 正式构建。Windows 安装包位于：

- `src-tauri/target/release/bundle/nsis/`
- `src-tauri/target/release/bundle/msi/`

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

正式基线为 `2.0.0`，详细变更参见 [CHANGELOG.md](CHANGELOG.md)。

已知限制：

- 暂不支持云同步、多人协作、插件系统和移动客户端
- 大型 Excalidraw 画布与复杂 Mermaid 文档可能占用较多内存
- 安装包尚未配置商业代码签名证书

## 安全

安全漏洞请按照 [安全策略](SECURITY.md) 私下报告，不要通过公开 Issue 发布尚未修复的漏洞细节。

## 许可证

MarkFX 基于 [MIT License](LICENSE) 开源。
