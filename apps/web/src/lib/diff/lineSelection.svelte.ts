import { copyToClipboard } from '@gitbutler/shared/clipboard';
import {
	readDiffLineKey,
	type DiffLineKey,
	type DiffFileHunkKey,
	createDiffFileHunkKey,
	createDiffLineKey,
	readDiffFileHunkKey,
	encodeDiffFileLine
} from '@gitbutler/ui/utils/diffParsing';
import { SvelteSet } from 'svelte/reactivity';
import type { DiffPatch } from '@gitbutler/shared/chat/types';
import type { LineClickParams } from '@gitbutler/ui/HunkDiff.svelte';
import type { ContentSection, DiffFileLineId, LineSelector } from '@gitbutler/ui/utils/diffParsing';

export interface DiffLineSelected extends LineSelector {
	index: number;
}

export interface DiffSelection {
	diffSha: string;
	fileName: string;
	hunkIndex: number;
	lines: DiffLineSelected[];
}

/**
 * Create a diff line selection string out of a diff patch array.
 *
 * @note - This function assumes that the diff patch array is an ordered & continues selection of lines.
 */
export function parseDiffPatchToEncodedSelection(
	fileName: string,
	diffPatchArray: DiffPatch[]
): DiffFileLineId | undefined {
	if (diffPatchArray.length === 0) return undefined;
	return encodeDiffFileLine(fileName, diffPatchArray[0].left, diffPatchArray[0].right);
}

function calculateSelectedLines(selectedDiffLines: SvelteSet<DiffLineKey>): DiffLineSelected[] {
	const parsedLines = Array.from(selectedDiffLines)
		.map((key) => readDiffLineKey(key))
		.filter((l): l is DiffLineSelected => !!l);

	if (parsedLines.length === 0) return [];
	if (parsedLines.length === 1)
		return [
			{
				...parsedLines[0],
				isFirstOfGroup: true,
				isLastOfGroup: true,
				isLast: true
			}
		];

	const sortedLines = parsedLines.sort((a, b) => a.index - b.index);
	const result: DiffLineSelected[] = [];

	for (let i = 0; i < sortedLines.length; i++) {
		const current = sortedLines[i];
		const prev = sortedLines[i - 1];
		const next = sortedLines[i + 1];

		const isFirstOfGroup = !prev || current.index - prev.index > 1;
		const isLastOfGroup = !next || next.index - current.index > 1;
		const isLast = i === sortedLines.length - 1;

		result.push({
			...current,
			isFirstOfGroup,
			isLastOfGroup,
			isLast
		});
	}
	return result;
}

export default class DiffLineSelection {
	private _quote = $state<boolean>(false);
	private _diffSha = $state<string>();
	private _selectedDiffLines = new SvelteSet<DiffLineKey>();
	private _selectedLines: DiffLineSelected[] = $derived(
		calculateSelectedLines(this._selectedDiffLines)
	);
	private _selectedDiffFileHunk = $state<DiffFileHunkKey>();

	clear() {
		this._selectedDiffLines.clear();
		this._selectedDiffFileHunk = undefined;
		this._diffSha = undefined;
		this._quote = false;
	}

	toggle(fileName: string, hunkIndex: number, diffSha: string, params: LineClickParams) {
		this._diffSha = diffSha;
		const diffFileHunkKey = createDiffFileHunkKey(fileName, hunkIndex);

		if (this._selectedDiffFileHunk !== diffFileHunkKey) {
			this._selectedDiffLines.clear();
			this._selectedDiffFileHunk = diffFileHunkKey;
		}

		const key = createDiffLineKey(params.index, params.oldLine, params.newLine);
		const isOnlyOneSelected =
			this._selectedDiffLines.size === 1 && this._selectedDiffLines.has(key);

		if (params.resetSelection && !isOnlyOneSelected) {
			this._selectedDiffLines.clear();
		}

		if (this._selectedDiffLines.has(key)) {
			this._selectedDiffLines.delete(key);
		} else {
			this._selectedDiffLines.add(key);
		}
	}

	quote() {
		this._quote = true;
	}

	copy(sections: ContentSection[]) {
		const selectedLines = this.selectedLines;
		if (selectedLines.length === 0) return;

		const flatSectionLines = sections.flatMap((section) => section.lines);

		const buffer: string[] = [];
		for (const line of selectedLines) {
			const sectionLine = flatSectionLines.find(
				(sectionLine) =>
					sectionLine.beforeLineNumber === line.oldLine &&
					sectionLine.afterLineNumber === line.newLine
			);

			if (!sectionLine) continue;

			buffer.push(sectionLine.content);
		}

		const copyString = buffer.join('\n');
		copyToClipboard(copyString);
	}

	get selectedLines() {
		return this._selectedLines;
	}

	get diffSelection(): DiffSelection | undefined {
		if (
			!this._quote ||
			!this._selectedDiffFileHunk ||
			this._selectedLines.length === 0 ||
			this._diffSha === undefined
		)
			return;

		const parsed = readDiffFileHunkKey(this._selectedDiffFileHunk);
		if (!parsed) return;
		const [fileName, hunkIndex] = parsed;

		return {
			diffSha: this._diffSha,
			fileName,
			hunkIndex,
			lines: this._selectedLines
		};
	}
}
