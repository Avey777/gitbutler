import { embedUserMention } from './mentions';
import { encodeLineSelection, type DiffSelection } from '$lib/diff/lineSelection.svelte';
import { ChatChannelsService } from '@gitbutler/shared/chat/chatChannelsService';
import type { EditorInstance } from '@gitbutler/ui/RichTextEditor.svelte';

export interface SendParams {
	issue?: boolean;
	diffSelection?: DiffSelection;
}

export default class MessageHandler {
	private _message = $state<string>();
	private _displayMessage = $state<string>();

	constructor(
		private chatChannelService: ChatChannelsService,
		private projectId: string,
		private branchId: string,
		private changeId: string
	) {}

	private updateMessage(editor: EditorInstance) {
		this._message = editor?.getText({
			textSerializers: {
				mention: ({ node }) => {
					const id = node.attrs.id;
					const username = node.attrs.label;
					if (!id) {
						return '@' + username;
					}

					return embedUserMention(id);
				}
			}
		});
	}

	private updateDisplayMessage(editor: EditorInstance) {
		this._displayMessage = editor?.getText({
			textSerializers: {
				mention: ({ node }) => {
					const username = node.attrs.label;
					return '@' + username;
				}
			}
		});
	}

	async send(params: SendParams) {
		if (this._message === undefined || this._message.trim() === '') {
			return;
		}

		const diffRange = params.diffSelection?.lines
			? encodeLineSelection(params.diffSelection.lines)
			: undefined;

		await this.chatChannelService.sendChatMessage({
			projectId: this.projectId,
			branchId: this.branchId,
			changeId: this.changeId,
			chat: this._message,
			displayableText: this._displayMessage,
			issue: params.issue,
			diffPath: params.diffSelection?.fileName,
			diffSha: params.diffSelection?.diffSha,
			range: diffRange
		});
	}

	update(editor: EditorInstance) {
		this.updateMessage(editor);
		this.updateDisplayMessage(editor);
	}

	get message() {
		return this._message;
	}

	get displayMessage() {
		return this._displayMessage;
	}
}
