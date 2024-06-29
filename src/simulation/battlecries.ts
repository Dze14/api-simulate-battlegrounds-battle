import { AllCardsService, CardIds, CardType, GameTag, Race } from '@firestone-hs/reference-data';
import { BgsPlayerEntity } from '../bgs-player-entity';
import { BoardEntity } from '../board-entity';
import { pickRandom } from '../services/utils';
import {
	addStatsToBoard,
	buildSingleBoardEntity,
	getPlayerState,
	getRandomAliveMinion,
	grantStatsToMinionsOfEachType,
	hasCorrectTribe,
	isMinionGolden,
	makeMinionGolden,
} from '../utils';
import { getNeighbours } from './attack';
import { playBloodGemsOn } from './blood-gems';
import { addCardsInHand } from './cards-in-hand';
import { FullGameState } from './internal-game-state';
import { magnetizeToTarget } from './magnetize';
import { SharedState } from './shared-state';
import { modifyStats } from './stats';

export const computeBattlecryMultiplier = (
	board: BoardEntity[],
	boardHero: BgsPlayerEntity,
	sharedState: SharedState,
): number => {
	const brann = board.find(
		(entity) =>
			entity.cardId === CardIds.BrannBronzebeard_BG_LOE_077 ||
			entity.cardId === CardIds.MoiraBronzebeard_BG27_518,
	);
	const brannBlessings = boardHero.secrets?.some((e) => e.cardId === CardIds.BrannsBlessing_BG28_509);
	const brannBonus = !!brann || brannBlessings ? 2 : 0;
	const goldenBrann = board.find(
		(entity) =>
			entity.cardId === CardIds.BrannBronzebeard_TB_BaconUps_045 ||
			entity.cardId === CardIds.MoiraBronzebeard_BG27_518_G,
	);
	const goldenBrannBonus = !!goldenBrann ? 3 : 0;
	const gilneanWarHorns =
		boardHero.questRewardEntities?.filter((entity) => entity.cardId === CardIds.GilneanWarHorn)?.length ?? 0;
	const echoesOfArgus = sharedState.anomalies.includes(CardIds.EchoesOfArgus_BG27_Anomaly_802) ? 1 : 0;

	const multiplier = echoesOfArgus + Math.max(goldenBrannBonus, brannBonus, 1) + gilneanWarHorns;
	return multiplier;
};

