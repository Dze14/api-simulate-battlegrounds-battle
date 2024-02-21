import { CardIds } from '@firestone-hs/reference-data';
import { BgsPlayerEntity } from '../bgs-player-entity';
import { BoardEntity } from '../board-entity';
import { updateAvengeCounters } from './avenge';
import { FullGameState } from './internal-game-state';
import { onQuestProgressUpdated } from './quest';
import { removeMinionFromBoard } from './remove-minion-from-board';

export const makeMinionsDie = (
	board: BoardEntity[],
	boardHero: BgsPlayerEntity,
	otherBoard: BoardEntity[],
	otherBoardHero: BgsPlayerEntity,
	gameState: FullGameState,
): [number[], BoardEntity[]] => {
	// Because entities spawn to the left, so the right index is unchanged
	const deadMinionIndexesFromRight: number[] = [];
	const deadEntities: BoardEntity[] = [];
	const initialBoardLength = board.length;
	for (let i = 0; i < board.length; i++) {
		if (board[i].health <= 0 || board[i].definitelyDead) {
			deadMinionIndexesFromRight.push(initialBoardLength - (i + 1));
			deadEntities.push(board[i]);
			// console.log(
			// 	'\tflagging dead minion 0',
			// 	stringifySimpleCard(board[i], allCards),
			// 	stringifySimple(board, allCards),
			// 	initialBoardLength,
			// 	i,
			// 	deadMinionIndexesFromRight,
			// );
		}
	}

	// These will always be processed from left to right afterwards
	// We compute the indexes as they will be once the new board is effective. For a
	// board of length N, having an indexFromRight at N means it will spawn at the very left
	// of the board (first minion)
	let indexesFromRightAfterDeath = [];
	for (let i = deadMinionIndexesFromRight.length - 1; i >= 0; i--) {
		const newIndex = deadMinionIndexesFromRight[i] - indexesFromRightAfterDeath.length;
		indexesFromRightAfterDeath.push(newIndex);
	}
	indexesFromRightAfterDeath = indexesFromRightAfterDeath.reverse();

	for (let i = 0; i < board.length; i++) {
		if (board[i].health <= 0 || board[i].definitelyDead) {
			// console.log('\tflagging dead minion', stringifySimpleCard(board[i], allCards), deadMinionIndexesFromRight);
			removeMinionFromBoard(board, boardHero, i, gameState.allCards, gameState.spectator);
			// We modify the original array, so we need to update teh current index accordingly
			i--;
		}
	}

	// console.debug('dead entities', stringifySimple(deadEntities, allCards));
	// Update the avenge counters as soon as minions die. If we wait until the "avenge" phase, we might
	// update the counters for entities that have been spawned after the death of the original entity
	// ISSUE:
	// - Scallywag && another minion die at the same time
	// - Scallywag spawns a Sky Pirate
	// - This causes the Assemble a Lineup quest to complete with the Stable Amalgamation reward
	// - We need to count the other minion's death for the Avenge of reward, but NOT the Scallywag's?
	// See http://replays.firestoneapp.com/?reviewId=0ce4db9c-3269-4704-b662-8a8c31f5afe1&turn=16&action=27
	for (const deadEntity of deadEntities) {
		updateAvengeCounters(board, boardHero);
		onMinionDeadQuest(board, boardHero, otherBoard, otherBoardHero, gameState);
	}

	return [indexesFromRightAfterDeath, deadEntities];
};

export const onMinionDeadQuest = (
	board: BoardEntity[],
	boardHero: BgsPlayerEntity,
	otherBoard: BoardEntity[],
	otherBoardHero: BgsPlayerEntity,
	gameState: FullGameState,
) => {
	const quests = boardHero.questEntities ?? [];
	for (const quest of quests) {
		switch (quest.CardId) {
			case CardIds.ReenactTheMurder:
				onQuestProgressUpdated(boardHero, quest, board, gameState);
				break;
		}
	}

	const otherQuests = otherBoardHero.questEntities ?? [];
	for (const quest of otherQuests) {
		switch (quest.CardId) {
			case CardIds.RoundUpTheSuspects:
				onQuestProgressUpdated(otherBoardHero, quest, otherBoard, gameState);
				break;
		}
	}
};
