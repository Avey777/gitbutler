<script lang="ts">
	import Chrome from '$components/Chrome.svelte';
	import FileMenuAction from '$components/FileMenuAction.svelte';
	import History from '$components/History.svelte';
	import MetricsReporter from '$components/MetricsReporter.svelte';
	import Navigation from '$components/Navigation.svelte';
	import NoBaseBranch from '$components/NoBaseBranch.svelte';
	import NotOnGitButlerBranch from '$components/NotOnGitButlerBranch.svelte';
	import ProblemLoadingRepo from '$components/ProblemLoadingRepo.svelte';
	import ProjectSettingsMenuAction from '$components/ProjectSettingsMenuAction.svelte';
	import { BaseBranch, NoDefaultTarget } from '$lib/baseBranch/baseBranch';
	import { BaseBranchService } from '$lib/baseBranch/baseBranchService';
	import { BranchController } from '$lib/branches/branchController';
	import { BranchListingService, CombinedBranchListingService } from '$lib/branches/branchListing';
	import { GitBranchService } from '$lib/branches/gitBranch';
	import { VirtualBranchService } from '$lib/branches/virtualBranchService';
	import { SettingsService } from '$lib/config/appSettingsV2';
	import { showHistoryView } from '$lib/config/config';
	import { StackingReorderDropzoneManagerFactory } from '$lib/dragging/stackingReorderDropzoneManager';
	import { UncommitedFilesWatcher } from '$lib/files/watcher';
	import { FocusManager } from '$lib/focus/focusManager.svelte';
	import { DefaultForgeFactory } from '$lib/forge/forgeFactory.svelte';
	import { GitHubClient } from '$lib/forge/github/githubClient';
	import { BrToPrService } from '$lib/forge/shared/prFooter';
	import { TemplateService } from '$lib/forge/templateService';
	import { HistoryService } from '$lib/history/history';
	import { StackPublishingService } from '$lib/history/stackPublishingService';
	import { SyncedSnapshotService } from '$lib/history/syncedSnapshotService';
	import { ModeService } from '$lib/mode/modeService';
	import { Project } from '$lib/project/project';
	import { projectCloudSync } from '$lib/project/projectCloudSync.svelte';
	import { ProjectService } from '$lib/project/projectService';
	import { IdSelection } from '$lib/selection/idSelection.svelte';
	import { UpstreamIntegrationService } from '$lib/upstream/upstreamIntegrationService';
	import { debounce } from '$lib/utils/debounce';
	import { WorktreeService } from '$lib/worktree/worktreeService.svelte';
	import { BranchService as CloudBranchService } from '@gitbutler/shared/branches/branchService';
	import { LatestBranchLookupService } from '@gitbutler/shared/branches/latestBranchLookupService';
	import { getContext } from '@gitbutler/shared/context';
	import { HttpClient } from '@gitbutler/shared/network/httpClient';
	import { ProjectService as CloudProjectService } from '@gitbutler/shared/organizations/projectService';
	import { WebRoutesService } from '@gitbutler/shared/routing/webRoutes.svelte';
	import { onDestroy, setContext, type Snippet } from 'svelte';
	import type { ProjectMetrics } from '$lib/metrics/projectMetrics';
	import type { LayoutData } from './$types';
	import { goto } from '$app/navigation';

	const { data, children }: { data: LayoutData; children: Snippet } = $props();

	const {
		vbranchService,
		project,
		projectId,
		projectsService,
		baseBranchService,
		branchListingService,
		modeService,
		userService,
		fetchSignal,
		posthog,
		projectMetrics
	} = $derived(data);

	const branchesError = $derived(vbranchService.branchesError);
	const baseBranch = $derived(baseBranchService.base);
	const repoInfo = $derived(baseBranchService.repo);
	const forkInfo = $derived(baseBranchService.pushRepo);
	const user = $derived(userService.user);
	const accessToken = $derived($user?.github_access_token);

	const gitHubClient = getContext(GitHubClient);
	$effect(() => gitHubClient.setToken(accessToken));
	$effect(() => gitHubClient.setRepo({ owner: $repoInfo?.owner, repo: $repoInfo?.name }));

	const baseError = $derived(baseBranchService.error);
	const projectError = $derived(projectsService.error);

	const cloudBranchService = getContext(CloudBranchService);
	const cloudProjectService = getContext(CloudProjectService);
	const latestBranchLookupService = getContext(LatestBranchLookupService);
	$effect(() => {
		const upstreamIntegrationService = new UpstreamIntegrationService(
			project,
			vbranchService,
			cloudBranchService,
			cloudProjectService,
			latestBranchLookupService
		);
		setContext(UpstreamIntegrationService, upstreamIntegrationService);
	});

	$effect.pre(() => {
		setContext(HistoryService, data.historyService);
		setContext(VirtualBranchService, data.vbranchService);
		setContext(BranchController, data.branchController);
		setContext(BaseBranchService, data.baseBranchService);
		setContext(TemplateService, data.templateService);
		setContext(BaseBranch, baseBranch);
		setContext(Project, project);
		setContext(StackingReorderDropzoneManagerFactory, data.stackingReorderDropzoneManagerFactory);
		setContext(GitBranchService, data.gitBranchService);
		setContext(BranchListingService, data.branchListingService);
		setContext(ModeService, data.modeService);
		setContext(UncommitedFilesWatcher, data.uncommitedFileWatcher);
		setContext(ProjectService, data.projectService);

		// Cloud related services
		setContext(SyncedSnapshotService, data.syncedSnapshotService);
		setContext(StackPublishingService, data.stackPublishingService);
	});

	const focusManager = new FocusManager();
	setContext(FocusManager, focusManager);

	const worktreeService = getContext(WorktreeService);
	const idSelection = new IdSelection(worktreeService);
	setContext(IdSelection, idSelection);

	let intervalId: any;

	const baseBranchName = $derived($baseBranch?.shortName);

	const forgeFactory = getContext(DefaultForgeFactory);
	$effect.pre(() => {
		const combinedBranchListingService = new CombinedBranchListingService(
			data.branchListingService,
			projectId
		);

		setContext(CombinedBranchListingService, combinedBranchListingService);
	});

	// Refresh base branch if git fetch event is detected.
	const mode = $derived(modeService.mode);
	const head = $derived(modeService.head);

	// TODO: can we eliminate the need to debounce?
	const fetch = $derived(fetchSignal.event);
	const debouncedBaseBranchRefresh = debounce(async () => await baseBranchService.refresh(), 500);
	$effect(() => {
		if ($fetch || $head) debouncedBaseBranchRefresh();
	});

	// TODO: can we eliminate the need to debounce?
	const debouncedRemoteBranchRefresh = debounce(
		async () => await branchListingService?.refresh(),
		500
	);

	$effect(() => {
		if ($baseBranch || $head || $fetch) debouncedRemoteBranchRefresh();
	});

	$effect(() => {
		forgeFactory.setConfig({
			repo: $repoInfo,
			pushRepo: $forkInfo,
			baseBranch: baseBranchName,
			githubAuthenticated: !!$user?.github_access_token
		});
	});

	$effect(() => {
		posthog.setPostHogRepo($repoInfo);
		return () => {
			posthog.setPostHogRepo(undefined);
		};
	});

	// Once on load and every time the project id changes
	$effect(() => {
		if (projectId) {
			setupFetchInterval();
		} else {
			goto('/onboarding');
		}
	});

	// TODO(mattias): This is an ugly hack, fix it somehow?
	// I want to flush project metrics to local storage before e.g. switching
	// to a different project. Since `projectMetrics` is defined in layout.ts
	// we get no heads up when it is about to change, and reactively updated
	// in this scope through `LayoutData`. Even at time of unMount in e.g.
	// metrics reporter it seems as if the projectMetrics variable is already
	// referencing the new instance.
	let lastProjectMetrics: ProjectMetrics | undefined;
	$effect(() => {
		if (lastProjectMetrics) {
			lastProjectMetrics.saveToLocalStorage();
		}
		lastProjectMetrics = projectMetrics;
		projectMetrics.loadFromLocalStorage();
	});

	function setupFetchInterval() {
		baseBranchService.fetchFromRemotes();
		clearFetchInterval();
		const intervalMs = 15 * 60 * 1000; // 15 minutes
		intervalId = setInterval(async () => {
			await baseBranchService.fetchFromRemotes();
		}, intervalMs);
	}

	function clearFetchInterval() {
		if (intervalId) clearInterval(intervalId);
	}

	const httpClient = getContext(HttpClient);

	const settingsService = getContext(SettingsService);
	const settingsStore = settingsService.appSettings;

	const webRoutesService = getContext(WebRoutesService);
	const brToPrService = new BrToPrService(
		webRoutesService,
		cloudProjectService,
		latestBranchLookupService,
		forgeFactory
	);
	setContext(BrToPrService, brToPrService);

	$effect(() => {
		projectCloudSync(data.projectsService, data.projectService, httpClient);
	});

	onDestroy(() => {
		clearFetchInterval();
	});

	$effect(() => {
		projectsService.setActiveProject(projectId);
	});