export const triggerBattlecry = (
	board: BoardEntity[],
	hero: BgsPlayerEntity,
	entity: BoardEntity,
	otherBoard: BoardEntity[],
	otherHero: BgsPlayerEntity,
	gameState: FullGameState,
) => {
	const allMinions = [...board, ...otherBoard];
	const totalTriggers = computeBattlecryMultiplier(board, hero, gameState.sharedState);
	for (let z = 0; z < totalTriggers; z++) {
		let hasTriggered = true;
		switch (entity.cardId) {
			case CardIds.RazorfenGeomancer_BG20_100:
			case CardIds.RazorfenGeomancer_BG20_100_G:
				const razorFenCardsToAdd =
					entity.cardId === CardIds.RazorfenGeomancer_BG20_100
						? [CardIds.BloodGem]
						: [CardIds.BloodGem, CardIds.BloodGem];
				addCardsInHand(hero, board, razorFenCardsToAdd, gameState);
				break;
			case CardIds.RockpoolHunter_BG_UNG_073:
			case CardIds.RockpoolHunter_TB_BaconUps_061:
				const rockPoolTarget = getRandomAliveMinion(board, Race.MURLOC, gameState.allCards);
				if (!!rockPoolTarget) {
					const rockpoolStats = entity.cardId === CardIds.RockpoolHunter_BG_UNG_073 ? 1 : 2;
					modifyStats(rockPoolTarget, rockpoolStats, rockpoolStats, board, hero, gameState);
					gameState.spectator.registerPowerTarget(entity, rockPoolTarget, board, hero, otherHero);
				}
				break;
			case CardIds.ShellCollector_BG23_002:
			case CardIds.ShellCollector_BG23_002_G:
				const shellCollectorCardsToAdd =
					entity.cardId === CardIds.ShellCollector_BG23_002
						? [CardIds.TheCoinCore]
						: [CardIds.TheCoinCore, CardIds.TheCoinCore];
				addCardsInHand(hero, board, shellCollectorCardsToAdd, gameState);
				break;
			case CardIds.MenagerieMug_BGS_082:
			case CardIds.MenagerieMug_TB_BaconUps_144:
				const menagerieMugStats = entity.cardId === CardIds.MenagerieMug_BGS_082 ? 1 : 2;
				grantStatsToMinionsOfEachType(entity, board, hero, menagerieMugStats, menagerieMugStats, gameState, 3);
				break;
			case CardIds.MenagerieJug_BGS_083:
			case CardIds.MenagerieJug_TB_BaconUps_145:
				const menagerieJugStats = entity.cardId === CardIds.MenagerieJug_BGS_083 ? 2 : 4;
				grantStatsToMinionsOfEachType(entity, board, hero, menagerieJugStats, menagerieJugStats, gameState, 3);
				break;
			case CardIds.NerubianDeathswarmer_BG25_011:
			case CardIds.NerubianDeathswarmer_BG25_011_G:
				const nerubianDeathswarmerStats = entity.cardId === CardIds.NerubianDeathswarmer_BG25_011 ? 1 : 2;
				hero.globalInfo.UndeadAttackBonus =
					(hero.globalInfo?.UndeadAttackBonus ?? 0) + nerubianDeathswarmerStats;
				addStatsToBoard(entity, board, hero, nerubianDeathswarmerStats, 0, gameState, Race[Race.UNDEAD]);
				break;
			case CardIds.SparringPartner_BG_AT_069:
			case CardIds.SparringPartner_BG_AT_069_G:
				const sparringPartnersTargets = allMinions.filter((e) => !e.taunt);
				const sparringPartnersTarget = pickRandom(sparringPartnersTargets);
				if (sparringPartnersTarget) {
					sparringPartnersTarget.taunt = true;
				}
				break;
			case CardIds.TwilightEmissary_BGS_038:
			case CardIds.TwilightEmissary_TB_BaconUps_108:
				const twilightEmissaryTarget = getRandomAliveMinion(board, Race.DRAGON, gameState.allCards);
				const twilightEmissaryStats = entity.cardId === CardIds.TwilightEmissary_BGS_038 ? 2 : 4;
				modifyStats(
					twilightEmissaryTarget,
					twilightEmissaryStats,
					twilightEmissaryStats,
					board,
					hero,
					gameState,
				);
				gameState.spectator.registerPowerTarget(entity, twilightEmissaryTarget, board, hero, otherHero);
				break;
			case CardIds.BloodsailCannoneer_BGS_053:
			case CardIds.BloodsailCannoneer_TB_BaconUps_138:
				addStatsToBoard(
					entity,
					board.filter((e) => e.entityId != entity.entityId),
					hero,
					entity.cardId === CardIds.BloodsailCannoneer_BGS_053 ? 3 : 6,
					0,
					gameState,
					Race[Race.PIRATE],
				);
				break;
			case CardIds.CrowsNestSentry_BG29_502:
			case CardIds.CrowsNestSentry_BG29_502_G:
				addStatsToBoard(
					entity,
					board.filter((e) => e.entityId != entity.entityId),
					hero,
					0,
					entity.cardId === CardIds.CrowsNestSentry_BG29_502 ? 3 : 6,
					gameState,
					Race[Race.PIRATE],
				);
				break;
			case CardIds.ColdlightSeerLegacy_BG_EX1_103:
			case CardIds.ColdlightSeerLegacy_TB_BaconUps_064:
				addStatsToBoard(
					entity,
					board.filter((e) => e.entityId != entity.entityId),
					hero,
					0,
					entity.cardId === CardIds.ColdlightSeerLegacy_BG_EX1_103 ? 2 : 4,
					gameState,
					Race[Race.MURLOC],
				);
				break;
			case CardIds.FelfinNavigator_BG_BT_010:
			case CardIds.FelfinNavigator_TB_BaconUps_124:
				addStatsToBoard(
					entity,
					board.filter((e) => e.entityId != entity.entityId),
					hero,
					entity.cardId === CardIds.FelfinNavigator_TB_BaconUps_124 ? 2 : 1,
					entity.cardId === CardIds.FelfinNavigator_TB_BaconUps_124 ? 2 : 1,
					gameState,
					Race[Race.MURLOC],
				);
				break;
			case CardIds.KeyboardIgniter_BG26_522:
			case CardIds.KeyboardIgniter_BG26_522_G:
				addStatsToBoard(
					entity,
					board.filter((e) => e.entityId != entity.entityId),
					hero,
					entity.cardId === CardIds.KeyboardIgniter_BG26_522 ? 2 : 4,
					entity.cardId === CardIds.KeyboardIgniter_BG26_522 ? 2 : 4,
					gameState,
					Race[Race.DEMON],
				);
				break;
			case CardIds.MoonBaconJazzer_BG26_159:
			case CardIds.MoonBaconJazzer_BG26_159_G:
				// console.debug('triggering moonbaconjazzer');
				const moonBaconJazzerStats = entity.cardId === CardIds.MoonBaconJazzer_BG26_159 ? 1 : 2;
				hero.globalInfo.BloodGemHealthBonus =
					(hero.globalInfo?.BloodGemHealthBonus ?? 0) + moonBaconJazzerStats;
				break;
			case CardIds.Smogger_BG21_021:
			case CardIds.Smogger_BG21_021_G:
				const smoggerLoops = entity.cardId === CardIds.Smogger_BG21_021 ? 1 : 2;
				for (let i = 0; i < smoggerLoops; i++) {
					const smoggerTarget = getRandomAliveMinion(board, Race.ELEMENTAL, gameState.allCards);
					const smoggerStats = hero.tavernTier ?? 3;
					modifyStats(smoggerTarget, smoggerStats, smoggerStats, board, hero, gameState);
					gameState.spectator.registerPowerTarget(entity, smoggerTarget, board, hero, otherHero);
				}
				break;
			case CardIds.AnnihilanBattlemaster_BGS_010:
			case CardIds.AnnihilanBattlemaster_TB_BaconUps_083:
				// TODO: pass damage taken info
				const startingHp = hero.cardId === CardIds.Patchwerk_TB_BaconShop_HERO_34 ? 60 : 30;
				const hpMissing = startingHp - hero.hpLeft;
				const annihilanStats = (entity.cardId === CardIds.AnnihilanBattlemaster_BGS_010 ? 2 : 4) * hpMissing;
				modifyStats(entity, 0, annihilanStats, board, hero, gameState);
				gameState.spectator.registerPowerTarget(entity, entity, board, hero, otherHero);
				break;
			case CardIds.ElectricSynthesizer_BG26_963:
			case CardIds.ElectricSynthesizer_BG26_963_G:
				addStatsToBoard(
					entity,
					board.filter((e) => e.entityId != entity.entityId),
					hero,
					entity.cardId === CardIds.ElectricSynthesizer_BG26_963 ? 3 : 6,
					entity.cardId === CardIds.ElectricSynthesizer_BG26_963 ? 2 : 4,
					gameState,
					Race[Race.DRAGON],
				);
				break;
			case CardIds.Necrolyte_BG20_202:
			case CardIds.Necrolyte_BG20_202_G:
				// console.debug('triggering necrolyte', entity.entityId);
				const necrolyteBloodGems = entity.cardId === CardIds.Necrolyte_BG20_202 ? 2 : 4;
				const necrolyteTarget = pickRandom(board);
				playBloodGemsOn(entity, necrolyteTarget, necrolyteBloodGems, board, hero, gameState);
				gameState.spectator.registerPowerTarget(entity, necrolyteTarget, board, hero, otherHero);

				const necrolyteTargetNeighbours = getNeighbours(board, necrolyteTarget);
				for (const neighbour of necrolyteTargetNeighbours) {
					const bloodGemStatsEnchantment = neighbour.enchantments?.find(
						(e) => e.cardId === CardIds.BloodGem_BloodGemsEnchantment,
					);
					if (bloodGemStatsEnchantment) {
						const atk = bloodGemStatsEnchantment.tagScriptDataNum1 ?? 0;
						const heath = bloodGemStatsEnchantment.tagScriptDataNum2 ?? 0;
						neighbour.attack = Math.max(0, neighbour.attack - atk);
						neighbour.health = Math.max(1, neighbour.health - heath);
						neighbour.maxHealth = Math.max(1, neighbour.maxHealth - heath);
						necrolyteTarget.attack += atk;
						necrolyteTarget.health += heath;
						necrolyteTarget.maxHealth += heath;
						gameState.spectator.registerPowerTarget(necrolyteTarget, neighbour, board, hero, otherHero);
					}
				}
				break;
			case CardIds.PrimalfinLookout_BGS_020:
			case CardIds.PrimalfinLookout_TB_BaconUps_089:
				const primalfinLookoutCardsToAdd =
					entity.cardId === CardIds.PrimalfinLookout_BGS_020
						? [gameState.cardsData.getRandomMinionForTribe(Race.MURLOC, hero.tavernTier ?? 1)]
						: [
								gameState.cardsData.getRandomMinionForTribe(Race.MURLOC, hero.tavernTier ?? 1),
								gameState.cardsData.getRandomMinionForTribe(Race.MURLOC, hero.tavernTier ?? 1),
						  ];
				addCardsInHand(hero, board, primalfinLookoutCardsToAdd, gameState);
				gameState.spectator.registerPowerTarget(entity, hero, board, hero, otherHero);
				break;
			case CardIds.StrongshellScavenger_BG_ICC_807:
			case CardIds.StrongshellScavenger_TB_BaconUps_072:
				const strongshellScavengerStats = entity.cardId === CardIds.StrongshellScavenger_BG_ICC_807 ? 2 : 4;
				const strongshellScavengerTargets = board
					.filter((e) => e.entityId != entity.entityId)
					.filter((e) => e.taunt);
				strongshellScavengerTargets.forEach((target) => {
					modifyStats(target, strongshellScavengerStats, strongshellScavengerStats, board, hero, gameState);
					gameState.spectator.registerPowerTarget(entity, target, board, hero, otherHero);
				});
				break;
			case CardIds.VigilantStoneborn_BG24_023:
			case CardIds.VigilantStoneborn_BG24_023_G:
				const vigilantStonebornTarget = pickRandom(board);
				const vigilantStonebornStats = entity.cardId === CardIds.VigilantStoneborn_BG24_023 ? 6 : 12;
				vigilantStonebornTarget.taunt = true;
				modifyStats(vigilantStonebornTarget, 0, vigilantStonebornStats, board, hero, gameState);
				gameState.spectator.registerPowerTarget(entity, vigilantStonebornTarget, board, hero, otherHero);
				break;
			case CardIds.Bonemare_BG26_ICC_705:
			case CardIds.Bonemare_BG26_ICC_705_G:
				const bonemareTarget = pickRandom(board);
				const bonemareStats = entity.cardId === CardIds.Bonemare_BG26_ICC_705 ? 4 : 8;
				bonemareTarget.taunt = true;
				modifyStats(bonemareTarget, bonemareStats, bonemareStats, board, hero, gameState);
				gameState.spectator.registerPowerTarget(entity, bonemareTarget, board, hero, otherHero);
				break;
			case CardIds.GeneralDrakkisath_BG25_309:
			case CardIds.GeneralDrakkisath_BG25_309_G:
				const generalDrakkisathCardsToAdd =
					entity.cardId === CardIds.GeneralDrakkisath_BG25_309
						? [CardIds.GeneralDrakkisath_SmolderwingToken_BG25_309t]
						: [
								CardIds.GeneralDrakkisath_SmolderwingToken_BG25_309t,
								CardIds.GeneralDrakkisath_SmolderwingToken_BG25_309t,
						  ];
				addCardsInHand(hero, board, generalDrakkisathCardsToAdd, gameState);
				break;
			case CardIds.KingBagurgle_BGS_030:
			case CardIds.KingBagurgle_TB_BaconUps_100:
				addStatsToBoard(
					entity,
					board.filter((e) => e.entityId != entity.entityId),
					hero,
					entity.cardId === CardIds.KingBagurgle_BGS_030 ? 3 : 6,
					entity.cardId === CardIds.KingBagurgle_BGS_030 ? 3 : 6,
					gameState,
					Race[Race.MURLOC],
				);
				break;
			// Not correct, but only used to trigger the "add cards in hand" effect
			case CardIds.Murozond_BGS_043:
			case CardIds.Murozond_TB_BaconUps_110:
				const murozondCardsToAdd =
					entity.cardId === CardIds.Murozond_BGS_043
						? [CardIds.TheCoinCore]
						: [CardIds.TheCoinCore, CardIds.TheCoinCore];
				addCardsInHand(hero, board, murozondCardsToAdd, gameState);
				break;
			case CardIds.TavernTempest_BGS_123:
			case CardIds.TavernTempest_TB_BaconUps_162:
				const tavernTempestCardsToAdd =
					entity.cardId === CardIds.TavernTempest_BGS_123
						? [CardIds.TheCoinCore]
						: [CardIds.TheCoinCore, CardIds.TheCoinCore];
				addCardsInHand(hero, board, tavernTempestCardsToAdd, gameState);
				break;
			case CardIds.MechaJaraxxus_BG25_807:
			case CardIds.MechaJaraxxus_BG25_807_G:
				const mechaJaraxxusCardsToAdd =
					entity.cardId === CardIds.MechaJaraxxus_BG25_807
						? [CardIds.TheCoinCore]
						: [CardIds.TheCoinCore, CardIds.TheCoinCore];
				addCardsInHand(hero, board, mechaJaraxxusCardsToAdd, gameState);
				break;
			case CardIds.OozelingGladiator_BG27_002:
			case CardIds.OozelingGladiator_BG27_002_G:
				const oozelingCardsToAdd =
					entity.cardId === CardIds.OozelingGladiator_BG27_002
						? [CardIds.TheCoinCore, CardIds.TheCoinCore]
						: [CardIds.TheCoinCore, CardIds.TheCoinCore, CardIds.TheCoinCore, CardIds.TheCoinCore];
				addCardsInHand(hero, board, oozelingCardsToAdd, gameState);
				break;
			case CardIds.UtherTheLightbringer_BG23_190:
			case CardIds.UtherTheLightbringer_BG23_190_G:
				const utherTarget = pickRandom(allMinions);
				const utherStats = entity.cardId === CardIds.UtherTheLightbringer_BG23_190 ? 15 : 30;
				utherTarget.attack = utherStats;
				utherTarget.health = utherStats;
				utherTarget.maxHealth = utherStats;
				break;
			case CardIds.IronGroundskeeper_BG27_000:
			case CardIds.IronGroundskeeper_BG27_000_G:
				const ironGroundskeeperTargets = allMinions;
				const ironGroundskeeperTarget = pickRandom(ironGroundskeeperTargets);
				ironGroundskeeperTarget.taunt = !ironGroundskeeperTarget.taunt;
				break;
			case CardIds.LivingConstellation_BG27_001:
			case CardIds.LivingConstellation_BG27_001_G:
				const differentTypes = extractUniqueTribes(board, gameState.allCards);
				const livingConstellationStats =
					(entity.cardId === CardIds.LivingConstellation_BG27_001 ? 1 : 2) * differentTypes.length;
				const livingConstellationTarget = pickRandom(allMinions);
				const boardForTarget = board.includes(livingConstellationTarget) ? board : otherBoard;
				modifyStats(
					livingConstellationTarget,
					livingConstellationStats,
					livingConstellationStats,
					boardForTarget,
					hero,
					gameState,
				);
				gameState.spectator.registerPowerTarget(
					entity,
					livingConstellationTarget,
					boardForTarget,
					hero,
					otherHero,
				);
				break;
			case CardIds.FairyTaleCaroler_BG26_001:
			case CardIds.FairyTaleCaroler_BG26_001_G:
				addStatsToBoard(
					entity,
					board.filter((e) => e.entityId != entity.entityId),
					hero,
					entity.cardId === CardIds.FairyTaleCaroler_BG26_001 ? 2 : 4,
					entity.cardId === CardIds.FairyTaleCaroler_BG26_001 ? 2 : 4,
					gameState,
				);
				break;
			case CardIds.SparkLing_BG27_019:
			case CardIds.SparkLing_BG27_019_G:
				addStatsToBoard(
					entity,
					board.filter((e) => e.entityId != entity.entityId),
					hero,
					entity.cardId === CardIds.SparkLing_BG27_019 ? 1 : 2,
					entity.cardId === CardIds.SparkLing_BG27_019 ? 1 : 2,
					gameState,
				);
				addStatsToBoard(
					entity,
					otherBoard,
					hero,
					entity.cardId === CardIds.SparkLing_BG27_019 ? 1 : 2,
					entity.cardId === CardIds.SparkLing_BG27_019 ? 1 : 2,
					gameState,
				);
				break;
			case CardIds.EmergentFlame_BG27_018:
			case CardIds.EmergentFlame_BG27_018_G:
				const emergentFlameTarget = pickRandom(
					allMinions.filter((e) => hasCorrectTribe(e, Race.ELEMENTAL, gameState.allCards)),
				);
				if (!!emergentFlameTarget) {
					const targetBoard = board.includes(emergentFlameTarget) ? board : otherBoard;
					const targetHero = board.includes(emergentFlameTarget) ? hero : otherHero;
					const emergentFlameMultiplier = entity.cardId === CardIds.EmergentFlame_BG27_018 ? 1 : 2;
					const emergentFlameStats = (entity.scriptDataNum1 ?? 1) * emergentFlameMultiplier;
					modifyStats(
						emergentFlameTarget,
						emergentFlameStats,
						emergentFlameStats,
						targetBoard,
						targetHero,
						gameState,
					);
					gameState.spectator.registerPowerTarget(entity, emergentFlameTarget, targetBoard, hero, otherHero);
				}
				break;
			case CardIds.GeneralDrakkisath_SmolderwingToken_BG25_309t:
			case CardIds.GeneralDrakkisath_SmolderwingToken_BG25_309_Gt:
				const smolderwingTarget = pickRandom(
					allMinions.filter((e) => hasCorrectTribe(e, Race.DRAGON, gameState.allCards)),
				);
				if (!!smolderwingTarget) {
					const targetBoard = board.includes(smolderwingTarget) ? board : otherBoard;
					const targetHero = board.includes(smolderwingTarget) ? hero : otherHero;
					const smolderwingMultiplier =
						entity.cardId === CardIds.GeneralDrakkisath_SmolderwingToken_BG25_309t ? 1 : 2;
					const smolderwingStats = 5 * smolderwingMultiplier;
					modifyStats(smolderwingTarget, smolderwingStats, 0, targetBoard, targetHero, gameState);
				}
				break;
			case CardIds.ArgentBraggart_BG_SCH_149:
			case CardIds.ArgentBraggart_TB_BaconUps_308:
				const highestAttack = Math.max(...allMinions.map((minion) => minion.attack));
				const highestHealth = Math.max(...allMinions.map((minion) => minion.health));
				const argentBraggartMultiplier = entity.cardId === CardIds.ArgentBraggart_BG_SCH_149 ? 1 : 2;
				entity.attack = argentBraggartMultiplier * highestAttack;
				entity.health = argentBraggartMultiplier * highestHealth;
				break;
			case CardIds.CaptainSanders_BG25_034:
			case CardIds.CaptainSanders_BG25_034_G:
				const captainSandersTarget = pickRandom(board.filter((e) => !isMinionGolden(e, gameState.allCards)));
				if (captainSandersTarget) {
					makeMinionGolden(captainSandersTarget, entity, board, hero, gameState);
				}
				break;
			case CardIds.SanguineChampion_BG23_017:
			case CardIds.SanguineChampion_BG23_017_G:
				const sanguineChampionStats = entity.cardId === CardIds.SanguineChampion_BG23_017 ? 1 : 2;
				hero.globalInfo.BloodGemAttackBonus += sanguineChampionStats;
				hero.globalInfo.BloodGemHealthBonus += sanguineChampionStats;
				break;
			case CardIds.Murky_BG24_012:
			case CardIds.Murky_BG24_012_G:
				const murkyScale = entity.cardId === CardIds.Murky_BG24_012 ? 1 : 2;
				const murlocsControlled = board.filter((e) =>
					hasCorrectTribe(e, Race.MURLOC, gameState.allCards),
				).length;
				// const murkyBattlecriesPlayed = entity.scriptDataNum1 > 0 ? entity.scriptDataNum1 / murkyScale - 1 : 0;
				const murkyStats = murkyScale * 4 * murlocsControlled;
				const murkyTarget = pickRandom(
					board.filter((e) => hasCorrectTribe(e, Race.MURLOC, gameState.allCards)),
				);
				if (!!murkyTarget) {
					modifyStats(murkyTarget, murkyStats, murkyStats, board, hero, gameState);
				}
				break;
			case CardIds.LovesickBalladist_BG26_814:
			case CardIds.LovesickBalladist_BG26_814_G:
				const balladistMultiplier = entity.cardId === CardIds.LovesickBalladist_BG26_814 ? 1 : 2;
				const balladistStats = balladistMultiplier * (entity.scriptDataNum1 ?? 0);
				const balladistTargets = allMinions.filter((e) => hasCorrectTribe(e, Race.PIRATE, gameState.allCards));
				const balladistTarget = pickRandom(balladistTargets);
				if (balladistTarget) {
					const targetBoard = board.includes(balladistTarget) ? board : otherBoard;
					const targetHero = board.includes(balladistTarget) ? hero : otherHero;
					modifyStats(balladistTarget, 0, balladistStats, targetBoard, targetHero, gameState);
					gameState.spectator.registerPowerTarget(
						entity,
						balladistTarget,
						targetBoard,
						targetHero,
						otherHero,
					);
				}
				break;
			case CardIds.FacelessDisciple_BG24_719:
			case CardIds.FacelessDisciple_BG24_719_G:
				const target = pickRandom(allMinions.filter((e) => !e.definitelyDead && e.health > 0));
				if (target) {
					gameState.spectator.registerPowerTarget(entity, target, board, hero, otherHero);
					const minionTier = gameState.cardsData.getTavernLevel(target.cardId);
					const targetTier =
						entity.cardId === CardIds.FacelessDisciple_BG24_719 ? minionTier + 1 : minionTier + 2;
					const maxTier = !!gameState.anomalies?.includes(CardIds.SecretsOfNorgannon_BG27_Anomaly_504)
						? 7
						: 6;
					const newMinionId = gameState.cardsData.getRandomMinionForTavernTier(Math.min(maxTier, targetTier));
					const targetBoard = board.includes(target) ? board : otherBoard;
					const targetHero = board.includes(target) ? hero : otherHero;
					const newMinion = buildSingleBoardEntity(
						newMinionId,
						hero,
						board,
						gameState.allCards,
						targetHero.friendly,
						gameState.sharedState.currentEntityId++,
						false,
						gameState.cardsData,
						gameState.sharedState,
						null,
					);
					// Replace the target with the new minion
					const index = targetBoard.indexOf(target);
					// console.debug('board before disciple', stringifySimple(targetBoard, gameState.allCards));
					targetBoard.splice(index, 1, newMinion);
					// console.debug('board after disciple', stringifySimple(targetBoard, gameState.allCards));
					gameState.spectator.registerPowerTarget(entity, newMinion, targetBoard, hero, otherHero);
				}
				break;
			case CardIds.Amalgadon_BGS_069:
			case CardIds.Amalgadon_TB_BaconUps_121:
				const numberOfTribes = extractUniqueTribes(board, gameState.allCards).length;
				const amalgadonMultiplier = entity.cardId === CardIds.Amalgadon_BGS_069 ? 1 : 2;
				const totalAdapts = amalgadonMultiplier * numberOfTribes;
				for (let i = 0; i < totalAdapts; i++) {
					const adapts = [
						CardIds.FlamingClawsToken,
						CardIds.LivingSporesToken,
						CardIds.VolcanicMightToken,
						CardIds.RockyCarapaceToken,
					];
					if (!entity.divineShield) {
						adapts.push(CardIds.CracklingShieldToken);
					}
					if (!entity.windfury) {
						adapts.push(CardIds.LightningSpeedToken);
					}
					if (!entity.taunt) {
						adapts.push(CardIds.MassiveToken);
					}
					if (!entity.venomous && !entity.poisonous) {
						adapts.push(CardIds.PoisonSpitToken);
					}
					const adapt = pickRandom(adapts);
					switch (adapt) {
						case CardIds.FlamingClawsToken:
							modifyStats(entity, 3, 0, board, hero, gameState);
							break;
						case CardIds.LivingSporesToken:
							entity.enchantments = entity.enchantments ?? [];
							entity.enchantments.push({
								cardId: CardIds.LivingSpores_LivingSporesEnchantment,
								timing: 0,
							});
							break;
						case CardIds.LightningSpeedToken:
							entity.windfury = true;
							break;
						case CardIds.MassiveToken:
							entity.taunt = true;
							break;
						case CardIds.PoisonSpitToken:
							entity.poisonous = true;
							break;
						case CardIds.RockyCarapaceToken:
							modifyStats(entity, 0, 3, board, hero, gameState);
							break;
						case CardIds.CracklingShieldToken:
							entity.divineShield = true;
							break;
						case CardIds.VolcanicMightToken:
							modifyStats(entity, 1, 1, board, hero, gameState);
							break;
					}
				}
				break;
			case CardIds.RodeoPerformer_BG28_550:
			case CardIds.RodeoPerformer_BG28_550_G:
				const rodeoPerformerCardsToAdd =
					entity.cardId === CardIds.RodeoPerformer_BG28_550_G ? [null] : [null, null];
				addCardsInHand(hero, board, rodeoPerformerCardsToAdd, gameState);
				break;
			case CardIds.Eagill_BG28_630:
			case CardIds.Eagill_BG28_630_G:
				const eagillMultiplier = entity.cardId === CardIds.Eagill_BG28_630 ? 1 : 2;
				const eagillBoardTarget = pickRandom(board.filter((e) => e.entityId !== entity.entityId));
				if (eagillBoardTarget) {
					modifyStats(eagillBoardTarget, 2 * eagillMultiplier, 3 * eagillMultiplier, board, hero, gameState);
					gameState.spectator.registerPowerTarget(entity, eagillBoardTarget, board, hero, otherHero);
				}
				const eagillHandTarget = pickRandom(
					hero.hand.filter(
						(e) => gameState.allCards.getCard(e.cardId).type?.toUpperCase() === CardType[CardType.MINION],
					),
				);
				if (eagillHandTarget) {
					modifyStats(eagillHandTarget, 2 * eagillMultiplier, 3 * eagillMultiplier, board, hero, gameState);
					gameState.spectator.registerPowerTarget(entity, eagillHandTarget, board, hero, otherHero);
				}
				break;
			case CardIds.Weebomination_TB_BaconShop_HERO_34_Buddy:
			case CardIds.Weebomination_TB_BaconShop_HERO_34_Buddy_G:
				const weebominationMultiplier =
					entity.cardId === CardIds.Weebomination_TB_BaconShop_HERO_34_Buddy ? 1 : 2;
				const weebominationTarget = pickRandom(allMinions);
				if (weebominationTarget) {
					const heroMaxHealth = gameState.allCards.getCard(hero.cardId)?.health ?? 40;
					const heroMissingHealth = heroMaxHealth - hero.hpLeft;
					const weebominationBuff = weebominationMultiplier * heroMissingHealth;
					modifyStats(weebominationTarget, 0, weebominationBuff, board, hero, gameState);
					gameState.spectator.registerPowerTarget(entity, weebominationTarget, board, hero, otherHero);
				}
				break;
			case CardIds.AssistantGuard_BG29_845:
			case CardIds.AssistantGuard_BG29_845_G:
				const assistantGuardMultiplier = entity.cardId === CardIds.AssistantGuard_BG29_845 ? 1 : 2;
				const assistantGuardTarget = pickRandom(allMinions);
				if (assistantGuardTarget) {
					assistantGuardTarget.taunt = true;
					gameState.spectator.registerPowerTarget(entity, assistantGuardTarget, board, hero, otherHero);
				}
				addStatsToBoard(
					entity,
					board.filter((e) => !!e.taunt),
					hero,
					assistantGuardMultiplier * 2,
					assistantGuardMultiplier * 3,
					gameState,
				);
				break;
			case CardIds.GoldshellWarden_BG29_803:
			case CardIds.GoldshellWarden_BG29_803_G:
				const goldshellMultiplier = entity.cardId === CardIds.GoldshellWarden_BG29_803_G ? 2 : 1;
				addStatsToBoard(
					entity,
					board.filter((e) => e.entityId != entity.entityId),
					hero,
					goldshellMultiplier * 2,
					goldshellMultiplier * 4,
					gameState,
					Race[Race.BEAST],
				);
				break;
			case CardIds.ShellWhistler_BG26_045:
			case CardIds.ShellWhistler_BG26_045_G:
				const shellWhistlerCardsToAdd =
					entity.cardId === CardIds.ShellWhistler_BG26_045_G ? [null] : [null, null];
				addCardsInHand(hero, board, shellWhistlerCardsToAdd, gameState);
				break;
			// case CardIds.ScrapScraper_BG26_148:
			// case CardIds.ScrapScraper_BG26_148_G:
			// 	const scraperToAddQuantity = entity.cardId === CardIds.ScrapScraper_BG26_148_G ? 2 : 1;
			// 	const scraperCardsToAdd = [];
			// 	for (let i = 0; i < scraperToAddQuantity; i++) {
			// 		scraperCardsToAdd.push(pickRandom(gameState.cardsData.scrapScraperSpawns));
			// 	}
			// 	addCardsInHand(hero, board, scraperCardsToAdd, gameState);
			// 	break;
			case CardIds.GemSmuggler_BG25_155:
			case CardIds.GemSmuggler_BG25_155_G:
				// console.debug('triggering gem smuggler');
				const gemSmugglerBloodGems = entity.cardId === CardIds.GemSmuggler_BG25_155 ? 1 : 2;
				board
					.filter((e) => e.entityId !== entity.entityId)
					.forEach((e) => playBloodGemsOn(entity, e, gemSmugglerBloodGems, board, hero, gameState));
				break;
			case CardIds.DisguisedGraverobber_BG28_303:
			case CardIds.DisguisedGraverobber_BG28_303_G:
				const disguisedGraverobberTarget = pickRandom(board.filter((e) => e.entityId !== entity.entityId));
				if (disguisedGraverobberTarget) {
					const disguisedGraverobberNumberOfCopies =
						entity.cardId === CardIds.DisguisedGraverobber_BG28_303 ? 1 : 2;
					disguisedGraverobberTarget.definitelyDead = true;
					const copies = Array.from({ length: disguisedGraverobberNumberOfCopies }).map(
						(_) => disguisedGraverobberTarget.cardId,
					);
					addCardsInHand(hero, board, copies, gameState);
				}
				break;
			case CardIds.FriendlySaloonkeeper_BGDUO_104:
			case CardIds.FriendlySaloonkeeper_BGDUO_104_G:
				const playerState = getPlayerState(gameState.gameState, hero);
				if (playerState) {
					const cardsToAdd =
						entity.cardId === CardIds.FriendlySaloonkeeper_BGDUO_104
							? [CardIds.TheCoinCore]
							: [CardIds.TheCoinCore, CardIds.TheCoinCore];
					addCardsInHand(playerState.player, playerState.board, cardsToAdd, gameState);
				}
				break;
			case CardIds.GenerousGeomancer_BGDUO_111:
			case CardIds.GenerousGeomancer_BGDUO_111_G:
				const cardsToAdd =
					entity.cardId === CardIds.GenerousGeomancer_BGDUO_111
						? [CardIds.BloodGem]
						: [CardIds.BloodGem, CardIds.BloodGem];
				addCardsInHand(
					gameState.gameState.player.player,
					gameState.gameState.player.board,
					cardsToAdd,
					gameState,
				);
				if (gameState.gameState.player.teammate) {
					addCardsInHand(
						gameState.gameState.player.teammate.player,
						gameState.gameState.player.teammate.board,
						cardsToAdd,
						gameState,
					);
				}
				break;
			case CardIds.OrcEstraConductor_BGDUO_119:
			case CardIds.OrcEstraConductor_BGDUO_119_G:
				const conductorTarget = pickRandom(
					allMinions.filter((e) => hasCorrectTribe(e, Race.ELEMENTAL, gameState.allCards)),
				);
				if (!!conductorTarget) {
					const targetBoard = board.includes(conductorTarget) ? board : otherBoard;
					const targetHero = board.includes(conductorTarget) ? hero : otherHero;
					const multiplier = entity.cardId === CardIds.OrcEstraConductor_BGDUO_119 ? 1 : 2;
					const attackStats = 2 * (entity.scriptDataNum1 ?? 1) * multiplier;
					const healthStats = 2 * (entity.scriptDataNum1 ?? 1) * multiplier;
					modifyStats(conductorTarget, attackStats, healthStats, targetBoard, targetHero, gameState);
					gameState.spectator.registerPowerTarget(entity, conductorTarget, targetBoard, hero, otherHero);
				}
				break;
			case CardIds.FacelessOne_BGDUO_HERO_100_Buddy:
			case CardIds.FacelessOne_BGDUO_HERO_100_Buddy_G:
				const facelessOneCardsToAdd =
					entity.cardId === CardIds.FacelessOne_BGDUO_HERO_100_Buddy ? [null] : [null, null];
				addCardsInHand(hero, board, facelessOneCardsToAdd, gameState);
				break;
			case CardIds.Phyresz_TB_BaconShop_HERO_91_Buddy:
			case CardIds.Phyresz_TB_BaconShop_HERO_91_Buddy_G:
				const phyreszCardsToAdd =
					entity.cardId === CardIds.Phyresz_TB_BaconShop_HERO_91_Buddy ? [null] : [null, null];
				addCardsInHand(hero, board, phyreszCardsToAdd, gameState);
				break;
			case CardIds.Muckslinger_TB_BaconShop_HERO_23_Buddy:
			case CardIds.Muckslinger_TB_BaconShop_HERO_23_Buddy_G:
				const muckslingerCardsToAdd =
					entity.cardId === CardIds.Muckslinger_TB_BaconShop_HERO_23_Buddy
						? [pickRandom(gameState.cardsData.battlecryMinions)]
						: [
								pickRandom(gameState.cardsData.battlecryMinions),
								pickRandom(gameState.cardsData.battlecryMinions),
						  ];
				addCardsInHand(hero, board, muckslingerCardsToAdd, gameState);
				break;
			case CardIds.BarrensBrawler_BG29_861:
			case CardIds.BarrensBrawler_BG29_861_G:
				const barrendsBrawlerCardsToAdd =
					entity.cardId === CardIds.BarrensBrawler_BG29_861
						? [pickRandom(gameState.cardsData.deathrattleMinions)]
						: [
								pickRandom(gameState.cardsData.deathrattleMinions),
								pickRandom(gameState.cardsData.deathrattleMinions),
						  ];
				addCardsInHand(hero, board, barrendsBrawlerCardsToAdd, gameState);
				break;
			case CardIds.Vaelastrasz_TB_BaconShop_HERO_56_Buddy:
			case CardIds.Vaelastrasz_TB_BaconShop_HERO_56_Buddy_G:
				const vaelastraszBonus = entity.cardId === CardIds.Vaelastrasz_TB_BaconShop_HERO_56_Buddy_G ? 6 : 3;
				board
					.filter((e) => e.entityId !== entity.entityId)
					.forEach((e) => {
						modifyStats(e, vaelastraszBonus, vaelastraszBonus, board, hero, gameState);
					});
				break;
			case CardIds.ClunkerJunker_BG29_503:
			case CardIds.ClunkerJunker_BG29_503_G:
				const boardWithMechs = board.filter((e) => hasCorrectTribe(e, Race.MECH, gameState.allCards));
				const junkerTarget = pickRandom(boardWithMechs);
				if (junkerTarget) {
					// const name = gameState.allCards.getCard(junkerTarget.cardId)?.name;
					const numberOfMagnetizes = entity.cardId === CardIds.ClunkerJunker_BG29_503 ? 1 : 2;
					for (let i = 0; i < numberOfMagnetizes; i++) {
						const minionToMagnetize = gameState.cardsData.getRandomMechToMagnetize(hero.tavernTier ?? 1);
						// const magnet = gameState.allCards.getCard(minionToMagnetize).name;
						gameState.spectator.registerPowerTarget(entity, junkerTarget, board, null, null);
						magnetizeToTarget(junkerTarget, minionToMagnetize, board, hero, gameState);
					}
				}
				break;
			case CardIds.NathanosBlightcaller_BG23_HERO_306_Buddy:
			case CardIds.NathanosBlightcaller_BG23_HERO_306_Buddy_G:
				const nathanosTarget = pickRandom(board);
				if (nathanosTarget) {
					gameState.spectator.registerPowerTarget(entity, target, board, null, null);
					nathanosTarget.definitelyDead = true;
					const buffMultiplier = entity.cardId === CardIds.NathanosBlightcaller_BG23_HERO_306_Buddy ? 1 : 2;
					const attackBuff = nathanosTarget.attack * buffMultiplier;
					const healthBuff = nathanosTarget.health * buffMultiplier;
					const buffTargets = getNeighbours(board, nathanosTarget);
					buffTargets.forEach((e) => {
						modifyStats(e, attackBuff, healthBuff, board, hero, gameState);
						gameState.spectator.registerPowerTarget(entity, e, board, null, null);
					});
				}
				break;
			default:
				// All hte Battlecry minions that arent implemented / have no effect on the board state
				const hasBattlecry = gameState.allCards
					.getCard(entity.cardId)
					?.mechanics?.includes(GameTag[GameTag.BATTLECRY]);
				hasTriggered = hasBattlecry;
				break;
		}
		if (hasTriggered) {
			afterBattlecryTriggered(entity, board, hero, otherBoard, otherHero, gameState);
		}
	}
};

