/* eslint-disable @typescript-eslint/no-use-before-define */
import { AllCardsService, CardIds } from '@firestone-hs/reference-data';
import { BoardEntity } from '../board-entity';
import { CardsData } from '../cards/cards-data';

export const applyGlobalModifiers = (
	board1: BoardEntity[],
	board2: BoardEntity[],
	data: CardsData,
	cards: AllCardsService,
): void => {
	// console.log('before applying global modifiers', board1, board2);
	const totalMurlocs =
		board1.map(entity => cards.getCard(entity.cardId).race).filter(race => race === 'MURLOC').length +
		board2.map(entity => cards.getCard(entity.cardId).race).filter(race => race === 'MURLOC').length;
	for (const entity of board1) {
		mapEntity(entity, totalMurlocs);
	}
	for (const entity of board2) {
		mapEntity(entity, totalMurlocs);
	}
};

export const removeGlobalModifiers = (board1: BoardEntity[], board2: BoardEntity[]): void => {
	for (const entity of board1) {
		removeGlobalModifiersForEntity(entity);
	}
	for (const entity of board2) {
		removeGlobalModifiersForEntity(entity);
	}
};

const removeGlobalModifiersForEntity = (entity: BoardEntity): void => {
	if (entity.previousAttack) {
		entity.attack = entity.previousAttack;
	}
	entity.previousAttack = undefined;
	entity.attacking = undefined;
	entity.lastAffectedByEntity = undefined;
};

const mapEntity = (entity: BoardEntity, totalMurlocs: number): void => {
	if (
		[CardIds.Collectible.Neutral.OldMurkEye, CardIds.NonCollectible.Neutral.OldMurkEyeTavernBrawl].indexOf(
			entity.cardId,
		) !== -1
	) {
		applyMurkeyeBuff(entity, totalMurlocs);
	}
};

const applyMurkeyeBuff = (entity: BoardEntity, totalMurlocs: number): void => {
	entity.previousAttack = entity.attack;
	entity.attack += totalMurlocs * (entity.cardId === CardIds.Collectible.Neutral.OldMurkEye ? 1 : 2);
};
