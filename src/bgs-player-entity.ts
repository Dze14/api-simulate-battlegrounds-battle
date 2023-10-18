import { BoardEntity } from './board-entity';

export interface BgsPlayerEntity {
	readonly cardId: string;
	readonly nonGhostCardId?: string;
	readonly hpLeft: number;
	readonly tavernTier: number;
	readonly heroPowerId?: string | undefined | null;
	readonly heroPowerUsed: boolean;
	readonly heroPowerInfo?: number;
	readonly heroPowerInfo2?: number;
	entityId?: number;
	questRewards?: readonly string[];
	questRewardEntities?: readonly {
		cardId: string;
		avengeDefault?: number;
		avengeCurrent?: number;
	}[];
	hand?: BoardEntity[];
	avengeCurrent?: number;
	avengeDefault?: number;
	globalInfo?: BgsPlayerGlobalInfo;

	deadEyeDamageDone?: number;
	rapidReanimationMinion?: BoardEntity;
	rapidReanimationIndexFromRight?: number;
}

export interface BgsPlayerGlobalInfo {
	EternalKnightsDeadThisGame?: number;
	UndeadAttackBonus?: number;
	ChoralAttackBuff?: number;
	ChoralHealthBuff?: number;
	FrostlingBonus?: number;
	BloodGemAttackBonus?: number;
	BloodGemHealthBonus?: number;
	GoldrinnBuff?: number;
}
