/* eslint-disable @typescript-eslint/no-use-before-define */
import { AllCardsService, CardIds } from '@firestone-hs/reference-data';
import { BoardEntity } from '../board-entity';
import { CardsData } from '../cards/cards-data';
import { bumpEntities, dealDamageToEnemy, dealDamageToRandomEnemy, processMinionDeath } from './attack';
import { spawnEntities } from './deathrattle-spawns';
import { SharedState } from './shared-state';

export const handleDeathrattleEffects = (
	boardWithDeadEntity: BoardEntity[],
	deadEntity: BoardEntity,
	deadMinionIndex: number,
	otherBoard: BoardEntity[],
	allCards: AllCardsService,
	cardsData: CardsData,
	sharedState: SharedState,
): void => {
	applyMinionDeathEffect(deadEntity, boardWithDeadEntity, otherBoard, allCards, cardsData, sharedState);

	const rivendare = boardWithDeadEntity.find(entity => entity.cardId === CardIds.Collectible.Neutral.BaronRivendare);
	const goldenRivendare = boardWithDeadEntity.find(
		entity => entity.cardId === CardIds.NonCollectible.Neutral.BaronRivendareTavernBrawl,
	);
	const multiplier = goldenRivendare ? 3 : rivendare ? 2 : 1;
	// We do it on a case by case basis so that we deal all the damage in one go for instance
	// and avoid proccing deathrattle spawns between the times the damage triggers
	switch (deadEntity.cardId) {
		case CardIds.Collectible.Paladin.SelflessHero:
			for (let i = 0; i < multiplier; i++) {
				grantRandomDivineShield(boardWithDeadEntity);
			}
			return;
		// return [boardWithDeadEntity, otherBoard];
		case CardIds.NonCollectible.Paladin.SelflessHeroTavernBrawl:
			for (let i = 0; i < multiplier; i++) {
				grantRandomDivineShield(boardWithDeadEntity);
				grantRandomDivineShield(boardWithDeadEntity);
			}
			return;
		// return [boardWithDeadEntity, otherBoard];
		case CardIds.NonCollectible.Neutral.NadinaTheRed:
			for (let i = 0; i < multiplier; i++) {
				grantAllDivineShield(boardWithDeadEntity, 'DRAGON', allCards);
			}
			return;
		// return [boardWithDeadEntity, otherBoard];
		case CardIds.Collectible.Neutral.SpawnOfNzoth:
			addStatsToBoard(boardWithDeadEntity, multiplier * 1, multiplier * 1, allCards);
			return;
		// return [boardWithDeadEntity, otherBoard];
		case CardIds.NonCollectible.Neutral.SpawnOfNzothTavernBrawl:
			addStatsToBoard(boardWithDeadEntity, multiplier * 2, multiplier * 2, allCards);
			// return [boardWithDeadEntity, otherBoard];
			return;
		case CardIds.NonCollectible.Neutral.GoldrinnTheGreatWolf:
			addStatsToBoard(boardWithDeadEntity, multiplier * 4, multiplier * 4, allCards, 'BEAST');
			return;
		// return [boardWithDeadEntity, otherBoard];
		case CardIds.NonCollectible.Neutral.GoldrinnTheGreatWolfTavernBrawl:
			addStatsToBoard(boardWithDeadEntity, multiplier * 8, multiplier * 8, allCards, 'BEAST');
			return;
		// return [boardWithDeadEntity, otherBoard];
		case CardIds.NonCollectible.Neutral.KingBagurgle:
			addStatsToBoard(boardWithDeadEntity, multiplier * 2, multiplier * 2, allCards, 'MURLOC');
			return;
		// return [boardWithDeadEntity, otherBoard];
		case CardIds.NonCollectible.Neutral.KingBagurgleTavernBrawl:
			addStatsToBoard(boardWithDeadEntity, multiplier * 4, multiplier * 4, allCards, 'MURLOC');
			return;
		// return [boardWithDeadEntity, otherBoard];
		case CardIds.Collectible.Warlock.FiendishServant:
			for (let i = 0; i < multiplier; i++) {
				grantRandomAttack(boardWithDeadEntity, deadEntity.attack);
			}
			return;
		// return [boardWithDeadEntity, otherBoard];
		case CardIds.NonCollectible.Warlock.FiendishServantTavernBrawl:
			for (let i = 0; i < multiplier; i++) {
				grantRandomAttack(boardWithDeadEntity, deadEntity.attack);
				grantRandomAttack(boardWithDeadEntity, deadEntity.attack);
			}
			return;
		// return [boardWithDeadEntity, otherBoard];
		case CardIds.Collectible.Neutral.KaboomBot:
			// FIXME: I don't think this way of doing things is really accurate (as some deathrattles
			// could be spawned between the shots firing), but let's say it's good enough for now
			for (let i = 0; i < multiplier; i++) {
				dealDamageToRandomEnemy(
					otherBoard,
					deadEntity,
					4,
					boardWithDeadEntity,
					allCards,
					cardsData,
					sharedState,
				);
			}
			return;
		// console.log('after damage from bot', opponentBoard, board);
		// return [boardWithDeadEntity, otherBoard];
		case CardIds.NonCollectible.Neutral.KaboomBotTavernBrawl:
			for (let i = 0; i < multiplier; i++) {
				dealDamageToRandomEnemy(
					otherBoard,
					deadEntity,
					4,
					boardWithDeadEntity,
					allCards,
					cardsData,
					sharedState,
				);
				dealDamageToRandomEnemy(
					otherBoard,
					deadEntity,
					4,
					boardWithDeadEntity,
					allCards,
					cardsData,
					sharedState,
				);
			}
			return;
		// return [boardWithDeadEntity, otherBoard];
	}
	// return [boardWithDeadEntity, otherBoard];
};

