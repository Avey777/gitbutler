<script lang="ts">
	import ReduxResult from '$components/ReduxResult.svelte';
	import FileList from '$components/v3/FileList.svelte';
	import { StackService } from '$lib/stacks/stackService.svelte';
	import { inject } from '@gitbutler/shared/context';
	import Badge from '@gitbutler/ui/Badge.svelte';

	type Props = {
		projectId: string;
		stackId: string;
		selectionId:
			| {
					type: 'commit';
					commitId: string;
			  }
			| {
					type: 'branch';
					stackId: string;
					branchName: string;
			  };
	};

	const { projectId, stackId, selectionId }: Props = $props();
	const [stackService] = inject(StackService);
	const changesResult = $derived(
		selectionId.type === 'commit'
			? stackService.commitChanges(projectId, selectionId.commitId)
			: stackService.branchChanges(projectId, selectionId.stackId, selectionId.branchName)
	);

	const headerTitle = $derived.by(() => {
		switch (selectionId.type) {
			case 'commit':
				return 'Changed files';
			case 'branch':
				return 'All changed files';
		}
	});
</script>

{#if changesResult}
	<div class="changed-files">
		<ReduxResult result={changesResult.current}>
			{#snippet children(changes)}
				<div class="header text-13 text-bold">
					<span>{headerTitle}</span>
					<Badge>{changes.length}</Badge>
				</div>
				{#if changes.length > 0}
					<FileList {projectId} {stackId} {changes} {selectionId} />
				{:else}
					<div class="text-12 text-body helper-text">(no changed files)</div>
				{/if}
			{/snippet}
		</ReduxResult>
	</div>
{:else}
	<p class="text-13 text-bold">Malformed props</p>
{/if}

<style>
	.changed-files {
		display: flex;
		flex-direction: column;
		border-radius: var(--radius-m);
		border: 1px solid var(--clr-border-2);
		overflow: hidden;
	}

	.header {
		padding: 14px 14px 16px 14px;
		display: flex;
		align-items: center;
		gap: 4px;
	}
</style>
