import { App, Modal, Setting } from "obsidian";
import type OpenWhisprPlugin from "./main";
import type { OpenWhisprFolder } from "./types";

/**
 * Modal that lists the folders reported by `openwhispr folders list` and lets
 * the user tick the ones to exclude from sync (e.g. a Personal folder).
 * Changes are persisted immediately on toggle.
 */
export class FolderExclusionModal extends Modal {
	constructor(app: App, private plugin: OpenWhisprPlugin) {
		super(app);
	}

	onOpen(): void {
		this.setTitle("Excluded folders");
		this.contentEl.createEl("p", {
			text:
				"Notes in the folders you select here are skipped during sync. " +
				"Notes that aren't in any folder are always synced.",
			cls: "setting-item-description",
		});
		const listEl = this.contentEl.createDiv();
		listEl.createEl("p", { text: "Loading folders from the OpenWhispr CLI…" });
		void this.loadFolders(listEl);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async loadFolders(listEl: HTMLElement): Promise<void> {
		let folders: OpenWhisprFolder[];
		try {
			folders = await this.plugin.listFolders();
		} catch (e) {
			listEl.empty();
			listEl.createEl("p", {
				text:
					"Could not list folders: " +
					(e instanceof Error ? e.message : String(e)),
				cls: "mod-warning",
			});
			return;
		}

		listEl.empty();
		if (folders.length === 0) {
			listEl.createEl("p", {
				text: "No folders found in your OpenWhispr account.",
				cls: "setting-item-description",
			});
		}

		const seen = new Set<string>();
		for (const folder of folders) {
			if (folder.id == null) continue;
			const id = String(folder.id);
			if (seen.has(id)) continue;
			seen.add(id);
			this.renderFolderToggle(listEl, id, folder.name?.trim() || `Folder ${id}`);
		}

		// Excluded ids the CLI no longer reports (deleted folders, other
		// backend) — still shown so they can be un-excluded.
		for (const id of this.plugin.settings.excludedFolderIds) {
			if (seen.has(id)) continue;
			seen.add(id);
			this.renderFolderToggle(listEl, id, `Unknown folder (id ${id})`);
		}
	}

	private renderFolderToggle(listEl: HTMLElement, id: string, name: string): void {
		new Setting(listEl).setName(name).addToggle((toggle) =>
			toggle
				.setValue(this.plugin.settings.excludedFolderIds.includes(id))
				.setTooltip("Exclude from sync")
				.onChange(async (excluded) => {
					const ids = this.plugin.settings.excludedFolderIds.filter(
						(existing) => existing !== id
					);
					if (excluded) ids.push(id);
					this.plugin.settings.excludedFolderIds = ids;
					await this.plugin.saveSettings();
				})
		);
	}
}