const addStatsToBoard = (
	board: BoardEntity[],
	attack: number,
	health: number,
	allCards: AllCardsService,
	tribe?: string,
): void => {
	for (const entity of board) {
		if (!tribe || allCards.getCard(entity.cardId).race === tribe) {
			entity.attack += attack;
			entity.health += health;
			// return {
			// 	...entity,
			// 	attack: entity.attack + attack,
			// 	health: entity.health + health,
			// };
		}
	}
	// return board.map(entity => {
	// 	if (!tribe || allCards.getCard(entity.cardId).race === tribe) {
	// 		return {
	// 			...entity,
	// 			attack: entity.attack + attack,
	// 			health: entity.health + health,
	// 		};
	// 	}
	// 	return entity;
	// });
};

const applyMinionDeathEffect = (
	deadEntity: BoardEntity,
	boardWithDeadEntity: BoardEntity[],
	otherBoard: BoardEntity[],
	allCards: AllCardsService,
	cardsData: CardsData,
	sharedState: SharedState,
): void => {
	if (allCards.getCard(deadEntity.cardId).race === 'BEAST') {
		applyScavengingHyenaEffect(boardWithDeadEntity);
	}
	if (allCards.getCard(deadEntity.cardId).race === 'DEMON') {
		// console.log('will apply juggler effect', deadEntity, boardWithDeadEntity, otherBoard);
		applySoulJugglerEffect(boardWithDeadEntity, otherBoard, allCards, cardsData, sharedState);
	}
	if (allCards.getCard(deadEntity.cardId).race === 'MECH') {
		applyJunkbotEffect(boardWithDeadEntity);
	}
	// Overkill
	// console.log('is there overkill?', deadEntity);
	if (deadEntity.health < 0 && deadEntity.lastAffectedByEntity.attacking) {
		// console.log('overkill', deadEntity);
		if (deadEntity.lastAffectedByEntity.cardId === CardIds.NonCollectible.Warrior.HeraldOfFlameBATTLEGROUNDS) {
			const targets = boardWithDeadEntity.filter(entity => entity.health > 0);
			if (targets.length > 0) {
				const target = targets[0];
				// console.log('hof target', target);
				dealDamageToEnemy(
					target,
					boardWithDeadEntity,
					deadEntity.lastAffectedByEntity,
					3,
					otherBoard,
					allCards,
					cardsData,
					sharedState,
				);
				// console.log('board after overkill handling', boardWithDeadEntity);
			}
		} else if (deadEntity.lastAffectedByEntity.cardId === CardIds.NonCollectible.Warrior.HeraldOfFlameTavernBrawl) {
			const targets = boardWithDeadEntity.filter(entity => entity.health > 0);
			if (targets.length > 0) {
				const target = targets[0];
				dealDamageToEnemy(
					target,
					boardWithDeadEntity,
					deadEntity.lastAffectedByEntity,
					6,
					otherBoard,
					allCards,
					cardsData,
					sharedState,
				);
			}
		} else if (deadEntity.lastAffectedByEntity.cardId === CardIds.Collectible.Druid.IronhideDirehorn) {
			// console.log('will apply direhorn overkill', deadEntity, otherBoard);
			const index = otherBoard.map(e => e.entityId).indexOf(deadEntity.entityId);
			const newEntities = spawnEntities(
				CardIds.NonCollectible.Druid.IronhideDirehorn_IronhideRuntToken,
				1,
				otherBoard,
				allCards,
				sharedState,
				true,
			);
			// const updatedBoard = [...otherBoard];
			otherBoard.splice(index, 0, ...newEntities);
			// otherBoard = updatedBoard;
		} else if (
			deadEntity.lastAffectedByEntity.cardId === CardIds.NonCollectible.Druid.IronhideDirehornTavernBrawl
		) {
			const index = otherBoard.map(e => e.entityId).indexOf(deadEntity.entityId);
			const newEntities = spawnEntities(
				CardIds.NonCollectible.Druid.IronhideDirehorn_IronhideRuntTokenTavernBrawl,
				1,
				otherBoard,
				allCards,
				sharedState,
				true,
			);
			// const updatedBoard = [...otherBoard];
			otherBoard.splice(index, 0, ...newEntities);
			// otherBoard = updatedBoard;
		}
	}

	const rivendare = boardWithDeadEntity.find(entity => entity.cardId === CardIds.Collectible.Neutral.BaronRivendare);
	const goldenRivendare = boardWithDeadEntity.find(
		entity => entity.cardId === CardIds.NonCollectible.Neutral.BaronRivendareTavernBrawl,
	);
	const multiplier = goldenRivendare ? 3 : rivendare ? 2 : 1;
	if (deadEntity.cardId === CardIds.Collectible.Neutral.UnstableGhoul) {
		dealDamageToAllMinions(
			boardWithDeadEntity,
			otherBoard,
			deadEntity,
			multiplier * 1,
			allCards,
			cardsData,
			sharedState,
		);
	} else if (deadEntity.cardId === CardIds.NonCollectible.Neutral.UnstableGhoulTavernBrawl) {
		dealDamageToAllMinions(
			boardWithDeadEntity,
			otherBoard,
			deadEntity,
			multiplier * 2,
			allCards,
			cardsData,
			sharedState,
		);
	}
	// return [boardWithDeadEntity, otherBoard];
};

