# MarkFX

MarkFX 是一款本地优先的桌面 Markdown 写作与绘图工具，面向需要持续写作、整理技术文档和绘制结构图的用户。

## 主要功能

- Markdown 所见即所得编辑
- 本地文件打开、保存与最近文件记录
- 文档大纲与标题导航
- Mermaid 图表与数学公式
- Excalidraw 手绘和结构图工作区
- 多套明暗主题
- 可自定义快捷键
- 系统托盘与开机自动启动

## 系统要求

- Windows 10 或 Windows 11（64 位）
- Microsoft Edge WebView2 Runtime

通常 Windows 10/11 已包含 WebView2；缺失时安装程序或系统会提示安装。

## 安装

从发布页面下载 MarkFX `2.0.0` 的 `.msi` 或安装程序并运行。当前本地构建产物未使用商业代码签名证书，Windows 可能显示“未知发布者”或 SmartScreen 提示。

## 数据与隐私

MarkFX 直接读取和写入用户选择的本地 Markdown 文件。主题、快捷键、最近文件和界面偏好保存在应用本地存储中。当前版本不要求账号，不提供云同步，也不会主动上传文档内容。

## 开发

需要 Node.js、npm、Rust、MSVC Build Tools 和 WebView2。

```bash
npm install
npm run tauri dev
```

运行检查：

```bash
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

生成品牌图标和 Windows 安装包：

```bash
npm run release
```

该命令会根据 `public/markfx.svg` 生成完整桌面图标，然后执行正式打包。构建产物位于 `src-tauri/target/release/bundle/`。

## 版本

当前正式基线：`2.0.0`。版本变更参见 `CHANGELOG.md`。