const afterBattlecryTriggered = (
	entity: BoardEntity,
	board: BoardEntity[],
	hero: BgsPlayerEntity,
	otherBoard: BoardEntity[],
	otherHero: BgsPlayerEntity,
	gameState: FullGameState,
) => {
	board
		.filter(
			(e) =>
				e.cardId === CardIds.KalecgosArcaneAspect_BGS_041 ||
				e.cardId === CardIds.KalecgosArcaneAspect_TB_BaconUps_109,
		)
		.forEach((e) => {
			const buff = entity.cardId === CardIds.KalecgosArcaneAspect_BGS_041 ? 1 : 2;
			addStatsToBoard(e, board, hero, buff, buff, gameState, Race[Race.DRAGON]);
		});
	board
		.filter((e) => e.cardId === CardIds.BlazingSkyfin_BG25_040 || e.cardId === CardIds.BlazingSkyfin_BG25_040_G)
		.forEach((e) => {
			const buff = e.cardId === CardIds.BlazingSkyfin_BG25_040 ? 1 : 2;
			modifyStats(e, buff, buff, board, hero, gameState);
		});
};

// TODO: this is probably too slow
const extractUniqueTribes = (board: BoardEntity[], allCards: AllCardsService): readonly Race[] => {
	const boardReferenceCards = board.map((m) => allCards.getCard(m.cardId));
	const minionsPlayedWithTribes = boardReferenceCards.filter((c) => !!c.races?.length);
	const minionsToProcess: /*Mutable<ReferenceCard & { picked?: boolean }>*/ any[] = [
		...minionsPlayedWithTribes
			.filter((c) => !c.races.includes(Race[Race.ALL]))
			.map((c) => ({ ...c, races: [...c.races] })),
	];

	const uniqueTribes: Race[] = [];
	const maxTribesPerMinion = 2;
	for (let i = 1; i <= maxTribesPerMinion; i++) {
		let dirty = true;
		while (dirty) {
			dirty = false;
			for (let j = 0; j < minionsToProcess.length; j++) {
				const minion = minionsToProcess[j];
				// console.debug('considering minion', minion.name, minion.races);
				if (!minion.picked && minion.races.length > 0 && minion.races.length <= i) {
					const raceToAdd: string = minion.races[0];
					uniqueTribes.push(Race[raceToAdd]);
					// console.debug('added', raceToAdd, uniqueTribes);
					for (const m of minionsToProcess) {
						m.races = m.races.filter((r) => r !== raceToAdd);
						// console.debug('updates races', m.name, m.races, raceToAdd);
					}
					minion.picked = true;
					dirty = true;
					// Restart the loop, so we're not dependant on the order in which we process things
					j = 0;
				}
			}
			// minionsToProcess = minionsToProcess.filter((c) => !c.picked);
		}
	}

	uniqueTribes.push(
		...minionsPlayedWithTribes
			.filter((m) => m.races.includes(Race[Race.ALL]))
			.flatMap((m) => m.races)
			.map((r: string) => Race[r]),
	);
	return uniqueTribes;
};
