/* eslint-disable @typescript-eslint/no-use-before-define */
import { AllCardsService, CardIds, Race } from '@firestone-hs/reference-data';
import { BgsPlayerEntity } from '../bgs-player-entity';
import { BoardEntity } from '../board-entity';
import { CardsData } from '../cards/cards-data';
import { getRaceEnum, isCorrectTribe, stringifySimple, stringifySimpleCard } from '../utils';
import { bumpEntities, dealDamageToEnemy, dealDamageToRandomEnemy, getNeighbours, processMinionDeath } from './attack';
import { spawnEntities } from './deathrattle-spawns';
import { SharedState } from './shared-state';
import { Spectator } from './spectator/spectator';

export const handleDeathrattleEffects = (
	boardWithDeadEntity: BoardEntity[],
	boardWithDeadEntityHero: BgsPlayerEntity,
	deadEntity: BoardEntity,
	deadMinionIndex: number,
	otherBoard: BoardEntity[],
	otherBoardHero: BgsPlayerEntity,
	allCards: AllCardsService,
	cardsData: CardsData,
	sharedState: SharedState,
	spectator: Spectator,
): void => {
	if (deadMinionIndex >= 0) {
		applyMinionDeathEffect(
			deadEntity,
			deadMinionIndex,
			boardWithDeadEntity,
			boardWithDeadEntityHero,
			otherBoard,
			otherBoardHero,
			allCards,
			cardsData,
			sharedState,
			spectator,
		);
	}

	const rivendare = boardWithDeadEntity.find((entity) => entity.cardId === CardIds.Collectible.Neutral.BaronRivendare);
	const goldenRivendare = boardWithDeadEntity.find(
		(entity) => entity.cardId === CardIds.NonCollectible.Neutral.BaronRivendareTavernBrawl,
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
			addStatsToBoard(boardWithDeadEntity, multiplier * 5, multiplier * 4, allCards, 'BEAST');
			return;
		// return [boardWithDeadEntity, otherBoard];
		case CardIds.NonCollectible.Neutral.GoldrinnTheGreatWolfTavernBrawl:
			addStatsToBoard(boardWithDeadEntity, multiplier * 10, multiplier * 8, allCards, 'BEAST');
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
				if (sharedState.debug) {
					console.debug('dealing kaboom bot damage\n', stringifySimpleCard(deadEntity) + '\n', stringifySimple(otherBoard));
				}
				dealDamageToRandomEnemy(
					otherBoard,
					otherBoardHero,
					deadEntity,
					4,
					boardWithDeadEntity,
					boardWithDeadEntityHero,
					allCards,
					cardsData,
					sharedState,
					spectator,
				);
				if (sharedState.debug) {
					console.debug('dealt kaboom bot damage\n', stringifySimpleCard(deadEntity) + '\n', stringifySimple(otherBoard));
				}
			}
			return;
		// console.log('after damage from bot', opponentBoard, board);
		// return [boardWithDeadEntity, otherBoard];
		case CardIds.NonCollectible.Neutral.KaboomBotTavernBrawl:
			for (let i = 0; i < multiplier; i++) {
				dealDamageToRandomEnemy(
					otherBoard,
					otherBoardHero,
					deadEntity,
					4,
					boardWithDeadEntity,
					boardWithDeadEntityHero,
					allCards,
					cardsData,
					sharedState,
					spectator,
				);
				dealDamageToRandomEnemy(
					otherBoard,
					otherBoardHero,
					deadEntity,
					4,
					boardWithDeadEntity,
					boardWithDeadEntityHero,
					allCards,
					cardsData,
					sharedState,
					spectator,
				);
			}
			return;
	}
};

const addStatsToBoard = (board: BoardEntity[], attack: number, health: number, allCards: AllCardsService, tribe?: string): void => {
	for (const entity of board) {
		if (!tribe || isCorrectTribe(allCards.getCard(entity.cardId).race, Race[tribe])) {
			entity.attack += attack;
			entity.previousAttack += attack;
			entity.health += health;
		}
	}
};

