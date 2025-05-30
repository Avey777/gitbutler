<script lang="ts">
	import ReduxResult from '$components/ReduxResult.svelte';
	import FileListItemWrapper from '$components/v3/FileListItemWrapper.svelte';
	import UnifiedDiffView from '$components/v3/UnifiedDiffView.svelte';
	import { StackService } from '$lib/stacks/stackService.svelte';
	import { WorktreeService } from '$lib/worktree/worktreeService.svelte';
	import { inject } from '@gitbutler/shared/context';
	import type { SelectedFile } from '$lib/selection/key';

	type Props = {
		selectedFile: SelectedFile;
		projectId: string;
	};

	const { selectedFile, projectId }: Props = $props();

	const [stackService, worktreeService] = inject(StackService, WorktreeService);

	const changeResult = $derived.by(() => {
		switch (selectedFile.type) {
			case 'commit':
				return stackService.commitChange(projectId, selectedFile.commitId, selectedFile.path);
			case 'branch':
				return stackService.branchChange(
					projectId,
					selectedFile.stackId,
					selectedFile.branchName,
					selectedFile.path
				);
			case 'worktree':
				return worktreeService.getChange(projectId, selectedFile.path);
		}
	});
</script>

<ReduxResult result={changeResult.current}>
	{#snippet children(change)}
		<FileListItemWrapper {selectedFile} {projectId} {change} isHeader />
		<UnifiedDiffView {projectId} {change} selectable />
	{/snippet}
</ReduxResult>
