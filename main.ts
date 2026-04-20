import {
  getLanguage,
  Menu,
  Notice,
  Plugin,
  TAbstractFile,
  TFolder
} from "obsidian";

interface PinRecord {
  path: string;
  parentPath: string;
  pinnedAt: number;
}

interface PinToTopSettings {
  pins: PinRecord[];
  nextPinnedAt: number;
}

const DEFAULT_SETTINGS: PinToTopSettings = {
  pins: [],
  nextPinnedAt: 1
};

const FILE_EXPLORER_VIEW_TYPE = "file-explorer";
const PATCHED_SORT_KEY = "__pinToTopOriginalGetSortedFolderItems";

type LocaleKey =
  | "pin"
  | "unpin"
  | "clearAllPins"
  | "pinnedNotice"
  | "unpinnedNotice"
  | "clearAllNotice";

const TRANSLATIONS: Record<"zh" | "en", Record<LocaleKey, string>> = {
  zh: {
    pin: "置顶",
    unpin: "取消置顶",
    clearAllPins: "清空所有置顶",
    pinnedNotice: "已置顶：{name}",
    unpinnedNotice: "已取消置顶：{name}",
    clearAllNotice: "已清空所有置顶"
  },
  en: {
    pin: "Pin to top",
    unpin: "Unpin",
    clearAllPins: "Clear all pinned items",
    pinnedNotice: "Pinned: {name}",
    unpinnedNotice: "Unpinned: {name}",
    clearAllNotice: "Cleared all pinned items"
  }
};

export default class PinToTopPlugin extends Plugin {
  private settings: PinToTopSettings = structuredClone(DEFAULT_SETTINGS);
  private patchedViews = new Set<FileExplorerViewWithPatch>();