const applyMinionDeathEffect = (
	deadEntity: BoardEntity,
	deadEntityIndex: number,
	boardWithDeadEntity: BoardEntity[],
	boardWithDeadEntityHero: BgsPlayerEntity,
	otherBoard: BoardEntity[],
	otherBoardHero: BgsPlayerEntity,
	allCards: AllCardsService,
	cardsData: CardsData,
	sharedState: SharedState,
	spectator: Spectator,
): void => {
	if (isCorrectTribe(allCards.getCard(deadEntity.cardId).race, Race.BEAST)) {
		applyScavengingHyenaEffect(boardWithDeadEntity);
	}
	if (isCorrectTribe(allCards.getCard(deadEntity.cardId).race, Race.DEMON)) {
		// console.log('will apply juggler effect', deadEntity, boardWithDeadEntity, otherBoard);
		applySoulJugglerEffect(
			boardWithDeadEntity,
			boardWithDeadEntityHero,
			otherBoard,
			otherBoardHero,
			allCards,
			cardsData,
			sharedState,
			spectator,
		);
	}
	if (isCorrectTribe(allCards.getCard(deadEntity.cardId).race, Race.MECH)) {
		applyJunkbotEffect(boardWithDeadEntity);
	}
	if (deadEntity.taunt) {
		applyQirajiHarbringerEffect(boardWithDeadEntity, deadEntityIndex);
	}
	// Overkill
	if (deadEntity.health < 0 && deadEntity.lastAffectedByEntity.attacking) {
		if (deadEntity.lastAffectedByEntity.cardId === CardIds.NonCollectible.Warrior.HeraldOfFlameBATTLEGROUNDS) {
			const targets = boardWithDeadEntity.filter((entity) => entity.health > 0);
			if (targets.length > 0) {
				const target = targets[0];
				dealDamageToEnemy(
					target,
					boardWithDeadEntity,
					boardWithDeadEntityHero,
					deadEntity.lastAffectedByEntity,
					3,
					otherBoard,
					otherBoardHero,
					allCards,
					cardsData,
					sharedState,
					spectator,
				);
			}
		} else if (deadEntity.lastAffectedByEntity.cardId === CardIds.NonCollectible.Warrior.HeraldOfFlameTavernBrawl) {
			const targets = boardWithDeadEntity.filter((entity) => entity.health > 0);
			if (targets.length > 0) {
				const target = targets[0];
				dealDamageToEnemy(
					target,
					boardWithDeadEntity,
					boardWithDeadEntityHero,
					deadEntity.lastAffectedByEntity,
					6,
					otherBoard,
					otherBoardHero,
					allCards,
					cardsData,
					sharedState,
					spectator,
				);
			}
		} else if (deadEntity.lastAffectedByEntity.cardId === CardIds.NonCollectible.Neutral.WildfireElemental) {
			const excessDamage = -deadEntity.health;
			const neighbours = getNeighbours(boardWithDeadEntity, null, deadEntityIndex);
			if (neighbours.length > 0) {
				const randomTarget = neighbours[Math.floor(Math.random() * neighbours.length)];
				dealDamageToEnemy(
					randomTarget,
					boardWithDeadEntity,
					boardWithDeadEntityHero,
					null,
					excessDamage,
					otherBoard,
					otherBoardHero,
					allCards,
					cardsData,
					sharedState,
					spectator,
				);
			}
		} else if (deadEntity.lastAffectedByEntity.cardId === CardIds.NonCollectible.Neutral.WildfireElementalTavernBrawl) {
			const excessDamage = -deadEntity.health;
			const neighbours = getNeighbours(boardWithDeadEntity, null, deadEntityIndex);
			neighbours.forEach((neighbour) =>
				dealDamageToEnemy(
					neighbour,
					boardWithDeadEntity,
					boardWithDeadEntityHero,
					null,
					excessDamage,
					otherBoard,
					otherBoardHero,
					allCards,
					cardsData,
					sharedState,
					spectator,
				),
			);
		} else if (deadEntity.lastAffectedByEntity.cardId === CardIds.Collectible.Druid.IronhideDirehorn) {
			const newEntities = spawnEntities(
				CardIds.NonCollectible.Druid.IronhideDirehorn_IronhideRuntToken,
				1,
				otherBoard,
				otherBoardHero,
				allCards,
				sharedState,
				!deadEntity.friendly,
				true,
			);
			otherBoard.splice(deadEntityIndex, 0, ...newEntities);
		} else if (deadEntity.lastAffectedByEntity.cardId === CardIds.NonCollectible.Druid.IronhideDirehornTavernBrawl) {
			const newEntities = spawnEntities(
				CardIds.NonCollectible.Druid.IronhideDirehorn_IronhideRuntTokenTavernBrawl,
				1,
				otherBoard,
				otherBoardHero,
				allCards,
				sharedState,
				!deadEntity.friendly,
				true,
			);
			otherBoard.splice(deadEntityIndex, 0, ...newEntities);
		} else if (deadEntity.lastAffectedByEntity.cardId === CardIds.NonCollectible.Neutral.SeabreakerGoliathBATTLEGROUNDS) {
			const otherPirates = otherBoard
				.filter((entity) => isCorrectTribe(allCards.getCard(entity.cardId).race, Race.PIRATE))
				.filter((entity) => entity.entityId !== deadEntity.lastAffectedByEntity.entityId);
			otherPirates.forEach((pirate) => {
				pirate.attack += 2;
				pirate.health += 2;
			});
		} else if (deadEntity.lastAffectedByEntity.cardId === CardIds.NonCollectible.Neutral.SeabreakerGoliathTavernBrawl) {
			const otherPirates = otherBoard
				.filter((entity) => isCorrectTribe(allCards.getCard(entity.cardId).race, Race.PIRATE))
				.filter((entity) => entity.entityId !== deadEntity.lastAffectedByEntity.entityId);
			otherPirates.forEach((pirate) => {
				pirate.attack += 4;
				pirate.health += 4;
			});
		}
		// else if (deadEntity.lastAffectedByEntity.cardId === CardIds.NonCollectible.Neutral.NatPagleExtremeAngler) {
		// }
	}

	const rivendare = boardWithDeadEntity.find((entity) => entity.cardId === CardIds.Collectible.Neutral.BaronRivendare);
	const goldenRivendare = boardWithDeadEntity.find(
		(entity) => entity.cardId === CardIds.NonCollectible.Neutral.BaronRivendareTavernBrawl,
	);
	const multiplier = goldenRivendare ? 3 : rivendare ? 2 : 1;
	if (deadEntity.cardId === CardIds.Collectible.Neutral.UnstableGhoul) {
		dealDamageToAllMinions(
			boardWithDeadEntity,
			boardWithDeadEntityHero,
			otherBoard,
			otherBoardHero,
			deadEntity,
			multiplier * 1,
			allCards,
			cardsData,
			sharedState,
			spectator,
		);
	} else if (deadEntity.cardId === CardIds.NonCollectible.Neutral.UnstableGhoulTavernBrawl) {
		dealDamageToAllMinions(
			boardWithDeadEntity,
			boardWithDeadEntityHero,
			otherBoard,
			otherBoardHero,
			deadEntity,
			multiplier * 2,
			allCards,
			cardsData,
			sharedState,
			spectator,
		);
	}
	// return [boardWithDeadEntity, otherBoard];
};

