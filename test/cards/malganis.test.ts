import { CardIds } from '@firestone-hs/reference-data';
import { BoardEntity } from '../../src/board-entity';
import { AllCardsService } from '../../src/cards/cards';
import { CardsData } from '../../src/cards/cards-data';
import { PlayerEntity } from '../../src/player-entity';
import { Simulator } from '../../src/simulation/simulator';
import { buildBoardEntity } from '../../src/utils';
import cardsJson from '../cards.json';

describe('MalGanis', () => {
	test('MalGanis aura works properly even on a minion two spaces removed', async () => {
		const cards = buildCardsService();
		await cards.initializeCardsDb();
		const spawns = new CardsData(cards);
		const simulator = new Simulator(cards, spawns);

		const playerBoard: readonly BoardEntity[] = [
			{ ...buildBoardEntity('LOOT_013', cards, 1), attack: 4 }, // Vulgar Homonculus
		];
		const playerEntity: PlayerEntity = { tavernTier: 1 } as PlayerEntity;
		const opponentBoard: readonly BoardEntity[] = [
			buildBoardEntity('LOOT_013', cards, 2), // Vulgar Homonculus
			buildBoardEntity('UNG_073', cards, 3), // Rockpool Hunter
			buildBoardEntity('GVG_021', cards, 4), // Mal'Ganis
		];
		const opponentEntity: PlayerEntity = { tavernTier: 1 } as PlayerEntity;

		const result = simulator.simulateSingleBattle(playerBoard, playerEntity, opponentBoard, opponentEntity);

		expect(result).not.toBeNull();
		expect(result.result).toBe('lost');
		expect(result.damageDealt).toBe(8);
	});

	test('MalGanis aura works only on demons', async () => {
		const cards = buildCardsService();
		await cards.initializeCardsDb();
		const spawns = new CardsData(cards);
		const simulator = new Simulator(cards, spawns);

		const playerBoard: readonly BoardEntity[] = [
			buildBoardEntity('BGS_039', cards, 1), // Dragonspawn Lieutenant
		];
		const playerEntity: PlayerEntity = { tavernTier: 1 } as PlayerEntity;
		const opponentBoard: readonly BoardEntity[] = [
			buildBoardEntity('BGS_039', cards, 2), // Dragonspawn Lieutenant
			buildBoardEntity('GVG_021', cards, 4), // Mal'Ganis
		];
		const opponentEntity: PlayerEntity = { tavernTier: 1 } as PlayerEntity;

		const result = simulator.simulateSingleBattle(playerBoard, playerEntity, opponentBoard, opponentEntity);

		expect(result).not.toBeNull();
		expect(result.result).toBe('lost');
		expect(result.damageDealt).toBe(6);
	});

	test('MalGanis aura ends once it is killed', async () => {
		const cards = buildCardsService();
		await cards.initializeCardsDb();
		const spawns = new CardsData(cards);
		const simulator = new Simulator(cards, spawns);

		const playerBoard: readonly BoardEntity[] = [
			{ ...buildBoardEntity('BGS_039', cards, 5), attack: 8 } as BoardEntity, // Dragonspawn Lieutenant
			buildBoardEntity('UNG_073', cards, 1), // Rockpool hunter
			buildBoardEntity('BGS_039', cards, 4), // Dragonspawn Lieutenant
		];
		const playerEntity: PlayerEntity = { tavernTier: 1 } as PlayerEntity;
		const opponentBoard: readonly BoardEntity[] = [
			{ ...buildBoardEntity('EX1_185', cards, 2), taunt: true }, // MalGanis
			buildBoardEntity(CardIds.Collectible.Neutral.RockpoolHunter, cards, 3),
		];
		const opponentEntity: PlayerEntity = { tavernTier: 1 } as PlayerEntity;

		const result = simulator.simulateSingleBattle(playerBoard, playerEntity, opponentBoard, opponentEntity);

		expect(result).not.toBeNull();
		expect(result.result).toBe('won');
		// First Rockpool dies to the taunt, Wolf dies to the taunt, second rockpool survives the unbuffed taunt
		expect(result.damageDealt).toBe(3);
	});
});

function buildCardsService() {
	const service = new AllCardsService();
	service['allCards'] = [...(cardsJson as any[])];
	return service;
}
