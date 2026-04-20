# Pin To Top

Pin To Top is an Obsidian plugin that lets you pin files and folders to the top of their current folder in the built-in file explorer.

Pin To Top 是一个 Obsidian 文件浏览器置顶插件，可以把文件或文件夹固定到当前目录顶部。

## Features

- Right-click a file or folder to pin or unpin it.
- Pinned items stay at the top of their current folder only.
- When multiple items are pinned in the same folder, the latest pinned item appears first.
- Works in both the vault root and nested folders.
- Unpinned items return to Obsidian's normal file explorer order.
- Menu labels, notices, and the pinned badge automatically use Chinese in Chinese Obsidian environments and English otherwise.
- The command palette includes a command to clear all pinned items.

## 功能

- 右键文件或文件夹即可置顶或取消置顶。
- 置顶项只会固定到当前所在目录顶部，不影响其他目录。
- 根目录和子目录都支持置顶。
- 同一目录存在多个置顶项时，最新置顶的项目排在最上面。
- 取消置顶后，项目会回到 Obsidian 文件浏览器的正常顺序。
- 菜单、通知和置顶标记会自动判断 Obsidian 当前语言：中文环境显示中文，非中文环境显示英文。
- 命令面板提供清空所有置顶项的命令。

## Usage

1. Open the Obsidian file explorer.
2. Right-click a file or folder.
3. Select **Pin to top**.
4. Right-click the same item again and select **Unpin** to restore Obsidian's normal order.

## 使用方式

1. 打开 Obsidian 文件浏览器。
2. 右键文件或文件夹。
3. 点击 **置顶**。
4. 再次右键该项目，点击 **取消置顶**，即可恢复 Obsidian 默认排序。

## Commands

- **Clear all pinned items**: removes all pinned file and folder records.
- **清空所有置顶**：清除全部文件和文件夹置顶记录。

## Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest GitHub release.
2. Create this folder inside your vault: `.obsidian/plugins/pin-to-top/`.
3. Put the three downloaded files into that folder.
4. Restart Obsidian or reload community plugins.
5. Enable **Pin To Top** in **Settings -> Community plugins**.

## Development

```bash
npm install
npm run build
```

For local testing, copy `main.js`, `manifest.json`, and `styles.css` into:

```text
<YourVault>/.obsidian/plugins/pin-to-top/
```

## Release

Obsidian community plugin releases must include these assets:

- `main.js`
- `manifest.json`
- `styles.css`

The GitHub release tag must match the `version` field in `manifest.json`, for example `1.0.6`.

## How It Works

Obsidian does not currently expose an official API for changing the built-in file explorer sort order. Pin To Top uses public file menu and workspace events, then patches the file explorer's runtime sorting result so Obsidian can render pinned items in the normal file tree.

The plugin does not access the network and does not read note contents.

## Compatibility

Pin To Top changes the file explorer order at runtime. It may conflict with other plugins that also change the built-in file explorer order, file tree rendering, or folder sorting behavior.

If pinned items do not appear in the expected position, try disabling other file explorer sorting or file tree replacement plugins first.

## 兼容性说明

Pin To Top 会在运行时调整 Obsidian 内置文件浏览器的排序结果，因此可能会与其他同样修改文件浏览器排序、文件树渲染或文件夹排序行为的插件发生冲突。

如果置顶项没有出现在预期位置，建议先禁用其他文件浏览器排序类插件或文件树替代类插件后再测试。

## License

MIT
