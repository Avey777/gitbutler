import type MentionSuggestions from '$lib/components/chat/MentionSuggestions.svelte';
import type { User } from '$lib/user/userService';
import type { UserSimple } from '@gitbutler/shared/users/types';
import type { UserService } from '@gitbutler/shared/users/userService';
import type MentionPlugin from '@gitbutler/ui/richText/plugins/Mention.svelte';
import type {
	MentionSuggestion,
	MentionSuggestionUpdate
} from '@gitbutler/ui/richText/plugins/Mention.svelte';

export default class SuggestionsHandler {
	private _isLoading = $state<boolean>(false);
	private _suggestions = $state<MentionSuggestion[]>();
	private _mentionSuggestions = $state<ReturnType<typeof MentionSuggestions>>();
	private _mentionPlugin = $state<ReturnType<typeof MentionPlugin>>();

	private userService: UserService | undefined;
	private chatParticipants: UserSimple[] | undefined;
	private currentUser: User | undefined;

	init(
		userService: UserService,
		chatParticipants: UserSimple[] | undefined,
		currentUser: User | undefined
	) {
		this.userService = userService;
		this.chatParticipants = chatParticipants;
		this.currentUser = currentUser;
	}

	reset() {
		this._suggestions = undefined;
	}

	private async searchUsers(query: string): Promise<UserSimple[]> {
		this._isLoading = true;
		const results = await this.userService?.searchUsers({
			query: {
				filters: [
					{
						field: 'login',
						operator: 'NOT_NULL'
					}
				],
				search_terms: [
					{
						value: query,
						operator: 'STARTS_WITH'
					}
				]
			}
		});

		this._isLoading = false;
		return results ?? [];
	}

	private async getSuggestionItemsForQuery(query: string): Promise<MentionSuggestion[]> {
		const results = await this.searchUsers(query);

		const users = results
			.map((item) => {
				if (!item.login) return undefined;
				if (item.login === this.currentUser?.login) return undefined;
				return { id: item.id.toString(), label: item.login };
			})
			.filter((item): item is MentionSuggestion => !!item);

		return users;
	}

	private async getInitialSuggestionItems(): Promise<MentionSuggestion[]> {
		const participants: UserSimple[] = this.chatParticipants ?? [];
		return participants
			.map((participant) => {
				if (!participant.login) return undefined;
				if (participant.login === this.currentUser?.login) return undefined;
				return { id: participant.id.toString(), label: participant.login };
			})
			.filter((item): item is MentionSuggestion => !!item);
	}

	async getSuggestionItems(query: string): Promise<MentionSuggestion[]> {
		if (query) {
			return await this.getSuggestionItemsForQuery(query);
		}
		return await this.getInitialSuggestionItems();
	}

	onSuggestionUpdate(props: MentionSuggestionUpdate) {
		this._suggestions = props.items;
	}

	onSuggestionExit() {
		this._suggestions = undefined;
	}

	onSuggestionKeyDown(event: KeyboardEvent): boolean {
		if (event.key === 'Escape') {
			this._suggestions = undefined;
			this._mentionPlugin?.exitSuggestions();
			return true;
		}

		if (event.key === 'Enter') {
			if (this._mentionSuggestions) {
				this._mentionSuggestions.onEnter();
			}

			event.preventDefault();
			event.stopPropagation();

			return true;
		}

		if (event.key === 'ArrowUp') {
			if (this._mentionSuggestions) {
				this._mentionSuggestions.onArrowUp();
			}
			return true;
		}

		if (event.key === 'ArrowDown') {
			if (this._mentionSuggestions) {
				this._mentionSuggestions.onArrowDown();
			}
			return true;
		}

		return false;
	}

	get isLoading() {
		return this._isLoading;
	}

	get suggestions() {
		return this._suggestions;
	}

	get mentionSuggestions() {
		return this._mentionSuggestions;
	}

	set mentionSuggestions(value: ReturnType<typeof MentionSuggestions> | undefined) {
		this._mentionSuggestions = value;
	}

	set mentionPlugin(value: ReturnType<typeof MentionPlugin> | undefined) {
		this._mentionPlugin = value;
	}

	selectSuggestion(suggestion: MentionSuggestion) {
		this._mentionPlugin?.selectMentionSuggestion(suggestion);
	}
}
