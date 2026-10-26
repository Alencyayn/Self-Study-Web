# study studio

首页只保留一个居中的粗体名字。点击 **study studio**，或拖入自己的资料，进入左侧目录、右侧学习内容的阅读空间。

## 两种模式

- **自学**：建立理解、完整例题、独立练习、闭卷回忆。保留渐进提示、节奏调整、多行答题与间隔复习。
- **课上自学**：跟随老师，先阅读概念并完成一道简单检查题。通过侧边栏的「课后集中练习」统一做独立练习与闭卷回忆；完整例题不作为这一模式的必修阶段。

两种模式都允许自由选择任意章节与阶段。跳转不会自动完成其他项目；只有逐项经过练习和自检确认的阶段才显示主题色实心圆。模块须完成该模式的所有必修环节才填满。切换模式不会伪造未完成的阶段。

模块首次确认完成时，显示全屏彩带并播放轻柔的四音庆祝声。侧边栏可以关闭音效；页面尊重减少动画偏好。不在打开旧记录或刷新时重复播放。

## 导入自己的资料

支持 **PDF、Markdown、TXT**，每份最大 25 MB；PDF 最多 300 页，文字最多 200 万字符。

- Markdown / TXT：根据实际标题生成目录，没有标题时按原文或实际内容分段显示。
- PDF：在浏览器本地读取书签和文字；没有可用书签时按真实页码生成目录。保留原文件，可打开原稿。扫描件按页浏览，不假装识别出文字或生成章节。
- 数学公式支持 `$...$` 和 `$$...$$`，所有脚本、字体与 PDF 资源由本站提供。
- 不执行资料中的 HTML 或脚本。资料和进度保存在当前浏览器的 IndexedDB；同一文件再次导入会复用已有进度。
- 清除站点数据、更换浏览器或预览地址会影响本机记录，没有账户同步。

导入面板附有 Vector Spaces 示例资料，展示 Basis、Coordinates 与 Dimension。原有的核、导数和递归三个练习仍可打开；旧版学习记录继续保留。

**当前没有接入实时 AI 服务**。上传内容用于阅读和自检；不会把任意文件伪装为 AI 自动生成的课程。若原稿明确标注示例、练习与答案，会分别显示；没有这些内容时使用通用自学问题，并明确以学习者对照自检为准。

## 运行

需要 Node.js **22.13 或更新版本**。开发与依赖安装在云端完成，Windows 上无需安装软件。

```bash
npm ci
npm run dev
```

开发服务默认监听 `0.0.0.0:3000`，可用 `PORT=3001 npm run dev` 指定端口。

```bash
npm test              # 13 组进度、文件解析、两种模式与复习检查
npm run build         # 生成 dist/，包含本地 PDF 与公式资源
npm start             # 运行生产版本，需先 build
npm run test:browser  # 先启动开发服务；需要本机 Chromium
```

浏览器测试使用独立临时配置，真实上传 Markdown 和三页 PDF，验证目录、模式、自由跳转、持久化、圆点颜色、庆祝音效及移动端。支持 `CHROMIUM_PATH` 和 `TEST_URL`。截图保存到 `/tmp/study-studio-*.png`。

## Chrome 私有预览

[在浏览器中创建 Codespaces 私有预览](https://codespaces.new/Alencyayn/Self-Study-Web?ref=main)

1. 使用 Chrome 登录 GitHub，点击 **Create codespace**。
2. 云端会自动安装依赖并启动网站，尝试自动打开 3000 端口预览。
3. 如未自动打开，在 **Ports** 面板点击 **3000 / study studio → Open in Browser**，保持 **Port Visibility: Private**。

这是创建入口，实际网站地址由 Codespace 创建后生成，需要 GitHub 登录。无需 Windows 安装，不使用 GitHub Pages；Codespaces 使用账户云开发额度，停止后预览也会停止。已有 Codespace 更新代码后，请运行 `npm ci` 并重启预览。

## 文件

- `src/app.js`：首页、资料库、目录与两种模式的学习交互。
- `src/materials.js`：真实文件解析、标题目录、模式完成条件与复习。
- `src/storage.js`：资料和进度的本机持久化。
- `src/markdown.js`：安全的文字、代码与数学公式显示。
- `src/celebration.js`：全屏彩带、庆祝声音及静音设置。
- `src/learning.js`、`src/courses.js`：原有练习与进度能力。
- `assets/sample-material.md`：与示例图相同主题的线性代数资料。
- `scripts/prepare-assets.mjs`：从锁定依赖准备本站资源；第三方许可证随构建保留。

`node_modules/`、`assets/pdfjs/`、`assets/katex/` 与 `dist/` 为可重复生成的忽略目录，不提交到仓库。