const dealDamageToAllMinions = (
	board1: BoardEntity[],
	board2: BoardEntity[],
	damageSource: BoardEntity,
	damageDealt: number,
	allCards: AllCardsService,
	cardsData: CardsData,
	sharedState: SharedState,
): void => {
	if (board1.length === 0 && board2.length === 0) {
		return;
		// return [board1, board2];
	}
	// let updatedBoard1 = [...board1];
	// let updatedBoard2 = [...board2];
	const fakeAttacker = {
		...damageSource,
		attack: damageDealt,
		attacking: true,
	} as BoardEntity;
	for (let i = 0; i < board1.length; i++) {
		bumpEntities(board1[i], fakeAttacker, board1, allCards, cardsData, sharedState);
		// board1[i] = entity;
	}
	for (let i = 0; i < board2.length; i++) {
		bumpEntities(board2[i], fakeAttacker, board2, allCards, cardsData, sharedState);
		// updatedBoard2 = [...boardResult];
		// updatedBoard2[i] = entity;
	}
	processMinionDeath(board1, board2, allCards, cardsData, sharedState);
};

const applySoulJugglerEffect = (
	boardWithJugglers: BoardEntity[],
	boardToAttack: BoardEntity[],
	allCards: AllCardsService,
	cardsData: CardsData,
	sharedState: SharedState,
): void => {
	if (boardWithJugglers.length === 0 && boardToAttack.length === 0) {
		return;
		// return [boardWithJugglers, boardToAttack];
	}
	const jugglers = boardWithJugglers.filter(entity => entity.cardId === CardIds.NonCollectible.Warlock.SoulJuggler);
	// console.log('jugglers in board', boardWithJugglers);
	for (const juggler of jugglers) {
		dealDamageToRandomEnemy(boardToAttack, juggler, 3, boardWithJugglers, allCards, cardsData, sharedState);
	}
	const goldenJugglers = boardWithJugglers.filter(
		entity => entity.cardId === CardIds.NonCollectible.Warlock.SoulJugglerTavernBrawl,
	);
	// console.log('golden jugglers in board', boardWithJugglers);
	for (const juggler of goldenJugglers) {
		dealDamageToRandomEnemy(boardToAttack, juggler, 3, boardWithJugglers, allCards, cardsData, sharedState);
		dealDamageToRandomEnemy(boardToAttack, juggler, 3, boardWithJugglers, allCards, cardsData, sharedState);
	}
	processMinionDeath(boardWithJugglers, boardToAttack, allCards, cardsData, sharedState);
};