export const dealDamageToAllMinions = (
	board1: BoardEntity[],
	board1Hero: BgsPlayerEntity,
	board2: BoardEntity[],
	board2Hero: BgsPlayerEntity,
	damageSource: BoardEntity,
	damageDealt: number,
	allCards: AllCardsService,
	cardsData: CardsData,
	sharedState: SharedState,
	spectator: Spectator,
): void => {
	if (board1.length === 0 && board2.length === 0) {
		return;
		// return [board1, board2];
	}
	// let updatedBoard1 = [...board1];
	// let updatedBoard2 = [...board2];
	const fakeAttacker = {
		...(damageSource || {}),
		entityId: -1,
		attack: damageDealt,
		attacking: true,
	} as BoardEntity;
	for (let i = 0; i < board1.length; i++) {
		bumpEntities(board1[i], fakeAttacker, board1, board1Hero, allCards, cardsData, sharedState, spectator);
		// board1[i] = entity;
	}
	for (let i = 0; i < board2.length; i++) {
		bumpEntities(board2[i], fakeAttacker, board2, board2Hero, allCards, cardsData, sharedState, spectator);
		// updatedBoard2 = [...boardResult];
		// updatedBoard2[i] = entity;
	}
	processMinionDeath(board1, board1Hero, board2, board2Hero, allCards, cardsData, sharedState, spectator);
};

