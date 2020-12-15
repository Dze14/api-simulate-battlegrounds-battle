/* eslint-disable @typescript-eslint/no-use-before-define */
import { AllCardsService, CardIds, Race } from '@firestone-hs/reference-data';
import { ReferenceCard } from '@firestone-hs/reference-data/lib/models/reference-cards/reference-card';
import { BoardEntity } from './board-entity';

const CLEAVE_IDS = [
	CardIds.Collectible.Hunter.CaveHydra,
	CardIds.NonCollectible.Hunter.CaveHydraTavernBrawl,
	CardIds.Collectible.Neutral.FoeReaper4000,
	CardIds.NonCollectible.Neutral.FoeReaper4000TavernBrawl,
];
// Because for some reason, the Taunt keyword is only a referenced tag,
// so we have to know when a taunt minion is spawned (the taunt tag
// is passed in input properly, so it's not an issue there)
const TAUNT_IDS = [
	CardIds.NonCollectible.Neutral.YoHoOgre,
	CardIds.NonCollectible.Neutral.YoHoOgreTavernBrawl,
	CardIds.NonCollectible.Warrior.SecurityRover_GuardBotToken,
	CardIds.NonCollectible.Warrior.SecurityRover_GuardBotTokenTavernBrawl,
	CardIds.NonCollectible.Neutral.MoltenRock,
	CardIds.NonCollectible.Neutral.MoltenRockTavernBrawl,
	CardIds.NonCollectible.Neutral.LieutenantGarr,
	CardIds.NonCollectible.Neutral.LieutenantGarrTavernBrawl,
	CardIds.NonCollectible.Neutral.GentleDjinni,
	CardIds.NonCollectible.Neutral.GentleDjinniTavernBrawl,	
	CardIds.NonCollectible.Neutral.AcolyteOfCthun,	
	CardIds.NonCollectible.Neutral.AcolyteOfCthunTavernBrawl,	
]
const ATTACK_IMMEDIATELY_IDS = [
	CardIds.NonCollectible.Rogue.Scallywag_SkyPirateToken,
	CardIds.NonCollectible.Rogue.Scallywag_SkyPirateTokenTavernBrawl,
];
export const MEGA_WINDFURY_IDS = [CardIds.NonCollectible.Neutral.ZappSlywickTavernBrawl, CardIds.NonCollectible.Neutral.CracklingCycloneTavernBrawl];
const CANT_ATTACK_IDS = [
	CardIds.NonCollectible.Neutral.ArcaneCannon,
	CardIds.NonCollectible.Neutral.ArcaneCannonTavernBrawl,
];

export const buildSingleBoardEntity = (
	cardId: string,
	allCards: AllCardsService,
	friendly: boolean,
	entityId = 1,
): BoardEntity => {
	const card = allCards.getCard(cardId);
	const megaWindfury = MEGA_WINDFURY_IDS.indexOf(cardId) !== -1;
	const attackImmediately = ATTACK_IMMEDIATELY_IDS.indexOf(cardId) !== -1;
	return addImpliedMechanics({
		attack: card.attack,
		attacksPerformed: 0,
		cardId: cardId,
		divineShield: hasMechanic(card, 'DIVINE_SHIELD'),
		entityId: entityId,
		health: card.health,
		taunt: hasMechanic(card, 'TAUNT') || TAUNT_IDS.includes(cardId),
		reborn: hasMechanic(card, 'REBORN'),
		poisonous: hasMechanic(card, 'POISONOUS'),
		windfury: !megaWindfury && (hasMechanic(card, 'WINDFURY') || card.referencedTags?.includes('WINDFURY')),
		megaWindfury: megaWindfury,
		enchantments: [],
		friendly: friendly,
		attackImmediately: attackImmediately,
	} as BoardEntity);
};

export const hasMechanic = (card: ReferenceCard, mechanic: string): boolean => {
	return card.mechanics?.includes(mechanic);
}

export const isCorrectTribe = (cardRace: string, targetTribe: Race): boolean => {
	return getRaceEnum(cardRace) === Race.ALL || getRaceEnum(cardRace) === targetTribe;
}

export const getRaceEnum = (race: string): Race => {
	return Race[race];
}

export const addImpliedMechanics = (entity: BoardEntity): BoardEntity => {
	return {
		...entity,
		cleave: CLEAVE_IDS.indexOf(entity.cardId) !== -1,
		cantAttack: CANT_ATTACK_IDS.indexOf(entity.cardId) !== -1,
	} as BoardEntity;
};

export const stringifySimple = (board: readonly BoardEntity[]): string => {
	return '[' + board.map(entity => stringifySimpleCard(entity)).join(', ') + ']';
};

export const stringifySimpleCard = (entity: BoardEntity): string => {
	return entity
		? `${entity.cardId}/${entity.attack}/${entity.health}/${entity.entityId}/${
				entity.divineShield
		  }/${entity.attacksPerformed || 0}`
		: null;
};

export const encode = (input: string): string => {
	// return compressToEncodedURIComponent(input);
	const buff = Buffer.from(input, 'utf-8');
	const base64 = buff.toString('base64');
	return base64;
};

export const decode = (base64: string): string => {
	const buff = Buffer.from(base64, 'base64');
	const str = buff.toString('utf-8');
	return str;
};
