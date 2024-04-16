import { BgsBattleInfo } from './bgs-battle-info';
import { BgsBoardInfo } from './bgs-board-info';
import { BoardEntity } from './board-entity';

// const cloneInput = (input: BgsBattleInfo): BgsBattleInfo => {
// 	return structuredClone(input);
// };
// const cloneInput2 = (input: string): BgsBattleInfo => {
// 	return JSON.parse(input);
// };

export const cloneInput3 = (input: BgsBattleInfo): BgsBattleInfo => {
	const result: BgsBattleInfo = {
		gameState: {
			currentTurn: input.gameState.currentTurn,
			anomalies: input.gameState.anomalies,
			validTribes: input.gameState.validTribes,
		},
		heroHasDied: input.heroHasDied,
		playerBoard: cloneBoard(input.playerBoard),
		opponentBoard: cloneBoard(input.opponentBoard),
		options: null,
	};
	return result;
};

const cloneBoard = (board: BgsBoardInfo): BgsBoardInfo => {
	const result: BgsBoardInfo = {
		player: {
			...board.player,
			questEntities: board.player.questEntities?.map((quest) => ({ ...quest })),
			questRewardEntities: board.player.questRewardEntities?.map((reward) => ({ ...reward })),
			questRewards: board.player.questRewards?.map((reward) => reward),
			hand: board.player.hand?.map((entity) => cloneEntity(entity)),
			secrets: board.player.secrets?.map((secret) => ({ ...secret })),
			globalInfo: { ...board.player.globalInfo },
		},
		board: board.board.map((entity) => cloneEntity(entity)),
	};
	return result;
};

const cloneEntity = (entity: BoardEntity): BoardEntity => {
	const result: BoardEntity = {
		...entity,
		enchantments: entity.enchantments?.map((enchant) => ({ ...enchant })),
	};
	return result;
};