const applySoulJugglerEffect = (
	boardWithJugglers: BoardEntity[],
	boardWithJugglersHero: BgsPlayerEntity,
	boardToAttack: BoardEntity[],
	boardToAttackHero: BgsPlayerEntity,
	allCards: AllCardsService,
	cardsData: CardsData,
	sharedState: SharedState,
	spectator: Spectator,
): void => {
	if (boardWithJugglers.length === 0 && boardToAttack.length === 0) {
		return;
		// return [boardWithJugglers, boardToAttack];
	}
	const jugglers = boardWithJugglers.filter((entity) => entity.cardId === CardIds.NonCollectible.Warlock.SoulJuggler);
	// console.log('jugglers in board', boardWithJugglers);
	for (const juggler of jugglers) {
		dealDamageToRandomEnemy(
			boardToAttack,
			boardToAttackHero,
			juggler,
			3,
			boardWithJugglers,
			boardWithJugglersHero,
			allCards,
			cardsData,
			sharedState,
			spectator,
		);
	}
	const goldenJugglers = boardWithJugglers.filter((entity) => entity.cardId === CardIds.NonCollectible.Warlock.SoulJugglerTavernBrawl);
	// console.log('golden jugglers in board', boardWithJugglers);
	for (const juggler of goldenJugglers) {
		dealDamageToRandomEnemy(
			boardToAttack,
			boardToAttackHero,
			juggler,
			3,
			boardWithJugglers,
			boardWithJugglersHero,
			allCards,
			cardsData,
			sharedState,
			spectator,
		);
		dealDamageToRandomEnemy(
			boardToAttack,
			boardToAttackHero,
			juggler,
			3,
			boardWithJugglers,
			boardWithJugglersHero,
			allCards,
			cardsData,
			sharedState,
			spectator,
		);
	}
	processMinionDeath(
		boardWithJugglers,
		boardWithJugglersHero,
		boardToAttack,
		boardToAttackHero,
		allCards,
		cardsData,
		sharedState,
		spectator,
	);
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

const applyQirajiHarbringerEffect = (board: BoardEntity[], deadEntityIndex: number): void => {
	const qiraji = board.filter((entity) => entity.cardId === CardIds.NonCollectible.Neutral.QirajiHarbinger);
	const goldenQiraji = board.filter((entity) => entity.cardId === CardIds.NonCollectible.Neutral.QirajiHarbingerTavernBrawl);
	if (qiraji.length === 0 && goldenQiraji.length === 0) {
		return;
	}

	const neighbours = getNeighbours(board, null, deadEntityIndex);
	if (SharedState.debugEnabled) {
		console.debug('neighbours', stringifySimple(neighbours), stringifySimple(board), deadEntityIndex);
	}
	neighbours.forEach((entity) => {
		entity.attack += 2 * qiraji.length + 4 * goldenQiraji.length;
		entity.health += 2 * qiraji.length + 4 * goldenQiraji.length;
	});
};

const grantRandomAttack = (board: BoardEntity[], additionalAttack: number): void => {
	if (board.length > 0) {
		const chosen = board[Math.floor(Math.random() * board.length)];
		chosen.attack += additionalAttack;
	}
};

const grantRandomDivineShield = (board: BoardEntity[]): void => {
	const elligibleEntities = board.filter((entity) => !entity.divineShield);
	if (elligibleEntities.length > 0) {
		const chosen = elligibleEntities[Math.floor(Math.random() * elligibleEntities.length)];
		chosen.divineShield = true;
	}
	// return board;
};

const grantAllDivineShield = (board: BoardEntity[], tribe: string, cards: AllCardsService): void => {
	const elligibleEntities = board
		.filter((entity) => !entity.divineShield)
		.filter((entity) => isCorrectTribe(cards.getCard(entity.cardId).race, getRaceEnum(tribe)));
	for (const entity of elligibleEntities) {
		entity.divineShield = true;
	}
	// return board;
};

export const rememberDeathrattles = (fish: BoardEntity, deadEntities: readonly BoardEntity[], cardsData: CardsData) => {
	const validDeathrattles = deadEntities
		.filter((entity) => cardsData.validDeathrattles.includes(entity.cardId))
		.map((entity) => entity.cardId);
	const validEnchantments = deadEntities
		// eslint-disable-next-line prettier/prettier
		.filter((entity) => entity.enchantments?.length)
		.map((entity) => entity.enchantments)
		.reduce((a, b) => a.concat(b), [])
		.map((enchantment) => enchantment.cardId)
		.filter((enchantmentId) =>
			[
				CardIds.NonCollectible.Neutral.ReplicatingMenace_ReplicatingMenaceEnchantment,
				CardIds.NonCollectible.Neutral.ReplicatingMenace_ReplicatingMenaceEnchantmentTavernBrawl,
				CardIds.NonCollectible.Neutral.LivingSporesToken2,
			].includes(enchantmentId),
		);
	if (SharedState.debugEnabled) {
		console.debug('remembering deathrattles', fish.cardId, stringifySimple(deadEntities), validDeathrattles, validEnchantments);
	}
	const newDeathrattles = [...validDeathrattles, ...validEnchantments];
	// Order is important
	if (fish.cardId === CardIds.NonCollectible.Neutral.FishOfNzothTavernBrawl) {
		// https://stackoverflow.com/questions/33305152/how-to-duplicate-elements-in-a-js-array
		const doubleDr = [...validDeathrattles, ...validEnchantments].reduce((res, current) => res.concat([current, current]), []);
		fish.rememberedDeathrattles = [...doubleDr, ...(fish.rememberedDeathrattles || [])];
	} else {
		fish.rememberedDeathrattles = [...newDeathrattles, ...(fish.rememberedDeathrattles || [])];
	}
};
