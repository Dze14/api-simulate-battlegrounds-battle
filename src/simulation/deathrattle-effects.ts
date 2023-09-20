/* eslint-disable @typescript-eslint/no-use-before-define */
import { AllCardsService, CardIds, Race } from '@firestone-hs/reference-data';
import { BgsPlayerEntity } from '../bgs-player-entity';
import { BoardEntity } from '../board-entity';
import { CardsData } from '../cards/cards-data';
import { groupByFunction, pickMultipleRandomDifferent, pickRandom } from '../services/utils';
import {
	addCardsInHand,
	addStatsToBoard,
	afterStatsUpdate,
	grantRandomAttack,
	grantRandomDivineShield,
	grantRandomHealth,
	grantRandomStats,
	hasCorrectTribe,
	isCorrectTribe,
	isFish,
	isGolden,
	makeMinionGolden,
	modifyAttack,
	modifyHealth,
	updateDivineShield,
} from '../utils';
import { dealDamageToEnemy, dealDamageToRandomEnemy, findNearestEnemies, getNeighbours } from './attack';
import { triggerBattlecry } from './battlecries';
import { spawnEntities } from './deathrattle-spawns';
import { SharedState } from './shared-state';
import { Spectator } from './spectator/spectator';

export const computeDeathrattleMultiplier = (
	board: BoardEntity[],
	boardHero: BgsPlayerEntity,
	deadEntity: BoardEntity,
	sharedState: SharedState,
): number => {
	const rivendare = !!board.find(
		(entity) =>
			entity.cardId === CardIds.BaronRivendare_BG_FP1_031 || entity.cardId === CardIds.MoiraBronzebeard_BG27_518,
	);
	const goldenRivendare = board.find(
		(entity) =>
			entity.cardId === CardIds.BaronRivendare_TB_BaconUps_055 ||
			entity.cardId === CardIds.MoiraBronzebeard_BG27_518_G,
	);
	const titus = board.filter((entity) => entity.cardId === CardIds.TitusRivendare_BG25_354).length;
	const goldenTitus = board.filter((entity) => entity.cardId === CardIds.TitusRivendare_BG25_354_G).length;
	const tombs =
		boardHero.questRewardEntities?.filter((entity) => entity.cardId === CardIds.TurbulentTombs)?.length ?? 0;
	const echoesOfArgus = sharedState.anomalies.includes(CardIds.EchoesOfArgus_BG27_Anomaly_802) ? 1 : 0;
	const scourgeMultiplier = deadEntity.additionalCards?.includes(CardIds.ScourgeTroll) ? 2 : 1;
	const multiplier =
		scourgeMultiplier *
		((goldenRivendare ? 3 : rivendare ? 2 : 1) + titus + 2 * goldenTitus + tombs + echoesOfArgus);
	return multiplier;
};