const applyScavengingHyenaEffect = (board: BoardEntity[]): void => {
	// const copy = [...board];
	for (let i = 0; i < board.length; i++) {
		if (board[i].cardId === CardIds.Collectible.Hunter.ScavengingHyena) {
			board[i].attack += 2;
			board[i].health += 1;
		} else if (board[i].cardId === CardIds.NonCollectible.Hunter.ScavengingHyenaTavernBrawl) {
			board[i].attack += 4;
			board[i].health += 2;
		}
	}
};

const applyJunkbotEffect = (board: BoardEntity[]): void => {
	for (let i = 0; i < board.length; i++) {
		if (board[i].cardId === CardIds.Collectible.Neutral.Junkbot) {
			board[i].attack += 2;
			board[i].health += 2;
		} else if (board[i].cardId === CardIds.NonCollectible.Neutral.JunkbotTavernBrawl) {
			board[i].attack += 4;
			board[i].health += 4;
		}
	}
};

const grantRandomAttack = (board: BoardEntity[], additionalAttack: number): void => {
	if (board.length > 0) {
		const chosen = board[Math.floor(Math.random() * board.length)];
		chosen.attack += additionalAttack;
	}
};

const grantRandomDivineShield = (board: BoardEntity[]): void => {
	const elligibleEntities = board.filter(entity => !entity.divineShield);
	if (elligibleEntities.length > 0) {
		const chosen = elligibleEntities[Math.floor(Math.random() * elligibleEntities.length)];
		chosen.divineShield = true;
	}
	// return board;
};

const grantAllDivineShield = (board: BoardEntity[], tribe: string, cards: AllCardsService): void => {
	const elligibleEntities = board
		.filter(entity => !entity.divineShield)
		.filter(entity => cards.getCard(entity.cardId).race === tribe);
	for (const entity of elligibleEntities) {
		entity.divineShield = true;
	}
	// return board;
};
