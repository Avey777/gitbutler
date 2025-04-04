<script lang="ts">
	import ReduxResult from '$components/ReduxResult.svelte';
	import FileList from '$components/v3/FileList.svelte';
	import noChanges from '$lib/assets/illustrations/no-changes.svg?raw';
	import { createCommitStore } from '$lib/commits/contexts';
	import { FocusManager } from '$lib/focus/focusManager.svelte';
	import { ChangeSelectionService } from '$lib/selection/changeSelection.svelte';
	import { StackService } from '$lib/stacks/stackService.svelte';
	import { UiState } from '$lib/state/uiState.svelte';
	import { WorktreeService } from '$lib/worktree/worktreeService.svelte';
	import { inject } from '@gitbutler/shared/context';
	import Badge from '@gitbutler/ui/Badge.svelte';
	import Button from '@gitbutler/ui/Button.svelte';

	type Props = {
		projectId: string;
		stackId?: string;
	};

	const { projectId, stackId }: Props = $props();

	const [changeSelection, worktreeService, uiState, stackService, focus] = inject(
		ChangeSelectionService,
		WorktreeService,
		UiState,
		StackService,
		FocusManager
	);

	const projectState = $derived(uiState.project(projectId));
	const drawerPage = $derived(projectState.drawerPage.get());
	const isCommitting = $derived(drawerPage.current === 'new-commit');
	const stackState = $derived(stackId ? uiState.stack(stackId) : undefined);
	const defaultBranchResult = $derived(
		stackId !== undefined ? stackService.defaultBranch(projectId, stackId) : undefined
	);
	const defaultBranch = $derived(defaultBranchResult?.current.data);
	const defaultBranchName = $derived(defaultBranch?.name);

	// TODO: Make this go away.
	createCommitStore(undefined);

	const changesResult = $derived(worktreeService.getChanges(projectId));

	/** Clear any selected changes that no longer exist. */
	$effect(() => {
		const affectedPaths = changesResult.current.data?.map((c) => c.path);
		changeSelection.retain(affectedPaths);
	});

	const focusedArea = $derived(focus.current);

	$effect(() => {
		// If the focused area updates and it matches "left" then we update what
		// selection should be shown in the main view.
		if (focusedArea === 'left') {
			stackState?.activeSelectionId.set({ type: 'worktree' });
		}
	});

	function startCommit() {
		if (!defaultBranchName) return;
		stackState?.selection.set({ branchName: defaultBranchName });
		projectState.drawerPage.set('new-commit');
	}
</script>

<ReduxResult result={changesResult.current}>
	{#snippet children(changes)}
		<div class="worktree-header text-14 text-semibold">
			<h3>Uncommitted changes</h3>
			{#if changes.length > 0}
				<Badge>{changes.length}</Badge>
			{/if}
		</div>
		{#if changes.length > 0}
			<div class="uncommitted-changes">
				<FileList
					selectionId={{ type: 'worktree', showCheckboxes: isCommitting }}
					{projectId}
					{stackId}
					{changes}
				/>
				<div class="start-commit">
					<Button
						kind={isCommitting ? 'outline' : 'solid'}
						type="button"
						size="cta"
						wide
						disabled={isCommitting}
						onclick={startCommit}
					>
						Start a commit…
					</Button>
				</div>
			</div>
		{:else}
			<div class="empty-state">
				{@html noChanges}
				<p class="text-13 text-body empty-state-text">
					You're all caught up!<br />
					No files need committing
				</p>
			</div>
		{/if}
	{/snippet}
</ReduxResult>

<style>
	.worktree-header {
		display: flex;
		padding: 14px 8px 12px 14px;
		width: 100%;
		gap: 4px;
		align-items: center;
		text-wrap: nowrap;
		overflow: hidden;
	}

	.uncommitted-changes {
		display: flex;
		flex: 1;
		width: 100%;
		height: 100%;
		display: flex;
		justify-items: top;
		flex-direction: column;
		align-items: top;
		justify-content: top;
		overflow: hidden;
	}

	.start-commit {
		padding: 16px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 20px;
		padding: 0 20px 40px;
		height: 100%;
	}

	.empty-state-text {
		text-align: center;
		color: var(--clr-text-3);
	}
</style>
