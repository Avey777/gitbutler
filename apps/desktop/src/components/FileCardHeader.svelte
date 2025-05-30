<script lang="ts">
	import FileStatusTag from '$components/FileStatusTag.svelte';
	import { computeFileStatus } from '$lib/utils/fileStatus';
	import { computeAddedRemovedByFiles } from '$lib/utils/metrics';
	import Badge from '@gitbutler/ui/Badge.svelte';
	import Button from '@gitbutler/ui/Button.svelte';
	import FileIcon from '@gitbutler/ui/file/FileIcon.svelte';
	import { splitFilePath } from '@gitbutler/ui/utils/filePath';
	import type { AnyFile } from '$lib/files/file';

	interface Props {
		file: AnyFile;
		isFileLocked: boolean;
		onClose?: () => void;
	}

	const { file, isFileLocked, onClose }: Props = $props();

	const fileStats = $derived(computeAddedRemovedByFiles(file));
	const fileStatus = $derived(computeFileStatus(file));

	const fileTitle = $derived(splitFilePath(file.path));
</script>

<div class="header">
	<div class="header__inner">
		<FileIcon fileName={file.path} size={16} />
		<div class="header__info truncate">
			<div class="header__filetitle text-13 truncate">
				<span class="header__filename">{fileTitle.filename}</span>
				<span class="header__filepath">{fileTitle.path}</span>
			</div>
			<div class="header__tags">
				{#if file.conflicted || isFileLocked}
					<div class="header__tag-group">
						{#if isFileLocked}
							<Badge
								size="icon"
								icon="locked-small"
								style="warning"
								tooltip="File changes cannot be moved because part of this file was already committed into this branch"
								>Locked</Badge
							>
						{/if}
						{#if file.conflicted}
							<Badge size="tag" icon="warning-small" style="error">Has conflicts</Badge>
						{/if}
					</div>
				{/if}
				<div class="header__tag-group">
					{#if fileStats.added}
						<Badge size="icon" style="success" kind="soft">+{fileStats.added}</Badge>
					{/if}
					{#if fileStats.removed}
						<Badge size="icon" style="error" kind="soft">-{fileStats.removed}</Badge>
					{/if}
					{#if fileStatus}
						<FileStatusTag status={fileStatus} />
					{/if}
				</div>
			</div>
		</div>
	</div>
	<Button icon="cross" kind="ghost" onclick={() => onClose?.()} />
</div>

<style lang="postcss">
	.header {
		display: flex;
		padding: 10px;
		gap: 12px;
		border-bottom: 1px solid var(--clr-border-2);
	}
	.header__inner {
		display: flex;
		flex-grow: 1;
		gap: 8px;
		padding: 4px;
		overflow: hidden;
	}
	.header__info {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
	}
	.header__tags {
		display: flex;
		gap: 6px;
	}
	.header__tag-group {
		display: flex;
		gap: 2px;
	}
	.header__filetitle {
		width: 100%;
		user-select: text;
	}
	.header__filename {
		color: var(--clr-scale-ntrl-0);
		line-height: 120%;
	}
	.header__filepath {
		color: var(--clr-scale-ntrl-50);
	}
</style>