  /**
   * 加载插件并注册文件菜单、文件变更事件。
   */
  async onload(): Promise<void> {
    await this.loadSettings();

    this.app.workspace.onLayoutReady(() => {
      this.patchFileExplorerViews();
      this.refreshFileExplorerSort();
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
        this.addFileMenuItem(menu, file);
      })
    );

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.patchFileExplorerViews();
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        void this.handleRename(file, oldPath);
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        void this.removePin(file.path, false);
      })
    );

    this.addCommand({
      id: "clear-all-pinned-files",
      name: this.t("clearAllPins"),
      callback: () => {
        void this.clearAllPins();
      }
    });
  }

  /**
   * 卸载插件时恢复被补丁过的文件浏览器排序方法。
   */
  onunload(): void {
    this.restoreFileExplorerViews();
  }

  /**
   * 读取插件保存的置顶数据，并兼容旧版数据结构。
   */
  private async loadSettings(): Promise<void> {
    const loaded = await this.loadData();
    this.settings = {
      ...structuredClone(DEFAULT_SETTINGS),
      ...loaded,
      pins: loaded?.pins ?? []
    };
  }

  /**
   * 保存插件设置。
   */
  private async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * 给文件或文件夹右键菜单添加置顶/取消置顶入口。
   */
  private addFileMenuItem(menu: Menu, file: TAbstractFile): void {
    const isPinned = this.isPinned(file.path);

    menu.addItem((item) => {
      item
        .setTitle(isPinned ? this.t("unpin") : this.t("pin"))
        .setIcon(isPinned ? "pin-off" : "pin")
        .onClick(() => {
          void (isPinned ? this.removePin(file.path) : this.pinFile(file));
        });
    });
  }

  /**
   * 将文件或文件夹置顶到其当前所在目录顶部。
   */
  private async pinFile(file: TAbstractFile): Promise<void> {
    const parentPath = this.getParentPath(file);

    this.settings.pins = this.settings.pins.filter((pin) => pin.path !== file.path);
    this.settings.pins.push({
      path: file.path,
      parentPath,
      pinnedAt: this.settings.nextPinnedAt++
    });

    await this.saveSettings();
    this.refreshFileExplorerSort();
    new Notice(this.t("pinnedNotice", { name: file.name }));
  }

  /**
   * 取消置顶；重新排序后会回到 Obsidian 原始位置。
   */
  private async removePin(path: string, showNotice = true): Promise<void> {
    const pin = this.settings.pins.find((item) => item.path === path);
    if (!pin) {
      return;
    }

    this.settings.pins = this.settings.pins.filter((item) => item.path !== path);
    await this.saveSettings();
    this.refreshFileExplorerSort();

    if (showNotice) {
      const file = this.app.vault.getAbstractFileByPath(path);
      new Notice(this.t("unpinnedNotice", { name: file?.name ?? path }));
    }
  }

  /**
   * 清空所有置顶状态。
   */
  private async clearAllPins(): Promise<void> {
    this.settings.pins = [];
    await this.saveSettings();
    this.refreshFileExplorerSort();
    new Notice(this.t("clearAllNotice"));
  }

  /**
   * 处理重命名或移动，尽量保持置顶状态跟随文件路径变化。
   */
  private async handleRename(file: TAbstractFile, oldPath: string): Promise<void> {
    const pin = this.settings.pins.find((item) => item.path === oldPath);
    if (!pin) {
      return;
    }

    pin.path = file.path;
    pin.parentPath = this.getParentPath(file);

    await this.saveSettings();
    this.refreshFileExplorerSort();
  }

  /**
   * 给文件浏览器内部排序方法打补丁，让根目录和子目录都通过 Obsidian 自身渲染顺序完成置顶。
   */
  private patchFileExplorerViews(): void {
    for (const view of this.getFileExplorerViews()) {
      const patchedView = view;
      if (typeof patchedView.getSortedFolderItems !== "function" || patchedView[PATCHED_SORT_KEY]) {
        continue;
      }

      const originalGetSortedFolderItems = patchedView.getSortedFolderItems.bind(view);
      patchedView[PATCHED_SORT_KEY] = originalGetSortedFolderItems;
      patchedView.getSortedFolderItems = (folder: TFolder) => {
        return this.applyPinnedSort(folder, originalGetSortedFolderItems(folder));
      };
      this.patchedViews.add(patchedView);
    }
  }

  /**
   * 插件卸载时恢复文件浏览器原始排序方法。
   */
  private restoreFileExplorerViews(): void {
    for (const view of this.patchedViews) {
      const originalGetSortedFolderItems = view[PATCHED_SORT_KEY];
      if (originalGetSortedFolderItems) {
        view.getSortedFolderItems = originalGetSortedFolderItems;
        delete view[PATCHED_SORT_KEY];
      }
    }

    this.patchedViews.clear();
  }

  /**
   * 让已打开的文件浏览器重新排序一次。
   */
  private refreshFileExplorerSort(): void {
    this.patchFileExplorerViews();

    for (const view of this.getFileExplorerViews()) {
      if (typeof view.requestSort === "function") {
        view.requestSort();
      } else if (typeof view.sort === "function") {
        view.sort();
      }
    }
  }

  /**
   * 从当前工作区中获取文件浏览器视图。这里访问的是 Obsidian 内部视图对象，所以只做鸭子类型判断。
   */
  private getFileExplorerViews(): FileExplorerViewWithPatch[] {
    const views: FileExplorerViewWithPatch[] = [];

    for (const leaf of this.app.workspace.getLeavesOfType(FILE_EXPLORER_VIEW_TYPE)) {
      if (this.isFileExplorerView(leaf.view)) {
        views.push(leaf.view);
      }
    }

    return views;
  }

  /**
   * 判断工作区视图是否是文件浏览器视图。
   */
  private isFileExplorerView(view: unknown): view is FileExplorerViewWithPatch {
    if (!view || typeof view !== "object") {
      return false;
    }

    const candidate = view as FileExplorerViewWithPatch;
    return typeof candidate.getViewType === "function" && candidate.getViewType() === FILE_EXPLORER_VIEW_TYPE;
  }

  /**
   * 在 Obsidian 原始排序结果基础上，把当前目录的置顶项移动到最前面。
   */
  private applyPinnedSort(folder: TFolder, items: FileExplorerItem[]): FileExplorerItem[] {
    const parentPath = folder.isRoot() ? "" : folder.path;
    const pins = this.settings.pins
      .filter((pin) => pin.parentPath === parentPath)
      .sort((a, b) => b.pinnedAt - a.pinnedAt);

    if (pins.length === 0) {
      return items;
    }

    const itemByPath = new Map(items.map((item) => [item.file.path, item]));
    const pinnedItems = pins
      .map((pin) => itemByPath.get(pin.path))
      .filter((item): item is FileExplorerItem => Boolean(item));
    const pinnedPathSet = new Set(pinnedItems.map((item) => item.file.path));
    const remainingItems = items.filter((item) => !pinnedPathSet.has(item.file.path));

    return [...pinnedItems, ...remainingItems];
  }

  /**
   * 判断路径是否已置顶。
   */
  private isPinned(path: string): boolean {
    return this.settings.pins.some((pin) => pin.path === path);
  }

  /**
   * 获取文件或文件夹所在目录路径。
   */
  private getParentPath(file: TAbstractFile): string {
    return file.parent?.path === "/" ? "" : file.parent?.path ?? "";
  }

  /**
   * 按 Obsidian 当前语言返回界面文案；中文环境显示中文，其他语言默认英文。
   */
  private t(key: LocaleKey, values: Record<string, string> = {}): string {
    const language = getLanguage().toLowerCase();
    const locale = language.startsWith("zh") ? "zh" : "en";
    let text = TRANSLATIONS[locale][key];

    for (const [name, value] of Object.entries(values)) {
      text = text.replace(`{${name}}`, value);
    }

    return text;
  }
}

interface FileExplorerViewWithPatch {
  getViewType?: () => string;
  getSortedFolderItems?: (folder: TFolder) => FileExplorerItem[];
  requestSort?: () => void;
  sort?: () => void;
  [PATCHED_SORT_KEY]?: (folder: TFolder) => FileExplorerItem[];
}

interface FileExplorerItem {
  file: TAbstractFile;
}
