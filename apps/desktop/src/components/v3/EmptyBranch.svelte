<script lang="ts">
	import { getColorFromBranchType } from '$components/v3/lib';

	interface Props {
		lastBranch?: boolean;
	}

	const { lastBranch }: Props = $props();
</script>

<div class="empty-series" style:--commit-color={getColorFromBranchType('LocalOnly')}>
	<div class="commit-line" class:dashed={lastBranch}></div>
	<div class="text-13 text-body empty-series__label">
		This is an empty branch.
		<br />
		Create or drag & drop commits here.
	</div>
</div>

<style lang="postcss">
	.empty-series {
		position: relative;
		display: flex;
	}
	.empty-series__label {
		color: var(--clr-text-2);
		width: 100%;
		padding: 20px 28px 26px 46px;
		opacity: 0.6;
	}
	.commit-line {
		position: absolute;
		left: 20px;
	}
</style>