export const handleDeathrattleEffects = (
	boardWithDeadEntity: BoardEntity[],
	boardWithDeadEntityHero: BgsPlayerEntity,
	deadEntity: BoardEntity,
	deadEntityIndexFromRight: number,
	otherBoard: BoardEntity[],
	otherBoardHero: BgsPlayerEntity,
	allCards: AllCardsService,
	cardsData: CardsData,
	sharedState: SharedState,
	spectator: Spectator,
): void => {
	const multiplier = computeDeathrattleMultiplier(
		boardWithDeadEntity,
		boardWithDeadEntityHero,
		deadEntity,
		sharedState,
	);
	// We do it on a case by case basis so that we deal all the damage in one go for instance
	// and avoid proccing deathrattle spawns between the times the damage triggers

	const cardIds = [deadEntity.cardId, ...(deadEntity.additionalCards ?? [])];
	for (const deadEntityCardId of cardIds) {
		switch (deadEntityCardId) {
			case CardIds.RylakMetalhead_BG26_801:
			case CardIds.RylakMetalhead_BG26_801_G:
				const rylakMutltiplier = deadEntityCardId === CardIds.RylakMetalhead_BG26_801_G ? 2 : 1;
				for (let i = 0; i < multiplier; i++) {
					const neighbours = getNeighbours(boardWithDeadEntity, null, deadEntityIndexFromRight);
					for (const neighbour of neighbours) {
						spectator.registerPowerTarget(deadEntity, neighbour, boardWithDeadEntity);
						for (let j = 0; j < rylakMutltiplier; j++) {
							triggerBattlecry(
								boardWithDeadEntity,
								boardWithDeadEntityHero,
								neighbour,
								otherBoard,
								otherBoardHero,
								allCards,
								cardsData,
								sharedState,
								spectator,
							);
						}
					}
				}
				break;
			case CardIds.SelflessHero_BG_OG_221:
				for (let i = 0; i < multiplier; i++) {
					grantRandomDivineShield(deadEntity, boardWithDeadEntity, allCards, spectator);
				}
				break;
			case CardIds.SelflessHero_TB_BaconUps_014:
				for (let i = 0; i < multiplier; i++) {
					grantRandomDivineShield(deadEntity, boardWithDeadEntity, allCards, spectator);
					grantRandomDivineShield(deadEntity, boardWithDeadEntity, allCards, spectator);
				}
				break;
			case CardIds.OperaticBelcher_BG26_888:
			case CardIds.OperaticBelcher_BG26_888_G:
				const belcherMultiplier = deadEntityCardId === CardIds.OperaticBelcher_BG26_888_G ? 2 : 1;
				for (let i = 0; i < multiplier; i++) {
					for (let j = 0; j < belcherMultiplier; j++) {
						const possibleBelcherTargets = boardWithDeadEntity
							.filter((entity) => !entity.venomous)
							.filter((entity) => !entity.poisonous)
							.filter((entity) => entity.health > 0 && !entity.definitelyDead)
							.filter((entity) => hasCorrectTribe(entity, Race.MURLOC, allCards));
						if (possibleBelcherTargets.length > 0) {
							const chosen = pickRandom(possibleBelcherTargets);
							chosen.venomous = true;
							spectator.registerPowerTarget(deadEntity, chosen, boardWithDeadEntity);
						}
					}
				}
				break;
			case CardIds.SpiritOfAir_TB_BaconShop_HERO_76_Buddy:
			case CardIds.SpiritOfAir_TB_BaconShop_HERO_76_Buddy_G:
				const iterations = deadEntityCardId === CardIds.SpiritOfAir_TB_BaconShop_HERO_76_Buddy_G ? 2 : 1;
				for (let i = 0; i < multiplier; i++) {
					for (let j = 0; j < iterations; j++) {
						let validTargets = boardWithDeadEntity.filter((entity) => !entity.divineShield);
						if (!validTargets?.length) {
							validTargets = boardWithDeadEntity.filter((entity) => !entity.taunt);
							if (!validTargets?.length) {
								validTargets = boardWithDeadEntity.filter((entity) => !entity.windfury);
							}
						}
						const target = pickRandom(validTargets);
						if (target) {
							if (!target.divineShield) {
								updateDivineShield(target, boardWithDeadEntity, true, allCards);
							}
							target.taunt = true;
							target.windfury = true;
							spectator.registerPowerTarget(deadEntity, target, boardWithDeadEntity);
						}
					}
				}
				break;
			case CardIds.NadinaTheRed_BGS_040:
			case CardIds.NadinaTheRed_TB_BaconUps_154:
				for (let i = 0; i < multiplier; i++) {
					const nadinaMultiplier = deadEntityCardId === CardIds.NadinaTheRed_TB_BaconUps_154 ? 6 : 3;
					for (let j = 0; j < nadinaMultiplier; j++) {
						const validTargets = boardWithDeadEntity
							.filter((e) => hasCorrectTribe(e, Race.DRAGON, allCards))
							.filter((entity) => !entity.divineShield);
						const target = pickRandom(validTargets);
						if (target) {
							updateDivineShield(target, boardWithDeadEntity, true, allCards);
							spectator.registerPowerTarget(deadEntity, target, boardWithDeadEntity);
						}
					}
				}
				break;
			case CardIds.SpawnOfNzoth_BG_OG_256:
				addStatsToBoard(deadEntity, boardWithDeadEntity, multiplier * 1, multiplier * 1, allCards, spectator);
				break;
			case CardIds.SpawnOfNzoth_TB_BaconUps_025:
				addStatsToBoard(deadEntity, boardWithDeadEntity, multiplier * 2, multiplier * 2, allCards, spectator);
				break;
			case CardIds.GoldrinnTheGreatWolf_BGS_018:
				addStatsToBoard(
					deadEntity,
					boardWithDeadEntity,
					multiplier * 5,
					multiplier * 5,
					allCards,
					spectator,
					'BEAST',
				);
				break;
			case CardIds.GoldrinnTheGreatWolf_TB_BaconUps_085:
				addStatsToBoard(
					deadEntity,
					boardWithDeadEntity,
					multiplier * 10,
					multiplier * 10,
					allCards,
					spectator,
					'BEAST',
				);
				break;
			case CardIds.KingBagurgle_BGS_030:
				addStatsToBoard(
					deadEntity,
					boardWithDeadEntity,
					multiplier * 2,
					multiplier * 3,
					allCards,
					spectator,
					'MURLOC',
				);
				break;
			case CardIds.KingBagurgle_TB_BaconUps_100:
				addStatsToBoard(
					deadEntity,
					boardWithDeadEntity,
					multiplier * 4,
					multiplier * 6,
					allCards,
					spectator,
					'MURLOC',
				);
				break;
			case CardIds.FiendishServant_YOD_026:
				for (let i = 0; i < multiplier; i++) {
					grantRandomAttack(deadEntity, boardWithDeadEntity, deadEntity.attack, allCards, spectator);
				}
				break;
			case CardIds.FiendishServant_TB_BaconUps_112:
				for (let i = 0; i < multiplier; i++) {
					grantRandomAttack(deadEntity, boardWithDeadEntity, deadEntity.attack, allCards, spectator);
					grantRandomAttack(deadEntity, boardWithDeadEntity, deadEntity.attack, allCards, spectator);
				}
				break;
			case CardIds.ImpulsiveTrickster_BG21_006:
				for (let i = 0; i < multiplier; i++) {
					grantRandomHealth(deadEntity, boardWithDeadEntity, deadEntity.maxHealth, allCards, spectator, true);
				}
				break;
			case CardIds.ImpulsiveTrickster_BG21_006_G:
				for (let i = 0; i < multiplier; i++) {
					grantRandomHealth(deadEntity, boardWithDeadEntity, deadEntity.maxHealth, allCards, spectator, true);
					grantRandomHealth(deadEntity, boardWithDeadEntity, deadEntity.maxHealth, allCards, spectator, true);
				}
				break;
			case CardIds.Leapfrogger_BG21_000:
				for (let i = 0; i < multiplier; i++) {
					applyLeapFroggerEffect(boardWithDeadEntity, deadEntity, false, allCards, spectator, sharedState);
				}
				break;
			case CardIds.Leapfrogger_BG21_000_G:
				for (let i = 0; i < multiplier; i++) {
					applyLeapFroggerEffect(boardWithDeadEntity, deadEntity, true, allCards, spectator, sharedState);
				}
				break;
			case CardIds.PalescaleCrocolisk_BG21_001:
				for (let i = 0; i < multiplier; i++) {
					const target = grantRandomStats(
						deadEntity,
						boardWithDeadEntity,
						6,
						6,
						Race.BEAST,
						true,
						allCards,
						spectator,
					);
					if (!!target) {
						spectator.registerPowerTarget(deadEntity, target, boardWithDeadEntity);
					}
				}
				break;
			case CardIds.PalescaleCrocolisk_BG21_001_G:
				for (let i = 0; i < multiplier; i++) {
					const target = grantRandomStats(
						deadEntity,
						boardWithDeadEntity,
						12,
						12,
						Race.BEAST,
						true,
						allCards,
						spectator,
					);
					if (!!target) {
						spectator.registerPowerTarget(deadEntity, target, boardWithDeadEntity);
					}
				}
				break;
			case CardIds.ScarletSkull_BG25_022:
			case CardIds.ScarletSkull_BG25_022_G:
				const scarletMultiplier = deadEntityCardId === CardIds.ScarletSkull_BG25_022_G ? 2 : 1;
				for (let i = 0; i < multiplier; i++) {
					const target = grantRandomStats(
						deadEntity,
						boardWithDeadEntity,
						scarletMultiplier * 1,
						scarletMultiplier * 2,
						Race.UNDEAD,
						false,
						allCards,
						spectator,
					);
					if (!!target) {
						spectator.registerPowerTarget(deadEntity, target, boardWithDeadEntity);
					}
				}
				break;
			case CardIds.AnubarakNerubianKing_BG25_007:
			case CardIds.AnubarakNerubianKing_BG25_007_G:
				const anubarakMultiplier = deadEntityCardId === CardIds.AnubarakNerubianKing_BG25_007_G ? 2 : 1;
				const attackBonus = anubarakMultiplier * 1;
				for (let i = 0; i < multiplier; i++) {
					boardWithDeadEntityHero.globalInfo.UndeadAttackBonus += attackBonus;
					addStatsToBoard(
						deadEntity,
						boardWithDeadEntity,
						attackBonus,
						0,
						allCards,
						spectator,
						Race[Race.UNDEAD],
					);
				}
				break;
			// case CardIds.ElementiumSquirrelBombBattlegrounds_TB_BaconShop_HERO_17_Buddy:
			// 	// FIXME: I don't think this way of doing things is really accurate (as some deathrattles
			// 	// could be spawned between the shots firing), but let's say it's good enough for now
			// 	for (let i = 0; i < multiplier; i++) {
			// 		const numberOfDeadMechsThisCombat = sharedState.deaths
			// 			.filter((entity) => entity.friendly === deadEntity.friendly)
			// 			// eslint-disable-next-line prettier/prettier
			// 			.filter((entity) => isCorrectTribe(allCards.getCard(entity.cardId)?.races, Race.MECH)).length;
			// 		for (let j = 0; j < numberOfDeadMechsThisCombat + 1; j++) {
			// 			dealDamageToRandomEnemy(
			// 				otherBoard,
			// 				otherBoardHero,
			// 				deadEntity,
			// 				3,
			// 				boardWithDeadEntity,
			// 				boardWithDeadEntityHero,
			// 				allCards,
			// 				cardsData,
			// 				sharedState,
			// 				spectator,
			// 			);
			// 		}
			// 	}
			// 	break;
			case CardIds.ElementiumSquirrelBomb_TB_BaconShop_HERO_17_Buddy:
			case CardIds.ElementiumSquirrelBomb_TB_BaconShop_HERO_17_Buddy_G:
				// FIXME: I don't think this way of doing things is really accurate (as some deathrattles
				// could be spawned between the shots firing), but let's say it's good enough for now
				const squirrelDamage =
					deadEntity.cardId === CardIds.ElementiumSquirrelBomb_TB_BaconShop_HERO_17_Buddy_G ? 4 : 2;
				for (let i = 0; i < multiplier; i++) {
					const numberOfDeadMechsThisCombat = sharedState.deaths
						.filter((entity) => entity.friendly === deadEntity.friendly)
						// eslint-disable-next-line prettier/prettier
						.filter((entity) => isCorrectTribe(allCards.getCard(entity.cardId)?.races, Race.MECH)).length;
					for (let j = 0; j < numberOfDeadMechsThisCombat + 1; j++) {
						dealDamageToRandomEnemy(
							otherBoard,
							otherBoardHero,
							deadEntity,
							squirrelDamage,
							boardWithDeadEntity,
							boardWithDeadEntityHero,
							allCards,
							cardsData,
							sharedState,
							spectator,
						);
					}
				}
				break;
			case CardIds.KaboomBot_BG_BOT_606:
			case CardIds.KaboomBot_TB_BaconUps_028:
				// FIXME: I don't think this way of doing things is really accurate (as some deathrattles
				// could be spawned between the shots firing), but let's say it's good enough for now
				const kaboomLoops = deadEntity.cardId === CardIds.KaboomBot_TB_BaconUps_028 ? 2 : 1;
				for (let i = 0; i < multiplier; i++) {
					for (let j = 0; j < kaboomLoops; j++) {
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
				}
				break;
			case CardIds.DrBoombox_BG25_165:
			case CardIds.DrBoombox_BG25_165_G:
				// FIXME: I don't think this way of doing things is really accurate (as some deathrattles
				// could be spawned between the shots firing), but let's say it's good enough for now
				const boomboxDamage = deadEntity.cardId === CardIds.DrBoombox_BG25_165_G ? 14 : 7;
				for (let i = 0; i < multiplier; i++) {
					// The nearest enemies use the full board info
					// const boardIncludingDeadEntityAtCorrectIndex = boardWithDeadEntity.splice(
					// 	deadEntityIndexFromRight,
					// 	0,
					// 	deadEntity,
					// );
					const targets = findNearestEnemies(
						boardWithDeadEntity,
						null,
						deadEntityIndexFromRight,
						otherBoard,
						2,
						allCards,
					);
					targets.forEach((target) => {
						// console.debug('dealing damage to', stringifySimpleCard(target));
						dealDamageToEnemy(
							target,
							otherBoard,
							otherBoardHero,
							deadEntity,
							boomboxDamage,
							boardWithDeadEntity,
							boardWithDeadEntityHero,
							allCards,
							cardsData,
							sharedState,
							spectator,
						);
					});
				}
				break;
			case CardIds.UnstableGhoul_BG_FP1_024:
			case CardIds.UnstableGhoul_TB_BaconUps_118:
				const damage = deadEntityCardId === CardIds.UnstableGhoul_TB_BaconUps_118 ? 2 : 1;
				for (let i = 0; i < multiplier; i++) {
					dealDamageToAllMinions(
						boardWithDeadEntity,
						boardWithDeadEntityHero,
						otherBoard,
						otherBoardHero,
						deadEntity,
						damage,
						allCards,
						cardsData,
						sharedState,
						spectator,
					);
				}
				break;
			case CardIds.TunnelBlaster_BG_DAL_775:
			case CardIds.TunnelBlaster_BG_DAL_775_G:
				const loops = deadEntityCardId === CardIds.TunnelBlaster_BG_DAL_775_G ? 2 : 1;
				for (let i = 0; i < multiplier; i++) {
					for (let j = 0; j < loops; j++) {
						dealDamageToAllMinions(
							boardWithDeadEntity,
							boardWithDeadEntityHero,
							otherBoard,
							otherBoardHero,
							deadEntity,
							3,
							allCards,
							cardsData,
							sharedState,
							spectator,
						);
					}
				}
				break;
			case CardIds.LeeroyTheReckless_BG23_318:
			case CardIds.LeeroyTheReckless_BG23_318_G:
				if (deadEntity.lastAffectedByEntity) {
					deadEntity.lastAffectedByEntity.definitelyDead = true;
				}
				break;
			case CardIds.RadioStar_BG25_399:
			case CardIds.RadioStar_BG25_399_G:
				const radioQuantity = deadEntityCardId === CardIds.RadioStar_BG25_399_G ? 2 : 1;
				const radioEntities = Array(radioQuantity).fill(deadEntity.lastAffectedByEntity);
				addCardsInHand(boardWithDeadEntityHero, boardWithDeadEntity, allCards, spectator, radioEntities);
				break;
			case CardIds.SrTombDiver_TB_BaconShop_HERO_41_Buddy:
				for (let i = 0; i < Math.min(1, boardWithDeadEntity.length); i++) {
					const rightMostMinion = boardWithDeadEntity[boardWithDeadEntity.length - 1 - i];
					if (rightMostMinion) {
						makeMinionGolden(rightMostMinion, deadEntity, boardWithDeadEntity, allCards, spectator);
					}
				}
				break;
			case CardIds.SrTombDiver_TB_BaconShop_HERO_41_Buddy_G:
				for (let i = 0; i < Math.min(2, boardWithDeadEntity.length); i++) {
					const rightMostMinion = boardWithDeadEntity[boardWithDeadEntity.length - 1 - i];
					if (rightMostMinion) {
						makeMinionGolden(rightMostMinion, deadEntity, boardWithDeadEntity, allCards, spectator);
					}
				}
				break;
			case CardIds.Scourfin_BG26_360:
			case CardIds.Scourfin_BG26_360_G:
				const statsScourfin = deadEntityCardId === CardIds.Scourfin_BG26_360_G ? 10 : 5;
				for (let i = 0; i < multiplier; i++) {
					grantRandomStats(
						deadEntity,
						boardWithDeadEntityHero.hand,
						statsScourfin,
						statsScourfin,
						null,
						true,
						allCards,
						null,
					);
				}
				break;
			case CardIds.SanguineChampion_BG23_017:
			case CardIds.SanguineChampion_BG23_017_G:
				const sanguineChampionStats = deadEntityCardId === CardIds.SanguineChampion_BG23_017 ? 1 : 2;
				boardWithDeadEntityHero.globalInfo.BloodGemAttackBonus += sanguineChampionStats;
				boardWithDeadEntityHero.globalInfo.BloodGemHealthBonus += sanguineChampionStats;
				break;

			// Putricide-only
			case CardIds.Banshee_BG_RLK_957:
				for (let i = 0; i < multiplier; i++) {
					addStatsToBoard(deadEntity, boardWithDeadEntity, 2, 1, allCards, spectator, Race[Race.UNDEAD]);
				}
				break;
			case CardIds.LostSpirit_BG26_GIL_513:
				for (let i = 0; i < multiplier; i++) {
					addStatsToBoard(deadEntity, boardWithDeadEntity, 1, 0, allCards, spectator, null);
				}
				break;
			case CardIds.TickingAbomination_BG_ICC_099:
				for (let i = 0; i < multiplier; i++) {
					for (const entity of boardWithDeadEntity) {
						dealDamageToEnemy(
							entity,
							boardWithDeadEntity,
							boardWithDeadEntityHero,
							deadEntity,
							5,
							otherBoard,
							otherBoardHero,
							allCards,
							cardsData,
							sharedState,
							spectator,
						);
					}
				}
				break;
			case CardIds.WitheredSpearhide_BG27_006:
			case CardIds.WitheredSpearhide_BG27_006_G:
				const witheredSpearhideCardsToAdd = Array(CardIds.WitheredSpearhide_BG27_006_G ? 2 : 1).fill(
					CardIds.BloodGem,
				);
				addCardsInHand(
					boardWithDeadEntityHero,
					boardWithDeadEntity,
					allCards,
					spectator,
					witheredSpearhideCardsToAdd,
				);
				break;
			case CardIds.RecurringNightmare_BG26_055:
			case CardIds.RecurringNightmare_BG26_055_G:
				for (let i = 0; i < multiplier; i++) {
					applyRecurringNightmareDeathrattleEffect(
						boardWithDeadEntity,
						deadEntity,
						deadEntityCardId === CardIds.RecurringNightmare_BG26_055_G,
						allCards,
						spectator,
						sharedState,
					);
				}
				break;
		}
	}

	// It's important to first copy the enchantments, otherwise you could end up
	// in an infinite loop - since new enchants are added after each step

	let enchantments: { cardId: string; originEntityId?: number; repeats?: number }[] = [
		...(deadEntity.enchantments ?? []),
		...(deadEntity.rememberedDeathrattles ?? []),
	].sort((a, b) => a.timing - b.timing);
	// In some cases it's possible that there are way too many enchantments because of the frog
	// In that case, we make a trade-off and don't trigger the "on stats change" trigger as
	// often as we should, so that we can have the stats themselves correct
	// We don't want to lump everything together, as it skews the stats when there are a lot of buffs
	// Instead, we build groups
	const maxNumberOfGroups = 12;
	const enchantmentGroups = groupByFunction((enchantment: any) => enchantment.cardId)(enchantments);
	enchantments = Object.keys(enchantmentGroups).flatMap((cardId) => {
		let repeatsToApply = enchantmentGroups[cardId].map((e) => e.repeats || 1).reduce((a, b) => a + b, 0);

		// Frogs include the multiplers here directly
		if (
			[
				CardIds.Leapfrogger_LeapfrogginEnchantment_BG21_000e,
				CardIds.Leapfrogger_LeapfrogginEnchantment_BG21_000_Ge,
			].includes(cardId as CardIds)
		) {
			repeatsToApply = repeatsToApply * multiplier;
		}

		const results = [];
		const repeatsPerBuff = Math.max(1, Math.floor(repeatsToApply / maxNumberOfGroups));
		let repeatsDone = 0;
		while (repeatsDone < repeatsToApply) {
			const repeats = Math.min(repeatsPerBuff, repeatsToApply - repeatsDone);
			results.push({
				cardId: cardId,
				repeats: repeats,
				timing: Math.min(...enchantmentGroups[cardId].map((e) => e.timing)),
			});
			repeatsDone += repeatsPerBuff;
		}
		return results;
	});
	for (const enchantment of enchantments) {
		switch (enchantment.cardId) {
			case CardIds.Leapfrogger_LeapfrogginEnchantment_BG21_000e:
			case CardIds.Leapfrogger_LeapfrogginEnchantment_BG21_000_Ge:
				applyLeapFroggerEffect(
					boardWithDeadEntity,
					deadEntity,
					enchantment.cardId === CardIds.Leapfrogger_LeapfrogginEnchantment_BG21_000_Ge,
					allCards,
					spectator,
					sharedState,
					enchantment.repeats || 1,
				);
				break;
			case CardIds.EarthRecollectionEnchantment:
				for (let i = 0; i < multiplier; i++) {
					applyEarthInvocationEnchantment(
						boardWithDeadEntity,
						deadEntity,
						deadEntity,
						allCards,
						sharedState,
						spectator,
					);
				}
				break;
			case CardIds.FireRecollectionEnchantment:
				for (let i = 0; i < multiplier; i++) {
					applyFireInvocationEnchantment(boardWithDeadEntity, deadEntity, deadEntity, allCards, spectator);
				}
				break;
			case CardIds.WaterRecollectionEnchantment:
				for (let i = 0; i < multiplier; i++) {
					applyWaterInvocationEnchantment(boardWithDeadEntity, deadEntity, deadEntity, allCards, spectator);
				}
				break;
			case CardIds.LightningRecollectionEnchantment:
				for (let i = 0; i < multiplier; i++) {
					applyLightningInvocationEnchantment(
						boardWithDeadEntity,
						boardWithDeadEntityHero,
						deadEntity,
						otherBoard,
						otherBoardHero,
						allCards,
						cardsData,
						sharedState,
						spectator,
					);
				}
				break;
		}
	}
	// const playerCopy = boardWithDeadEntity.map((e) => ({ ...e, lastAffectedByEntity: null }));
	// const oppCopy = otherBoard.map((e) => ({ ...e, lastAffectedByEntity: null }));
	// console.log('player board', boardWithDeadEntity.length, playerCopy.length, playerCopy.map((e) => JSON.stringify(e)).join('\n'));
	// console.log('opp board', JSON.stringify(oppCopy));
};

export const applyLightningInvocationEnchantment = (
	boardWithDeadEntity: BoardEntity[],
	boardWithDeadEntityHero: BgsPlayerEntity,
	deadEntity: BoardEntity,
	otherBoard: BoardEntity[],
	otherBoardHero: BgsPlayerEntity,
	allCards: AllCardsService,
	cardsData: CardsData,
	sharedState: SharedState,
	spectator: Spectator,
): void => {
	// Because the golden version doubles all the remembered effects
	const multiplier = deadEntity?.cardId === CardIds.SpiritRaptor_BG22_HERO_001_Buddy_G ? 2 : 1;
	for (let i = 0; i < multiplier; i++) {
		const targets = pickMultipleRandomDifferent(otherBoard, 5);
		for (const target of targets) {
			dealDamageToEnemy(
				target,
				otherBoard,
				otherBoardHero,
				deadEntity,
				1,
				boardWithDeadEntity,
				boardWithDeadEntityHero,
				allCards,
				cardsData,
				sharedState,
				spectator,
			);
		}
	}
};

export const applyWaterInvocationEnchantment = (
	boardWithDeadEntity: BoardEntity[],
	deadEntity: BoardEntity,
	sourceEntity: BgsPlayerEntity | BoardEntity,
	allCards: AllCardsService,
	spectator: Spectator,
): void => {
	const multiplier = deadEntity?.cardId === CardIds.SpiritRaptor_BG22_HERO_001_Buddy_G ? 2 : 1;
	for (let i = 0; i < multiplier; i++) {
		const target: BoardEntity = boardWithDeadEntity[boardWithDeadEntity.length - 1];
		if (!!target) {
			modifyHealth(target, 3, boardWithDeadEntity, allCards);
			target.taunt = true;
			afterStatsUpdate(target, boardWithDeadEntity, allCards);
			spectator.registerPowerTarget(sourceEntity, target, boardWithDeadEntity);
		}
	}
};

export const applyFireInvocationEnchantment = (
	boardWithDeadEntity: BoardEntity[],
	deadEntity: BoardEntity,
	sourceEntity: BgsPlayerEntity | BoardEntity,
	allCards: AllCardsService,
	spectator: Spectator,
): void => {
	const multiplier = deadEntity?.cardId === CardIds.SpiritRaptor_BG22_HERO_001_Buddy_G ? 2 : 1;
	for (let i = 0; i < multiplier; i++) {
		const target: BoardEntity = boardWithDeadEntity[0];
		if (!!target) {
			modifyAttack(target, target.attack, boardWithDeadEntity, allCards);
			afterStatsUpdate(target, boardWithDeadEntity, allCards);
			spectator.registerPowerTarget(sourceEntity, target, boardWithDeadEntity);
		}
	}
};

export const applyEarthInvocationEnchantment = (
	boardWithDeadEntity: BoardEntity[],
	deadEntity: BoardEntity,
	sourceEntity: BgsPlayerEntity | BoardEntity,
	allCards: AllCardsService,
	sharedState: SharedState,
	spectator: Spectator,
): void => {
	const multiplier = deadEntity?.cardId === CardIds.SpiritRaptor_BG22_HERO_001_Buddy_G ? 2 : 1;
	for (let i = 0; i < multiplier; i++) {
		const minionsGrantedDeathrattle: BoardEntity[] = pickMultipleRandomDifferent(boardWithDeadEntity, 4);
		minionsGrantedDeathrattle.forEach((minion) => {
			minion.enchantments.push({
				cardId: CardIds.EarthInvocation_ElementEarthEnchantment,
				originEntityId: deadEntity?.entityId,
				timing: sharedState.currentEntityId++,
			});
			spectator.registerPowerTarget(sourceEntity, minion, boardWithDeadEntity);
		});
	}
};

const applyLeapFroggerEffect = (
	boardWithDeadEntity: BoardEntity[],
	deadEntity: BoardEntity,
	isPremium: boolean,
	allCards: AllCardsService,
	spectator: Spectator,
	sharedState: SharedState,
	multiplier = 1,
): void => {
	multiplier = multiplier || 1;
	const buffed = grantRandomStats(
		deadEntity,
		boardWithDeadEntity,
		multiplier * (isPremium ? 2 : 1),
		multiplier * (isPremium ? 2 : 1),
		Race.BEAST,
		false,
		allCards,
		spectator,
	);
	if (buffed) {
		buffed.enchantments = buffed.enchantments ?? [];
		buffed.enchantments.push({
			cardId: isPremium
				? CardIds.Leapfrogger_LeapfrogginEnchantment_BG21_000_Ge
				: CardIds.Leapfrogger_LeapfrogginEnchantment_BG21_000e,
			originEntityId: deadEntity.entityId,
			repeats: multiplier > 1 ? multiplier : 1,
			timing: sharedState.currentEntityId++,
		});
		// Don't register power effect here, since it's already done in the random stats
		// spectator.registerPowerTarget(deadEntity, buffed, boardWithDeadEntity);
		// console.log('applyLeapFroggerEffect', stringifySimpleCard(deadEntity), stringifySimpleCard(buffed));
	}
};

const applyRecurringNightmareDeathrattleEffect = (
	boardWithDeadEntity: BoardEntity[],
	deadEntity: BoardEntity,
	isPremium: boolean,
	allCards: AllCardsService,
	spectator: Spectator,
	sharedState: SharedState,
	multiplier = 1,
): void => {
	multiplier = multiplier || 1;
	const target = pickRandom(
		boardWithDeadEntity.filter(
			(e) =>
				e.cardId !== CardIds.RecurringNightmare_BG26_055 && e.cardId !== CardIds.RecurringNightmare_BG26_055_G,
		),
	);
	if (target) {
		target.enchantments = target.enchantments ?? [];
		target.enchantments.push({
			cardId: isPremium
				? CardIds.RecurringNightmare_NightmareInsideEnchantment_BG26_055_Ge
				: CardIds.RecurringNightmare_NightmareInsideEnchantment_BG26_055e,
			originEntityId: deadEntity.entityId,
			repeats: multiplier > 1 ? multiplier : 1,
			timing: sharedState.currentEntityId++,
		});
		spectator.registerPowerTarget(deadEntity, target, boardWithDeadEntity);
	}
};

export const applyMinionDeathEffect = (
	deadEntity: BoardEntity,
	deadEntityIndexFromRight: number,
	boardWithDeadEntity: BoardEntity[],
	boardWithDeadEntityHero: BgsPlayerEntity,
	otherBoard: BoardEntity[],
	otherBoardHero: BgsPlayerEntity,
	allCards: AllCardsService,
	cardsData: CardsData,
	sharedState: SharedState,
	spectator: Spectator,
): void => {
	// console.log('applying minion death effect', stringifySimpleCard(deadEntity, allCards));
	if (isCorrectTribe(allCards.getCard(deadEntity.cardId).races, Race.BEAST)) {
		applyScavengingHyenaEffect(boardWithDeadEntity, allCards, spectator);
	}
	if (isCorrectTribe(allCards.getCard(deadEntity.cardId).races, Race.DEMON)) {
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
	if (isCorrectTribe(allCards.getCard(deadEntity.cardId).races, Race.MECH)) {
		applyJunkbotEffect(boardWithDeadEntity, allCards, spectator);
	}
	if (hasCorrectTribe(deadEntity, Race.MURLOC, allCards)) {
		removeOldMurkEyeAttack(boardWithDeadEntity, allCards);
		removeOldMurkEyeAttack(otherBoard, allCards);
	}
	if (deadEntity.taunt) {
		applyBristlemaneScrapsmithEffect(boardWithDeadEntity, boardWithDeadEntityHero, allCards, spectator);
		applyQirajiHarbringerEffect(boardWithDeadEntity, deadEntityIndexFromRight, allCards, spectator);
	}

	if (
		deadEntity.cardId === CardIds.EternalKnight_BG25_008 ||
		deadEntity.cardId === CardIds.EternalKnight_BG25_008_G
	) {
		applyEternalKnightEffect(boardWithDeadEntity, allCards, spectator);
	}

	// Putricide-only
	boardWithDeadEntity
		.filter((e) => e.additionalCards?.includes(CardIds.FlesheatingGhoulLegacy_BG26_tt_004))
		.forEach((e) => {
			modifyAttack(e, 1, boardWithDeadEntity, allCards);
			afterStatsUpdate(e, boardWithDeadEntity, allCards);
		});

	applyRotHideGnollEffect(boardWithDeadEntity, allCards, spectator);

	// Overkill
	if (deadEntity.health < 0 && deadEntity.lastAffectedByEntity?.attacking) {
		if (deadEntity.lastAffectedByEntity.cardId === CardIds.HeraldOfFlame_BGS_032) {
			const targets = boardWithDeadEntity.filter((entity) => entity.health > 0 && !entity.definitelyDead);
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
		} else if (deadEntity.lastAffectedByEntity.cardId === CardIds.HeraldOfFlame_TB_BaconUps_103) {
			const targets = boardWithDeadEntity.filter((entity) => entity.health > 0 && !entity.definitelyDead);
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
		}
		// else if (deadEntity.lastAffectedByEntity.cardId === CardIds.WildfireElemental && deadEntity.lastAffectedByEntity.attacking) {
		// 	// } else if (deadEntity.lastAffectedByEntity.cardId === CardIds.WildfireElemental) {
		// 	// console.log('applying WildfireElemental effect', stringifySimple(boardWithDeadEntity, allCards));
		// 	const excessDamage = -deadEntity.health;
		// 	// Prevent propagation of the effect
		// 	deadEntity.lastAffectedByEntity.attacking = false;
		// 	const neighbours = getNeighbours(boardWithDeadEntity, null, boardWithDeadEntity.length - deadEntityIndexFromRight);
		// 	// console.log('neighbours', stringifySimple(neighbours, allCards));
		// 	if (neighbours.length > 0) {
		// 		const randomTarget = neighbours[Math.floor(Math.random() * neighbours.length)];
		// 		dealDamageToEnemy(
		// 			randomTarget,
		// 			boardWithDeadEntity,
		// 			boardWithDeadEntityHero,
		// 			deadEntity.lastAffectedByEntity,
		// 			excessDamage,
		// 			otherBoard,
		// 			otherBoardHero,
		// 			allCards,
		// 			cardsData,
		// 			sharedState,
		// 			spectator,
		// 		);
		// 	}
		// } else if (
		// 	deadEntity.lastAffectedByEntity.cardId === CardIds.WildfireElementalBattlegrounds &&
		// 	deadEntity.lastAffectedByEntity.attacking
		// ) {
		// 	const excessDamage = -deadEntity.health;
		// 	deadEntity.lastAffectedByEntity.attacking = false;
		// 	const neighbours = getNeighbours(boardWithDeadEntity, null, boardWithDeadEntity.length - deadEntityIndexFromRight);
		// 	neighbours.forEach((neighbour) =>
		// 		dealDamageToEnemy(
		// 			neighbour,
		// 			boardWithDeadEntity,
		// 			boardWithDeadEntityHero,
		// 			deadEntity.lastAffectedByEntity,
		// 			excessDamage,
		// 			otherBoard,
		// 			otherBoardHero,
		// 			allCards,
		// 			cardsData,
		// 			sharedState,
		// 			spectator,
		// 		),
		// 	);
		// }
		else if (deadEntity.lastAffectedByEntity.cardId === CardIds.IronhideDirehorn_TRL_232) {
			const newEntities = spawnEntities(
				CardIds.IronhideDirehorn_IronhideRuntToken_TRL_232t,
				1,
				otherBoard,
				otherBoardHero,
				boardWithDeadEntity,
				boardWithDeadEntityHero,
				allCards,
				cardsData,
				sharedState,
				spectator,
				!deadEntity.friendly,
				true,
			);
			otherBoard.splice(otherBoard.length - deadEntityIndexFromRight, 0, ...newEntities);
		} else if (deadEntity.lastAffectedByEntity.cardId === CardIds.IronhideDirehorn_TB_BaconUps_051) {
			const newEntities = spawnEntities(
				CardIds.IronhideDirehorn_IronhideRuntToken_TB_BaconUps_051t,
				1,
				otherBoard,
				otherBoardHero,
				boardWithDeadEntity,
				boardWithDeadEntityHero,
				allCards,
				cardsData,
				sharedState,
				spectator,
				!deadEntity.friendly,
				true,
			);
			otherBoard.splice(otherBoard.length - deadEntityIndexFromRight, 0, ...newEntities);
		} else if (deadEntity.lastAffectedByEntity.cardId === CardIds.SeabreakerGoliath_BGS_080) {
			const otherPirates = otherBoard
				.filter((entity) => isCorrectTribe(allCards.getCard(entity.cardId).races, Race.PIRATE))
				.filter((entity) => entity.entityId !== deadEntity.lastAffectedByEntity.entityId);
			otherPirates.forEach((pirate) => {
				modifyAttack(pirate, 2, boardWithDeadEntity, allCards);
				modifyHealth(pirate, 2, boardWithDeadEntity, allCards);
				afterStatsUpdate(pirate, boardWithDeadEntity, allCards);
				spectator.registerPowerTarget(deadEntity.lastAffectedByEntity, pirate, otherBoard);
			});
		} else if (deadEntity.lastAffectedByEntity.cardId === CardIds.SeabreakerGoliath_TB_BaconUps_142) {
			const otherPirates = otherBoard
				.filter((entity) => isCorrectTribe(allCards.getCard(entity.cardId).races, Race.PIRATE))
				.filter((entity) => entity.entityId !== deadEntity.lastAffectedByEntity.entityId);
			otherPirates.forEach((pirate) => {
				modifyAttack(pirate, 4, boardWithDeadEntity, allCards);
				modifyHealth(pirate, 4, boardWithDeadEntity, allCards);
				afterStatsUpdate(pirate, boardWithDeadEntity, allCards);
				spectator.registerPowerTarget(deadEntity.lastAffectedByEntity, pirate, otherBoard);
			});
		}
	}
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
	}
	for (let i = 0; i < board1.length; i++) {
		dealDamageToEnemy(
			board1[i],
			board1,
			board1Hero,
			damageSource,
			damageDealt,
			board2,
			board2Hero,
			allCards,
			cardsData,
			sharedState,
			spectator,
		);
	}
	for (let i = 0; i < board2.length; i++) {
		dealDamageToEnemy(
			board2[i],
			board2,
			board2Hero,
			damageSource,
			damageDealt,
			board1,
			board1Hero,
			allCards,
			cardsData,
			sharedState,
			spectator,
		);
	}
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
	const jugglers = boardWithJugglers.filter((entity) => entity.cardId === CardIds.SoulJuggler_BGS_002);
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
	const goldenJugglers = boardWithJugglers.filter((entity) => entity.cardId === CardIds.SoulJuggler_TB_BaconUps_075);
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
	// processMinionDeath(
	// 	boardWithJugglers,
	// 	boardWithJugglersHero,
	// 	boardToAttack,
	// 	boardToAttackHero,
	// 	allCards,
	// 	cardsData,
	// 	sharedState,
	// 	spectator,
	// );
};

const applyScavengingHyenaEffect = (board: BoardEntity[], allCards: AllCardsService, spectator: Spectator): void => {
	// const copy = [...board];
	for (let i = 0; i < board.length; i++) {
		if (board[i].cardId === CardIds.ScavengingHyenaLegacy_BG_EX1_531) {
			modifyAttack(board[i], 2, board, allCards);
			modifyHealth(board[i], 1, board, allCards);
			afterStatsUpdate(board[i], board, allCards);
			spectator.registerPowerTarget(board[i], board[i], board);
		} else if (board[i].cardId === CardIds.ScavengingHyenaLegacy_TB_BaconUps_043) {
			modifyAttack(board[i], 4, board, allCards);
			modifyHealth(board[i], 2, board, allCards);
			afterStatsUpdate(board[i], board, allCards);
			spectator.registerPowerTarget(board[i], board[i], board);
		}
	}
};

const applyEternalKnightEffect = (board: BoardEntity[], allCards: AllCardsService, spectator: Spectator): void => {
	for (let i = 0; i < board.length; i++) {
		if (
			board[i].cardId === CardIds.EternalKnight_BG25_008 ||
			board[i].cardId === CardIds.EternalKnight_BG25_008_G
		) {
			const multiplier = board[i].cardId === CardIds.EternalKnight_BG25_008_G ? 2 : 1;
			modifyAttack(board[i], multiplier * 1, board, allCards);
			modifyHealth(board[i], multiplier * 1, board, allCards);
			afterStatsUpdate(board[i], board, allCards);
			spectator.registerPowerTarget(board[i], board[i], board);
		}
	}
};

const applyRotHideGnollEffect = (board: BoardEntity[], allCards: AllCardsService, spectator: Spectator): void => {
	for (let i = 0; i < board.length; i++) {
		if (board[i].cardId === CardIds.RotHideGnoll_BG25_013 || board[i].cardId === CardIds.RotHideGnoll_BG25_013_G) {
			const multiplier = board[i].cardId === CardIds.RotHideGnoll_BG25_013_G ? 2 : 1;
			modifyAttack(board[i], multiplier * 1, board, allCards);
			afterStatsUpdate(board[i], board, allCards);
			spectator.registerPowerTarget(board[i], board[i], board);
		}
	}
};

const applyBristlemaneScrapsmithEffect = (
	board: BoardEntity[],
	boardPlayerEntity: BgsPlayerEntity,
	allCards: AllCardsService,
	spectator: Spectator,
): void => {
	for (let i = 0; i < board.length; i++) {
		if (
			board[i].cardId === CardIds.BristlemaneScrapsmith_BG24_707 ||
			board[i].cardId === CardIds.BristlemaneScrapsmith_BG24_707_G
		) {
			const cardsToAdd = Array(CardIds.BristlemaneScrapsmith_BG24_707_G ? 2 : 1).fill(CardIds.BloodGem);
			addCardsInHand(boardPlayerEntity, board, allCards, spectator, cardsToAdd);
			spectator.registerPowerTarget(board[i], board[i], board);
		}
	}
};

const applyJunkbotEffect = (board: BoardEntity[], allCards: AllCardsService, spectator: Spectator): void => {
	for (let i = 0; i < board.length; i++) {
		if (board[i].cardId === CardIds.Junkbot_GVG_106) {
			modifyAttack(board[i], 2, board, allCards);
			modifyHealth(board[i], 2, board, allCards);
			afterStatsUpdate(board[i], board, allCards);
			spectator.registerPowerTarget(board[i], board[i], board);
		} else if (board[i].cardId === CardIds.Junkbot_TB_BaconUps_046) {
			modifyAttack(board[i], 4, board, allCards);
			modifyHealth(board[i], 4, board, allCards);
			afterStatsUpdate(board[i], board, allCards);
			spectator.registerPowerTarget(board[i], board[i], board);
		}
	}
};

const applyQirajiHarbringerEffect = (
	board: BoardEntity[],
	deadEntityIndexFromRight: number,
	allCards: AllCardsService,
	spectator: Spectator,
): void => {
	const qiraji = board.filter((entity) => entity.cardId === CardIds.QirajiHarbinger_BGS_112);
	const goldenQiraji = board.filter((entity) => entity.cardId === CardIds.QirajiHarbinger_TB_BaconUps_303);
	const neighbours = getNeighbours(board, null, deadEntityIndexFromRight);

	// TODO: if reactivated, properly apply buffs one by one, instead of all together
	neighbours.forEach((entity) => {
		modifyAttack(entity, 2 * qiraji.length + 4 * goldenQiraji.length, board, allCards);
		modifyHealth(entity, 2 * qiraji.length + 4 * goldenQiraji.length, board, allCards);
		afterStatsUpdate(entity, board, allCards);
	});
};

export const applyMonstrosity = (
	monstrosity: BoardEntity,
	deadEntities: readonly BoardEntity[],
	boardWithDeadEntities: BoardEntity[],
	allCards: AllCardsService,
): void => {
	for (const deadEntity of deadEntities) {
		modifyAttack(monstrosity, deadEntity.attack, boardWithDeadEntities, allCards);
		if (monstrosity.cardId === CardIds.Monstrosity_BG20_HERO_282_Buddy_G) {
			modifyAttack(monstrosity, deadEntity.attack, boardWithDeadEntities, allCards);
		}
	}
};

export const rememberDeathrattles = (
	fish: BoardEntity,
	deadEntities: readonly BoardEntity[],
	cardsData: CardsData,
	allCards: AllCardsService,
	sharedState: SharedState,
): void => {
	const validDeathrattles = deadEntities
		.filter((entity) => cardsData.validDeathrattles.includes(entity.cardId) || isFish(entity))
		.map((entity) => ({ cardId: entity.cardId, repeats: 1, timing: sharedState.currentEntityId++ }));
	const validEnchantments = deadEntities
		.filter((entity) => entity.enchantments?.length)
		.map((entity) => entity.enchantments)
		.reduce((a, b) => a.concat(b), [])
		.flatMap((enchantment) => ({
			cardId: enchantment.cardId,
			repeats: enchantment.repeats ?? 1,
			timing: sharedState.currentEntityId++,
		}))
		.filter((enchantment) =>
			[
				CardIds.ReplicatingMenace_ReplicatingMenaceEnchantment_BG_BOT_312e,
				CardIds.ReplicatingMenace_ReplicatingMenaceEnchantment_TB_BaconUps_032e,
				CardIds.Leapfrogger_LeapfrogginEnchantment_BG21_000e,
				CardIds.Leapfrogger_LeapfrogginEnchantment_BG21_000_Ge,
				CardIds.LivingSpores_LivingSporesEnchantment,
				CardIds.SneedsReplicator_ReplicateEnchantment,
				CardIds.EarthInvocation_ElementEarthEnchantment,
				CardIds.FireInvocation_ElementFireEnchantment,
				CardIds.WaterInvocation_ElementWaterEnchantment,
				CardIds.LightningInvocation,
			].includes(enchantment.cardId as CardIds),
		);
	// Multiple fish
	const deadEntityRememberedDeathrattles =
		deadEntities.filter((e) => !!e.rememberedDeathrattles?.length).flatMap((e) => e.rememberedDeathrattles) ?? [];
	const newDeathrattles = [...validDeathrattles, ...validEnchantments, ...deadEntityRememberedDeathrattles];
	// Order is important - the DR are triggered in the ordered the minions have died
	// console.log(
	// 	'remembering deathrattle',
	// 	'\n',
	// 	stringifySimpleCard(fish, allCards),
	// 	'\n',
	// 	stringifySimple(deadEntities, allCards),
	// 	'\n',
	// 	fish.rememberedDeathrattles,
	// );
	if (isGolden(fish.cardId, allCards)) {
		// https://stackoverflow.com/questions/33305152/how-to-duplicate-elements-in-a-js-array
		const doubleDr = newDeathrattles.reduce((res, current) => res.concat([current, current]), []);
		fish.rememberedDeathrattles = [...(fish.rememberedDeathrattles || []), ...doubleDr];
	} else {
		fish.rememberedDeathrattles = [...(fish.rememberedDeathrattles || []), ...newDeathrattles];
	}
	// console.log('remembering deathrattle after', '\n', fish.rememberedDeathrattles);
};

const removeOldMurkEyeAttack = (boardWithDeadEntity: BoardEntity[], allCards: AllCardsService) => {
	const murkeyes = boardWithDeadEntity.filter(
		(entity) => entity.cardId === CardIds.OldMurkEyeLegacy || entity.cardId === CardIds.OldMurkEyeVanilla,
	);
	const goldenMurkeyes = boardWithDeadEntity.filter((entity) => entity.cardId === CardIds.OldMurkEye);
	murkeyes.forEach((entity) => {
		modifyAttack(entity, -1, boardWithDeadEntity, allCards);
		afterStatsUpdate(entity, boardWithDeadEntity, allCards);
	});
	goldenMurkeyes.forEach((entity) => {
		modifyAttack(entity, -2, boardWithDeadEntity, allCards);
		afterStatsUpdate(entity, boardWithDeadEntity, allCards);
	});
};