</script>

<!-- forces components to be recreated when projectId changes -->
{#key projectId}
	<ProjectSettingsMenuAction />
	<FileMenuAction />

	{#if !project}
		<p>Project not found!</p>
	{:else if $baseError instanceof NoDefaultTarget}
		<NoBaseBranch />
	{:else if $baseError}
		<ProblemLoadingRepo error={$baseError} />
	{:else if $branchesError}
		<ProblemLoadingRepo error={$branchesError} />
	{:else if $projectError}
		<ProblemLoadingRepo error={$projectError} />
	{:else if $baseBranch}
		{#if $mode?.type === 'OpenWorkspace' || $mode?.type === 'Edit'}
			<div class="view-wrap" role="group" ondragover={(e) => e.preventDefault()}>
				{#if $settingsStore?.featureFlags.v3}
					<Chrome {projectId}>
						{@render children()}
					</Chrome>
				{:else}
					<Navigation {projectId} />
					{@render children()}
				{/if}
				{#if $showHistoryView}
					<History onHide={() => ($showHistoryView = false)} />
				{/if}
			</div>
		{:else if $mode?.type === 'OutsideWorkspace'}
			<NotOnGitButlerBranch baseBranch={$baseBranch} />
		{/if}
	{/if}
{/key}

<!-- Mounting metrics reporter in the board ensures dependent services are subscribed to. -->
<MetricsReporter {projectId} {projectMetrics} />

<style>
	.view-wrap {
		position: relative;
		display: flex;
		width: 100%;
	}
</style>
